// Thin Ice — melting-lake isolation for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import ThinIce from '../pages/ThinIce.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'thinice',
  name: 'Thin Ice',
  tag: 'strategy · melting lake · first to 3',
  accent: 'p1',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'thinice-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(ThinIce, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
    code: ctx.code,
    onComplete: w => {
      if (isHost) finish(w);
    }
  }));
}

export function setPaused(_p) {
  /* turn-based board — no clock */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
