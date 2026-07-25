import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ENGINES } from '../engines/index.js';
import { createFriendsClient } from '../lib/friends.js';

/** Overlay for pending friend-match invites (guest side). */
export default function FriendMatchInvite({ enabled }) {
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let unsub = () => {};
    let timer = null;
    createFriendsClient().then(api => {
      if (!alive) return;
      setClient(api);
      const poll = async () => {
        try {
          const list = await api.listPendingMatchInvites();
          if (!alive) return;
          setInvite(list[0] || null);
        } catch { /* schema missing */ }
      };
      poll();
      timer = setInterval(poll, 5000);
      unsub = api.subscribeInbox(payload => {
        if (payload?.k === 'match-invite') poll();
      });
    });
    return () => {
      alive = false;
      clearInterval(timer);
      unsub();
    };
  }, [enabled]);

  if (!enabled || !invite) return null;

  const eng = ENGINES[invite.gameId];
  const names = invite.session?.names || {};

  const accept = async () => {
    if (!client) return;
    setError('');
    try {
      await client.respondMatch(invite.code, true);
      setInvite(null);
      navigate('/friend/' + invite.code);
    } catch (e) {
      setError(e.message);
    }
  };

  const decline = async () => {
    if (!client) return;
    setError('');
    try {
      await client.respondMatch(invite.code, false);
      setInvite(null);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="invite-overlay on">
      <div className="invite-modal" style={{ position: 'relative' }}>
        <div className="invite-icon">🎮</div>
        <div className="invite-text">
          <b>@{names.A || 'Friend'}</b> wants to play<br />
          {eng ? eng.meta.name : invite.gameId}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn warm" onClick={accept}>Accept & play</button>
          <button type="button" className="btn ghost" onClick={decline}>Decline</button>
        </div>
        <div className="status" style={{ color: '#FF8A8A', minHeight: 0 }}>{error}</div>
      </div>
    </div>
  );
}
