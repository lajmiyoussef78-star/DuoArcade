# Gastronomica ↔ DuoArcade embed hook

DuoArcade loads **Ready, Set, Cook** in an iframe (`/embed`). When a kitchen shift ends,
the game should notify the parent so both partners count the evening together.

## One change in `project-gastronomica`

In `apps/web/src/components/GameCanvas.tsx`, inside `onMatchComplete`, add:

```ts
if (window.parent !== window) {
  window.parent.postMessage(
    {
      type: "rsc:complete",
      score: result.score,
      stars: result.stars,
      served: result.served,
    },
    "*",
  );
}
```

Place it **before** the existing `api.completeMatch` block (embed mode has no login).

## Run locally

Terminal 1 — kitchen:

```bash
git clone https://github.com/MohamedAliZegnani/project-gastronomica
cd project-gastronomica
npm install
npm run dev
```

Kitchen embed: http://localhost:5174/embed

Terminal 2 — DuoArcade:

```bash
cd duoarcade-react
npm run dev
```

Open your duo → **Play** → **Ready, Set, Cook**. Dev mode uses `http://localhost:5174/embed` automatically.

## Production

Deploy `project-gastronomica` (Vercel/Netlify) and set the embed URL on DuoArcade:

```js
window.__RSC_EMBED_URL__ = "https://your-kitchen-host/embed";
```

Or build DuoArcade with `VITE_RSC_EMBED_URL=https://your-kitchen-host/embed`.
