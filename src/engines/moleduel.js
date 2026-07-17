// Mole Duel — latency-fair whack-a-mole, shared seeded schedule.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Moles from '../pages/Moles.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'moleduel',
  name: 'Mole Duel',
  tag: 'real-time · fastest hand · 20 moles',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'mo-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Moles, {
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
