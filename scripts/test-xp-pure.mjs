// scripts/test-xp-pure.mjs — plain node tests for levelFromXp / titleForLevel
import {
  levelFromXp, titleForLevel, xpToNext, TITLES
} from '../src/lib/xp.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed += 1; console.log('  ok  ' + msg); }
  else { failed += 1; console.log('FAIL  ' + msg); }
}

function eq(a, b) {
  return a === b;
}

console.log('levelFromXp boundaries');
{
  const a = levelFromXp(0);
  assert(eq(a.level, 1) && eq(a.intoLevel, 0) && eq(a.needed, 100), '0 XP -> L1 into 0/100');

  const b = levelFromXp(99);
  assert(eq(b.level, 1) && eq(b.intoLevel, 99) && eq(b.needed, 100), '99 XP -> L1 into 99/100');

  const c = levelFromXp(100);
  assert(eq(c.level, 2) && eq(c.intoLevel, 0) && eq(c.needed, 140), '100 XP -> L2 into 0/140');

  const d = levelFromXp(239);
  assert(eq(d.level, 2) && eq(d.intoLevel, 139) && eq(d.needed, 140), '239 XP -> L2 into 139/140');

  const e = levelFromXp(240);
  assert(eq(e.level, 3) && eq(e.intoLevel, 0) && eq(e.needed, 180), '240 XP -> L3 into 0/180');
}

console.log('xpToNext curve');
assert(eq(xpToNext(1), 100), 'L1->2 costs 100');
assert(eq(xpToNext(2), 140), 'L2->3 costs 140');
assert(eq(xpToNext(3), 180), 'L3->4 costs 180');

console.log('monotonicity 0..100000');
{
  let prev = 0;
  let ok = true;
  for (let xp = 0; xp <= 100000; xp += 17) {
    const { level } = levelFromXp(xp);
    if (level < prev) { ok = false; break; }
    prev = level;
  }
  // also check every exact boundary does not drop
  let sum = 0;
  let lvl = 1;
  while (sum <= 100000) {
    const need = xpToNext(lvl);
    const at = levelFromXp(sum);
    const after = levelFromXp(sum + need);
    if (at.level !== lvl || after.level !== lvl + 1) { ok = false; break; }
    sum += need;
    lvl += 1;
    if (lvl > 500) break;
  }
  assert(ok, 'level never decreases; boundaries promote exactly once');
}

console.log('titleForLevel ladder');
assert(eq(titleForLevel(1), 'New Sparks'), 'L1 New Sparks');
assert(eq(titleForLevel(2), 'New Sparks'), 'L2 New Sparks');
assert(eq(titleForLevel(3), 'Game Night Regulars'), 'L3 Game Night Regulars');
assert(eq(titleForLevel(5), 'Game Night Regulars'), 'L5 Game Night Regulars');
assert(eq(titleForLevel(6), 'Rival Sweethearts'), 'L6 Rival Sweethearts');
assert(eq(titleForLevel(10), 'Partners in Crime'), 'L10 Partners in Crime');
assert(eq(titleForLevel(14), 'Tag Team'), 'L14 Tag Team');
assert(eq(titleForLevel(18), 'Synced Souls'), 'L18 Synced Souls');
assert(eq(titleForLevel(22), 'Arcade Royalty'), 'L22 Arcade Royalty');
assert(eq(titleForLevel(27), 'Dream Duo'), 'L27 Dream Duo');
assert(eq(titleForLevel(33), 'Legendary Lovebirds'), 'L33 Legendary Lovebirds');
assert(eq(titleForLevel(39), 'Legendary Lovebirds'), 'L39 Legendary Lovebirds');
assert(eq(titleForLevel(40), 'The Eternal Two'), 'L40 The Eternal Two');
assert(eq(titleForLevel(99), 'The Eternal Two'), 'L99 The Eternal Two');

console.log('TITLES table intact');
assert(TITLES.length === 10, '10 title thresholds');

console.log('');
console.log(failed === 0 ? `ALL PASSED (${passed})` : `FAILED ${failed} / ${passed + failed}`);
process.exit(failed === 0 ? 0 : 1);
