// sync.js — DuoArcade Phase 2+3 sync layer: accounts + duos + realtime.
//
//   auth.signUp(email, pw) / auth.signIn(email, pw) / auth.signOut()
//   auth.user()                 -> { id, email } | null (after init)
//   listMyDuos()                -> [duo]
//   createDuo({nameA, nameB})   -> { code, hostToken, guestToken, shareUrl, duo }
//   openDuo(code, token|null)   -> { duo, role }   (server decides role;
//                                   signed-in guests auto-claim their seat)
//   onDuo(cb); updateDuo(code, patch, {guardTurn, force})

import { CONFIG } from './config.js';

function shareUrlFor(code, token) {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('duo', code);
  url.searchParams.set('t', token);
  return url.toString();
}

function normalize(row) {
  return {
    code: row.code,
    nameA: row.name_a, nameB: row.name_b,
    memberA: row.member_a ?? null,
    memberB: row.member_b ?? null,
    records: row.records ?? {},
    evenings: row.evenings ?? 0,
    streak: row.streak ?? 0,
    bestStreak: row.best_streak ?? 0,
    tasteAgree: row.taste_agree ?? 0,
    tasteTotal: row.taste_total ?? 0,
    lastDay: row.last_day ?? null,
    createdAt: row.created_at ?? null,
    session: row.session ?? null,
    showPublic: row.show_public ?? false,
    passTier: row.pass_tier ?? 'free',
    theme: row.theme ?? null,
    turn: row.turn ?? '-'
  };
}

function denormalize(patch) {
  const out = {};
  if ('records' in patch) out.records = patch.records;
  if ('evenings' in patch) out.evenings = patch.evenings;
  if ('streak' in patch) out.streak = patch.streak;
  if ('bestStreak' in patch) out.best_streak = patch.bestStreak;
  if ('tasteAgree' in patch) out.taste_agree = patch.tasteAgree;
  if ('tasteTotal' in patch) out.taste_total = patch.tasteTotal;
  if ('lastDay' in patch) out.last_day = patch.lastDay;
  if ('session' in patch) out.session = patch.session;
  if ('showPublic' in patch) out.show_public = patch.showPublic;
  if ('theme' in patch) out.theme = patch.theme;
  if ('turn' in patch) out.turn = patch.turn;
  return out;
}

/* ---------------- Supabase backend ---------------- */

async function supabaseSync() {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  let cb = () => {};
  let channel = null;
  let myToken = null;
  let currentUser = null;

  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user ?? null;
  sb.auth.onAuthStateChange((_e, s) => { currentUser = s?.user ?? null; });

  function subscribe(code) {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('duo-' + code)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duos', filter: `code=eq.${code}` },
        payload => cb(normalize(payload.new)))
      .subscribe();
  }

  const rpc = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  };

  return {
    mode: 'supabase',

    auth: {
      user: () => currentUser ? { id: currentUser.id, email: currentUser.email } : null,
      async signUp(email, password) {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        currentUser = data.user ?? null;
        return { needsConfirm: !data.session };
      },
      async signIn(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        currentUser = data.user;
      },
      async signOut() { await sb.auth.signOut(); currentUser = null; }
    },

    async listMyDuos() {
      const rows = await rpc('list_my_duos', {});
      return (rows || []).map(normalize);
    },

    async ensureProfile() { return await rpc('get_or_create_profile', {}); },
    async setUsername(u) { return await rpc('set_username', { p_username: u }); },
    async searchUsers(q) { return await rpc('search_users', { p_query: q }); },
    async getPublicProfile(u) { return await rpc('get_public_profile', { p_username: u }); },
    async redeemPassCode(codeStr, duoCode) { return await rpc('redeem_pass_code', { p_code: codeStr, p_duo_code: duoCode }); },

    async createDuo({ nameA, nameB }) {
      const data = await rpc('create_duo', { p_name_a: nameA, p_name_b: nameB });
      myToken = data.host_token;
      subscribe(data.code);
      const duo = {
        code: data.code, nameA, nameB, records: {},
        evenings: 0, streak: 0, bestStreak: 0, tasteAgree: 0, tasteTotal: 0,
        lastDay: null, session: null, turn: '-'
      };
      return {
        code: data.code, hostToken: data.host_token, guestToken: data.guest_token,
        shareUrl: shareUrlFor(data.code, data.guest_token), duo
      };
    },

    async openDuo(code, token = null) {
      const data = await rpc('open_duo', { p_code: code, p_token: token });
      myToken = token;
      subscribe(code);
      return { duo: normalize(data.duo), role: data.role };
    },

    onDuo(fn) { cb = fn; },

    async fetchDuo(code) {
      const { data, error } = await sb.from('duos').select('*').eq('code', code).single();
      if (error || !data) return null;
      return normalize(data);
    },

    presence(code, role) {
      let pcb = () => {};
      let state = { focused: true };
      let inflight = Promise.resolve();
      const ch = sb.channel('presence-' + code, { config: { presence: { key: role } } });
      const scheduleTrack = () => {
        inflight = inflight.then(async () => {
          await ch.track({ ...state });
          emit();
        }).catch(() => {});
      };
      const emit = () => {
        const st = ch.presenceState();
        const norm = arr => {
          if (!arr || !arr.length) return { online: false, focused: false, place: null, lat: null, lng: null };
          const last = arr[arr.length - 1];
          return {
            online: true,
            focused: last.focused !== false,
            place: last.place || null,
            lat: typeof last.lat === 'number' ? last.lat : null,
            lng: typeof last.lng === 'number' ? last.lng : null
          };
        };
        pcb({ A: norm(st.A), B: norm(st.B) });
      };
      ch.on('presence', { event: 'sync' }, emit)
        .on('presence', { event: 'join' }, emit)
        .on('presence', { event: 'leave' }, emit)
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') scheduleTrack();
        });
      return {
        setFocused: f => { state = { ...state, focused: f }; scheduleTrack(); },
        setGeo: geo => { state = { ...state, ...geo }; scheduleTrack(); },
        onChange: f => { pcb = f; },
        close: () => sb.removeChannel(ch)
      };
    },

    rt(code) {
      let rcb = () => {};
      const ch = sb.channel('rt-' + code, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'm' }, p => rcb(p.payload))
        .subscribe();
      return {
        send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
        on: f => { rcb = f; },
        close: () => sb.removeChannel(ch)
      };
    },

    async updateDuo(code, patch, { guardTurn = null, force = false } = {}) {
      return await rpc('update_duo', {
        p_code: code, p_token: myToken, p_patch: denormalize(patch),
        p_guard_turn: guardTurn, p_force: force
      }) === true;
    }
  };
}

/* -------------- Local demo backend (two tabs, one browser) -------------- */

function localSync() {
  let bc = null;
  let cb = () => {};
  const key = code => 'duoarcade-duo-' + code;
  const read = code => JSON.parse(localStorage.getItem(key(code)) || 'null');
  const write = (code, duo) => localStorage.setItem(key(code), JSON.stringify(duo));

  function randCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function attach(code) {
    if (bc) bc.close();
    bc = new BroadcastChannel('duoarcade-' + code);
    bc.onmessage = e => cb(e.data);
  }
  const blank = (code, nameA, nameB) => ({
    code, nameA, nameB, records: {},
    evenings: 0, streak: 0, bestStreak: 0, tasteAgree: 0, tasteTotal: 0,
    lastDay: null, session: null, turn: '-'
  });

  return {
    mode: 'local',
    auth: {
      user: () => ({ id: 'demo', email: 'demo@this-browser' }),
      async signUp() { return { needsConfirm: false }; },
      async signIn() {}, async signOut() {}
    },
    async listMyDuos() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('duoarcade-duo-')) out.push(JSON.parse(localStorage.getItem(k)));
      }
      return out;
    },
    async createDuo({ nameA, nameB }) {
      const code = randCode();
      const duo = blank(code, nameA, nameB);
      write(code, duo);
      attach(code);
      return { code, hostToken: 'demo-host', guestToken: 'demo-guest',
               shareUrl: shareUrlFor(code, 'demo-guest'), duo };
    },
    async openDuo(code, token = null) {
      const duo = read(code);
      if (!duo) throw new Error('Duo not found (demo duos only exist in this browser)');
      attach(code);
      return { duo, role: token === 'demo-guest' ? 'B' : 'A' };
    },
    onDuo(fn) { cb = fn; },
    async updateDuo(code, patch, { guardTurn = null, force = false } = {}) {
      const duo = read(code);
      if (!duo) return false;
      if (guardTurn && !force && duo.turn !== guardTurn) return false;
      const next = { ...duo, ...patch };
      write(code, next);
      bc.postMessage(next);
      return true;
    }
  };
}

export async function createSync() {
  const configured = CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT');
  if (configured) {
    try { return await supabaseSync(); }
    catch (e) { console.warn('Supabase unavailable, falling back to local demo:', e); }
  }
  return localSync();
}
