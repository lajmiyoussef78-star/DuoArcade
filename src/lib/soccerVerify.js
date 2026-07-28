// soccerVerify.js — VERIFICATION ONLY. No sync behavior changes.
// Logs host sends / guest receives and diffs ball+score fields.

let frame = 0;
export function socVerifyTickFrame() {
  frame += 1;
  return frame;
}

export function socVerifyFrame() {
  return frame;
}

function ballSnap(b) {
  if (!b) return null;
  return {
    x: b.x, y: b.y, vx: b.vx, vy: b.vy,
  };
}

export function extractAuthFields(msg) {
  const st = msg?.st;
  if (!st?.ball) return null;
  return {
    seq: msg.seq ?? null,
    ball: ballSnap(st.ball),
    score: st.score ? { A: st.score.A, B: st.score.B } : null,
  };
}

/** Host: log exact payload about to be sent. */
export function logHostSend(msg) {
  const f = extractAuthFields(msg);
  if (!f) return;
  console.info('[SOC_VERIFY][HOST][SEND]', {
    seq: f.seq,
    timestamp: performance.now(),
    ball: f.ball,
    score: f.score,
  });
  if (typeof window !== 'undefined') {
    window.__SOC_VERIFY_LAST_HOST_SEND__ = { ...f, timestamp: performance.now() };
  }
}

/**
 * Guest: log raw receive, post-validate, and FIELD MISMATCH vs raw.
 * Returns true if raw vs validated match for ball+score+seq.
 */
export function logGuestRecv(raw, validated) {
  const ts = performance.now();
  const rawF = extractAuthFields(raw);
  const valF = extractAuthFields(validated);

  console.info('[SOC_VERIFY][GUEST][RECV_RAW]', {
    seq: rawF?.seq ?? raw?.seq ?? null,
    timestamp: ts,
    ball: rawF?.ball ?? null,
    score: rawF?.score ?? null,
  });

  console.info('[SOC_VERIFY][GUEST][RECV_VALIDATED]', {
    seq: valF?.seq ?? null,
    timestamp: ts,
    ball: valF?.ball ?? null,
    score: valF?.score ?? null,
  });

  if (!rawF || !valF) {
    console.warn('[SOC_VERIFY] FIELD MISMATCH — missing raw or validated fields');
    return false;
  }

  let ok = true;
  const check = (path, a, b) => {
    if (a !== b && !(Number.isFinite(a) && Number.isFinite(b) && Object.is(a, b))) {
      // Allow identical numeric equality only
      if (a !== b) {
        console.warn('[SOC_VERIFY] FIELD MISMATCH', {
          field: path,
          hostOrRawValue: a,
          guestValidatedValue: b,
          difference: (typeof a === 'number' && typeof b === 'number') ? (b - a) : 'n/a',
        });
        ok = false;
      }
    }
  };

  check('seq', rawF.seq, valF.seq);
  check('ball.x', rawF.ball.x, valF.ball.x);
  check('ball.y', rawF.ball.y, valF.ball.y);
  check('ball.vx', rawF.ball.vx, valF.ball.vx);
  check('ball.vy', rawF.ball.vy, valF.ball.vy);
  check('score.A', rawF.score.A, valF.score.A);
  check('score.B', rawF.score.B, valF.score.B);

  if (ok) {
    console.info('[SOC_VERIFY] RAW≡VALIDATED OK', { seq: valF.seq });
  }

  if (typeof window !== 'undefined') {
    window.__SOC_VERIFY_LAST_GUEST_RECV__ = { raw: rawF, validated: valF, timestamp: ts, match: ok };
  }
  return ok;
}

/** Trace a ball-related write (verification only). */
export function logBallWrite({ target, oldValue, newValue, reason, fn }) {
  console.info('[SOC_VERIFY][WRITE]', {
    frame: frame,
    target,
    reason,
    function: fn,
    old: ballSnap(oldValue),
    new: ballSnap(newValue),
    timestamp: performance.now(),
  });
}
