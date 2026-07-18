// Heart Duel (moleduel) — latency-fair pops, shared seeded schedule.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Moles from '../pages/Moles.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'moleduel',
  name: 'Heart Duel',
  tag: 'real-time · hearts · rings · bombs',
  accent: 'p2',
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
  const finish = (w, scores) => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w, scores);
  };

  root = createRoot(wrap);
  root.render(createElement(Moles, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
    code: ctx.code,
    pausedRef,
    onComplete: (w, scores) => {
      if (isHost) finish(w, scores);
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
