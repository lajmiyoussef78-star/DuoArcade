import assert from 'node:assert/strict';
import { createDuoStickmanNet, remapFromKeys } from '../src/lib/duoStickmanNet.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeRtPair() {
  function endpoint(name) {
    const messageListeners = new Set();
    const reconnectListeners = new Set();
    return {
      name,
      sent: [],
      peer: null,
      send(message) {
        const packet = clone(message);
        this.sent.push(packet);
        this.peer.deliver(packet);
      },
      subscribe(fn) {
        messageListeners.add(fn);
        return () => messageListeners.delete(fn);
      },
      subscribeReconnect(fn) {
        reconnectListeners.add(fn);
        return () => reconnectListeners.delete(fn);
      },
      deliver(message) {
        for (const fn of [...messageListeners]) fn(clone(message));
      },
      reconnect(attempt = 1) {
        for (const fn of [...reconnectListeners]) fn(attempt);
      },
      listenerCounts() {
        return {
          messages: messageListeners.size,
          reconnects: reconnectListeners.size,
        };
      },
    };
  }

  const host = endpoint('host');
  const guest = endpoint('guest');
  host.peer = guest;
  guest.peer = host;
  return { host, guest };
}

const pair = createFakeRtPair();
const config = {
  p1Codes: ['KeyA', 'KeyW'],
  p2Codes: ['ArrowLeft', 'ArrowUp'],
  remap: { KeyA: 'ArrowLeft', KeyW: 'ArrowUp' },
};
const host = createDuoStickmanNet({ rt: pair.host, myRole: 'A', ...config });
const guest = createDuoStickmanNet({ rt: pair.guest, myRole: 'B', ...config });

// Guest input is ordered, remapped, and only applied by the host.
const guestKeys = { keys: {}, pressed: {} };
assert.equal(guest.onKeyDown('KeyA', guestKeys), 'ArrowLeft');
guest.netTick(null, () => ({ pose: 1 }));
const firstInput = pair.guest.sent.find((m) => m.k === 'inp');
assert.equal(firstInput.seq, 1);
assert.equal(firstInput.role, 'B');

const hostKeys = { keys: {}, pressed: {} };
assert.deepEqual(host.mergeRemoteInto(hostKeys), []);
assert.equal(hostKeys.keys.ArrowLeft, true);
assert.equal(hostKeys.pressed.ArrowLeft, true);
assert.deepEqual(host.takeRemoteExtra(), { pose: 1 });

guest.onKeyUp('KeyA', guestKeys);
guest.netTick();
assert.deepEqual(host.mergeRemoteInto(hostKeys), ['ArrowLeft']);
assert.equal(hostKeys.keys.ArrowLeft, false);

pair.host.deliver(firstInput);
host.mergeRemoteInto(hostKeys);
assert.equal(hostKeys.keys.ArrowLeft, false, 'stale guest input must not rewind host keys');
assert.equal(host.getMetrics().staleInputDrops, 1);

pair.host.deliver({ k: 'inp', role: 'A', seq: 999, keys: { ArrowLeft: true } });
host.mergeRemoteInto(hostKeys);
assert.equal(hostKeys.keys.ArrowLeft, false, 'host must ignore host-role input packets');

// Existing host state, host-input mirror, trail, UI, and state-read APIs still work.
host.netTick(() => ({ tick: 1 }));
assert.deepEqual(guest.takeState(), { tick: 1 });
assert.deepEqual(guest.peekState(), { tick: 1 });

const hostLocal = { keys: {}, pressed: {} };
host.onKeyDown('KeyW', hostLocal);
host.netTickHostInput();
const guestRemote = { keys: {}, pressed: {} };
guest.mergeRemoteInto(guestRemote);
assert.equal(guestRemote.keys.KeyW, true);

host.sendTrail({ ink: [1, 2, 3], enc: true, n: 4, len: 3 });
assert.deepEqual(guest.takeTrail(), {
  k: 'trail', seq: 1, ink: [1, 2, 3], enc: 1, n: 4, len: 3,
});

const uiEvents = [];
guest.onUi((message) => uiEvents.push(message));
host.sendUi({ type: 'ready', ready: true });
assert.ok(uiEvents.some((m) => m.type === 'ready' && m.ready === true));

const sentBeforeOver = pair.host.sent.length;
host.sendLifecycle('over', { winner: 'A' });
assert.ok(uiEvents.some((m) => m.type === 'over' && m.winner === 'A'));
assert.equal(pair.host.sent.length, sentBeforeOver + 1, 'explicit over is delivered once');

// Guest state ordering rejects duplicate/late snapshots.
pair.host.send({ k: 'st', seq: 10, st: { tick: 10 } });
pair.host.send({ k: 'st', seq: 9, st: { tick: 9 } });
assert.deepEqual(guest.takeState(), { tick: 10 });
assert.deepEqual(guest.peekState(), { tick: 10 });
assert.equal(guest.getMetrics().staleStateDrops, 1);

// A guest reconnect sends critical sync; host replies from its full-state provider.
let currentState = { tick: 20, full: true };
const clearProvider = host.setStateProvider(() => currentState);
guest.clearState();
pair.guest.reconnect(2);
assert.equal(pair.guest.sent.at(-1).k, 'sync');
assert.equal(pair.host.sent.at(-1).full, 1);
assert.deepEqual(guest.takeState(), currentState);

// Host reconnects also force a current full snapshot.
currentState = { tick: 21, full: true };
pair.host.reconnect(3);
assert.deepEqual(guest.takeState(), currentState);
assert.equal(host.forceState({ tick: 22, manual: true }), true);
assert.deepEqual(guest.takeState(), { tick: 22, manual: true });
clearProvider();

// Metrics cover messages, bytes, reconnects, stale drops, and state age.
const hostMetrics = host.getMetrics();
const guestMetrics = guest.getMetrics();
assert.ok(hostMetrics.messagesSent > 0 && hostMetrics.messagesReceived > 0);
assert.ok(guestMetrics.messagesSent > 0 && guestMetrics.messagesReceived > 0);
assert.ok(hostMetrics.bytesSent > 0 && hostMetrics.bytesReceived > 0);
assert.ok(guestMetrics.bytesSent > 0 && guestMetrics.bytesReceived > 0);
assert.equal(hostMetrics.reconnects, 1);
assert.equal(guestMetrics.reconnects, 1);
assert.equal(hostMetrics.staleDrops, 1);
assert.equal(guestMetrics.staleDrops, 1);
assert.ok(Number.isFinite(hostMetrics.stateAgeMs));
assert.ok(Number.isFinite(guestMetrics.stateAgeMs));

// Legacy remap/offline/touch behavior remains available.
assert.deepEqual(
  remapFromKeys({ left: 'KeyA', jump: 'KeyW' }, { left: 'ArrowLeft', jump: 'ArrowUp' }),
  { KeyA: 'ArrowLeft', KeyW: 'ArrowUp' },
);
const offline = createDuoStickmanNet({
  rt: null,
  myRole: null,
  p1Codes: ['KeyA'],
  p2Codes: ['ArrowLeft'],
});
const offlineState = { keys: {}, pressed: {} };
assert.equal(offline.online, false);
assert.equal(offline.isHost, true);
assert.equal(offline.onKeyDown('KeyZ', offlineState), 'KeyZ');
assert.equal(offlineState.keys.KeyZ, true);
offline.touchSet('KeyZ', false, offlineState);
assert.equal(offlineState.keys.KeyZ, false);
assert.deepEqual(offline.mergeRemoteInto(offlineState), []);
assert.equal(offline.forceState({ ignored: true }), false);

// dispose removes both message and reconnect subscriptions.
assert.deepEqual(pair.host.listenerCounts(), { messages: 1, reconnects: 1 });
assert.deepEqual(pair.guest.listenerCounts(), { messages: 1, reconnects: 1 });
host.dispose();
guest.dispose();
const sentBeforeDisposedReconnect = pair.guest.sent.length;
pair.guest.reconnect(4);
assert.equal(pair.guest.sent.length, sentBeforeDisposedReconnect);
assert.deepEqual(pair.host.listenerCounts(), { messages: 0, reconnects: 0 });
assert.deepEqual(pair.guest.listenerCounts(), { messages: 0, reconnects: 0 });

console.log('duoStickmanNet tests passed');
