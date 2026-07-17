// Micro Soccer — realtime car soccer, host-authoritative.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Soccer from '../pages/Soccer.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'microsoccer',
  name: 'Micro Soccer',
  tag: 'real-time · cars · 90 seconds',
  accent: 'good',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'sc-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Soccer, {
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
