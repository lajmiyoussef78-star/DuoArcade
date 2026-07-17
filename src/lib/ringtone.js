// Classic telephone ringtone (North-America style dual-tone 440 + 480 Hz).
// Pattern: ring-ring …… ring-ring …… (like a landline / phone call)

let ctx = null;
let timer = null;
let running = false;
let activeNodes = [];

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function stopNodes() {
  for (const n of activeNodes) {
    try { n.stop(); } catch { /* already stopped */ }
    try { n.disconnect(); } catch { /* ignore */ }
  }
  activeNodes = [];
}

/** One continuous dual-tone ring segment (both freqs together). */
function tonePair(audioCtx, when, dur, gain = 0.1) {
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.0001, when);
  master.gain.exponentialRampToValueAtTime(gain, when + 0.015);
  // slight decay so it doesn't clip harshly
  master.gain.setValueAtTime(gain, when + Math.max(0.05, dur - 0.04));
  master.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  master.connect(audioCtx.destination);

  for (const freq of [440, 480]) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);
    osc.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    activeNodes.push(osc);
  }
  activeNodes.push(master);
}

/** One full "ring-ring" cycle: two bursts, then silence until next interval. */
function playPhoneRing(audioCtx) {
  stopNodes();
  const t0 = audioCtx.currentTime + 0.02;
  // Classic cadence: ~400ms on, 200ms gap, 400ms on
  tonePair(audioCtx, t0, 0.4, 0.11);
  tonePair(audioCtx, t0 + 0.6, 0.4, 0.11);
}

export async function startRingtone() {
  if (running) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  running = true;
  try {
    if (audioCtx.state === 'suspended') await audioCtx.resume();
  } catch { /* autoplay policies */ }

  playPhoneRing(audioCtx);
  // Pause between ring-ring pairs (~2s silence after the pair) — feels like a phone
  timer = setInterval(() => {
    if (!running) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      playPhoneRing(audioCtx);
    } catch { /* ignore */ }
  }, 3000);
}

export function stopRingtone() {
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  stopNodes();
}
