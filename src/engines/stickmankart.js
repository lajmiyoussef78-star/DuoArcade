// Stickman Kart Racing — couch co-op (same keyboard), from MohamedAliZegnani/stickman-kart-racing.
// Kart race with items/tracks. No dedicated SQL — wins go through shell onFinish.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import StickmanKartShell from '../stickman/StickmanKartShell.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'stickmankart',
  name: 'Stickman Kart Racing',
  tag: 'online duo · kart racing',
  accent: 'p1',
  realtime: true,
  keepInGame: true,
  hidePlayers: true,
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'skr-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(StickmanKartShell, {
    myRole: ctx.myRole,
    rt: ctx.rt,
    names: ctx.names,
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
