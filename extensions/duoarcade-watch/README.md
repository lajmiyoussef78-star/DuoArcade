# DuoArcade Watch (browser extension)

Thin Manifest V3 bridge for **Streaming WatchParty**. DuoArcade web owns Supabase / duo session. This extension only detects playback on supported streaming tabs and reports playhead events.

## Non-goals

- No DRM bypass, download, proxy, or re-stream
- No credential scraping
- No `<all_urls>` permission

## Install (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select this folder (`extensions/duoarcade-watch`)
4. On DuoArcade, start a Netflix Streaming Night → **Connect extension**
5. Open Netflix and play a title

## Capability levels

| Level | Meaning |
|-------|---------|
| L3 | Coordination only (web) — always available |
| L2 | Play/pause + Sync now (Netflix adapter) |
| L1 | Full seek/episode — only after probe harness stays green |

## Adapters

- `adapters/netflix.js` — L2 target
- `adapters/disney.js`, `max.js`, `prime.js` — **stubs** (report L3; `probe()` available)

## Probe harness

On a Netflix watch page, open the extension popup → **Run Netflix probe**, or in DevTools:

```js
await window.__duoAdapter.probe()
```

Promote a stub to L2 only after green probes on both seats for ≥2 weeks.
