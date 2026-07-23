import { useState, useEffect, useRef, useCallback } from "react";
import { initialState, applyMove, fits, endsFor, other, TARGET } from "../lib/dominoes.js";

/* ────────────────────────────────────────────────────────────
   DominoDuel — DuoArcade real-time game (2 devices, lockstep)
   Draw dominoes · double-six set · first to 50 points
   The board lays tiles in a snake: rows wrap and alternate
   direction (stair look) — no horizontal scrolling.
   Props:
     myRole  — 'A' | 'B'
     names   — { A, B } display names
     rt      — realtime channel { on(fn), send(msg) }
     code    — duo session code, used to cache the match seed
     onMatchEnd({ winner, scores, roundWins }) — fired once, host
       only, when the match is decided. Wired to the duo-record system.
   ──────────────────────────────────────────────────────────── */

const T = {
  bg: "#150c1f",
  card: "#1f1430",
  cardBorder: "rgba(255,255,255,0.07)",
  pink: "#ff5fa8",
  blue: "#57c8ff",
  gold: "#ffc84a",
  text: "#efe9fb",
  muted: "#9a8fb8",
  bone: "#f6efdf",
  pip: "#2b1a3d",
};
const HALF = 34; // board half-tile size (px)
const GAP = 6;

const seedByCode = new Map();

/* pip layouts on a 3×3 grid (indices 0-8) */
const PIP_MAP = {
  0: [],
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Half({ v, size }) {
  const dot = Math.round(size * 0.17);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gridTemplateRows: "repeat(3,1fr)",
        placeItems: "center",
        padding: Math.round(size * 0.12),
        boxSizing: "border-box",
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          style={{
            width: dot,
            height: dot,
            borderRadius: "50%",
            background: PIP_MAP[v].includes(i) ? T.pip : "transparent",
          }}
        />
      ))}
    </div>
  );
}

function HandTile({ tile, playable, color, onClick, size = 46 }) {
  return (
    <button
      onClick={onClick}
      disabled={!playable}
      style={{
        width: size,
        height: size * 2,
        borderRadius: 10,
        padding: 0,
        cursor: playable ? "pointer" : "default",
        background: T.bone,
        border: "none",
        boxShadow: playable
          ? `0 0 0 2px ${color}, 0 0 16px ${color}66, 0 4px 10px rgba(0,0,0,0.5)`
          : "0 3px 8px rgba(0,0,0,0.45)",
        opacity: playable ? 1 : 0.45,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: "transform .12s ease, box-shadow .12s ease",
        transform: playable ? "translateY(-4px)" : "none",
        flexShrink: 0,
      }}
    >
      <Half v={tile.a} size={size} />
      <div style={{ width: size * 0.62, height: 2, borderRadius: 2, background: "rgba(43,26,61,0.35)" }} />
      <Half v={tile.b} size={size} />
    </button>
  );
}

/* Board tile. `flip` mirrors a/b for right-to-left rows so the
   pip chain still reads continuously through the snake. */
function BoardTile({ tile, size = HALF, isNew, isEnd, flip }) {
  const isDouble = tile.a === tile.b;
  const first = flip && !isDouble ? tile.b : tile.a;
  const second = flip && !isDouble ? tile.a : tile.b;
  return (
    <div
      className={isNew ? "da-pop" : ""}
      style={{
        display: "flex",
        flexDirection: isDouble ? "column" : "row",
        alignItems: "center",
        background: T.bone,
        borderRadius: 9,
        boxShadow: isEnd
          ? `0 0 0 2px ${T.gold}88, 0 0 12px ${T.gold}44, 0 3px 8px rgba(0,0,0,0.5)`
          : "0 3px 8px rgba(0,0,0,0.5)",
        flexShrink: 0,
      }}
    >
      <Half v={first} size={size} />
      <div
        style={
          isDouble
            ? { width: size * 0.62, height: 2, borderRadius: 2, background: "rgba(43,26,61,0.35)" }
            : { width: 2, height: size * 0.62, borderRadius: 2, background: "rgba(43,26,61,0.35)" }
        }
      />
      <Half v={second} size={size} />
    </div>
  );
}

function BackTile({ size = 20 }) {
  return (
    <div
      style={{
        width: size,
        height: size * 1.9,
        borderRadius: 6,
        background: "linear-gradient(160deg,#2c1b45,#221338)",
        border: "1px solid rgba(255,255,255,0.09)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${T.pink}, ${T.blue})`,
          opacity: 0.8,
        }}
      />
    </div>
  );
}

/* chunk the chain into snake rows that fit `maxW` */
function buildRows(chain, maxW) {
  const rows = [];
  let row = [];
  let w = 0;
  chain.forEach((t, gi) => {
    const tw = t.a === t.b ? HALF : HALF * 2;
    const need = tw + (row.length ? GAP : 0);
    if (row.length && w + need > maxW) {
      rows.push(row);
      row = [];
      w = 0;
    }
    row.push({ t, gi });
    w += tw + (row.length > 1 ? GAP : 0);
  });
  if (row.length) rows.push(row);
  return rows;
}

/* ── main component ─────────────────────────────────────── */
export default function DominoesDuel({ myRole, names = {}, rt, code, onMatchEnd }) {
  const me = myRole;
  const opp = other(me);
  const PLAYERS = {
    A: { name: names.A || "You", color: T.blue, glow: "rgba(87,200,255,0.45)" },
    B: { name: names.B || "Partner", color: T.pink, glow: "rgba(255,95,168,0.45)" },
  };

  const [st, setSt] = useState(null);
  const [pending, setPending] = useState(null);
  const [boardW, setBoardW] = useState(440);
  const boardRef = useRef(null);

  const stRef = useRef(null);
  const meRef = useRef(me);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  meRef.current = me;

  const commit = useCallback(
    (next) => {
      stRef.current = next;
      setSt(next);
      setPending(null);
      if (next.phase === "matchEnd" && next.winner && !finishedRef.current) {
        finishedRef.current = true;
        if (meRef.current === "A") {
          onMatchEnd?.({
            winner: next.winner === "A" ? 0 : 1,
            scores: next.scores,
            roundWins: next.roundWins,
          });
        }
      }
    },
    [onMatchEnd]
  );

  const begin = useCallback(
    (seed) => {
      if (seed == null) return;
      const n = seed >>> 0;
      if (startedRef.current && seedRef.current === n) return; // dedup resent 'start'
      startedRef.current = true;
      seedRef.current = n;
      if (code) seedByCode.set(code, n);
      finishedRef.current = false;
      commit(initialState(n));
    },
    [code, commit]
  );

  const dispatch = useCallback(
    (move, broadcast = true) => {
      const cur = stRef.current;
      if (!cur) return;
      const next = applyMove(cur, move, meRef.current);
      if (next.error) {
        setSt({ ...next });
        return;
      }
      commit(next);
      if (broadcast) {
        const payload = { k: "move", move, by: meRef.current };
        rt?.send(payload);
        setTimeout(() => rt?.send(payload), 180);
      }
    },
    [rt, commit]
  );

  const rematch = useCallback(() => {
    if (meRef.current !== "A") return;
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    if (code) seedByCode.set(code, seed);
    const push = () => rt?.send({ k: "start", seed });
    push();
    begin(seed);
    setTimeout(push, 400);
  }, [rt, code, begin]);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on((m) => {
      if (!m?.k) return;
      if (m.k === "needstart") {
        if (me === "A" && seedRef.current != null) {
          rt.send({ k: "start", seed: seedRef.current });
        }
        return;
      }
      if (m.k === "start") {
        begin(m.seed);
        return;
      }
      if (m.k === "move") {
        if (m.by === me || !stRef.current || !m.move) return;
        const next = applyMove(stRef.current, m.move, m.by);
        if (!next.error) commit(next);
      }
    });
  }, [rt, me, begin, commit]);

  useEffect(() => {
    if (me === "A") {
      let seed = (code && seedByCode.get(code)) || seedRef.current;
      if (seed == null) {
        seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
        if (code) seedByCode.set(code, seed);
      }
      seedRef.current = seed;
      const push = () => rt?.send({ k: "start", seed });
      push();
      begin(seed);
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    const ask = () => {
      if (!startedRef.current) rt?.send({ k: "needstart" });
    };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [me, rt, begin, code]);

  /* measure board width for the snake layout */
  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setBoardW(Math.max(160, el.clientWidth - 24));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [st]);

  const chain = st?.chain || [];
  const { left: leftEnd, right: rightEnd } = endsFor(chain);
  const myTurn = !!st && st.phase === "play" && st.turn === me;
  const myHand = st?.hands?.[me] || [];
  const handPlayable = myTurn && myHand.some((t) => fits(chain, t));
  const canDraw = myTurn && !handPlayable && (st?.boneyard.length || 0) > 0;
  const canPass = myTurn && !handPlayable && !!st && st.boneyard.length === 0;

  function onTileClick(tile) {
    if (!myTurn || !fits(chain, tile)) return;
    if (chain.length === 0) return dispatch({ t: "place", id: tile.id, end: "right" });
    const canL = tile.a === leftEnd || tile.b === leftEnd;
    const canR = tile.a === rightEnd || tile.b === rightEnd;
    if (canL && canR) return setPending(tile);
    dispatch({ t: "place", id: tile.id, end: canL ? "left" : "right" });
  }

  function place(tile, end) {
    dispatch({ t: "place", id: tile.id, end });
  }
  function draw() {
    if (canDraw) dispatch({ t: "draw" });
  }
  function pass() {
    if (canPass) dispatch({ t: "pass" });
  }
  function nextRound() {
    dispatch({ t: "nextRound" });
  }

  const rows = buildRows(chain, boardW);

  /* ── shared shell / widgets ───────────────────────────── */
  const shell = (children) => (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(700px 400px at 85% -5%, rgba(255,95,168,0.13), transparent 60%),
                     radial-gradient(700px 420px at 0% 105%, rgba(87,200,255,0.11), transparent 60%), ${T.bg}`,
        color: T.text,
        fontFamily: "'Nunito', system-ui, sans-serif",
        display: "flex",
        justifyContent: "center",
        padding: "18px 10px 30px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@600;700;800;900&display=swap');
        .da-pop { animation: daPop .28s cubic-bezier(.34,1.56,.64,1); }
        @keyframes daPop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .da-btn { transition: transform .1s ease, filter .1s ease; }
        .da-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
        .da-btn:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .da-pop { animation: none; } }
      `}</style>
      <div style={{ width: "100%", maxWidth: 560 }}>{children}</div>
    </div>
  );

  const header = st && (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 24, fontWeight: 800 }}>
        <span style={{ color: T.blue }}>Domino</span>
        <span style={{ color: T.pink }}>Duel</span>
      </div>
      <div style={{ display: "flex", gap: 8 }} title={`First to ${TARGET} points`}>
        {["A", "B"].map((p) => (
          <div
            key={p}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              background: T.card,
              border: `1px solid ${st.turn === p && st.phase === "play" ? PLAYERS[p].color : T.cardBorder}`,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span style={{ color: PLAYERS[p].color }}>{PLAYERS[p].name}</span>
            <span style={{ color: T.muted, marginLeft: 6 }}>{st.scores[p]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const btn = (label, onClick, opts = {}) => (
    <button
      className="da-btn"
      onClick={onClick}
      disabled={opts.disabled}
      style={{
        padding: "12px 22px",
        borderRadius: 14,
        cursor: opts.disabled ? "default" : "pointer",
        fontFamily: "'Nunito', sans-serif",
        fontWeight: 900,
        fontSize: 15,
        color: opts.ghost ? T.text : "#1a0f28",
        background: opts.ghost ? T.card : `linear-gradient(135deg, ${T.blue}, ${T.pink})`,
        border: opts.ghost ? `1px solid ${T.cardBorder}` : "none",
        opacity: opts.disabled ? 0.4 : 1,
        boxShadow: opts.ghost ? "none" : "0 6px 18px rgba(255,95,168,0.3)",
      }}
    >
      {label}
    </button>
  );

  /* ── screens ──────────────────────────────────────────── */
  if (!st) {
    return shell(
      <div style={{ textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 10 }}>
          <span style={{ color: T.blue }}>Domino</span>
          <span style={{ color: T.pink }}>Duel</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            margin: "18px 0 22px",
          }}
        >
          <BoardTile tile={{ a: 6, b: 3 }} size={40} />
          <BoardTile tile={{ a: 3, b: 3 }} size={40} />
          <BoardTile tile={{ a: 3, b: 5 }} size={40} />
        </div>
        <p style={{ color: T.muted, fontWeight: 800 }}>Dealing…</p>
      </div>
    );
  }

  if (st.phase === "roundEnd" || st.phase === "matchEnd") {
    const r = st.result || {};
    const winP = r.w != null ? PLAYERS[r.w] : null;
    return shell(
      <>
        {header}
        <div
          style={{
            marginTop: 60,
            textAlign: "center",
            background: T.card,
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 22,
            padding: "40px 24px",
            boxShadow: winP ? `0 0 46px ${winP.glow}` : "none",
          }}
        >
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 800, letterSpacing: 1 }}>
            {st.phase === "matchEnd" ? "MATCH OVER" : r.blocked ? "GAME LOCKED" : "ROUND OVER"}
          </div>
          <div
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontSize: 36,
              fontWeight: 800,
              color: winP ? winP.color : T.muted,
              margin: "6px 0",
            }}
          >
            {winP ? `${winP.name} ${st.phase === "matchEnd" ? "wins the match!" : "takes it"}` : "Dead heat"}
          </div>
          {winP && <div style={{ color: T.gold, fontWeight: 900, fontSize: 20 }}>+{r.pts} points</div>}
          <div style={{ color: T.muted, fontWeight: 700, fontSize: 14, marginTop: 10 }}>
            pips left — {PLAYERS.A.name}: {r.sums?.A} · {PLAYERS.B.name}: {r.sums?.B}
          </div>
          <div style={{ marginTop: 8, fontWeight: 800, fontSize: 15 }}>
            <span style={{ color: T.blue }}>{st.scores.A}</span>
            <span style={{ color: T.muted }}> — </span>
            <span style={{ color: T.pink }}>{st.scores.B}</span>
            <span style={{ color: T.muted, fontSize: 13 }}>
              {" "}
              (rounds {st.roundWins.A}–{st.roundWins.B})
            </span>
          </div>
          <div style={{ marginTop: 26 }}>
            {st.phase === "matchEnd"
              ? me === "A"
                ? btn("Rematch", rematch)
                : <p style={{ color: T.muted, fontWeight: 700, fontSize: 14 }}>Waiting for a rematch…</p>
              : btn("Deal next round", nextRound)}
          </div>
        </div>
      </>
    );
  }

  /* ── active play ──────────────────────────────────────── */
  const P = PLAYERS[st.turn];
  return shell(
    <>
      {header}

      {/* opponent */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: T.card,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 16,
          padding: "10px 14px",
          marginBottom: 12,
        }}
      >
        <span style={{ color: PLAYERS[opp].color, fontWeight: 900, fontSize: 14 }}>{PLAYERS[opp].name}</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {st.hands[opp].map((t) => (
            <BackTile key={t.id} size={18} />
          ))}
        </div>
      </div>

      {/* board — snake layout, no side scrolling */}
      <div
        ref={boardRef}
        style={{
          background: `linear-gradient(180deg, rgba(255,255,255,0.02), transparent), ${T.card}`,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 18,
          padding: "14px 12px",
          marginBottom: 12,
        }}
      >
        {chain.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0 2px 10px",
              fontSize: 12,
              fontWeight: 900,
              color: T.muted,
            }}
          >
            <span>
              start open: <span style={{ color: T.gold }}>{leftEnd}</span>
            </span>
            <span>
              end open: <span style={{ color: T.gold }}>{rightEnd}</span>
            </span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 96 }}>
          {chain.length === 0 ? (
            <div
              style={{
                color: T.muted,
                fontWeight: 800,
                margin: "auto",
                fontSize: 14,
                padding: "24px 0",
              }}
            >
              {P.name} leads — play any tile
            </div>
          ) : (
            rows.map((row, ri) => {
              const reversed = ri % 2 === 1;
              return (
                <div key={ri}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: reversed ? "row-reverse" : "row",
                      gap: GAP,
                      alignItems: "center",
                      minHeight: HALF * 2,
                    }}
                  >
                    {row.map(({ t, gi }) => (
                      <BoardTile
                        key={t.id}
                        tile={t}
                        flip={reversed}
                        isNew={t.id === st.lastPlacedId}
                        isEnd={gi === 0 || gi === chain.length - 1}
                      />
                    ))}
                  </div>
                  {ri < rows.length - 1 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: reversed ? "flex-start" : "flex-end",
                        padding: "2px 14px",
                      }}
                    >
                      <div
                        style={{
                          width: 3,
                          height: 12,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.16)",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14 }}>
          <span style={{ color: P.color }}>{P.name}</span>
          <span style={{ color: T.muted }}>
            {!myTurn
              ? ` — ${PLAYERS[st.turn].name}'s turn`
              : handPlayable
              ? " — your move"
              : canDraw
              ? " — no match, draw a bone"
              : " — nothing left, pass"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {btn(`Draw · ${st.boneyard.length}`, draw, { ghost: true, disabled: !canDraw })}
          {btn("Pass", pass, { ghost: true, disabled: !canPass })}
        </div>
      </div>

      {/* hand */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          background: T.card,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 18,
          padding: "16px 10px",
          minHeight: 120,
        }}
      >
        {myHand.map((t) => (
          <HandTile
            key={t.id}
            tile={t}
            playable={myTurn && fits(chain, t)}
            color={P.color}
            onClick={() => onTileClick(t)}
          />
        ))}
      </div>

      {st.error && (
        <div style={{ marginTop: 10, textAlign: "center", color: T.pink, fontWeight: 800, fontSize: 13 }}>
          {st.error}
        </div>
      )}

      {/* end chooser */}
      {pending && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12,6,20,0.75)",
            display: "grid",
            placeItems: "center",
            zIndex: 20,
          }}
          onClick={() => setPending(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.card,
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 20,
              padding: 24,
              textAlign: "center",
              boxShadow: `0 0 40px ${P.glow}`,
            }}
          >
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
              <BoardTile tile={pending} size={36} />
            </div>
            <div style={{ color: T.muted, fontWeight: 800, fontSize: 13, marginBottom: 14 }}>
              This bone fits both ends
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {btn(`Start (${leftEnd})`, () => place(pending, "left"))}
              {btn(`End (${rightEnd})`, () => place(pending, "right"))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
