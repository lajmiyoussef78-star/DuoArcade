// RoomChat — per-game-room messages (like todo comments: each room has its own thread).
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient.js';
import {
  listRoomMessages,
  roomChatConfigured,
  sendRoomMessage,
} from '../lib/roomChat.js';
import { Avatar } from './avatars.jsx';
import { ChatEmpty } from './GameLobby.jsx';

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M4 11.5 19.5 4 14 20l-2.8-6.2L4 11.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {string} props.code
 * @param {string|null} props.roomId
 * @param {string|null|undefined} props.userId
 * @param {'A'|'B'} props.myRole
 * @param {object} props.duo
 * @param {{ avatar_a?: string|null, avatar_b?: string|null }} props.avatars
 */
export default function RoomChat({ code, roomId, userId, myRole, duo, avatars }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const nameOf = role => (role === 'A' ? (duo?.nameA || 'A') : (duo?.nameB || 'B'));
  const avatarOf = role => (role === 'A' ? avatars?.avatar_a : avatars?.avatar_b);

  useEffect(() => {
    setMessages([]);
    setDraft('');
    if (!roomChatConfigured() || !code || !roomId) return undefined;
    let cancelled = false;
    listRoomMessages(code, roomId)
      .then(data => { if (!cancelled) setMessages(data); })
      .catch(() => { if (!cancelled) setMessages([]); });
    return () => { cancelled = true; };
  }, [code, roomId]);

  useEffect(() => {
    if (!roomChatConfigured() || !code || !roomId || !userId) return undefined;
    let channel;
    let cancelled = false;
    getSupabase().then(sb => {
      if (cancelled) return;
      channel = sb
        .channel(`room-chat-${code}-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'duo_room_messages',
            filter: `duo_code=eq.${code}`,
          },
          (payload) => {
            const msg = payload.new;
            if (!msg || msg.room_id !== roomId) return;
            setMessages(prev => {
              const i = prev.findIndex(m =>
                m._temp && m.role === msg.role && m.content === msg.content
              );
              if (i !== -1) {
                const next = [...prev];
                next[i] = msg;
                return next;
              }
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) getSupabase().then(sb => sb.removeChannel(channel)).catch(() => {});
    };
  }, [code, roomId, userId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || !userId || !code || !roomId || sending) return;
    const tempId = `temp-${Date.now()}`;
    const temp = {
      id: tempId,
      _temp: true,
      duo_code: code,
      room_id: roomId,
      role: myRole,
      sender_id: userId,
      content,
      created_at: new Date().toISOString(),
    };
    setDraft('');
    setMessages(prev => [...prev, temp]);
    setSending(true);
    try {
      const data = await sendRoomMessage(code, roomId, {
        role: myRole,
        senderId: userId,
        content,
      });
      setMessages(prev => {
        if (data && prev.some(m => m.id === data.id)) return prev.filter(m => m.id !== tempId);
        return prev.map(m => (m.id === tempId ? (data || { ...m, _failed: true }) : m));
      });
    } catch {
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, _failed: true } : m)));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [draft, userId, code, roomId, myRole, sending]);

  const canSend = !!draft.trim() && !!userId && !!code && !!roomId && !sending && roomChatConfigured();

  return (
    <section className="gr-side-chat" aria-label="Room chat">
      <h3 className="gr-side-title gr-chat-heading">Room Chat</h3>
      <div className="gr-chat-list" ref={listRef}>
        {!messages.length ? (
          <ChatEmpty tab="chat" />
        ) : (
          messages.map((m, i) => {
            const mine = userId
              ? m.sender_id === userId
              : m.role === myRole;
            const role = m.role === 'A' || m.role === 'B'
              ? m.role
              : (mine ? myRole : (myRole === 'A' ? 'B' : 'A'));
            const name = nameOf(role);
            const prev = messages[i - 1];
            const prevMine = prev
              ? (userId ? prev.sender_id === userId : prev.role === myRole)
              : null;
            const sameAsPrev = prev != null && prevMine === mine
              && (userId
                ? prev.sender_id === m.sender_id
                : prev.role === m.role);
            const showMeta = !sameAsPrev;
            return (
              <div
                key={m.id}
                className={
                  'gr-chat-msg'
                  + (mine ? ' mine' : '')
                  + (m._failed ? ' failed' : '')
                  + (sameAsPrev ? ' grouped' : '')
                }
              >
                {!mine && (
                  <div className={'gr-chat-av' + (showMeta ? '' : ' ghost')}>
                    {showMeta ? (
                      <Avatar id={avatarOf(role)} size={28} fallback={(name || '?')[0]} />
                    ) : null}
                  </div>
                )}
                <div className="gr-chat-body">
                  {m.content && <p>{m.content}</p>}
                  {m._failed && <p className="gr-chat-failed">Not sent</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="gr-chat-compose">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            !roomChatConfigured()
              ? 'Chat unavailable'
              : !roomId
                ? 'Waiting for room…'
                : 'Type a message…'
          }
          maxLength={1000}
          disabled={!roomChatConfigured() || !userId || !roomId}
        />
        <button
          type="button"
          className="gr-chat-send"
          onClick={send}
          disabled={!canSend}
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </div>
    </section>
  );
}
