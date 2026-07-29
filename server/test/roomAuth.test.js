import assert from 'node:assert/strict';
import test from 'node:test';
import { authoritativeRoleForMember } from '../src/roomAuth.js';
import { parseJoinPayload } from '../src/rooms.js';

test('derives duo and friend roles only from authenticated member IDs', () => {
  assert.equal(authoritativeRoleForMember({
    member_a: 'user-a',
    member_b: 'user-b',
  }, 'user-a', 'duo'), 'A');
  assert.equal(authoritativeRoleForMember({
    member_a: 'user-a',
    member_b: 'user-b',
  }, 'user-b', 'duo'), 'B');
  assert.equal(authoritativeRoleForMember({
    host_id: 'host',
    guest_id: 'guest',
  }, 'guest', 'friend'), 'B');
  assert.equal(authoritativeRoleForMember({
    host_id: 'host',
    guest_id: 'guest',
  }, 'intruder', 'friend'), null);
});

test('join payload carries game and match ID but discards client role claims', () => {
  const parsed = parseJoinPayload({
    code: 'DUO123',
    kind: 'duo',
    game: 'MicroSoccer',
    matchId: 'match-1',
    role: 'B',
  });
  assert.deepEqual(parsed, {
    code: 'DUO123',
    kind: 'duo',
    game: 'microsoccer',
    matchId: 'match-1',
  });
  assert.equal('role' in parsed, false);
});
