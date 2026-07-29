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
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  /** Reject join-room unless JWT user is a duo/friend-match member (default on). */
  roomAuth: String(process.env.ROOM_AUTH || '1') !== '0',
  /** Max JSON size for relayed `m` payloads (bytes). */
  maxPayloadBytes: intEnv('MAX_PAYLOAD_BYTES', 16_384),
  /** Authoritative Micro Soccer sends one full state every three 60 Hz ticks. */
  soccerSnapshotHz: intEnv('SOCCER_SNAPSHOT_HZ', 20),
  soccerInputTimeoutMs: intEnv('SOCCER_INPUT_TIMEOUT_MS', 250),
  soccerInputRateLimit: intEnv('SOCCER_INPUT_RATE_LIMIT', 40),
  soccerDisconnectGraceMs: intEnv('SOCCER_DISCONNECT_GRACE_MS', 10_000),
  soccerFinishedRetentionMs: intEnv('SOCCER_FINISHED_RETENTION_MS', 30_000),
};
