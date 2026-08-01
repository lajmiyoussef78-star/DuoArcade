/**
 * Adapter probe harness — run in a streaming-tab DevTools console after the
 * DuoArcade Watch content script loads:
 *
 *   await window.__duoAdapter.probe()
 *
 * Or from repo (documentation / future CI):
 *   node extensions/duoarcade-watch/probe-harness.mjs --help
 *
 * Promote Disney+/Max/Prime from L3 stubs → L2 only after green probes
 * on both duo seats for ≥2 weeks.
 */

const HELP = `
DuoArcade Watch — probe harness

Manual (recommended):
  1. Load unpacked extension
  2. Open Netflix (or stub platform) watch player
  3. Extension popup → "Run Netflix probe"
     OR DevTools: await window.__duoAdapter.probe()

Expected green L2 report:
  { detect: true, hasVideo: true, canPlayPause: true, canSeek: true, level: 2 }

Stubs (disney_plus, max, prime_video) intentionally return level 3
even if a <video> exists, until this harness stays green.

Never promote L1 marketing without sustained green probes.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

console.log(HELP);
console.log('This script is documentation-only in Node; probes run in the browser extension context.');
