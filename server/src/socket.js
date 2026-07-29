import { Server } from 'socket.io';
import { config } from './config.js';
import { log } from './logger.js';
import { isSoccerGame, parseJoinPayload, roomName } from './rooms.js';
import { createJwtAuthMiddleware } from './auth.js';
import { assertRoomMembership } from './roomAuth.js';
import { validateRelayPayload } from './payload.js';
import {
  isSoccerProtocolKind,
  MicroSoccerRooms,
  validateSoccerClientMessage,
} from './microSoccerRooms.js';

/**
 * Socket.IO game relay — Step 3 (JWT + room membership + payload gate).
 *
 * Event contract (matches sync.rt() / client adapter):
 *   join-room   → { code, kind?: 'duo'|'friend', game?, matchId? }
 *   leave-room
 *   m           → relay ordinary games; intercept authoritative soccer protocol
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

  const soccerRooms = new MicroSoccerRooms({
    snapshotHz: config.soccerSnapshotHz,
    inputTimeoutMs: config.soccerInputTimeoutMs,
    inputRateLimit: config.soccerInputRateLimit,
    disconnectGraceMs: config.soccerDisconnectGraceMs,
    finishedRetentionMs: config.soccerFinishedRetentionMs,
    emit(socketId, payload) {
      io.to(socketId).emit('m', payload);
    },
  });
  io.soccerRooms = soccerRooms;

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
    socket.data.game = null;
    socket.data.matchId = null;
    socket.data.soccerJoined = false;

    const detachSoccer = () => {
      if (!socket.data.soccerJoined) return;
      soccerRooms.disconnect({
        room: socket.data.room,
        matchId: socket.data.matchId,
        role: socket.data.role,
        socketId: socket.id,
      });
      socket.data.soccerJoined = false;
    };

    socket.emit('server:hello', {
      ok: true,
      service: 'duoarcade-game-server',
      step: 4,
      userId: socket.data.userId,
      roomAuth: config.roomAuth,
      events: ['join-room', 'leave-room', 'm', 'latency:ping', 'latency:pong'],
      authoritativeGames: ['microsoccer'],
    });

    socket.on('join-room', async (payload, ack) => {
      try {
        const { code, kind, game, matchId } = parseJoinPayload(payload);
        const authoritativeSoccer = isSoccerGame(game);
        const room = roomName(code, kind);
        if (!room) {
          const err = { ok: false, error: 'missing_code' };
          if (typeof ack === 'function') ack(err);
          return;
        }
        if (authoritativeSoccer
          && !validateSoccerClientMessage({ k: 'soccer:join', matchId }).ok) {
          const err = { ok: false, error: 'invalid_match_id' };
          if (typeof ack === 'function') ack(err);
          return;
        }

        const membership = await assertRoomMembership({
          token: socket.data.accessToken,
          userId: socket.data.userId,
          code,
          kind,
          requireAuthoritativeRole: authoritativeSoccer,
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

        detachSoccer();
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
        socket.data.game = game || null;
        socket.data.matchId = matchId || null;
        socket.data.role = membership.role || null;

        const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
        log.info('client joined room', {
          id: socket.id,
          userId: socket.data.userId,
          room,
          kind,
          game: game || null,
          matchId: matchId || null,
          role: socket.data.role,
          occupants: size,
          roomAuth: membership.skipped ? 'skipped' : 'ok',
        });

        const ok = {
          ok: true,
          room,
          code,
          kind,
          game: game || null,
          matchId: matchId || null,
          role: socket.data.role,
          occupants: size,
        };
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
        detachSoccer();
        socket.leave(room);
        log.info('client left room', { id: socket.id, room });
        socket.data.room = null;
        socket.data.code = null;
        socket.data.kind = null;
        socket.data.role = null;
        socket.data.game = null;
        socket.data.matchId = null;
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
      if (isSoccerProtocolKind(payload.k)) {
        if (!isSoccerGame(socket.data.game)
          || !socket.data.matchId
          || !socket.data.role
          || payload.matchId !== socket.data.matchId) {
          log.warn('soccer message dropped — invalid room context', {
            id: socket.id,
            room,
            kind: payload.k,
          });
          return;
        }
        const validated = validateSoccerClientMessage(payload);
        if (!validated.ok) {
          log.warn('soccer message dropped — invalid protocol payload', {
            id: socket.id,
            room,
            kind: payload.k,
            error: validated.error,
          });
          return;
        }
        let result;
        if (validated.value.k === 'soccer:join') {
          result = soccerRooms.join({
            room,
            matchId: socket.data.matchId,
            role: socket.data.role,
            userId: socket.data.userId,
            socketId: socket.id,
          });
          socket.data.soccerJoined = result.ok;
        } else {
          result = soccerRooms.receiveInput({
            room,
            matchId: socket.data.matchId,
            role: socket.data.role,
            socketId: socket.id,
            seq: validated.value.seq,
            keys: validated.value.keys,
          });
        }
        if (!result.ok) {
          log.warn('soccer message rejected', {
            id: socket.id,
            room,
            kind: payload.k,
            error: result.error,
          });
        }
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
      detachSoccer();
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
    soccer: soccerRooms.metrics(),
  });

  return io;
}
