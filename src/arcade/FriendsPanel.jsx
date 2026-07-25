import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFriendsClient, friendPlayableGames } from '../lib/friends.js';
import { createSync } from '../lib/sync.js';
import '../styles/friends.css';

function statusLine(f) {
  if (!f?.online) return 'Offline';
  if (f.status === 'busy') return f.busy_label || 'Busy';
  if (f.status === 'away') return 'Away';
  return 'Online';
}

function FriendRow({ friend, mine, onPlay, onRemove, busy }) {
  const canPlay = mine && friend.online && friend.status !== 'busy' && !busy;
  return (
    <li className="friends-row">
      <span
        className={
          'friends-dot'
          + (friend.online && friend.status === 'busy' ? ' busy' : '')
          + (friend.online && friend.status !== 'busy' ? ' on' : '')
        }
        aria-hidden
      />
      <div className="friends-meta">
        <strong>@{friend.username || 'unknown'}</strong>
        <span>{statusLine(friend)}</span>
      </div>
      {mine && (
        <div className="friends-actions">
          {canPlay && (
            <button type="button" className="btn small warm" onClick={() => onPlay(friend)}>
              Play
            </button>
          )}
          <button type="button" className="btn small ghost" onClick={() => onRemove(friend)}>
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

export default function FriendsPanel({ partnerName = 'Partner', compact = false, onChanged }) {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [view, setView] = useState(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [picking, setPicking] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async api => {
    const apiClient = api || client;
    if (!apiClient) return;
    try {
      const data = await apiClient.listView();
      setView(data);
      setStatus('');
      onChanged?.(data);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }, [client, onChanged]);

  useEffect(() => {
    let alive = true;
    createFriendsClient().then(api => {
      if (!alive) return;
      setClient(api);
      reload(api);
    }).catch(e => {
      if (alive) { setStatus(e.message); setLoading(false); }
    });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!client) return;
    const t = setInterval(() => reload(client), 10000);
    return () => clearInterval(t);
  }, [client, reload]);

  const search = async () => {
    setStatus('');
    const q = query.trim();
    if (!q) { setHits([]); return; }
    try {
      const sync = await createSync();
      const rows = await sync.searchUsers(q);
      setHits((rows || []).filter(r => r.username));
    } catch (e) {
      setStatus(e.message);
    }
  };

  const send = async username => {
    if (!client) return;
    try {
      await client.sendRequest(username);
      setQuery('');
      setHits([]);
      setStatus('Request sent to @' + username);
      await reload();
    } catch (e) {
      setStatus(e.message);
    }
  };

  const respond = async (id, accept) => {
    try {
      await client.respondRequest(id, accept);
      await reload();
    } catch (e) {
      setStatus(e.message);
    }
  };

  const cancel = async id => {
    try {
      await client.cancelRequest(id);
      await reload();
    } catch (e) {
      setStatus(e.message);
    }
  };

  const remove = async friend => {
    if (!confirm(`Remove @${friend.username} from your friends?`)) return;
    try {
      await client.removeFriend(friend.id);
      await reload();
    } catch (e) {
      setStatus(e.message);
    }
  };

  const startMatch = async (friend, gameId) => {
    try {
      const match = await client.createMatch(friend.id, gameId);
      try {
        await client.notifyUser(friend.id, { k: 'match-invite', code: match.code, gameId });
      } catch { /* invite still in DB */ }
      setPicking(null);
      navigate('/friend/' + match.code);
    } catch (e) {
      setStatus(e.message);
    }
  };

  const games = friendPlayableGames();
  const mine = view?.mine || [];
  const partner = view?.partner || [];
  const incoming = view?.incoming || [];
  const outgoing = view?.outgoing || [];
  const slots = view?.slots_left ?? Math.max(0, 5 - mine.length);

  return (
    <div className={'friends-panel' + (compact ? ' compact' : '')}>
      {!compact && <h2>Friends</h2>}
      <p className="friends-lead">
        {compact
          ? `Add up to 5. ${partnerName} can see your list — friends cannot. Play is 1v1.`
          : `Add up to 5 friends. ${partnerName} can see your list (and you can see theirs) — your friends cannot see either list. Play is 1v1 with a friend; your partner stays out of the match.`}
      </p>

      <div className="friends-search">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search username…"
          maxLength={20}
        />
        <button type="button" className="btn small" onClick={search}>Search</button>
      </div>

      {hits.length > 0 && (
        <ul className="friends-hits">
          {hits.map(h => (
            <li key={h.username}>
              <span>@{h.username}</span>
              <button
                type="button"
                className="btn small warm"
                disabled={slots <= 0}
                onClick={() => send(h.username)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <section className="friends-section">
          <h3>Incoming</h3>
          <ul className="friends-list">
            {incoming.map(r => (
              <li key={r.id} className="friends-row">
                <div className="friends-meta">
                  <strong>@{r.from_username}</strong>
                  <span>wants to be friends</span>
                </div>
                <div className="friends-actions">
                  <button type="button" className="btn small warm" onClick={() => respond(r.id, true)}>Accept</button>
                  <button type="button" className="btn small ghost" onClick={() => respond(r.id, false)}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="friends-section">
          <h3>Outgoing</h3>
          <ul className="friends-list">
            {outgoing.map(r => (
              <li key={r.id} className="friends-row">
                <div className="friends-meta">
                  <strong>@{r.to_username}</strong>
                  <span>pending</span>
                </div>
                <div className="friends-actions">
                  <button type="button" className="btn small ghost" onClick={() => cancel(r.id)}>Cancel</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="friends-section">
        <h3>
          My friends
          <span className="friends-slots">{mine.length}/5 · {slots} left</span>
        </h3>
        {loading && <p className="friends-empty">Loading…</p>}
        {!loading && mine.length === 0 && (
          <p className="friends-empty">No friends yet — search a username above.</p>
        )}
        <ul className="friends-list">
          {mine.map(f => (
            <FriendRow
              key={f.id}
              friend={f}
              mine
              onPlay={setPicking}
              onRemove={remove}
            />
          ))}
        </ul>
      </section>

      {picking && (
        <section className="friends-section">
          <h3>Play with @{picking.username}</h3>
          <p className="friends-empty">Pick a remote-friendly game:</p>
          <div className="friends-game-picker">
            {games.map(g => (
              <button key={g.id} type="button" onClick={() => startMatch(picking, g.id)}>
                <strong>{g.name}</strong>
                <small>{g.tag}</small>
              </button>
            ))}
          </div>
          <button type="button" className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setPicking(null)}>
            Cancel
          </button>
        </section>
      )}

      <section className="friends-section">
        <h3>{partnerName}&apos;s friends</h3>
        {partner.length === 0 ? (
          <p className="friends-empty">They haven&apos;t added anyone yet.</p>
        ) : (
          <ul className="friends-list">
            {partner.map(f => (
              <FriendRow key={f.id} friend={f} mine={false} />
            ))}
          </ul>
        )}
      </section>

      <p className="friends-status">{status}</p>
    </div>
  );
}
