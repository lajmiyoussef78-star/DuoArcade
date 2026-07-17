// src/pages/Auction.jsx — Auction Duel play UI (mounted by the auctionduel engine).
// Shell already ran ready + countdown. Host seeds the deck; both bid in secret.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  START_COINS, LOTS_PER_GAME, buildDeck, resolveLot, clampBid,
  scoreTrophies, decideWinner
} from '../lib/auction.js';
import '../styles/auction.css';

function Shelf({ names, wonA, wonB, big }) {
  return (
    <div className={`au-shelf${big ? ' big' : ''}`}>
      <div className="au-shelf-col">
        <div className="au-shelf-h pA">{names.A || 'A'}</div>
        <div className="au-shelf-items">
          {wonA.length
            ? wonA.map(t => <span key={t.id} className="au-trophy" title={t.name}>{t.emoji}</span>)
            : <span className="au-shelf-empty">empty shelf</span>}
        </div>
      </div>
      <div className="au-shelf-col">
        <div className="au-shelf-h pB">{names.B || 'B'}</div>
        <div className="au-shelf-items">
          {wonB.length
            ? wonB.map(t => <span key={t.id} className="au-trophy" title={t.name}>{t.emoji}</span>)
            : <span className="au-shelf-empty">empty shelf</span>}
        </div>
      </div>
    </div>
  );
}

export default function Auction({ myRole, names = {}, rt, onComplete }) {
  const role = myRole;
  const [phase, setPhase] = useState('wait'); // wait | bid | reveal | done
  const [deck, setDeck] = useState([]);
  const [lotIdx, setLotIdx] = useState(0);
  const [coins, setCoins] = useState({ A: START_COINS, B: START_COINS });
  const [won, setWon] = useState({ A: [], B: [] });
  const [draft, setDraft] = useState(0);
  const [myLocked, setMyLocked] = useState(false);
  const [myBid, setMyBid] = useState(null);
  const [theirBid, setTheirBid] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [result, setResult] = useState(null);

  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const lotIdxRef = useRef(0);
  const coinsRef = useRef(coins);
  const wonRef = useRef(won);
  const myLockedRef = useRef(false);
  const myBidRef = useRef(null);
  const theirBidRef = useRef(null);
  const deckRef = useRef([]);

  lotIdxRef.current = lotIdx;
  coinsRef.current = coins;
  wonRef.current = won;
  myLockedRef.current = myLocked;
  myBidRef.current = myBid;
  theirBidRef.current = theirBid;
  deckRef.current = deck;

  const finishGame = useCallback((coinsNow, wonNow) => {
    const { pointsA, pointsB } = scoreTrophies(wonNow.A, wonNow.B);
    const w = decideWinner(
      pointsA, pointsB,
      wonNow.A.length, wonNow.B.length,
      coinsNow.A, coinsNow.B
    );
    setResult({ w, pointsA, pointsB, coins: coinsNow, won: wonNow });
    setPhase('done');
    if (role === 'A' && !finishedRef.current) {
      finishedRef.current = true;
      onComplete?.(w);
    }
  }, [role, onComplete]);

  const applyReveal = useCallback((bidA, bidB) => {
    const lot = deckRef.current[lotIdxRef.current];
    if (!lot) return;
    const res = resolveLot(bidA, bidB);
    const coinsNow = {
      A: coinsRef.current.A - res.spentA,
      B: coinsRef.current.B - res.spentB
    };
    const wonNow = {
      A: [...wonRef.current.A],
      B: [...wonRef.current.B]
    };
    if (res.winner === 'A') wonNow.A.push(lot);
    if (res.winner === 'B') wonNow.B.push(lot);

    setCoins(coinsNow);
    setWon(wonNow);
    setReveal({
      bidA: res.spentA,
      bidB: res.spentB,
      winner: res.winner,
      lot
    });
    setPhase('reveal');
  }, []);

  const tryReveal = useCallback(() => {
    if (myBidRef.current == null || theirBidRef.current == null) return;
    const bidA = role === 'A' ? myBidRef.current : theirBidRef.current;
    const bidB = role === 'B' ? myBidRef.current : theirBidRef.current;
    applyReveal(bidA, bidB);
  }, [role, applyReveal]);

  const begin = useCallback((seed) => {
    if (startedRef.current) return;
    startedRef.current = true;
    const d = buildDeck(seed >>> 0);
    deckRef.current = d;
    setDeck(d);
    setLotIdx(0);
    lotIdxRef.current = 0;
    setCoins({ A: START_COINS, B: START_COINS });
    setWon({ A: [], B: [] });
    setDraft(Math.min(25, START_COINS));
    setMyLocked(false);
    setMyBid(null);
    setTheirBid(null);
    myLockedRef.current = false;
    myBidRef.current = null;
    theirBidRef.current = null;
    setReveal(null);
    setPhase('bid');
  }, []);

  useEffect(() => {
    if (!rt?.on) return;
    rt.on(m => {
      if (!m || !m.k) return;
      if (m.k === 'start') begin(m.seed);
      else if (m.k === 'bid') {
        if (m.by === role) return;
        if (m.lot !== lotIdxRef.current) return;
        theirBidRef.current = m.bid;
        setTheirBid(m.bid);
        if (myLockedRef.current) tryReveal();
      }
    });
  }, [rt, role, begin, tryReveal]);

  // Host seeds; guest waits with short fallback.
  useEffect(() => {
    if (role !== 'A') {
      const t = setTimeout(() => {
        if (!startedRef.current) begin((Date.now() ^ 0xA7C710) >>> 0);
      }, 900);
      return () => clearTimeout(t);
    }
    const seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    rt?.send({ k: 'start', seed });
    begin(seed);
  }, [role, rt, begin]);

  function setBidValue(v) {
    const rem = coins[role];
    setDraft(clampBid(v, rem));
  }

  function lockBid() {
    if (phase !== 'bid' || myLocked) return;
    const rem = coins[role];
    const bid = clampBid(draft, rem);
    myBidRef.current = bid;
    myLockedRef.current = true;
    setMyBid(bid);
    setMyLocked(true);
    setDraft(bid);
    rt?.send({ k: 'bid', lot: lotIdx, bid, by: role });
    if (theirBidRef.current != null) tryReveal();
  }

  function nextLot() {
    const next = lotIdx + 1;
    if (next >= deck.length || next >= LOTS_PER_GAME) {
      finishGame(coins, won);
      return;
    }
    setLotIdx(next);
    lotIdxRef.current = next;
    setMyLocked(false);
    setMyBid(null);
    setTheirBid(null);
    myLockedRef.current = false;
    myBidRef.current = null;
    theirBidRef.current = null;
    setReveal(null);
    const rem = coins[role];
    setDraft(Math.min(25, rem));
    setPhase('bid');
  }

  const lot = deck[lotIdx];
  const { pointsA, pointsB } = scoreTrophies(won.A, won.B);
  const myCoins = coins[role] ?? START_COINS;

  if (phase === 'wait') {
    return (
      <div className="au-page au-embedded">
        <div className="au-status">shuffling the trophy cabinet…</div>
      </div>
    );
  }

  return (
    <div className="au-page au-embedded">
      {(phase === 'bid' || phase === 'reveal') && lot && (
        <div className="au-arena">
          <div className="au-hud">
            <div className="au-coins">
              <span className="au-coin-lbl">your coins</span>
              <span className="au-coin-val">{myCoins}</span>
            </div>
            <div className="au-lotno">lot {lotIdx + 1}/{deck.length}</div>
            <div className="au-points">
              <span className="au-pts-lbl">pts</span>
              <span className="pA">{pointsA}</span>
              <span>–</span>
              <span className="pB">{pointsB}</span>
            </div>
          </div>

          <div className="au-lot">
            <div className="au-lot-emoji">{lot.emoji}</div>
            <div className="au-lot-name">{lot.name}</div>
            <div className="au-lot-pts">{lot.pts} pt{lot.pts === 1 ? '' : 's'}</div>
          </div>

          {phase === 'bid' && (
            myLocked ? (
              <div className="au-locked">
                Bid locked at <b>{myBid}</b>.
                <div className="au-waitline">
                  {theirBid != null ? 'Revealing…' : 'Waiting for their secret bid…'}
                </div>
              </div>
            ) : (
              <div className="au-bidbox">
                <div className="au-bidrow">
                  <input
                    className="au-slider"
                    type="range"
                    min={0}
                    max={myCoins}
                    value={Math.min(draft, myCoins)}
                    onChange={e => setBidValue(e.target.value)}
                  />
                  <input
                    className="au-biginput"
                    type="number"
                    min={0}
                    max={myCoins}
                    value={draft}
                    onChange={e => setBidValue(e.target.value)}
                  />
                </div>
                <div className="au-bidbtns">
                  <button type="button" className="au-btn small ghost" onClick={() => setBidValue(0)}>0</button>
                  <button type="button" className="au-btn small ghost" onClick={() => setBidValue(Math.floor(myCoins * 0.25))}>25%</button>
                  <button type="button" className="au-btn small ghost" onClick={() => setBidValue(Math.floor(myCoins * 0.5))}>50%</button>
                  <button type="button" className="au-btn small ghost" onClick={() => setBidValue(myCoins)}>all-in</button>
                </div>
                <button type="button" className="au-btn warm" onClick={lockBid} disabled={myCoins < 0}>
                  Lock bid ({clampBid(draft, myCoins)})
                </button>
                <p className="au-note">Secret until both lock. Higher bid wins the title — both still spend.</p>
              </div>
            )
          )}

          {phase === 'reveal' && reveal && (
            <div className="au-reveal">
              <div className="au-reveal-bids">
                <span className="pA">{names.A || 'A'}: {reveal.bidA}</span>
                <span className="pB">{names.B || 'B'}: {reveal.bidB}</span>
              </div>
              <div className="au-reveal-out">
                {reveal.winner
                  ? <><b>{reveal.winner === 'A' ? (names.A || 'A') : (names.B || 'B')}</b> claims {reveal.lot.emoji} {reveal.lot.name}</>
                  : <>Tie — nobody gets {reveal.lot.emoji}, but both paid</>}
              </div>
              <button type="button" className="au-btn warm" onClick={nextLot}>
                {lotIdx + 1 >= deck.length ? 'See results' : 'Next lot'}
              </button>
            </div>
          )}

          <Shelf names={names} wonA={won.A} wonB={won.B} />
        </div>
      )}

      {phase === 'done' && result && (
        <div className="au-done">
          <div className="au-winline">
            {result.w === 'draw'
              ? "It's a draw — shared cabinet!"
              : `${result.w === 'A' ? (names.A || 'A') : (names.B || 'B')} wins the cabinet!`}
          </div>
          <div className="au-final">
            {result.pointsA}–{result.pointsB} pts · coins left {result.coins.A}–{result.coins.B}
          </div>
          <Shelf names={names} wonA={result.won.A} wonB={result.won.B} big />
        </div>
      )}
    </div>
  );
}
