// Stickman Racing — couch co-op (same keyboard), as-is from upstream.
// No dedicated SQL schema — match wins go through the shell onFinish tally.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import StickmanRacingShell from '../stickman/StickmanRacingShell.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'stickmanracing',
  name: 'Stickman Racing',
  tag: 'online duo · parkour · first to the flag',
  accent: 'p1',
  realtime: true,
  /** Stay on the racing lobby after a win — no DuoArcade "Back to shelf" panel */
  keepInGame: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'sr-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
    // keepInGame: allow another race in the same lobby session to tally.
    window.setTimeout(() => { finished = false; }, 2500);
  };

  root = createRoot(wrap);
  root.render(createElement(StickmanRacingShell, {
    myRole: ctx.myRole,
    rt: ctx.rt,
    names: ctx.names,
    pausedRef,
    onComplete: w => {
      if (isHost) finish(w);
    }
  }));
}

export function setPaused(p) {
  pausedRef.current = !!p;
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
