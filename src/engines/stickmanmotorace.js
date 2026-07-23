// Stickman Moto Race — couch co-op (same keyboard), as-is from upstream.
// No dedicated SQL schema — match wins go through the shell onFinish tally.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import StickmanMotoRaceShell from '../stickman/StickmanMotoRaceShell.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'stickmanmotorace',
  name: 'Stickman Moto Race',
  tag: 'same keyboard · co-op · split-screen · neon moto',
  accent: 'p1',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'smr-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(StickmanMotoRaceShell, {
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
