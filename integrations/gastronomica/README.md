# Ready, Set, Cook — native kitchen in DuoArcade

The full **project-gastronomica** Phaser kitchen lives inside DuoArcade at `src/kitchen/` — no iframe or separate deploy.

## Layout

| Path | Role |
|------|------|
| `src/kitchen/game/` | Phaser scenes, maps, entities (from gastronomica) |
| `src/kitchen/KitchenPlay.jsx` | React mount + DuoArcade realtime bridge |
| `src/kitchen/MapLobby.jsx` | Kitchen / map picker UI |
| `src/kitchen/shared.ts` | Stand-in for `@gastronomica/shared` types |
| `src/engines/readysetcook.js` | DuoArcade engine entry (`mount` / `unmount`) |
| `src/styles/kitchen.scoped.css` | Map lobby + kitchen chrome styles |

## Co-op

- **Avatar sync:** chef positions broadcast over DuoArcade realtime (`{ k: 'chef', role, state }`).
- **Shift complete:** when a match ends, host calls `onFinish('draw')`; guest receives `{ k: 'rsc-done' }`.
- **Shared simulation** (orders, items, score) is not synced yet — each player runs their own kitchen; pick the same map and play side by side.

## Run locally

```bash
cd duoarcade-react
npm install
npm run dev
```

Open your duo → **Play** → **Ready, Set, Cook**.

## Upstream

Source game: [project-gastronomica](https://github.com/MohamedAliZegnani/project-gastronomica)

To pull updates from upstream, copy `apps/web/src/game/` into `src/kitchen/game/` and re-test `npm run build`.
