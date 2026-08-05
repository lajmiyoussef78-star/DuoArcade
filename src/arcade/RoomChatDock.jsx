// RoomChatDock.jsx — embedded room chat column (no FAB).
// Only real player talk — hide game/call system events.
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  chatConfigured, getChatClient, listChatMessages, sendChatMessage,
  parseCallEvent, parseGameEvent,
} from '../lib/chat.js';

function isPlayerTalk(m) {
  if (!m) return false;
  const c = m.content;
  if (m.image_url) return true;
  if (typeof c !== 'string' || !c.trim()) return false;
  const trimmed = c.trim();
  if (parseGameEvent(trimmed) || parseCallEvent(trimmed)) return false;
  if (parseGameEvent(c) || parseCallEvent(c)) return false;
  // Hide system payloads even if prefix/brackets vary in stored history
  const low = trimmed.toLowerCase();
  if (
    low.includes('duo:game')
    || low.includes('duo:call')
    || low.includes('⟦duo:game⟧')
    || low.includes('[duo:game]')
    || low.includes('⟦duo:call⟧')
    || low.includes('[duo:call]')
  ) return false;
  // JSON game/call blobs without a recognized prefix
  if (
    (trimmed.startsWith('{') && /"kind"\s*:\s*"(started|ended|session|finished)"/.test(trimmed))
    || /"gameId"\s*:/.test(trimmed)
  ) return false;
  return true;
}

export default function RoomChatDock({
  code,
  userId,
  partnerName = 'Partner',
  myName = 'You',
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const listRef = useRef(null);
  const sbRef = useRef(null);
  const channelRef = useRef(null);

  const talk = useMemo(() => messages.filter(isPlayerTalk), [messages]);

  useEffect(() => {
    if (!chatConfigured() || !code || !userId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    getChatClient().then(async (sb) => {
      if (cancelled || !sb) return;
      sbRef.current = sb;
      setReady(true);
      try {
        const data = await listChatMessages(code);
        if (!cancelled) setMessages((data || []).filter(isPlayerTalk));
      } catch { /* table may not exist */ }
      if (!cancelled) setLoading(false);

      const ch = sb
        .channel(`room-chat-db-${code}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'duo_chat_messages',
            filter: `duo_code=eq.${code}`,
          },
          (payload) => {
            const row = payload.new;
            if (!row?.id || !isPlayerTalk(row)) return;
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          },
        )
        .subscribe();
      channelRef.current = ch;
    });
    return () => {
      cancelled = true;
      const sb = sbRef.current;
      const ch = channelRef.current;
      if (sb && ch) {
        try { sb.removeChannel(ch); } catch { /* */ }
      }
      channelRef.current = null;
    };
  }, [code, userId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [talk]);

  const send = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || !ready || !userId) return;
    setDraft('');
    try {
      const row = await sendChatMessage(code, userId, text);
      if (row?.id && isPlayerTalk(row)) {
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      }
    } catch {
      setDraft(text);
    }
  };

  const labelFor = (m) => (m.sender_id === userId ? myName : partnerName);

  return (
    <div className="gv-room-chat">
      <div className="gv-room-chat-tabs">
        <span className="on">Room Chat</span>
      </div>
      <div className="gv-room-chat-list" ref={listRef}>
        {!chatConfigured() && (
          <div className="gv-room-chat-empty">Chat unavailable</div>
        )}
        {chatConfigured() && loading && (
          <div className="gv-room-chat-empty">Loading…</div>
        )}
        {chatConfigured() && !loading && talk.length === 0 && (
          <div className="gv-room-chat-empty">No messages yet — say hi</div>
        )}
        {talk.map((m) => (
          <div
            key={m.id}
            className={'gv-room-chat-row' + (m.sender_id === userId ? ' mine' : '')}
          >
            <div className="gv-room-chat-who">{labelFor(m)}</div>
            <div className="gv-room-chat-bubble">{m.content}</div>
          </div>
        ))}
      </div>
      <form className="gv-room-chat-compose" onSubmit={send}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={500}
          disabled={!ready}
        />
        <button type="submit" disabled={!ready || !draft.trim()} aria-label="Send">
          ➤
        </button>
      </form>
    </div>
  );
}
