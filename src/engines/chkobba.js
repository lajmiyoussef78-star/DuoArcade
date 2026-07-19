// Chkobba — Tunisian capture classic for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Chkobba from '../pages/Chkobba.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'chkobba',
  name: 'Chkobba',
  tag: 'tunisian · capture · first to 21',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'chkobba-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Chkobba, {
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
  /* turn-based cards — no clock */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
