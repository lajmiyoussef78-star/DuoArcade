import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { inDict } from "./dictionary";

/* ── DuoArcade theme tokens ─────────────────────────────── */
const T = {
  bg: "#150c1f",
  card: "#1f1430",
  tile: "#261838",
  cardBorder: "rgba(255,255,255,0.07)",
  pink: "#ff5fa8",
  blue: "#57c8ff",
  gold: "#ffc84a",
  text: "#efe9fb",
  muted: "#9a8fb8",
  bad: "#ff6b6b",
};
const ROLE_STYLE = {
  A: { color: T.blue, glow: "rgba(87,200,255,0.45)" },
  B: { color: T.pink, glow: "rgba(255,95,168,0.45)" },
};
const TURN_SECONDS = 60;

const seedByCode = new Map();

/* ── classic Boggle dice ────────────────────────────────── */
const DICE = [
  "AAEEGN","ABBJOO","ACHOPS","AFFKPS","AOOTTW","CIMOTU","DEILRX","DELRVY",
  "DISTTY","EEGHNW","EEINSU","EHRTVW","EIOSST","ELRTTY","HIMNQU","HLNNRZ",
];

/* deterministic RNG so both devices derive the same grid from one seed */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genGridFromSeed(seed) {
  const rnd = mulberry32(seed);
  const dice = [...DICE];
  for (let i = dice.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [dice[i], dice[j]] = [dice[j], dice[i]];
  }
  return dice.map((d) => {
    const f = d[Math.floor(rnd() * 6)];
    return f === "Q" ? "QU" : f;
  });
}

/* ── grid + path logic ──────────────────────────────────── */
const NEIGHBORS = Array.from({ length: 16 }, (_, i) => {
  const r = Math.floor(i / 4), c = i % 4, n = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) n.push(nr * 4 + nc);
    }
  return n;
});

/* returns array of cell indices spelling `word`, or null */
function findPath(word, grid, prefixOk = false) {
  const W = word.toUpperCase();
  if (!W) return null;
  const dfs = (pos, idx, visited, path) => {
    const cell = grid[idx];
    if (!W.startsWith(cell, pos)) {
      // allow partial match of a QU cell while typing "Q"
      if (prefixOk && cell === "QU" && pos === W.length - 1 && W[pos] === "Q")
        return [...path, idx];
      return null;
    }
    const np = pos + cell.length;
    const nPath = [...path, idx];
    if (np >= W.length) return nPath;
    for (const nb of NEIGHBORS[idx]) {
      if (visited.has(nb)) continue;
      const r = dfs(np, nb, new Set([...visited, nb]), nPath);
      if (r) return r;
    }
    return null;
  };
  for (let i = 0; i < 16; i++) {
    const r = dfs(0, i, new Set([i]), []);
    if (r) return r;
  }
  return null;
}

const wordPoints = (w) => (w.length <= 4 ? 1 : w.length === 5 ? 2 : w.length === 6 ? 3 : w.length === 7 ? 5 : 11);

/* shared-word cancellation + scoring, independent of any component state */
function computeTotals(listA, listB) {
  const setA = new Set(listA.map((x) => x.word));
  const setB = new Set(listB.map((x) => x.word));
  const dupeSet = new Set([...setA].filter((w) => setB.has(w)));
  const scoreOf = (list) =>
    list.reduce((s, x) => s + (!dupeSet.has(x.word) && !x.rejected ? x.pts : 0), 0);
  return { dupeSet, totalA: scoreOf(listA), totalB: scoreOf(listB) };
}

/* ── main component ─────────────────────────────────────── */
export default function WordGridDuel({ myRole, names = {}, rt, code, onMatchEnd }) {
  const me = myRole;
  const opp = me === "A" ? "B" : "A";
  const nm = { A: names.A || "Azure", B: names.B || "Rose" };
  const P = {
    A: { name: nm.A, ...ROLE_STYLE.A },
    B: { name: nm.B, ...ROLE_STYLE.B },
  };

  const [phase, setPhase] = useState("lobby"); // lobby | play | waiting | review
  const [grid, setGrid] = useState(null);
  const [myWords, setMyWords] = useState([]); // {word, pts, sure, rejected}
  const [partnerWords, setPartnerWords] = useState(null); // null until partner is done
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [flash, setFlash] = useState(null); // {msg, ok}
  const inputRef = useRef(null);

  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const amDoneRef = useRef(false);
  const partnerDoneRef = useRef(false);
  const myWordsRef = useRef([]);
  const partnerWordsRef = useRef(null);

  useEffect(() => { myWordsRef.current = myWords; }, [myWords]);
  useEffect(() => { partnerWordsRef.current = partnerWords; }, [partnerWords]);

  const maybeAdvanceToReview = useCallback(() => {
    if (!amDoneRef.current || !partnerDoneRef.current) {
      if (amDoneRef.current) setPhase("waiting");
      return;
    }
    setPhase("review");
    if (finishedRef.current || me !== "A") return;
    finishedRef.current = true;
    const listA = me === "A" ? myWordsRef.current : (partnerWordsRef.current || []);
    const listB = me === "B" ? myWordsRef.current : (partnerWordsRef.current || []);
    const { totalA, totalB } = computeTotals(listA, listB);
    const winner = totalA === totalB ? null : totalA > totalB ? 0 : 1;
    onMatchEnd?.({ winner, totals: { A: totalA, B: totalB } });
  }, [me, onMatchEnd]);

  const begin = useCallback((seed) => {
    if (seed == null) return;
    const n = seed >>> 0;
    if (n === seedRef.current) return;
    seedRef.current = n;
    startedRef.current = true;
    finishedRef.current = false;
    amDoneRef.current = false;
    partnerDoneRef.current = false;
    partnerWordsRef.current = null;
    myWordsRef.current = [];
    setPartnerWords(null);
    setMyWords([]);
    setInput("");
    setFlash(null);
    setTimeLeft(TURN_SECONDS);
    setGrid(genGridFromSeed(n));
    setPhase("play");
  }, []);

  const startNewMatch = useCallback(() => {
    const seed = (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
    if (code) seedByCode.set(code, seed);
    const payload = { k: "start", seed };
    begin(seed);
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
  }, [rt, code, begin]);

  const applyReject = useCallback((ownerRole, word, rejected) => {
    if (ownerRole === me) {
      setMyWords((list) => list.map((x) => (x.word === word ? { ...x, rejected } : x)));
    } else {
      setPartnerWords((list) => (list || []).map((x) => (x.word === word ? { ...x, rejected } : x)));
    }
  }, [me]);

  const finishMine = useCallback(() => {
    if (amDoneRef.current) return;
    amDoneRef.current = true;
    const payload = { k: "done", by: me, words: myWordsRef.current };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
    maybeAdvanceToReview();
  }, [me, rt, maybeAdvanceToReview]);

  /* RT handshake — mirrors the Chkobba start/needstart pattern */
  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on((m) => {
      if (!m?.k) return;
      if (m.k === "needstart") {
        if (me === "A" && seedRef.current != null) rt.send({ k: "start", seed: seedRef.current });
        return;
      }
      if (m.k === "start") {
        begin(m.seed);
        return;
      }
      if (m.k === "again") {
        if (me === "A") startNewMatch();
        return;
      }
      if (m.k === "done") {
        if (m.by === me) return;
        partnerWordsRef.current = m.words || [];
        partnerDoneRef.current = true;
        setPartnerWords(partnerWordsRef.current);
        maybeAdvanceToReview();
        return;
      }
      if (m.k === "reject") {
        applyReject(m.by, m.word, m.rejected);
      }
    });
  }, [rt, me, begin, startNewMatch, maybeAdvanceToReview, applyReject]);

  /* host seeds the very first grid; guest asks until it arrives */
  useEffect(() => {
    if (me === "A") {
      let seed = (code && seedByCode.get(code)) || seedRef.current;
      if (seed == null) {
        seed = (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
        if (code) seedByCode.set(code, seed);
      }
      const push = () => rt?.send({ k: "start", seed });
      push();
      begin(seed);
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => { if (!startedRef.current) rt?.send({ k: "needstart" }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, rt, code]);

  /* timer — runs locally, independent of the partner's clock */
  useEffect(() => {
    if (phase !== "play") return;
    setTimeLeft(TURN_SECONDS);
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          finishMine();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === "play") inputRef.current?.focus();
  }, [phase]);

  function handleNewGrid() {
    if (me === "A") startNewMatch();
    else rt?.send({ k: "again" });
  }

  const livePath = useMemo(() => {
    if (phase !== "play" || !input || !grid) return null;
    return findPath(input, grid, true);
  }, [input, grid, phase]);

  function ping(msg, ok) {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 1200);
  }

  function submit() {
    const w = input.trim().toUpperCase().replace(/[^A-Z]/g, "");
    setInput("");
    inputRef.current?.focus();
    if (w.length < 3) return ping("3 letters minimum", false);
    if (myWords.some((x) => x.word === w)) return ping("Already got it", false);
    if (!findPath(w, grid)) return ping("Not on the grid", false);
    const sure = inDict(w);
    const entry = { word: w, pts: wordPoints(w), sure, rejected: false };
    setMyWords((list) => [...list, entry]);
    ping(`+${entry.pts} ${w}${sure ? "" : " ?"}`, true);
  }

  /* review computations — recomputed live as rejects come in */
  const review = useMemo(() => {
    if (phase !== "review") return null;
    const listA = me === "A" ? myWords : (partnerWords || []);
    const listB = me === "B" ? myWords : (partnerWords || []);
    const { dupeSet, totalA, totalB } = computeTotals(listA, listB);
    return {
      dupes: [...dupeSet],
      lists: {
        A: listA.filter((x) => !dupeSet.has(x.word)),
        B: listB.filter((x) => !dupeSet.has(x.word)),
      },
      totals: { A: totalA, B: totalB },
    };
  }, [phase, myWords, partnerWords, me]);

  function toggleReject(ownerRole, word, currentRejected) {
    const next = !currentRejected;
    applyReject(ownerRole, word, next);
    rt?.send({ k: "reject", by: ownerRole, word, rejected: next });
  }

  /* ── shared shell ─────────────────────────────────────── */
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
        .wg-btn { transition: transform .1s ease, filter .1s ease; }
        .wg-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
        .wg-btn:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px; }
        .wg-flash { animation: wgFlash 1.2s ease forwards; }
        @keyframes wgFlash { 0% {opacity:0; transform:translateY(4px);} 12% {opacity:1; transform:none;} 80% {opacity:1;} 100% {opacity:0;} }
        @media (prefers-reduced-motion: reduce) { .wg-flash { animation: none; } }
      `}</style>
      <div style={{ width: "100%", maxWidth: 560 }}>{children}</div>
    </div>
  );

  const title = (size = 24) => (
    <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: size, fontWeight: 800 }}>
      <span style={{ color: T.blue }}>Word</span>
      <span style={{ color: T.pink }}>Grid</span>
    </div>
  );

  const btn = (label, onClick, opts = {}) => (
    <button
      className="wg-btn"
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

  const gridView = (highlight, color) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        background: T.card,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 20,
        padding: 12,
      }}
    >
      {(grid || Array(16).fill("")).map((L, i) => {
        const order = highlight ? highlight.indexOf(i) : -1;
        const on = order >= 0;
        const isLast = on && order === highlight.length - 1;
        return (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 800,
              fontSize: L === "QU" ? 24 : 30,
              background: on ? `${color}22` : T.tile,
              border: `2px solid ${on ? color : "rgba(255,255,255,0.06)"}`,
              boxShadow: isLast ? `0 0 18px ${color}66` : "none",
              color: on ? color : T.text,
              position: "relative",
              transition: "all .12s ease",
              userSelect: "none",
            }}
          >
            {L === "QU" ? "Qu" : L}
            {on && (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 7,
                  fontSize: 11,
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 900,
                  color,
                  opacity: 0.85,
                }}
              >
                {order + 1}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── screens ──────────────────────────────────────────── */
  if (phase === "lobby" || !grid)
    return shell(
      <div style={{ textAlign: "center", paddingTop: 70 }}>
        {title(36)}
        <p style={{ color: T.muted, fontWeight: 700, margin: "14px 0 0" }}>
          {me === "A" ? "Shuffling the grid\u2026" : "Waiting for the grid\u2026"}
        </p>
      </div>
    );

  if (phase === "play") {
    const pct = (timeLeft / TURN_SECONDS) * 100;
    const total = myWords.reduce((s, x) => s + x.pts, 0);
    const me_ = P[me];
    return shell(
      <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          {title()}
          <div style={{ fontWeight: 900, fontSize: 14 }}>
            <span style={{ color: me_.color }}>{me_.name}</span>
            <span style={{ color: T.gold, marginLeft: 8 }}>{total} pts</span>
          </div>
        </div>

        {/* timer */}
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.07)",
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              background:
                timeLeft <= 10
                  ? T.gold
                  : `linear-gradient(90deg, ${T.blue}, ${T.pink})`,
              transition: "width 1s linear",
            }}
          />
        </div>
        <div
          style={{
            textAlign: "right",
            fontWeight: 900,
            fontSize: 13,
            color: timeLeft <= 10 ? T.gold : T.muted,
            marginBottom: 8,
          }}
        >
          {timeLeft}s
        </div>

        <div style={{ maxWidth: 380, margin: "0 auto 12px" }}>
          {gridView(livePath, me_.color)}
        </div>

        {/* input */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="type a word, hit Enter"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{
              flex: 1,
              padding: "13px 16px",
              borderRadius: 14,
              background: T.card,
              border: `2px solid ${
                input && !livePath ? T.bad : input ? me_.color : T.cardBorder
              }`,
              color: T.text,
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 900,
              fontSize: 17,
              letterSpacing: 2,
              outline: "none",
            }}
          />
          {btn("Add", submit)}
        </div>

        {flash && (
          <div
            className="wg-flash"
            style={{
              textAlign: "center",
              fontWeight: 900,
              fontSize: 14,
              color: flash.ok ? T.gold : T.bad,
              marginBottom: 6,
            }}
          >
            {flash.msg}
          </div>
        )}

        {/* found words — never reveal partner's list during play */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {myWords.map((x) => (
            <span
              key={x.word}
              style={{
                padding: "5px 11px",
                borderRadius: 999,
                background: T.card,
                border: `1px solid ${x.sure ? me_.color : T.gold}`,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {x.word}
              <span style={{ color: T.muted, marginLeft: 5 }}>
                {x.pts}
                {!x.sure && <span style={{ color: T.gold }}> ?</span>}
              </span>
            </span>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          {btn("Done early", finishMine, { ghost: true })}
        </div>
      </>
    );
  }

  if (phase === "waiting") {
    const total = myWords.reduce((s, x) => s + (x.rejected ? 0 : x.pts), 0);
    const me_ = P[me];
    const opp_ = P[opp];
    return shell(
      <>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          {title()}
        </div>

        <div
          style={{
            textAlign: "center",
            background: T.card,
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 22,
            padding: "36px 20px",
            boxShadow: `0 0 30px ${opp_.glow}`,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 800, letterSpacing: 1 }}>
            YOU'RE DONE
          </div>
          <div
            style={{
              fontFamily: "'Baloo 2', sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: opp_.color,
              margin: "6px 0 4px",
            }}
          >
            {opp_.name} is still hunting&hellip;
          </div>
          <div style={{ color: T.muted, fontWeight: 700, fontSize: 13 }}>
            hang tight — results reveal once you're both finished
          </div>
        </div>

        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
          <span style={{ color: me_.color }}>{me_.name}</span>
          <span style={{ color: T.gold, marginLeft: 8 }}>{total} pts (provisional)</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {myWords.map((x) => (
            <span
              key={x.word}
              style={{
                padding: "5px 11px",
                borderRadius: 999,
                background: T.card,
                border: `1px solid ${x.sure ? me_.color : T.gold}`,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {x.word}
              <span style={{ color: T.muted, marginLeft: 5 }}>
                {x.pts}
                {!x.sure && <span style={{ color: T.gold }}> ?</span>}
              </span>
            </span>
          ))}
        </div>
      </>
    );
  }

  /* review */
  const r = review;
  const winnerIdx = r.totals.A === r.totals.B ? null : r.totals.A > r.totals.B ? 0 : 1;
  const winnerRole = winnerIdx === 0 ? "A" : winnerIdx === 1 ? "B" : null;
  return shell(
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        {title()}
      </div>

      <div
        style={{
          textAlign: "center",
          background: T.card,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 22,
          padding: "26px 18px",
          boxShadow: winnerRole !== null ? `0 0 40px ${P[winnerRole].glow}` : "none",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, color: T.muted, fontWeight: 800, letterSpacing: 1 }}>
          RESULTS
        </div>
        <div
          style={{
            fontFamily: "'Baloo 2', sans-serif",
            fontSize: 32,
            fontWeight: 800,
            color: winnerRole !== null ? P[winnerRole].color : T.muted,
            margin: "4px 0 6px",
          }}
        >
          {winnerRole !== null ? `${P[winnerRole].name} wins!` : "It's a tie"}
        </div>
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          <span style={{ color: T.blue }}>{r.totals.A}</span>
          <span style={{ color: T.muted }}> — </span>
          <span style={{ color: T.pink }}>{r.totals.B}</span>
        </div>
        <div style={{ color: T.muted, fontWeight: 700, fontSize: 12, marginTop: 8 }}>
          tap a "?" word to reject it if your partner made it up
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {["A", "B"].map((role) => (
          <div
            key={role}
            style={{
              background: T.card,
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <div style={{ color: P[role].color, fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
              {P[role].name}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {r.lists[role].length === 0 && (
                <span style={{ color: T.muted, fontSize: 12, fontWeight: 700 }}>
                  nothing unique
                </span>
              )}
              {r.lists[role].map((x) => (
                <button
                  key={x.word}
                  onClick={() => !x.sure && toggleReject(role, x.word, x.rejected)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: 999,
                    background: "transparent",
                    border: `1px solid ${
                      x.rejected ? T.bad : x.sure ? P[role].color : T.gold
                    }`,
                    color: T.text,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: x.sure ? "default" : "pointer",
                    textDecoration: x.rejected ? "line-through" : "none",
                    opacity: x.rejected ? 0.5 : 1,
                    fontFamily: "'Nunito', sans-serif",
                  }}
                >
                  {x.word} {x.pts}
                  {!x.sure && <span style={{ color: T.gold }}> ?</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {r.dupes.length > 0 && (
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 16,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ color: T.muted, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>
            Great minds — you both found these (0 pts)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {r.dupes.map((w) => (
              <span
                key={w}
                style={{
                  padding: "4px 9px",
                  borderRadius: 999,
                  border: `1px solid ${T.cardBorder}`,
                  color: T.muted,
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center" }}>{btn("New grid", handleNewGrid)}</div>
    </>
  );
}
