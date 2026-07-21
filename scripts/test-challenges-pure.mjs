// scripts/test-challenges-pure.mjs — plain node tests for challenge helpers
import {
  overallWinner, pickRandomGame3, STAKE_GROUPS, GAME_LIST
} from '../src/lib/challenges.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed += 1; console.log('  ok  ' + msg); }
  else { failed += 1; console.log('FAIL  ' + msg); }
}

console.log('overallWinner best-of-3');
assert(overallWinner('A', 'A', null) === 'A', 'A A _ -> A');
assert(overallWinner('B', 'B', null) === 'B', 'B B _ -> B');
assert(overallWinner('A', 'B', null) === null, 'A B _ undecided');
assert(overallWinner('A', 'B', 'A') === 'A', 'A B A -> A (decider)');
assert(overallWinner('A', 'B', 'B') === 'B', 'A B B -> B (decider)');
assert(overallWinner(null, null, null) === null, 'empty undecided');
assert(overallWinner('A', null, null) === null, 'single slot undecided');
assert(overallWinner('B', 'A', 'B') === 'B', 'B A B -> B');

console.log('pickRandomGame3');
{
  const ids = ['ttt', 'connect4', 'chkobba', 'wordbomb', 'uno'];
  for (let seed = 0; seed < 40; seed++) {
    let n = seed;
    const rnd = () => { n = (n * 1103515245 + 12345) & 0x7fffffff; return (n % 10000) / 10000; };
    const g3 = pickRandomGame3(ids, 'ttt', 'uno', rnd);
    assert(g3 !== 'ttt' && g3 !== 'uno' && ids.includes(g3), `seed ${seed}: g3=${g3} not ttt/uno`);
  }
  assert(pickRandomGame3(['a', 'b'], 'a', 'b') === null, 'empty pool -> null');
}

console.log('STAKE_GROUPS catalog');
assert(STAKE_GROUPS.length === 5, 'five groups');
assert(STAKE_GROUPS.map(g => g.id).join(',') === 'chores,dates,sweet,silly,distance', 'group ids');
{
  const all = STAKE_GROUPS.flatMap(g => g.stakes);
  const set = new Set(all);
  assert(all.length === set.size, 'no duplicate stake text');
  assert(all.length >= 30, 'enough presets (' + all.length + ')');
  for (const g of STAKE_GROUPS) {
    assert(Array.isArray(g.stakes) && g.stakes.length === 20 && g.label, 'group ' + g.id + ' has 20 stakes');
  }
}

console.log('GAME_LIST');
assert(GAME_LIST.length >= 10, 'shelf has games');
assert(GAME_LIST.every(g => g.id && g.name && g.route), 'each game has id/name/route');

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
