import { useEffect, useState } from 'react';
import { other, totalsOf, loadSeats, SEAT_KEY } from '../lib/util.js';
import { Celebration } from './CoupleFx.jsx';
import ChallengeCard from './ChallengeCard.jsx';
import GamesBrowse from './GamesBrowse.jsx';

const MS_KEY = code => 'duoarcade-ms-' + code;

/** Home body only — chrome lives in DuoHomeLayout so XP bar stays mounted. */
export default function HomeScreen({
  duo, code, myRole, homeStatus,
  onStartGame, onSetFavoriteGames,
}) {
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(null);

  const t = totalsOf(duo);
  const partnerRole = other(myRole);
  const partnerName = partnerRole === 'A' ? duo.nameA : duo.nameB;
  const partnerLinked = partnerRole === 'A' ? !!duo.memberA : !!duo.memberB;
  const bothLinked = !!duo.memberA && !!duo.memberB;
  const inviteToken = loadSeats()['invite-' + code];
  const inviteUrl = !bothLinked && inviteToken
    ? `${window.location.origin}${window.location.pathname}?duo=${code}&t=${inviteToken}` : null;

  useEffect(() => {
    if (bothLinked && loadSeats()['invite-' + code]) {
      const s = loadSeats();
      delete s['invite-' + code];
      localStorage.setItem(SEAT_KEY, JSON.stringify(s));
    }
  }, [bothLinked, code]);

  useEffect(() => {
    const reached = [10, 25, 50, 100, 250].filter(m => t.games >= m).pop() || 0;
    const seen = Number(localStorage.getItem(MS_KEY(code)) || 0);
    if (reached > seen) {
      localStorage.setItem(MS_KEY(code), String(reached));
      if (seen > 0) {
        setCelebrate({
          title: `${reached} games together`,
          sub: `${duo.nameA} & ${duo.nameB} — here's to many more evenings.`
        });
      }
    }
  }, [t.games, code, duo.nameA, duo.nameB]);

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      {celebrate && (
        <Celebration title={celebrate.title} sub={celebrate.sub}
          icon={celebrate.icon || '🏆'} onClose={() => setCelebrate(null)} />
      )}

      <GamesBrowse
        duo={duo}
        code={code}
        onStartGame={onStartGame}
        onSetFavoriteGames={onSetFavoriteGames}
      />

      <ChallengeCard />

      {myRole === 'A' && inviteUrl && (
        <div className="invite-box" style={{ width: '100%', marginTop: 14 }}>
          <div className="share">{inviteUrl}</div>
          <div className="row">
            <button className="btn small" onClick={copyInvite}>{copied ? 'Copied!' : 'Copy invite link'}</button>
          </div>
        </div>
      )}
      <div className="status">
        {!partnerLinked
          ? `⚠ ${partnerName} hasn’t opened the invite link while signed in yet — invitations only reach them while they have this duo open. Send them the invite link below once.`
          : homeStatus}
      </div>
    </>
  );
}
