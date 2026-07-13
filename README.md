# DuoArcade — React edition (v11.0)

The same DuoArcade, rebuilt on React + Vite. Same Supabase backend, same
invite links, same duo data — nothing on the server changes.

## What moved where

| Before                | Now                                        |
|-----------------------|--------------------------------------------|
| `index.html` (landing)| `src/pages/Landing.jsx` → route `/`         |
| `app.html` (arcade)   | `src/pages/Arcade.jsx` + `src/arcade/*` → route `/app` |
| `sync.js`             | `src/lib/sync.js` (unchanged logic; supabase now from npm) |
| `config.js`           | `src/lib/config.js` (unchanged)             |
| `engines/*.js`        | `src/engines/*.js` (same interface, unchanged files) |
| inline CSS            | `src/styles/*` (scoped per page, same design) |
| `test.mjs`            | `src/engines/test.mjs` (`npm run test:engines`) |

## Run it locally

    npm install
    npm run dev        # opens on http://localhost:5173

## ⚠ One thing to do before games work fully

Three engines ship implemented and tested (ttt, connect4, dots).
The other eight are placeholders — copy YOUR original files over them:

    engines/reversi.js  → src/engines/reversi.js
    engines/pong.js     → src/engines/pong.js
    engines/gomoku.js   → src/engines/gomoku.js
    engines/memory.js   → src/engines/memory.js
    engines/sketch.js   → src/engines/sketch.js
    engines/wordrace.js → src/engines/wordrace.js
    engines/maze.js     → src/engines/maze.js
    engines/reflex.js   → src/engines/reflex.js

They work unchanged. Then verify:  npm run test:engines

## Deploy to Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- `public/_redirects` is already set up:
  - `/app.html → /app` so every OLD invite link keeps working
  - SPA fallback so `/app?duo=CODE&t=TOKEN` loads correctly

Invite links now look like:  https://YOUR-SITE.netlify.app/app?duo=CODE&t=TOKEN

## Toward the mobile app

When you're ready for the App Store / Play Store, add Capacitor:

    npm install @capacitor/core @capacitor/cli
    npx cap init DuoArcade com.duoarcade.app --web-dir=dist
    npm run build && npx cap add android && npx cap add ios

The whole React app ships inside the native shell — no rewrite.

## Backend

`supabase/` holds your schema history (v2 → v9).

For an existing v7 database, run `supabase/schema-v8-arena.sql` once in the
Supabase SQL Editor. It adds the 2v2 Arena match/queue tables, secure RPCs,
four-seat authorization, and Realtime publication. Existing duo data is not
changed.

For the shared whiteboard, also run `supabase/schema-v9-whiteboard.sql` once.
It adds one persistent board per duo (live drawing uses broadcast; saves are
debounced to the database).

Arena supports private challenge links and public matchmaking for Tic-Tac-Toe,
Connect Four, and Dots & Boxes. Both partners must have signed-in accounts
linked to their duo before entering the Arena.
