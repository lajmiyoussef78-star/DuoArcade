import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SOCCER_KINDS,
  SOCCER_PROTOCOL_VERSION,
  sanitizeSoccerInput,
  validateSoccerAck,
  validateSoccerClientMessage,
  validateSoccerJoin,
  validateSoccerMessage,
  validateSoccerOver,
  validateSoccerPaused,
  validateSoccerReject,
  validateSoccerResumed,
  validateSoccerServerMessage,
  validateSoccerSnapshot,
  validateSoccerStart,
} from '../../shared/microSoccerProtocol.js';
import { socInitial } from '../../shared/microSoccerPhysics.js';

const MATCH = 'match-1700000000000';
const KEYS = Object.freeze({
  up: true,
  down: false,
  left: false,
  right: true,
});
const INPUTS_APPLIED = Object.freeze({
  A: { seq: 7, appliedTick: 12, keys: KEYS },
  B: null,
});
const ACKS = Object.freeze({ A: 7, B: null });

function envelope(k, fields = {}) {
  return { v: SOCCER_PROTOCOL_VERSION, k, matchId: MATCH, ...fields };
}

const serverMessages = [
  [
    validateSoccerStart,
    envelope(SOCCER_KINDS.START, {
      tick: 10,
      endTick: 5_400,
      tickHz: 60,
      serverTime: 1_000,
      endAt: 90_000,
    }),
  ],
  [
    validateSoccerAck,
    envelope(SOCCER_KINDS.ACK, {
      seq: 7,
      appliedTick: 12,
      tick: 12,
      keys: KEYS,
    }),
  ],
  [
    validateSoccerSnapshot,
    envelope(SOCCER_KINDS.SNAPSHOT, {
      tick: 12,
      endTick: 5_400,
      tickHz: 60,
      serverTime: 1_200,
      state: socInitial(),
      goal: null,
      inputsApplied: INPUTS_APPLIED,
      acks: ACKS,
    }),
  ],
  [
    validateSoccerPaused,
    envelope(SOCCER_KINDS.PAUSED, {
      tick: 12,
      serverTime: 1_200,
      role: 'B',
      graceMs: 10_000,
    }),
  ],
  [
    validateSoccerResumed,
    envelope(SOCCER_KINDS.RESUMED, {
      tick: 12,
      endTick: 5_400,
      tickHz: 60,
      serverTime: 2_000,
      endAt: 91_800,
    }),
  ],
  [
    validateSoccerOver,
    envelope(SOCCER_KINDS.OVER, {
      tick: 5_400,
      serverTime: 90_000,
      reason: 'time',
      winner: 'A',
      score: { A: 2, B: 1 },
      state: { ...socInitial(), score: { A: 2, B: 1 } },
      inputsApplied: INPUTS_APPLIED,
      acks: ACKS,
    }),
  ],
  [
    validateSoccerReject,
    envelope(SOCCER_KINDS.REJECT, {
      tick: 12,
      seq: 8,
      reason: 'stale_sequence',
    }),
  ],
];

test('protocol v2 client sanitizers are fail-closed and discard client tick claims', () => {
  const join = envelope(SOCCER_KINDS.JOIN);
  assert.deepEqual(validateSoccerJoin(join), validateSoccerClientMessage(join));

  const input = envelope(SOCCER_KINDS.INPUT, {
    seq: 8,
    tick: 999_999,
    clientTick: 999_999,
    keys: KEYS,
  });
  assert.deepEqual(sanitizeSoccerInput(input), {
    v: 2,
    k: SOCCER_KINDS.INPUT,
    matchId: MATCH,
    seq: 8,
    keys: KEYS,
  });
  assert.equal(validateSoccerClientMessage(input).ok, true);
  assert.equal(validateSoccerClientMessage({ ...input, v: 1 }).error, 'unsupported_version');
  assert.equal(validateSoccerClientMessage({ ...input, v: undefined }).error, 'unsupported_version');
  assert.equal(validateSoccerClientMessage({
    ...input,
    keys: { ...KEYS, boost: true },
  }).error, 'invalid_keys');
  assert.equal(validateSoccerClientMessage(serverMessages[0][1]).error, 'server_owned_kind');
});

test('every server protocol shape has individual and generic validator parity', () => {
  for (const [individualValidator, message] of serverMessages) {
    const individual = individualValidator(message);
    const generic = validateSoccerServerMessage(message);
    assert.equal(individual.ok, true, message.k);
    assert.deepEqual(generic, individual, message.k);
    assert.deepEqual(
      validateSoccerMessage(message, { direction: 'server' }),
      individual,
      message.k,
    );
  }
});

test('server protocol rejects malformed metadata and client-owned kinds', () => {
  const snapshot = serverMessages.find(([, message]) =>
    message.k === SOCCER_KINDS.SNAPSHOT)[1];
  assert.equal(validateSoccerSnapshot({
    ...snapshot,
    acks: { A: 7 },
  }).ok, false);
  assert.equal(validateSoccerSnapshot({
    ...snapshot,
    inputsApplied: {
      ...snapshot.inputsApplied,
      A: { ...snapshot.inputsApplied.A, appliedTick: -1 },
    },
  }).ok, false);
  assert.equal(validateSoccerServerMessage(envelope(SOCCER_KINDS.JOIN)).error,
    'client_owned_kind');
});
