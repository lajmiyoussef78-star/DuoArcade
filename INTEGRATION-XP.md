# DuoArcade XP — integration guide

Shared duo XP, levels, couple titles, and a global leaderboard.

## 1. Copy / confirm these files

```
supabase/schema-v26-xp.sql
src/lib/xp.js
src/arcade/XpBar.jsx
src/pages/Leaderboard.jsx
src/styles/xp.css
scripts/test-xp-pure.mjs
```

This repo already wires:

- `/leaderboard` in `src/main.jsx`
- `<XpBar code={code} />` on `src/arcade/HomeScreen.jsx`
- `awardXp` for **every** finished shelf match via `src/pages/Arcade.jsx`

## 2. Run the SQL once

1. Open your Supabase project → **SQL Editor**
2. Paste and run all of `supabase/schema-v26-xp.sql`
3. Confirm functions exist: `award_duo_xp`, `get_my_xp`, `get_xp_leaderboard`

## 3. Route + home widget (already done here)

In `src/main.jsx`:

```jsx
import Leaderboard from './pages/Leaderboard.jsx';
import './styles/xp.css';
// ...
<Route path="/leaderboard" element={<Leaderboard />} />
```

In `src/arcade/HomeScreen.jsx`:

```jsx
import XpBar from './XpBar.jsx';
// inside the duo card, after the header:
<XpBar code={code} />
```

## 4. Per-game awarding (automatic)

**You do not need a one-liner in every game page.**

`src/pages/Arcade.jsx` awards XP once whenever a match finishes:

- turn-based games → inside `move` when `eng.winner(...)` returns a result
- realtime games → inside `realtimeFinish` (host/`onFinish` path)

That covers every shelf engine. Games that also call `record_<game>()` for their own tally (e.g. Sumo Bomb, Magnet Hearts) keep those SQL tallies separate — XP is only awarded in Arcade.

### Optional quiet note when capped

If you want a toast from a specific game, you can still call:

```js
import { awardXp } from '../lib/xp.js';

awardXp(code, 'sumobomb')
  .then(r => {
    if (r && r.awarded === false && r.reason === 'daily-cap') {
      // show a small dim toast: "daily XP cap reached for this game"
    }
  })
  .catch(() => {});
```

Do **not** also award from the page if Arcade already does — that would double-count.

### Suggested `game_id` strings

These match each engine `meta.id` (what Arcade passes to `awardXp`):

| Game | `game_id` |
|------|-----------|
| Tic-Tac-Toe | `ttt` |
| Connect Four | `connect4` |
| Dots & Boxes | `dots` |
| Mancala | `mancala` |
| Sea Battle | `seabattle` |
| Checkers | `checkers` |
| Hex | `hex` |
| Pig Race | `pig` |
| Sticks | `nim` |
| Duo Dash | `race` |
| Couple Quiz | `couplequiz` |
| Two Truths | `twotruths` |
| Code Break | `codebreak` |
| Duo Pong | `pong` |
| Memory Match | `memory` |
| Gomoku | `gomoku` |
| Sketch & Guess | `sketch` |
| Maze Race | `maze` |
| Reversi | `reversi` |
| Reaction Duel | `reflex` |
| Word Race | `wordrace` |
| Spark Splash | `sparksplash` |
| Ready Set Cook | `readysetcook` |
| Stickman Sword | `stickmanswordduel` |
| Micro Soccer | `microsoccer` |
| Forbidden Words | `forbiddenwords` |
| Number Fortress | `numberfortress` |
| Mole Duel | `moleduel` |
| Auction Duel | `auctionduel` |
| Word Bomb | `wordbomb` |
| Uno | `uno` |
| Coup | `coup` |
| Carrot | `carrot` |
| Chkobba | `chkobba` |
| Minus One | `minusone` |
| Thin Ice | `thinice` |
| Stickman Racing | `stickmanracing` |
| Sumo Bomb | `sumobomb` |
| Magnet Hearts | `magnethearts` |

## 5. Pure unit tests

```bash
npm run test:xp
```

### Passing output

```
levelFromXp boundaries
  ok  0 XP -> L1 into 0/100
  ok  99 XP -> L1 into 99/100
  ok  100 XP -> L2 into 0/140
  ok  239 XP -> L2 into 139/140
  ok  240 XP -> L3 into 0/180
xpToNext curve
  ok  L1->2 costs 100
  ok  L2->3 costs 140
  ok  L3->4 costs 180
monotonicity 0..100000
  ok  level never decreases; boundaries promote exactly once
titleForLevel ladder
  ok  L1 New Sparks
  ok  L2 New Sparks
  ok  L3 Game Night Regulars
  ok  L5 Game Night Regulars
  ok  L6 Rival Sweethearts
  ok  L10 Partners in Crime
  ok  L14 Tag Team
  ok  L18 Synced Souls
  ok  L22 Arcade Royalty
  ok  L27 Dream Duo
  ok  L33 Legendary Lovebirds
  ok  L39 Legendary Lovebirds
  ok  L40 The Eternal Two
  ok  L99 The Eternal Two
TITLES table intact
  ok  10 title thresholds

ALL PASSED (24)
```

## Acceptance checklist

- [x] 6th match of the same game on the same day awards 0 XP (SQL `award_duo_xp` daily-cap)
- [x] 5 of game X + 5 of game Y = 100 XP that day (10 XP × 10 awards)
- [x] Non-member calling `award_duo_xp` raises
- [x] Leaderboard RPC returns names/rank/xp only — no duo codes
- [x] `levelFromXp`: 99→L1, 100→L2, 239→L2, 240→L3
- [x] Titles change at the listed levels
- [x] No emoji / no raw JSX `\uXXXX` text in delivered XP files

## How it works (short)

1. A match finishes in the Arcade shell → `move` or `realtimeFinish` updates records
2. The same path calls `awardXp(code, gameId)` once (10 XP, unless that game already hit 5 today in Europe/Berlin)
3. Home `XpBar` loads `getMyXp` and shows level, title, progress
4. `/leaderboard` loads `get_xp_leaderboard` (top 50 + your rank)
