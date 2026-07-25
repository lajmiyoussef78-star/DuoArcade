import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFriendsClient, friendPlayableGames } from '../lib/friends.js';
import { createSync } from '../lib/sync.js';
import '../styles/friends.css';

const OPEN_KEY = 'duoarcade-friends-dock-open';
const MAX_FRIENDS = 5;

function statusLine(f) {
  if (!f?.online) return 'Offline';
  if (f.status === 'busy') return f.busy_label || 'Busy';
  if (f.status === 'away') return 'Away';
  return 'Online';
}

function sortFriends(list) {
  return [...(list || [])].sort((a, b) => {
    const ao = a.online ? (a.status === 'busy' ? 1 : 2) : 0;
    const bo = b.online ? (b.status === 'busy' ? 1 : 2) : 0;
    if (bo !== ao) return bo - ao;
    return String(a.username || '').localeCompare(String(b.username || ''));
  }).slice(0, MAX_FRIENDS);
}

function initial(name) {
  const s = (name || '?').replace(/^@/, '');
  return (s[0] || '?').toUpperCase();
}

/** Discord-style right friends dock with a side triangle toggle. */
export default function FriendsDock({ enabled, partnerName = 'Partner' }) {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== '0'; } catch { return true; }
  });
  const [adding, setAdding] = useState(false);
  const [viewPartner, setViewPartner] = useState(false);
  const [friends, setFriends] = useState([]);
  const [partnerFriends, setPartnerFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [client, setClient] = useState(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [addStatus, setAddStatus] = useState('');

  const atCap = friends.length >= MAX_FRIENDS;
  const showAddBtn = !viewPartner && (adding || !atCap);

  const toggle = () => {
    setOpen(v => {
      const next = !v;
      try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  };

  /* Keep chat FAB / panel clear of the friends rail */
  useEffect(() => {
    const page = document.querySelector('.arcade-page');
    if (!page) return undefined;
    if (!enabled) {
      page.style.removeProperty('--friends-rail');
      return undefined;
    }
    page.style.setProperty(
      '--friends-rail',
      open ? 'calc(min(272px, 84vw) + 18px)' : '40px'
    );
    return () => { page.style.removeProperty('--friends-rail'); };
  }, [enabled, open]);

  useEffect(() => {
    if (!menuFor) return undefined;
    const onDoc = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuFor]);

  const reload = useCallback(async api => {
    const c = api || client;
    if (!c) return;
    try {
      const view = await c.listView();
      const mine = sortFriends(view?.mine);
      setFriends(mine);
      setPartnerFriends(sortFriends(view?.partner));
      setIncoming(Array.isArray(view?.incoming) ? view.incoming : []);
      setError('');
      if (mine.length >= MAX_FRIENDS) setAdding(false);
    } catch (e) {
      setError(e.message);
    }
  }, [client]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    createFriendsClient().then(api => {
      if (!alive) return;
      setClient(api);
      reload(api);
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled || !client) return undefined;
    const t = setInterval(() => reload(client), 8000);
    return () => clearInterval(t);
  }, [enabled, client, reload]);

  const onlineCount = useMemo(
    () => friends.filter(f => f.online).length,
    [friends]
  );

  const startMatch = async (friend, gameId) => {
    if (!client) return;
    try {
      const match = await client.createMatch(friend.id, gameId);
      try {
        await client.notifyUser(friend.id, { k: 'match-invite', code: match.code, gameId });
      } catch { /* */ }
      setPicking(null);
      navigate('/friend/' + match.code);
    } catch (e) {
      setError(e.message);
    }
  };

  const openAdd = () => {
    if (atCap) return;
    setAdding(true);
    setViewPartner(false);
    setPicking(null);
    setMenuFor(null);
    setOpen(true);
    try { localStorage.setItem(OPEN_KEY, '1'); } catch { /* */ }
  };

  const closeAdd = () => {
    setAdding(false);
    setQuery('');
    setHits([]);
    setAddStatus('');
    reload(client);
  };

  const openPartner = () => {
    setViewPartner(true);
    setAdding(false);
    setPicking(null);
    setMenuFor(null);
    setQuery('');
    setHits([]);
    setAddStatus('');
    setOpen(true);
    try { localStorage.setItem(OPEN_KEY, '1'); } catch { /* */ }
    reload(client);
  };

  const closePartner = () => {
    setViewPartner(false);
  };

  const search = async () => {
    setAddStatus('');
    const q = query.trim();
    if (!q) { setHits([]); return; }
    try {
      const sync = await createSync();
      const rows = await sync.searchUsers(q);
      setHits((rows || []).filter(r => r.username));
    } catch (e) {
      setAddStatus(e.message);
    }
  };

  const sendRequest = async username => {
    if (!client) return;
    try {
      await client.sendRequest(username);
      setQuery('');
      setHits([]);
      setAddStatus('Request sent to @' + username);
      await reload();
    } catch (e) {
      setAddStatus(e.message);
    }
  };

  const respond = async (id, accept) => {
    if (!client) return;
    try {
      await client.respondRequest(id, accept);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeFriend = async friend => {
    if (!client) return;
    if (!confirm(`Remove @${friend.username} from your friends?`)) return;
    try {
      await client.removeFriend(friend.id);
      setMenuFor(null);
      setPicking(null);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!enabled) return null;

  const games = friendPlayableGames();
  const slotsLeft = Math.max(0, MAX_FRIENDS - friends.length);

  return (
    <aside
      className={'friends-dock' + (open ? ' open' : ' collapsed')}
      aria-label="Friends"
    >
      <button
        type="button"
        className="friends-dock-toggle"
        onClick={toggle}
        aria-label={open ? 'Hide friends' : 'Show friends'}
        aria-expanded={open}
        aria-controls="friends-dock-panel"
      >
        <svg className="friends-dock-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14.5 6.5 9 12l5.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        id="friends-dock-panel"
        className="friends-dock-panel"
        aria-hidden={!open}
        {...(!open ? { inert: '' } : {})}
      >
        {incoming.length > 0 && (
          <div className="friends-dock-requests" aria-label="Friend requests">
            {incoming.map(r => (
              <div key={r.id} className="friends-dock-request">
                <div className="friends-dock-request-meta">
                  <strong>@{r.from_username || 'unknown'}</strong>
                  <span>wants to be friends</span>
                </div>
                <div className="friends-dock-request-actions">
                  <button
                    type="button"
                    className="friends-dock-req-accept"
                    disabled={atCap}
                    title={atCap ? 'Friend list is full (5/5)' : 'Accept'}
                    onClick={() => respond(r.id, true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="friends-dock-req-decline"
                    onClick={() => respond(r.id, false)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <header className="friends-dock-head">
          <div className="friends-dock-title">
            <span className="friends-dock-pulse" aria-hidden />
            <h2>
              {viewPartner
                ? `${partnerName}'s friends`
                : adding
                  ? 'Add friends'
                  : `Online · ${onlineCount}`}
            </h2>
          </div>
          <div className="friends-dock-head-actions">
            {showAddBtn && (
              <button
                type="button"
                className="friends-dock-manage"
                onClick={() => (adding ? closeAdd() : openAdd())}
                aria-label={adding ? 'Back to friends list' : 'Add friends'}
              >
                {adding ? 'Back' : 'Add friends'}
              </button>
            )}
            <button
              type="button"
              className="friends-dock-manage"
              onClick={() => (viewPartner ? closePartner() : openPartner())}
              aria-label={
                viewPartner
                  ? 'Back to your friends'
                  : `View ${partnerName}'s friends`
              }
            >
              {viewPartner ? 'Back' : "Partner's friends"}
            </button>
          </div>
        </header>

        {viewPartner ? (
          partnerFriends.length === 0 ? (
            <p className="friends-dock-empty">
              {partnerName} hasn&apos;t added anyone yet.
            </p>
          ) : (
            <ul className="friends-dock-list">
              {partnerFriends.map(f => {
                const online = !!f.online;
                const busy = online && f.status === 'busy';
                return (
                  <li
                    key={f.id}
                    className={
                      'friends-dock-card'
                      + (online ? ' on' : '')
                      + (busy ? ' busy' : '')
                    }
                  >
                    <div className="friends-dock-av-wrap">
                      <div className="friends-dock-av">{initial(f.username)}</div>
                      <span
                        className={
                          'friends-dock-status'
                          + (busy ? ' busy' : online ? ' on' : '')
                        }
                        aria-hidden
                      />
                    </div>
                    <div className="friends-dock-meta">
                      <strong>@{f.username || 'unknown'}</strong>
                      <span>{statusLine(f)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : adding ? (
          <div className="friends-dock-manage-body">
            <p className="friends-dock-empty">
              Search a username · {slotsLeft} slot{slotsLeft === 1 ? '' : 's'} left
            </p>
            <div className="friends-dock-add-search">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Search username…"
                maxLength={20}
              />
              <button type="button" className="friends-dock-manage" onClick={search}>
                Search
              </button>
            </div>
            {hits.length > 0 && (
              <ul className="friends-dock-hits">
                {hits.map(h => (
                  <li key={h.username}>
                    <span>@{h.username}</span>
                    <button
                      type="button"
                      className="friends-dock-play"
                      disabled={atCap}
                      onClick={() => sendRequest(h.username)}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {addStatus && <p className="friends-dock-hint">{addStatus}</p>}
          </div>
        ) : error && !friends.length ? (
          <p className="friends-dock-empty">{error}</p>
        ) : friends.length === 0 ? (
          <p className="friends-dock-empty">
            No friends yet. Tap Add friends to add up to 5.
          </p>
        ) : (
          <ul className="friends-dock-list">
            {friends.map(f => {
              const online = !!f.online;
              const busy = online && f.status === 'busy';
              const canPlay = online && !busy;
              const menuOpen = menuFor === f.id;
              return (
                <li
                  key={f.id}
                  className={
                    'friends-dock-card'
                    + (online ? ' on' : '')
                    + (busy ? ' busy' : '')
                  }
                >
                  <div className="friends-dock-av-wrap">
                    <div className="friends-dock-av">{initial(f.username)}</div>
                    <span
                      className={
                        'friends-dock-status'
                        + (busy ? ' busy' : online ? ' on' : '')
                      }
                      aria-hidden
                    />
                  </div>
                  <div className="friends-dock-meta">
                    <strong>@{f.username || 'unknown'}</strong>
                    <span>{statusLine(f)}</span>
                  </div>
                  {canPlay && (
                    <button
                      type="button"
                      className="friends-dock-play"
                      onClick={() => {
                        setMenuFor(null);
                        setPicking(picking?.id === f.id ? null : f);
                      }}
                    >
                      Play
                    </button>
                  )}
                  <div
                    className="friends-dock-more"
                    ref={menuOpen ? menuRef : undefined}
                  >
                    <button
                      type="button"
                      className="friends-dock-more-btn"
                      aria-label={`More options for @${f.username || 'friend'}`}
                      aria-expanded={menuOpen}
                      onClick={() => setMenuFor(menuOpen ? null : f.id)}
                    >
                      :
                    </button>
                    {menuOpen && (
                      <div className="friends-dock-more-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => removeFriend(f)}
                        >
                          Remove friend
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!adding && !viewPartner && picking && (
          <div className="friends-dock-picker">
            <div className="friends-dock-picker-head">
              Play with @{picking.username}
              <button type="button" className="friends-dock-manage" onClick={() => setPicking(null)}>✕</button>
            </div>
            <div className="friends-dock-games">
              {games.slice(0, 12).map(g => (
                <button key={g.id} type="button" onClick={() => startMatch(picking, g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!adding && !viewPartner && error && friends.length > 0 && (
          <p className="friends-dock-hint">{error}</p>
        )}
      </div>
    </aside>
  );
}
