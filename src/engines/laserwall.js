// Laser Wall Duel — role-A authoritative online duo over sync.rt().
// Artist traces glowing outlines with a laser; runner blocks on the wall.
// No dedicated SQL — match wins go through the shell onFinish tally.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import LaserWallShell from '../laserwall/LaserWallShell.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'laserwall',
  name: 'Laser Wall Duel',
  tag: 'online duo · laser · wall runner',
  accent: 'p1',
  realtime: true,
  transport: 'socket',
  keepInGame: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'lwd-wrap';
  el.appendChild(wrap);

  // Online duo REQUIRES rt + role — without these both tabs play alone.
  if (!ctx?.rt || !ctx?.myRole) {
    console.error('[laserwall] missing rt/myRole — online sync disabled', {
      hasRt: !!ctx?.rt, myRole: ctx?.myRole,
    });
  }

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(LaserWallShell, {
    myRole: ctx.myRole,
    rt: ctx.rt,
    names: ctx.names,
    matchId: String(ctx.startedAt || ''),
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
