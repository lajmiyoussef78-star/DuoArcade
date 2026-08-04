import 'dotenv/config';

function intEnv(name, fallback) {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

const origins = (process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const config = {
  port: intEnv('PORT', 3001),
  host: process.env.HOST || '0.0.0.0',
  corsOrigins: origins,
  pingIntervalMs: intEnv('PING_INTERVAL_MS', 10_000),
  pingTimeoutMs: intEnv('PING_TIMEOUT_MS', 20_000),
  // Strip trailing slash — Auth JWKS paths break if SUPABASE_URL ends with /.
  supabaseUrl: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  /** Reject join-room unless JWT user is a duo/friend-match member (default on). */
  roomAuth: String(process.env.ROOM_AUTH || '1') !== '0',
  /** Max JSON size for relayed `m` payloads (bytes). */
  maxPayloadBytes: intEnv('MAX_PAYLOAD_BYTES', 16_384),
};
