// src/pages/Auction.jsx — Auction Duel play UI (mounted by the auctionduel engine).
// Host seeds the deck; bids buffered by lot so late/early messages never get lost.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  START_COINS, LOTS_PER_GAME, buildDeck, cabinetDisplayOrder, resolveLot, clampBid,
  scoreTrophies, decideWinner
} from '../lib/auction.js';
import '../styles/auction.css';

const seedByCode = new Map();

function cardTone(pts) {
  if (pts >= 8) return 'hi';
  if (pts >= 5) return 'mid';
  return 'lo';
}

/** Shared face design used for the current lot and revealed cabinet cards. */
function TitleFace({ card, size = 'md' }) {
  return (
    <div className={`au-face au-face-${size} au-tone-${cardTone(card.pts)}`}>
      <div className="au-face-glow" aria-hidden="true" />
      <div className="au-face-emoji">{card.emoji}</div>
      <div className="au-face-name">{card.name}</div>
      <div className="au-face-pts">{card.pts} pt{card.pts === 1 ? '' : 's'}</div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="au-back" aria-hidden="true">
      <span className="au-back-mark">◆</span>
    </div>
  );
}

function Shelf({ names, wonA, wonB, big }) {
  return (
    <div className={`au-shelf${big ? ' big' : ''}`}>
      <div className="au-shelf-col A">
        <div className="au-shelf-h pA">{names.A || 'A'}</div>
        <div className="au-shelf-items">
          {wonA.length
            ? wonA.map(t => (
              <span
                key={t.id}
                className={`au-mini au-mini-${cardTone(t.pts)}`}
                title={`${t.name} · ${t.pts} pts`}
              >
                <span className="au-mini-e">{t.emoji}</span>
                <span className="au-mini-v">{t.pts}</span>
              </span>
            ))
            : <span className="au-shelf-empty">empty shelf</span>}
        </div>
      </div>
      <div className="au-shelf-col B">
        <div className="au-shelf-h pB">{names.B || 'B'}</div>
        <div className="au-shelf-items">
          {wonB.length
            ? wonB.map(t => (
              <span
                key={t.id}
                className={`au-mini au-mini-${cardTone(t.pts)}`}
                title={`${t.name} · ${t.pts} pts`}
              >
                <span className="au-mini-e">{t.emoji}</span>
                <span className="au-mini-v">{t.pts}</span>
              </span>
            ))
            : <span className="au-shelf-empty">empty shelf</span>}
        </div>
      </div>
    </div>
  );
}

function DeckList({ deck, lotIdx, phase, reveal, won, seed }) {
  const ownerOf = (card, i) => {
    if (won.A.some(t => t.id === card.id)) return 'A';
    if (won.B.some(t => t.id === card.id)) return 'B';
    if (i < lotIdx) return 'tie';
    if (i === lotIdx && phase === 'reveal') {
      if (reveal?.winner === 'A') return 'A';
      if (reveal?.winner === 'B') return 'B';
      return 'tie';
    }
    if (i === lotIdx) return 'now';
    return 'soon';
  };

  const items = seed != null ? cabinetDisplayOrder(deck, seed) : deck.map((card, drawIndex) => ({ card, drawIndex }));
  const faceDownLeft = Math.max(0, deck.length - lotIdx - 1);

  return (
    <div className="au-deck" aria-label="Cabinet cards">
      <div className="au-deck-h">
        Cabinet · {faceDownLeft} face-down · next draw is random
      </div>
      <div className="au-deck-grid">
        {items.map(({ card, drawIndex }) => {
          const own = ownerOf(card, drawIndex);
          const hidden = own === 'soon';
          return (
            <div
              key={card.id}
              className={`au-deck-slot au-deck-${own}`}
              title={hidden ? 'Face-down' : `${card.name} · ${card.pts} pts`}
            >
              {hidden ? (
                <CardBack />
              ) : (
                <div className={`au-deck-face au-tone-${cardTone(card.pts)}`}>
                  <span className="au-deck-emoji">{card.emoji}</span>
                  <span className="au-deck-val">{card.pts}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Auction({ myRole, names = {}, rt, code, onComplete }) {
  const role = myRole;
  const partnerRole = role === 'A' ? 'B' : 'A';
  const partnerName = names[partnerRole] || 'Partner';

  const [phase, setPhase] = useState('wait'); // wait | bid | reveal | done
  const [deck, setDeck] = useState([]);
  const [lotIdx, setLotIdx] = useState(0);
  const [coins, setCoins] = useState({ A: START_COINS, B: START_COINS });
  const [won, setWon] = useState({ A: [], B: [] });
  const [draft, setDraft] = useState(0);
  const [myLocked, setMyLocked] = useState(false);
  const [myBid, setMyBid] = useState(null);
  const [waitingPartner, setWaitingPartner] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [result, setResult] = useState(null);
  const [gameSeed, setGameSeed] = useState(null);

  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const revealedLotsRef = useRef(new Set());
  const lotIdxRef = useRef(0);
  const phaseRef = useRef('wait');
  const coinsRef = useRef(coins);
  const wonRef = useRef(won);
  const deckRef = useRef([]);
  const seedRef = useRef(null);
  const bidsByLotRef = useRef({}); // { [lot]: { A?: number, B?: number } }
  const retransmitRef = useRef(null);
  lotIdxRef.current = lotIdx;
  phaseRef.current = phase;
  coinsRef.current = coins;
  wonRef.current = won;
  deckRef.current = deck;

  const stopRetransmit = () => {
    if (retransmitRef.current) {
      clearInterval(retransmitRef.current);
      retransmitRef.current = null;
    }
  };

  const finishGame = useCallback((coinsNow, wonNow) => {
    stopRetransmit();
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

  const applyReveal = useCallback((lot, bidA, bidB) => {
    if (revealedLotsRef.current.has(lot)) return;
    const title = deckRef.current[lot];
    if (!title) return;
    revealedLotsRef.current.add(lot);
    stopRetransmit();

    const res = resolveLot(bidA, bidB);
    const coinsNow = {
      A: coinsRef.current.A - res.spentA,
      B: coinsRef.current.B - res.spentB
    };
    const wonNow = {
      A: [...wonRef.current.A],
      B: [...wonRef.current.B]
    };
    if (res.winner === 'A') wonNow.A.push(title);
    if (res.winner === 'B') wonNow.B.push(title);

    setCoins(coinsNow);
    setWon(wonNow);
    setReveal({
      bidA: res.spentA,
      bidB: res.spentB,
      winner: res.winner,
      lot: title
    });
    setWaitingPartner(false);
    setMyLocked(true);
    setPhase('reveal');

    // Host broadcasts canonical reveal so both screens match
    if (role === 'A') {
      const payload = { k: 'reveal', lot, bidA: res.spentA, bidB: res.spentB };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 200);
    }
  }, [role, rt]);

  const tryRevealLot = useCallback((lot) => {
    if (lot !== lotIdxRef.current) return;
    if (phaseRef.current !== 'bid' && phaseRef.current !== 'wait') return;
    if (revealedLotsRef.current.has(lot)) return;
    const row = bidsByLotRef.current[lot] || {};
    if (row.A == null || row.B == null) return;
    applyReveal(lot, row.A, row.B);
  }, [applyReveal]);

  const storeBid = useCallback((by, lot, bid) => {
    if (typeof lot !== 'number' || typeof bid !== 'number') return;
    const row = bidsByLotRef.current[lot] || (bidsByLotRef.current[lot] = {});
    row[by] = bid;
    if (by !== role && lot === lotIdxRef.current) {
      setWaitingPartner(false);
    }
    tryRevealLot(lot);
  }, [role, tryRevealLot]);

  const begin = useCallback((seed) => {
    if (seed == null || startedRef.current) return;
    startedRef.current = true;
    const n = seed >>> 0;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    setGameSeed(n);
    const d = buildDeck(n);
    deckRef.current = d;
    setDeck(d);
    setLotIdx(0);
    lotIdxRef.current = 0;
    setCoins({ A: START_COINS, B: START_COINS });
    setWon({ A: [], B: [] });
    setDraft(Math.min(25, START_COINS));
    setMyLocked(false);
    setMyBid(null);
    setWaitingPartner(false);
    setReveal(null);
    bidsByLotRef.current = {};
    revealedLotsRef.current = new Set();
    finishedRef.current = false;
    setPhase('bid');
  }, [code]);

  const goToLot = useCallback((next) => {
    stopRetransmit();
    if (next < lotIdxRef.current) return;
    if (next === lotIdxRef.current && phaseRef.current === 'bid') return;
    if (next >= deckRef.current.length || next >= LOTS_PER_GAME) {
      finishGame(coinsRef.current, wonRef.current);
      return;
    }
    setLotIdx(next);
    lotIdxRef.current = next;
    setMyLocked(false);
    setMyBid(null);
    setWaitingPartner(false);
    setReveal(null);
    const rem = coinsRef.current[role];
    setDraft(Math.min(25, rem));
    setPhase('bid');

    // Partner may have already locked this lot while we were on reveal
    const row = bidsByLotRef.current[next] || {};
    if (row[role] != null) {
      setMyBid(row[role]);
      setMyLocked(true);
      setDraft(row[role]);
      setWaitingPartner(row[partnerRole] == null);
    }
    tryRevealLot(next);
  }, [role, partnerRole, finishGame, tryRevealLot]);

  useEffect(() => {
    if (!rt?.on) return;
    rt.on(m => {
      if (!m || !m.k) return;
      if (m.k === 'needstart') {
        if (role === 'A' && seedRef.current != null) {
          rt.send({ k: 'start', seed: seedRef.current });
        }
        return;
      }
      if (m.k === 'start') {
        begin(m.seed);
        return;
      }
      if (m.k === 'bid') {
        if (m.by === role) return;
        storeBid(m.by, m.lot, m.bid);
        return;
      }
      if (m.k === 'reveal') {
        if (typeof m.lot !== 'number') return;
        if (m.lot > lotIdxRef.current) {
          lotIdxRef.current = m.lot;
          setLotIdx(m.lot);
        }
        storeBid('A', m.lot, m.bidA);
        storeBid('B', m.lot, m.bidB);
        if (!revealedLotsRef.current.has(m.lot)) {
          applyReveal(m.lot, m.bidA, m.bidB);
        }
        return;
      }
      if (m.k === 'advance') {
        if (typeof m.to !== 'number') return;
        if (m.to > lotIdxRef.current || phaseRef.current === 'reveal') {
          goToLot(m.to);
        }
        return;
      }
      if (m.k === 'needbid') {
        // Partner stuck waiting — resend our lock for that lot
        const lot = typeof m.lot === 'number' ? m.lot : lotIdxRef.current;
        const mine = bidsByLotRef.current[lot]?.[role];
        if (mine != null) {
          rt.send({ k: 'bid', lot, bid: mine, by: role });
        }
      }
    });
  }, [rt, role, begin, storeBid, applyReveal, goToLot]);

  useEffect(() => {
    if (role === 'A') {
      let seed = (code && seedByCode.get(code)) || seedRef.current;
      if (seed == null) {
        seed = ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);
        if (code) seedByCode.set(code, seed);
      }
      seedRef.current = seed;
      const push = () => rt?.send({ k: 'start', seed });
      push();
      begin(seed);
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => {
      if (!startedRef.current) rt?.send({ k: 'needstart' });
    };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [role, rt, begin, code]);

  // While waiting for partner bid, retransmit ours + nudge them
  useEffect(() => {
    stopRetransmit();
    if (phase !== 'bid' || !myLocked || myBid == null) return undefined;
    const tick = () => {
      rt?.send({ k: 'bid', lot: lotIdxRef.current, bid: myBid, by: role });
      rt?.send({ k: 'needbid', lot: lotIdxRef.current, by: role });
    };
    tick();
    retransmitRef.current = setInterval(tick, 900);
    return stopRetransmit;
  }, [phase, myLocked, myBid, role, rt]);

  function setBidValue(v) {
    const rem = coins[role];
    setDraft(clampBid(v, rem));
  }

  function lockBid() {
    if (phase !== 'bid' || myLocked) return;
    const rem = coins[role];
    const bid = clampBid(draft, rem);
    storeBid(role, lotIdx, bid);
    setMyBid(bid);
    setMyLocked(true);
    setDraft(bid);
    setWaitingPartner(true);
    rt?.send({ k: 'bid', lot: lotIdx, bid, by: role });
  }

  function requestNext() {
    if (phase !== 'reveal') return;
    const to = lotIdx + 1;
    rt?.send({ k: 'advance', to, by: role });
    goToLot(to);
  }

  const lot = deck[lotIdx];
  const { pointsA, pointsB } = scoreTrophies(won.A, won.B);
  const myCoins = coins[role] ?? START_COINS;
  const partnerBidKnown = !!(bidsByLotRef.current[lotIdx]?.[partnerRole] != null);

  if (phase === 'wait') {
    return (
      <div className="au-page au-embedded">
        <div className="au-status">Drawing 10 cards from the cabinet…</div>
      </div>
    );
  }

  return (
    <div className="au-page au-embedded">
      {(phase === 'bid' || phase === 'reveal') && lot && (
        <div className="au-arena">
          <div className="au-hud">
            <div className="au-coins">
              <span className="au-coin-lbl">Your coins</span>
              <span className="au-coin-val">{myCoins}</span>
            </div>
            <div className="au-lotpill">
              <span className="au-lotno">Lot {lotIdx + 1}</span>
              <span className="au-lotden">/ {deck.length}</span>
            </div>
            <div className="au-points" title="Title points">
              <span className="pA">{pointsA}</span>
              <span className="au-pts-sep">–</span>
              <span className="pB">{pointsB}</span>
            </div>
          </div>

          <div className="au-lot-wrap">
            <TitleFace card={lot} size="lg" />
          </div>

          <DeckList
            deck={deck}
            lotIdx={lotIdx}
            phase={phase}
            reveal={reveal}
            won={won}
            seed={gameSeed}
          />

          {phase === 'bid' && (
            myLocked ? (
              <div className="au-locked">
                <div className="au-locked-amt">Bid locked · <b>{myBid}</b></div>
                <div className="au-waitline">
                  {partnerBidKnown
                    ? 'Revealing…'
                    : `Waiting for ${partnerName}'s secret bid…`}
                </div>
                <div className="au-pulse" aria-hidden="true"><i /><i /><i /></div>
              </div>
            ) : (
              <div className="au-bidbox">
                <div className="au-bid-display">{clampBid(draft, myCoins)}</div>
                <div className="au-bidrow">
                  <input
                    className="au-slider"
                    type="range"
                    min={0}
                    max={Math.max(0, myCoins)}
                    value={Math.min(draft, myCoins)}
                    onChange={e => setBidValue(e.target.value)}
                  />
                </div>
                <div className="au-bidbtns">
                  <button type="button" className="au-chip" onClick={() => setBidValue(0)}>0</button>
                  <button type="button" className="au-chip" onClick={() => setBidValue(Math.floor(myCoins * 0.25))}>25%</button>
                  <button type="button" className="au-chip" onClick={() => setBidValue(Math.floor(myCoins * 0.5))}>50%</button>
                  <button type="button" className="au-chip" onClick={() => setBidValue(myCoins)}>all-in</button>
                </div>
                <button type="button" className="au-btn warm" onClick={lockBid}>
                  Lock secret bid
                </button>
                <p className="au-note">Higher bid wins the card — both still spend their coins.</p>
              </div>
            )
          )}

          {phase === 'reveal' && reveal && (
            <div className="au-reveal">
              <div className="au-reveal-bids">
                <div className="au-reveal-bid A">
                  <span className="lbl">{names.A || 'A'}</span>
                  <span className="amt">{reveal.bidA}</span>
                </div>
                <div className="au-reveal-bid B">
                  <span className="lbl">{names.B || 'B'}</span>
                  <span className="amt">{reveal.bidB}</span>
                </div>
              </div>
              <div className="au-reveal-out">
                {reveal.winner
                  ? <><b>{reveal.winner === 'A' ? (names.A || 'A') : (names.B || 'B')}</b> claims {reveal.lot.emoji} {reveal.lot.name}</>
                  : <>Tie — nobody gets it, both paid</>}
              </div>
              <button type="button" className="au-btn warm" onClick={requestNext}>
                {lotIdx + 1 >= deck.length ? 'See results' : 'Draw next card'}
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
              : `${result.w === role ? 'You win' : `${result.w === 'A' ? (names.A || 'A') : (names.B || 'B')} wins`} the cabinet!`}
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
