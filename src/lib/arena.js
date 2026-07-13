import { CONFIG } from './config.js';

const schemaHint = error => {
  const msg = error?.message || String(error);
  if (/function .* does not exist|arena_matches|arena_queue/i.test(msg)) {
    return new Error('Arena database is not installed yet. Run supabase/schema-v8-arena.sql in Supabase SQL Editor.');
  }
  return new Error(msg);
};

const normalizeDuo = row => ({
  code: row.code,
  nameA: row.name_a,
  nameB: row.name_b,
  memberA: row.member_a,
  memberB: row.member_b,
  theme: row.theme || 'night'
});

export function normalizeMatch(row) {
  if (!row) return null;
  return {
    code: row.code,
    game: row.game,
    duoA: row.duo_a,
    duoB: row.duo_b,
    status: row.status,
    state: row.state || {},
    revision: Number(row.revision || 0),
    winner: row.winner || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    teamA: row.team_a ? {
      nameA: row.team_a.name_a, nameB: row.team_a.name_b, theme: row.team_a.theme
    } : null,
    teamB: row.team_b ? {
      nameA: row.team_b.name_a, nameB: row.team_b.name_b, theme: row.team_b.theme
    } : null
  };
}

export async function createArenaClient() {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  const rpc = async (name, args = {}) => {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw schemaHint(error);
    return data;
  };

  const { data: { session } } = await sb.auth.getSession();

  return {
    user: session?.user ? { id: session.user.id, email: session.user.email } : null,

    async listDuos() {
      const rows = await rpc('list_my_duos');
      return (rows || []).map(normalizeDuo);
    },

    async listMatches() {
      return (await rpc('list_my_arena_matches') || []).map(normalizeMatch);
    },

    async createPrivate(duoCode, game, state) {
      return normalizeMatch(await rpc('create_arena_match', {
        p_duo_code: duoCode, p_game: game, p_state: state
      }));
    },

    async joinPrivate(matchCode, duoCode) {
      return normalizeMatch(await rpc('join_arena_match', {
        p_match_code: matchCode, p_duo_code: duoCode
      }));
    },

    async joinQueue(duoCode, game, state) {
      const data = await rpc('join_arena_queue', {
        p_duo_code: duoCode, p_game: game, p_state: state
      });
      return { ...data, match: normalizeMatch(data?.match) };
    },

    async queueStatus(duoCode) {
      const data = await rpc('arena_queue_status', { p_duo_code: duoCode });
      return { ...data, match: normalizeMatch(data?.match) };
    },

    cancelQueue: duoCode => rpc('cancel_arena_queue', { p_duo_code: duoCode }),

    async openMatch(code) {
      const data = await rpc('open_arena_match', { p_match_code: code });
      return {
        match: normalizeMatch(data.match),
        seat: data.seat,
        teamA: {
          code: data.team_a.code, nameA: data.team_a.name_a,
          nameB: data.team_a.name_b, theme: data.team_a.theme
        },
        teamB: {
          code: data.team_b.code, nameA: data.team_b.name_a,
          nameB: data.team_b.name_b, theme: data.team_b.theme
        }
      };
    },

    async ready(code, revision) {
      return normalizeMatch(await rpc('ready_arena_seat', {
        p_match_code: code, p_expected_revision: revision
      }));
    },

    async move(code, revision, state) {
      return normalizeMatch(await rpc('move_arena_match', {
        p_match_code: code, p_expected_revision: revision, p_state: state
      }));
    },

    async rematch(code, revision, state) {
      return normalizeMatch(await rpc('rematch_arena_match', {
        p_match_code: code, p_expected_revision: revision, p_state: state
      }));
    },

    cancelMatch: code => rpc('cancel_arena_match', { p_match_code: code }),

    subscribe(code, onMatch) {
      const ch = sb.channel('arena-match-' + code)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'arena_matches', filter: `code=eq.${code}`
        }, payload => onMatch(normalizeMatch(payload.new)))
        .subscribe();
      return () => sb.removeChannel(ch);
    },

    presence(code, seat, onChange) {
      const ch = sb.channel('arena-presence-' + code, {
        config: { presence: { key: seat } }
      });
      const emit = () => {
        const raw = ch.presenceState();
        const state = {};
        for (const key of ['A1', 'A2', 'B1', 'B2']) state[key] = !!raw[key]?.length;
        onChange(state);
      };
      ch.on('presence', { event: 'sync' }, emit)
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') await ch.track({ online: true, at: Date.now() });
        });
      return () => sb.removeChannel(ch);
    }
  };
}
