# Challenges — Integration Guide

Best-of-3 duo challenges with a stake. Create with Game 1 + stake → partner
accepts with Game 2 → fate rolls Game 3 → first to win 2 slots wins. Honor-system
winner buttons per slot. No new npm packages.

## 1. Files (already in the repo)

```
supabase/schema-v28-challenges.sql
src/lib/challenges.js
src/pages/Challenges.jsx
src/arcade/ChallengeCard.jsx
src/styles/challenges.css
```

## 2. Run the SQL (once)

Supabase → SQL Editor → paste ALL of `supabase/schema-v28-challenges.sql` → Run.

Creates `public.challenges` + RPCs: `create_challenge`, `respond_challenge`,
`set_challenge_result`, `cancel_challenge`, `get_challenges`.

## 3. Route + home widget

Already wired:

- Route `/challenges/:code` in `src/main.jsx`
- `<ChallengeCard code={code} myRole={myRole} />` on `HomeScreen`

## 4. GAME_LIST

`src/lib/challenges.js` exports `GAME_LIST` from the current shelf engines.
Play links go to `/app` (games sessions live in the arcade shell). When you add
a game engine, append `{ id, name, route: '/app' }` to `GAME_LIST`.

## 5. Unit tests

```bash
npm run test:challenges
```

Expect all pure helper tests to pass (best-of-3, game3 exclusion, stake catalog).

## Flow reminder

1. Create: stake + Game 1 → `pending`
2. Partner accepts (Game 2 ≠ Game 1; client rolls Game 3) → `active`, or declines
3. Record slot winners; first to 2 → `done` + celebration line
4. One pending/active challenge per duo at a time
