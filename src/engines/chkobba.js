// Chkobba — Tunisian capture classic for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Chkobba from '../pages/Chkobba.jsx';
import { DEFAULT_TARGET } from '../lib/chkobba.js';

let root = null;
let finished = false;

export const meta = {
  id: 'chkobba',
  name: 'Chkobba',
  tag: 'tunisian · capture · first to 11 / 21 / 31',
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
    target: ctx.target || DEFAULT_TARGET,
    startedAt: ctx.startedAt || 0,
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
