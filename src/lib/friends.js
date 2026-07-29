// friends.js — Duo Friends RPCs, presence, and friend-match sync.
import { getSupabase } from './supabaseClient.js';
import { ENGINES } from '../engines/index.js';

const FRESH_MS = 25000;
const BEAT_MS = 8000;

const schemaHint = error => {
  const msg = error?.message || String(error);
  if (/friend_requests|friendships|user_presence|friend_matches|list_duo_friend_view|does not exist/i.test(msg)) {
    return new Error('Friends database is not installed yet. Run supabase/schema-v35-friends.sql in Supabase SQL Editor.');
  }
  return new Error(msg);
};

export function isFriendOnline(row) {
  if (!row) return false;
  if (typeof row.online === 'boolean') return row.online;
  if (!row.last_seen) return false;
  return Date.now() - new Date(row.last_seen).getTime() < FRESH_MS;
}

/** Remote-capable engines only (skip same-keyboard couch games). */
export function friendPlayableGames() {
  return Object.values(ENGINES)
    .filter(e => e?.meta?.realtime && !/same\s*keyboard/i.test(e.meta.tag || ''))
    .map(e => ({ id: e.meta.id, name: e.meta.name, tag: e.meta.tag || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeFriendMatch(row) {
  if (!row) return null;
  return {
    code: row.code,
    gameId: row.game_id || row.gameId,
    hostId: row.host_id || row.hostId,
    guestId: row.guest_id || row.guestId,
    session: row.session || {},
    status: row.status,
    winner: row.winner || null,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  };
}

export async function createFriendsClient() {
  const sb = await getSupabase();
  const rpc = async (name, args = {}) => {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw schemaHint(error);
    return data;
  };

  const { data: { session } } = await sb.auth.getSession();
  const user = session?.user ? { id: session.user.id, email: session.user.email } : null;

  let presenceTimer = null;
  let presenceClosed = false;
  let presenceStatus = 'online';
  let presenceBusyLabel = null;
  let presenceMatchCode = null;

  const beatOnce = async () => {
    if (presenceClosed || !user) return;
    try {
      await rpc('user_presence_beat', {
        p_status: presenceStatus,
        p_busy_label: presenceBusyLabel,
        p_match_code: presenceMatchCode
      });
    } catch { /* schema missing or offline — non-fatal */ }
  };

  return {
    user,
    sb,

    async listView() {
      return await rpc('list_duo_friend_view');
    },

    async sendRequest(username) {
      return await rpc('send_friend_request', { p_username: username });
    },

    async respondRequest(id, accept) {
      return await rpc('respond_friend_request', { p_id: id, p_accept: !!accept });
    },

    async cancelRequest(id) {
      return await rpc('cancel_friend_request', { p_id: id });
    },

    async removeFriend(friendId) {
      return await rpc('remove_friend', { p_friend_id: friendId });
    },

    async createMatch(friendId, gameId) {
      return normalizeFriendMatch(await rpc('create_friend_match', {
        p_friend_id: friendId,
        p_game_id: gameId
      }));
    },

    async respondMatch(code, accept) {
      return normalizeFriendMatch(await rpc('respond_friend_match', {
        p_code: code,
        p_accept: !!accept
      }));
    },

    async updateMatchSession(code, session) {
      return normalizeFriendMatch(await rpc('update_friend_match_session', {
        p_code: code,
        p_session: session
      }));
    },

    async endMatch(code, winner = null) {
      return normalizeFriendMatch(await rpc('end_friend_match', {
        p_code: code,
        p_winner: winner
      }));
    },

    async getMatch(code) {
      return normalizeFriendMatch(await rpc('get_friend_match', { p_code: code }));
    },

    async listPendingMatchInvites() {
      const rows = await rpc('list_pending_friend_match_invites');
      return (rows || []).map(normalizeFriendMatch);
    },

    /** Heartbeat for friends/partner busy visibility. */
    startPresence({ status = 'online', busyLabel = null, matchCode = null } = {}) {
      presenceClosed = false;
      presenceStatus = status;
      presenceBusyLabel = busyLabel;
      presenceMatchCode = matchCode;
      beatOnce();
      clearInterval(presenceTimer);
      presenceTimer = setInterval(beatOnce, BEAT_MS);

      const leave = () => {
        try { sb.rpc('user_presence_leave').catch(() => {}); } catch { /* unload */ }
      };
      window.addEventListener('pagehide', leave);

      return {
        setBusy(label, code) {
          presenceStatus = 'busy';
          presenceBusyLabel = label;
          presenceMatchCode = code;
          beatOnce();
        },
        setOnline() {
          presenceStatus = 'online';
          presenceBusyLabel = null;
          presenceMatchCode = null;
          beatOnce();
        },
        setAway() {
          presenceStatus = document.hidden ? 'away' : 'online';
          if (presenceStatus !== 'busy') beatOnce();
        },
        close() {
          presenceClosed = true;
          clearInterval(presenceTimer);
          window.removeEventListener('pagehide', leave);
          leave();
        }
      };
    },

    /** Realtime: friend match invite + request pings on user channel. */
    subscribeInbox(onEvent) {
      if (!user) return () => {};
      const ch = sb.channel('friends-' + user.id)
        .on('broadcast', { event: 'friend' }, payload => onEvent?.(payload.payload))
        .subscribe();
      return () => { try { sb.removeChannel(ch); } catch { /* */ } };
    },

    async notifyUser(userId, payload) {
      if (!userId) return;
      const ch = sb.channel('friends-' + userId);
      await new Promise(resolve => {
        ch.subscribe(status => {
          if (status === 'SUBSCRIBED') resolve();
        });
        setTimeout(resolve, 800);
      });
      try {
        await ch.send({ type: 'broadcast', event: 'friend', payload });
      } finally {
        try { sb.removeChannel(ch); } catch { /* */ }
      }
    },

    /** Postgres changes on a friend match row. */
    subscribeMatch(code, onRow) {
      const ch = sb.channel('friend-match-' + code)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friend_matches',
          filter: `code=eq.${code}`
        }, payload => onRow?.(normalizeFriendMatch(payload.new)))
        .subscribe();
      return () => { try { sb.removeChannel(ch); } catch { /* */ } };
    },

    /** Broadcast channel for realtime engines (same shape as sync.rt). */
    rt(code) {
      let rcb = () => {};
      const ch = sb.channel('friend-rt-' + code, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'm' }, p => rcb(p.payload))
        .subscribe();
      return {
        send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
        on: f => { rcb = f; },
        close: () => { try { sb.removeChannel(ch); } catch { /* */ } }
      };
    }
  };
}
