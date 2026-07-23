// Night Curling — midnight ice curling for the duo game shell.
// Host-authoritative physics over shell RT. No dedicated SQL required —
// match wins go through onFinish. Optional: supabase/schema-v34-nightcurling.sql

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import NightCurling from '../pages/NightCurling.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'nightcurling',
  name: 'Night Curling',
  tag: 'physics · curling · first to 5',
  accent: 'p1',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'nightcurling-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(NightCurling, {
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
  /* host sim pauses with the shell if needed later */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
