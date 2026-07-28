import { Server } from 'socket.io';
import { config } from './config.js';
import { log } from './logger.js';
import { parseJoinPayload, roomName } from './rooms.js';
import { createJwtAuthMiddleware } from './auth.js';
import { assertRoomMembership } from './roomAuth.js';
import { validateRelayPayload } from './payload.js';

/**
 * Socket.IO game relay — Step 3 (JWT + room membership + payload gate).
 *
 * Event contract (matches sync.rt() / client adapter):
 *   join-room   → { code, kind?: 'duo'|'friend', role?: 'A'|'B' }
 *   leave-room
 *   m           → relay game payload as-is (no mutation, no self-echo)
 *   latency:ping / latency:pong
 */

export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: config.pingIntervalMs,
    pingTimeout: config.pingTimeoutMs,
  });

  io.use(createJwtAuthMiddleware());

  io.on('connection', socket => {
    log.info('client connected', {
      id: socket.id,
      userId: socket.data.userId,
      origin: socket.handshake.headers.origin || null,
    });

    socket.data.room = null;
    socket.data.role = null;
    socket.data.code = null;
    socket.data.kind = null;

    socket.emit('server:hello', {
      ok: true,
      service: 'duoarcade-game-server',
      step: 3,
      userId: socket.data.userId,
      roomAuth: config.roomAuth,
      events: ['join-room', 'leave-room', 'm', 'latency:ping', 'latency:pong'],
    });

    socket.on('join-room', async (payload, ack) => {
      try {
        const { code, kind, role } = parseJoinPayload(payload);
        const room = roomName(code, kind);
        if (!room) {
          const err = { ok: false, error: 'missing_code' };
          if (typeof ack === 'function') ack(err);
          return;
        }

        const membership = await assertRoomMembership({
          token: socket.data.accessToken,
          userId: socket.data.userId,
          code,
          kind,
        });
        if (!membership.ok) {
          log.warn('join-room rejected — not a member', {
            id: socket.id,
            userId: socket.data.userId,
            code,
            kind,
            error: membership.error,
          });
          const err = { ok: false, error: membership.error || 'not_a_member' };
          if (typeof ack === 'function') ack(err);
          return;
        }

        if (socket.data.room && socket.data.room !== room) {
          socket.leave(socket.data.room);
          log.info('client left previous room', {
            id: socket.id,
            room: socket.data.room,
          });
        }

        socket.join(room);
        socket.data.room = room;
        socket.data.code = code;
        socket.data.kind = kind;
        socket.data.role = role;

        const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
        log.info('client joined room', {
          id: socket.id,
          userId: socket.data.userId,
          room,
          kind,
          role,
          occupants: size,
          roomAuth: membership.skipped ? 'skipped' : 'ok',
        });

        const ok = { ok: true, room, code, kind, role, occupants: size };
        if (typeof ack === 'function') ack(ok);
        socket.emit('room:joined', ok);
      } catch (e) {
        log.error('join-room failed', { id: socket.id, error: String(e?.message || e) });
        if (typeof ack === 'function') ack({ ok: false, error: 'join_failed' });
      }
    });

    socket.on('leave-room', (_payload, ack) => {
      const room = socket.data.room;
      if (room) {
        socket.leave(room);
        log.info('client left room', { id: socket.id, room });
        socket.data.room = null;
        socket.data.code = null;
        socket.data.kind = null;
        socket.data.role = null;
      }
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('m', payload => {
      const room = socket.data.room;
      if (!room) {
        log.warn('m dropped — not in a room', { id: socket.id });
        return;
      }
      const gate = validateRelayPayload(payload);
      if (!gate.ok) {
        log.warn('m dropped — invalid payload', {
          id: socket.id,
          room,
          error: gate.error,
          size: gate.size,
        });
        return;
      }
      socket.to(room).emit('m', payload);
    });

    socket.on('latency:ping', payload => {
      const t = payload && typeof payload === 'object' ? payload.t : payload;
      socket.emit('latency:pong', {
        t,
        serverTime: Date.now(),
      });
    });

    socket.on('disconnect', reason => {
      log.info('client disconnected', {
        id: socket.id,
        userId: socket.data.userId,
        reason,
        room: socket.data.room,
        role: socket.data.role,
      });
    });
  });

  log.info('Socket.IO attached', {
    corsOrigins: config.corsOrigins,
    pingIntervalMs: config.pingIntervalMs,
    pingTimeoutMs: config.pingTimeoutMs,
    jwtAuth: !!(config.supabaseUrl && config.supabaseAnonKey),
    roomAuth: config.roomAuth,
    maxPayloadBytes: config.maxPayloadBytes,
  });

  return io;
}
