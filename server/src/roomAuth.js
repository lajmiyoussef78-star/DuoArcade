/**
 * Room membership authorization for join-room.
 * Uses the caller's JWT so RLS applies (member can see their own duo / friend match).
 */
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { log } from './logger.js';

export async function assertRoomMembership({ token, userId, code, kind }) {
  if (!config.roomAuth) {
    return { ok: true, skipped: true };
  }
  if (!token || !userId || !code) {
    return { ok: false, error: 'missing_auth_context' };
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    log.warn('room auth skipped — missing supabase config');
    return { ok: true, skipped: true };
  }

  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (kind === 'friend') {
      const { data, error } = await client
        .from('friend_matches')
        .select('code, host_id, guest_id')
        .eq('code', code)
        .maybeSingle();
      if (error) {
        log.warn('room auth friend query error', { code, error: error.message });
        // Fail open on infra/RLS misconfig so existing friend flows keep working.
        return { ok: true, skipped: true, softError: error.message };
      }
      if (!data) return { ok: false, error: 'not_a_member' };
      if (data.host_id !== userId && data.guest_id !== userId) {
        return { ok: false, error: 'not_a_member' };
      }
      return { ok: true };
    }

    const { data, error } = await client
      .from('duos')
      .select('code, member_a, member_b')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      log.warn('room auth duo query error', { code, error: error.message });
      return { ok: true, skipped: true, softError: error.message };
    }
    if (!data) return { ok: false, error: 'not_a_member' };
    if (data.member_a !== userId && data.member_b !== userId) {
      return { ok: false, error: 'not_a_member' };
    }
    return { ok: true };
  } catch (e) {
    log.warn('room auth exception', { code, error: String(e?.message || e) });
    return { ok: true, skipped: true, softError: String(e?.message || e) };
  }
}
