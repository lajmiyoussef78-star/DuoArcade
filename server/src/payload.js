/**
 * Lightweight relay payload gate — applies to all games on Socket.IO.
 * Rejects non-objects, missing kind, oversized JSON. Does not interpret game logic.
 */

import { config } from './config.js';

export function validateRelayPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'invalid_payload' };
  }
  if (typeof payload.k !== 'string' || !payload.k || payload.k.length > 32) {
    return { ok: false, error: 'invalid_kind' };
  }
  let size = 0;
  try {
    size = JSON.stringify(payload).length;
  } catch {
    return { ok: false, error: 'unserializable' };
  }
  if (size > config.maxPayloadBytes) {
    return { ok: false, error: 'payload_too_large', size };
  }
  return { ok: true, size };
}
