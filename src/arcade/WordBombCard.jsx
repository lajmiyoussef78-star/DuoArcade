// src/arcade/WordBombCard.jsx — Word Bomb home-screen card.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadWordBomb } from '../lib/wordbomb.js';
import '../styles/wordbomb.css';

export default function WordBombCard({ code }) {
  const [rec, setRec] = useState({ a: 0, b: 0 });
  useEffect(() => { loadWordBomb(code).then(setRec).catch(() => {}); }, [code]);
  const played = rec.a + rec.b;
  return (
    <div className="boc">
      <div className="boc-emoji">{'\u{1F4A3}'}</div>
      <div className="boc-body">
        <h3>Word Bomb</h3>
        <p>Type a word with the fragment, pass the bomb. The fuse is hidden — caught holding it, lose a life.</p>
        <div className="boc-rec">{played > 0 ? `record ${rec.a}\u2013${rec.b}` : 'no matches yet'}</div>
      </div>
      <Link className="btn warm small" to={`/wordbomb/${code}`}>Light it</Link>
    </div>
  );
}
