// src/games-soccer/Dpad.jsx — input for Micro Soccer: a keys ref driven by
// keyboard (arrows/WASD) and an on-screen touch pad for phones.

import { useEffect, useRef } from 'react';

export function useKeys() {
  const keys = useRef({});
  useEffect(() => {
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right'
    };
    const down = e => { const k = map[e.key]; if (k) { keys.current[k] = true; e.preventDefault(); } };
    const up = e => { const k = map[e.key]; if (k) { keys.current[k] = false; e.preventDefault(); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}

export default function Dpad({ keysRef }) {
  const press = (k, v) => e => { e.preventDefault(); keysRef.current[k] = v; };
  const B = ({ k, label }) => (
    <button
      className="sc-padbtn"
      onPointerDown={press(k, true)}
      onPointerUp={press(k, false)}
      onPointerLeave={press(k, false)}
      onContextMenu={e => e.preventDefault()}
    >{label}</button>
  );
  return (
    <div className="sc-pad">
      <B k="up" label={'\u2191'} />
      <div className="sc-pad-row">
        <B k="left" label={'\u2190'} />
        <B k="down" label={'\u2193'} />
        <B k="right" label={'\u2192'} />
      </div>
    </div>
  );
}
