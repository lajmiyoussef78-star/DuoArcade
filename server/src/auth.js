import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { log } from './logger.js';

let sb = null;

function getSupabase() {
  if (sb) return sb;
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for JWT validation');
  }
  sb = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return sb;
}

/**
 * Socket.IO middleware: verify Supabase access token from handshake.auth.token.
 * Uses getClaims (JWKS / local verify) so valid JWTs are accepted even when the
 * Auth session row is gone — getUser() fails with "session_id claim … does not exist".
 * Does NOT check duo/friend room membership (authorization deferred).
 */
export function createJwtAuthMiddleware() {
  return async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token || typeof token !== 'string') {
        log.warn('auth rejected — missing token', { id: socket.id });
        return next(new Error('unauthorized'));
      }

      const client = getSupabase();
      const { data, error } = await client.auth.getClaims(token);
      const claims = data?.claims;
      const userId = typeof claims?.sub === 'string' ? claims.sub : null;

      if (error || !userId) {
        log.warn('auth rejected — invalid JWT', {
          id: socket.id,
          error: error?.message || 'no_sub',
        });
        return next(new Error('unauthorized'));
      }

      socket.data.userId = userId;
      socket.data.userEmail = typeof claims.email === 'string' ? claims.email : null;
      socket.data.accessToken = token;
      log.info('auth ok', { id: socket.id, userId });
      return next();
    } catch (e) {
      log.error('auth middleware error', { id: socket.id, error: String(e?.message || e) });
      return next(new Error('unauthorized'));
    }
  };
}
