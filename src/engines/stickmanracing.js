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
  tag: 'same keyboard · co-op · parkour · first to the flag',
  accent: 'p1',
  realtime: true
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
  };

  root = createRoot(wrap);
  root.render(createElement(StickmanRacingShell, {
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
