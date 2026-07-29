/**
 * Room membership authorization for join-room.
 * Uses the caller's JWT so RLS applies (member can see their own duo / friend match).
 */
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { log } from './logger.js';

export function authoritativeRoleForMember(record, userId, kind) {
  if (!record || !userId) return null;
  if (kind === 'friend') {
    if (record.host_id === userId) return 'A';
    if (record.guest_id === userId) return 'B';
    return null;
  }
  if (record.member_a === userId) return 'A';
  if (record.member_b === userId) return 'B';
  return null;
}

export async function assertRoomMembership({
  token,
  userId,
  code,
  kind,
  requireAuthoritativeRole = false,
}) {
  if (!config.roomAuth) {
    if (requireAuthoritativeRole) {
      return { ok: false, error: 'authoritative_room_auth_required' };
    }
    return { ok: true, skipped: true };
  }
  if (!token || !userId || !code) {
    return { ok: false, error: 'missing_auth_context' };
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    log.warn('room auth unavailable — missing supabase config');
    if (requireAuthoritativeRole) {
      return { ok: false, error: 'room_auth_unavailable' };
    }
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
        if (requireAuthoritativeRole) {
          return { ok: false, error: 'room_auth_failed' };
        }
        // Existing non-authoritative relay rooms retain their compatibility behavior.
        return { ok: true, skipped: true, softError: error.message };
      }
      if (!data) return { ok: false, error: 'not_a_member' };
      const role = authoritativeRoleForMember(data, userId, kind);
      if (role) return { ok: true, role };
      return { ok: false, error: 'not_a_member' };
    }

    const { data, error } = await client
      .from('duos')
      .select('code, member_a, member_b')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      log.warn('room auth duo query error', { code, error: error.message });
      if (requireAuthoritativeRole) {
        return { ok: false, error: 'room_auth_failed' };
      }
      return { ok: true, skipped: true, softError: error.message };
    }
    if (!data) return { ok: false, error: 'not_a_member' };
    const role = authoritativeRoleForMember(data, userId, kind);
    if (role) return { ok: true, role };
    return { ok: false, error: 'not_a_member' };
  } catch (e) {
    log.warn('room auth exception', { code, error: String(e?.message || e) });
    if (requireAuthoritativeRole) {
      return { ok: false, error: 'room_auth_failed' };
    }
    return { ok: true, skipped: true, softError: String(e?.message || e) };
  }
}
