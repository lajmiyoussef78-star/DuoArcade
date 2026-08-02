// Single friends poll shared by the sidebar badge and the context rail,
// so the dashboard does not open a second client next to FriendsDock.

import { useCallback, useEffect, useState } from 'react';
import { createFriendsClient, isFriendOnline } from '../lib/friends.js';

const POLL_MS = 20000;

function rank(f) {
  if (!isFriendOnline(f)) return 0;
  return f.status === 'busy' ? 1 : 2;
}

export default function useFriendsView(enabled) {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async api => {
    try {
      const view = await api.listView();
      const mine = Array.isArray(view?.mine) ? view.mine : [];
      setFriends([...mine].sort((a, b) => rank(b) - rank(a)
        || String(a.username || '').localeCompare(String(b.username || ''))));
      setIncoming(Array.isArray(view?.incoming) ? view.incoming : []);
    } catch { /* FriendsDock surfaces friend errors */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let timer = null;
    createFriendsClient().then(api => {
      if (!alive) return;
      load(api);
      timer = window.setInterval(() => { if (alive) load(api); }, POLL_MS);
    }).catch(() => { if (alive) setLoaded(true); });
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [enabled, load]);

  return { friends, incoming, loaded };
}
