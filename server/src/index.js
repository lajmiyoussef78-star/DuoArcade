import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { log } from './logger.js';
import { attachSocketServer } from './socket.js';

const app = express();
let soccerRooms = null;

app.use(cors({
  origin(origin, cb) {
    // Allow non-browser tools (no Origin) and configured Vite/dev origins.
    if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'duoarcade-game-server',
    step: 4,
    jwtAuthConfigured: !!(config.supabaseUrl && config.supabaseAnonKey),
    roomAuth: config.roomAuth,
    authoritativeSoccer: soccerRooms?.metrics() ?? null,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.get('/', (_req, res) => {
  res.type('text').send('DuoArcade game server (Socket.IO) — authoritative Micro Soccer enabled.');
});

const httpServer = http.createServer(app);
const io = attachSocketServer(httpServer);
soccerRooms = io.soccerRooms;

httpServer.listen(config.port, config.host, () => {
  log.info('HTTP + Socket.IO listening', {
    host: config.host,
    port: config.port,
    health: `http://127.0.0.1:${config.port}/health`,
  });
});
