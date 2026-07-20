// Loop Duel — one-button drift racing, host-authoritative.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import LoopDuel from '../pages/LoopDuel.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'loopduel',
  name: 'Loop Duel',
  tag: 'real-time · drift · first to 5 laps',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'loopduel-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(LoopDuel, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
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
