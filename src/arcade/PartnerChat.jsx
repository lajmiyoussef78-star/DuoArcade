// PartnerChat.jsx — floating partner chat (FAB + panel).
// Text, photos, voice/video calls (WebRTC over Supabase broadcast).

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  chatConfigured, getChatClient, listChatMessages, sendChatMessage,
  uploadChatImage, markChatSeen, parseCallEvent, sendCallEvent
} from '../lib/chat.js';
import { startRingtone, stopRingtone } from '../lib/ringtone.js';
import '../styles/chat.css';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
const MAX_IMAGE_MB = 5;
const RING_TIMEOUT_MS = 60_000;

export default function PartnerChat({ code, userId, partnerName = 'Partner' }) {
  const [ready, setReady] = useState(false);
  const [supabase, setSupabase] = useState(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pendingImage, setPendingImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [snapOpen, setSnapOpen] = useState(false);

  const [call, setCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callError, setCallError] = useState(null);
  const [callPos, setCallPos] = useState(null); // { left, top } after first drag
  const [draggingCall, setDraggingCall] = useState(false);

  const openRef = useRef(open);
  const callRef = useRef(call);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);   // gallery
  const cameraInputRef = useRef(null); // mobile native camera
  const liveChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const markSeenRef = useRef(async () => {});
  const callWinRef = useRef(null);
  const dragRef = useRef(null); // { ox, oy, left, top }
  const missedPostedRef = useRef(false);
  const endedPostedRef = useRef(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const incomingOfferRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const snapVideoRef = useRef(null);
  const snapStreamRef = useRef(null);
  const ringTimerRef = useRef(null);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { callRef.current = call; }, [call]);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener('duoarcade-open-chat', openChat);
    return () => window.removeEventListener('duoarcade-open-chat', openChat);
  }, []);

  useEffect(() => {
    if (!chatConfigured() || !code || !userId) return;
    let cancelled = false;
    getChatClient().then(sb => {
      if (!cancelled) { setSupabase(sb); setReady(true); }
    });
    return () => { cancelled = true; };
  }, [code, userId]);

  const markSeen = useCallback(async (ids) => {
    if (!ids?.length) return;
    try { await markChatSeen(ids); } catch { /* ignore */ }
  }, []);
  markSeenRef.current = markSeen;

  useEffect(() => {
    if (!ready || !code || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await listChatMessages(code);
        if (!cancelled) {
          setMessages(data);
          setUnread(data.filter(m => m.sender_id !== userId && !m.seen_at).length);
        }
      } catch { /* table may not exist yet */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ready, code, userId]);

  function bindVideoEl(el, stream) {
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = el === localVideoRef.current || el === snapVideoRef.current;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function clearRingTimer() {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    stopRingtone();
  }

  function cleanupCall(notifyPeer) {
    const c = callRef.current;
    // Whoever hangs up after a connected call logs duration in chat
    if (notifyPeer && c?.status === 'active') {
      const secs = c.startedAt
        ? Math.max(1, Math.round((Date.now() - c.startedAt) / 1000))
        : Math.max(1, callSeconds);
      postEndedCall(c.video, secs);
    }
    clearRingTimer();
    if (notifyPeer) {
      liveChannelRef.current?.send({ type: 'broadcast', event: 'call-end', payload: { userId } });
    }
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingIceRef.current = [];
    incomingOfferRef.current = null;
    setCall(null);
    setMuted(false);
    setCamOff(false);
    setCallSeconds(0);
  }

  // No answer within 1 minute → end call + missed-call in chat
  function onRingTimeout() {
    const c = callRef.current;
    if (!c || (c.status !== 'calling' && c.status !== 'ringing')) return;
    stopRingtone();
    if (c.status === 'calling') {
      postMissedCall(c.video, 'missed');
      setCallError('No answer');
      cleanupCall(true);
    } else {
      // Callee never picked up — tell caller so they log the miss
      liveChannelRef.current?.send({
        type: 'broadcast', event: 'call-decline',
        payload: { userId, timeout: true }
      });
      setCallError('Missed call');
      cleanupCall(false);
    }
  }

  function armRingTimeout() {
    clearRingTimer();
    startRingtone();
    ringTimerRef.current = setTimeout(onRingTimeout, RING_TIMEOUT_MS);
  }

  // Caller posts a missed-call line into chat (decline / cancel / busy).
  async function postMissedCall(video, kind = 'missed') {
    if (!code || !userId || missedPostedRef.current) return;
    missedPostedRef.current = true;
    try {
      await sendCallEvent(code, userId, { kind, video: !!video });
    } catch { /* ignore */ }
  }

  // Either side posts a completed-call line with duration after hang-up.
  async function postEndedCall(video, seconds) {
    if (!code || !userId || endedPostedRef.current) return;
    endedPostedRef.current = true;
    try {
      await sendCallEvent(code, userId, { kind: 'ended', video: !!video, seconds });
    } catch { /* ignore */ }
  }

  const flushIce = async () => {
    for (const c of pendingIceRef.current) {
      try { await pcRef.current?.addIceCandidate(c); } catch { /* ignore */ }
    }
    pendingIceRef.current = [];
  };

  useEffect(() => {
    if (!supabase || !code || !userId) return;
    const channel = supabase
      .channel(`chat-db-${code}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'duo_chat_messages', filter: `duo_code=eq.${code}` },
        (payload) => {
          const msg = payload.new;
          setMessages(prev => {
            const i = prev.findIndex(m =>
              m._temp && m.sender_id === msg.sender_id &&
              ((m.content && m.content === msg.content) || (m.image_url && msg.image_url))
            );
            if (i !== -1) { const next = [...prev]; next[i] = msg; return next; }
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender_id !== userId) {
            setPartnerTyping(false);
            if (openRef.current && document.hasFocus()) markSeenRef.current([msg.id]);
            else setUnread(u => u + 1);
          }
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'duo_chat_messages', filter: `duo_code=eq.${code}` },
        (payload) => {
          setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, code, userId]);

  useEffect(() => {
    if (!supabase || !code || !userId) return;
    const channel = supabase.channel(`chat-live-${code}`, {
      config: { presence: { key: userId } }
    });
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === userId) return;
        setPartnerTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 2500);
      })
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        if (payload.userId === userId) return;
        if (callRef.current) {
          channel.send({ type: 'broadcast', event: 'call-decline', payload: { userId, busy: true } });
          return;
        }
        incomingOfferRef.current = payload.sdp;
        missedPostedRef.current = false;
        endedPostedRef.current = false;
        setCall({ status: 'ringing', video: payload.video });
        setOpen(true);
        armRingTimeout();
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (payload.userId === userId || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(payload.sdp);
        await flushIce();
        missedPostedRef.current = true; // connected — not a miss
        endedPostedRef.current = false;
        clearRingTimer();
        setCall(c => (c ? { ...c, status: 'active', startedAt: Date.now() } : c));
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.userId === userId) return;
        if (pcRef.current?.remoteDescription) {
          try { await pcRef.current.addIceCandidate(payload.candidate); } catch { /* ignore */ }
        } else {
          pendingIceRef.current.push(payload.candidate);
        }
      })
      .on('broadcast', { event: 'call-decline' }, ({ payload }) => {
        if (payload.userId === userId) return;
        const c = callRef.current;
        // We were the caller waiting — log missed call in the thread
        if (c?.status === 'calling') {
          postMissedCall(c.video, payload.busy ? 'busy' : 'missed');
          setCallError(
            payload.busy ? `${partnerName} is busy`
              : payload.timeout ? 'No answer'
                : `${partnerName} declined`
          );
        }
        cleanupCall(false);
      })
      .on('broadcast', { event: 'call-end' }, ({ payload }) => {
        if (payload.userId === userId) return;
        const c = callRef.current;
        if (c?.status === 'calling') {
          postMissedCall(c.video, 'missed');
          setCallError('No answer');
        }
        // Peer hung up — they log the ended call; we just tear down
        if (c?.status === 'active') endedPostedRef.current = true;
        cleanupCall(false);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPartnerOnline(Object.keys(state).some(key => key !== userId));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() });
      });
    liveChannelRef.current = channel;
    return () => {
      clearTimeout(typingTimeoutRef.current);
      cleanupCall(false);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, code, userId, partnerName]);

  const markAllSeen = useCallback(() => {
    setMessages(prev => {
      const unseenIds = prev.filter(m => m.sender_id !== userId && !m.seen_at).map(m => m.id);
      if (unseenIds.length) markSeen(unseenIds);
      return prev;
    });
    setUnread(0);
  }, [userId, markSeen]);

  useEffect(() => {
    if (open) {
      markAllSeen();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
    const onFocus = () => { if (openRef.current) markAllSeen(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open, markAllSeen]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, partnerTyping, open, pendingImage]);

  useEffect(() => {
    if (call?.status !== 'active') return;
    const t = setInterval(() => setCallSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  // Re-attach streams after the video nodes mount (fixes black preview),
  // and keep play() alive so some GPUs don't blank the feed when idle.
  useEffect(() => {
    if (!call || call.status === 'ringing') return;
    bindVideoEl(localVideoRef.current, localStreamRef.current);
    bindVideoEl(remoteVideoRef.current, remoteStreamRef.current);
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (!call.video) return undefined;
    const keepAlive = setInterval(() => {
      bindVideoEl(localVideoRef.current, localStreamRef.current);
      bindVideoEl(remoteVideoRef.current, remoteStreamRef.current);
    }, 2000);
    return () => clearInterval(keepAlive);
  }, [call?.status, call?.video, camOff]);

  // Instant camera capture overlay (desktop / when capture= is ignored)
  useEffect(() => {
    if (!snapOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        snapStreamRef.current = stream;
        stream.getVideoTracks().forEach(t => { try { t.contentHint = 'motion'; } catch { /* ignore */ } });
        bindVideoEl(snapVideoRef.current, stream);
      } catch (err) {
        setSnapOpen(false);
        setCallError(err.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : 'Could not open the camera');
      }
    })();
    return () => {
      cancelled = true;
      snapStreamRef.current?.getTracks().forEach(t => t.stop());
      snapStreamRef.current = null;
    };
  }, [snapOpen]);

  // Default place for a new call window (top-right with breathing room)
  useEffect(() => {
    if (!call) {
      setCallPos(null);
      setDraggingCall(false);
      dragRef.current = null;
      return;
    }
    if (callPos) return;
    const w = Math.min(320, window.innerWidth - 32);
    setCallPos({
      left: Math.max(12, window.innerWidth - w - 24),
      top: 24
    });
  }, [call, callPos]);

  useEffect(() => {
    if (!draggingCall) return;
    const onMove = (e) => {
      const d = dragRef.current;
      const el = callWinRef.current;
      if (!d || !el) return;
      const rect = el.getBoundingClientRect();
      const maxL = Math.max(8, window.innerWidth - rect.width - 8);
      const maxT = Math.max(8, window.innerHeight - rect.height - 8);
      const left = Math.min(maxL, Math.max(8, e.clientX - d.ox));
      const top = Math.min(maxT, Math.max(8, e.clientY - d.oy));
      setCallPos({ left, top });
    };
    const onUp = () => {
      setDraggingCall(false);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingCall]);

  const beginCallDrag = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('button, a, input, video')) return;
    const el = callWinRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top
    };
    setCallPos({ left: rect.left, top: rect.top });
    setDraggingCall(true);
    e.preventDefault();
  };

  const send = async () => {
    const content = draft.trim() || null;
    if ((!content && !pendingImage) || !userId) return;

    const tempId = `temp-${Date.now()}`;
    const img = pendingImage;
    const temp = {
      id: tempId,
      _temp: true,
      duo_code: code,
      sender_id: userId,
      content,
      image_url: img?.previewUrl || null,
      created_at: new Date().toISOString(),
      seen_at: null
    };
    setDraft('');
    setPendingImage(null);
    setMessages(prev => [...prev, temp]);

    let imageUrl = null;
    try {
      if (img) {
        setUploading(true);
        imageUrl = await uploadChatImage(code, img.file);
        setUploading(false);
      }
      const data = await sendChatMessage(code, userId, content, imageUrl);
      setMessages(prev => {
        if (data && prev.some(m => m.id === data.id)) return prev.filter(m => m.id !== tempId);
        return prev.map(m => (m.id === tempId ? (data || { ...m, _failed: true }) : m));
      });
      if (img) URL.revokeObjectURL(img.previewUrl);
    } catch {
      setUploading(false);
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, _failed: true } : m)));
    }
  };

  const acceptPickedFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setCallError(`Image too large (max ${MAX_IMAGE_MB} MB)`);
      return;
    }
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
    inputRef.current?.focus();
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    acceptPickedFile(file);
  };

  const openInstantCamera = () => {
    // Phones: native camera via capture=. Desktop: in-app snap overlay.
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    if (touch && cameraInputRef.current) {
      cameraInputRef.current.click();
      return;
    }
    setSnapOpen(true);
  };

  const closeSnap = () => {
    snapStreamRef.current?.getTracks().forEach(t => t.stop());
    snapStreamRef.current = null;
    setSnapOpen(false);
  };

  const takeSnap = () => {
    const video = snapVideoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeSnap();
      acceptPickedFile(file);
    }, 'image/jpeg', 0.92);
  };

  const onDraftChange = (e) => {
    setDraft(e.target.value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1200 && liveChannelRef.current) {
      lastTypingSentRef.current = now;
      liveChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId } });
    }
  };

  const buildPeer = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        liveChannelRef.current?.send({
          type: 'broadcast', event: 'ice',
          payload: { userId, candidate: e.candidate.toJSON() }
        });
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams?.[0] || new MediaStream([e.track]);
      remoteStreamRef.current = stream;
      bindVideoEl(remoteVideoRef.current, stream);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        if (callRef.current?.status === 'active') cleanupCall(false);
      }
    };
    pcRef.current = pc;
    return pc;
  };

  const getMedia = async (video) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: video
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false
    });
    localStreamRef.current = stream;
    stream.getVideoTracks().forEach(t => {
      try { t.contentHint = 'motion'; } catch { /* ignore */ }
    });
    // Wait a frame so <video> nodes exist after setCall
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    bindVideoEl(localVideoRef.current, stream);
    return stream;
  };

  const startCall = async (video) => {
    if (call) return;
    setCallError(null);
    missedPostedRef.current = false;
    endedPostedRef.current = false;
    try {
      setCall({ status: 'calling', video });
      armRingTimeout();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const stream = await getMedia(video);
      const pc = buildPeer();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      liveChannelRef.current?.send({
        type: 'broadcast', event: 'call-offer',
        payload: { userId, video, sdp: pc.localDescription }
      });
      bindVideoEl(localVideoRef.current, stream);
    } catch (err) {
      setCallError(err.name === 'NotAllowedError'
        ? 'Microphone/camera permission denied'
        : 'Could not start the call');
      cleanupCall(false);
    }
  };

  // Cancel outbound call before answer → missed call in chat
  const cancelOrEndCall = () => {
    const c = callRef.current;
    if (c?.status === 'calling') postMissedCall(c.video, 'missed');
    cleanupCall(true);
  };

  const acceptCall = async () => {
    try {
      const video = call?.video;
      const stream = await getMedia(video);
      const pc = buildPeer();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(incomingOfferRef.current);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      liveChannelRef.current?.send({
        type: 'broadcast', event: 'call-answer',
        payload: { userId, sdp: pc.localDescription }
      });
      missedPostedRef.current = true;
      endedPostedRef.current = false;
      clearRingTimer();
      setCall(c => (c ? { ...c, status: 'active', startedAt: Date.now() } : c));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      bindVideoEl(localVideoRef.current, stream);
      bindVideoEl(remoteVideoRef.current, remoteStreamRef.current);
    } catch (err) {
      setCallError(err.name === 'NotAllowedError'
        ? 'Microphone/camera permission denied'
        : 'Could not join the call');
      liveChannelRef.current?.send({ type: 'broadcast', event: 'call-decline', payload: { userId } });
      cleanupCall(false);
    }
  };

  const declineCall = () => {
    // Caller records the missed call when they receive decline
    liveChannelRef.current?.send({ type: 'broadcast', event: 'call-decline', payload: { userId } });
    cleanupCall(false);
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = muted; setMuted(!muted); }
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = camOff; setCamOff(!camOff); }
  };

  const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDur = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const lastOwnSeen = [...messages].reverse().find(m => m.sender_id === userId && m.seen_at);

  const receipt = (m) => {
    if (m._failed) return <span className="pc-receipt pc-failed">!</span>;
    if (m._temp) return <span className="pc-receipt">✓</span>;
    if (m.seen_at) return null;
    return <span className="pc-receipt pc-delivered">✓✓</span>;
  };

  if (!ready || !userId) return null;

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay />

      <button
        type="button"
        className={`pc-fab ${open ? 'pc-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : `Open chat${unread ? `, ${unread} unread` : ''}`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="pc-badge">+{unread > 99 ? '99' : unread}</span>
        )}
      </button>

      <div className={`pc-panel ${open ? 'pc-panel-open' : ''}`} role="dialog" aria-label="Partner chat">
        <div className="pc-header">
          <div className="pc-avatar">
            {(partnerName || '?').charAt(0).toUpperCase()}
            <span className={`pc-dot ${partnerOnline ? 'pc-dot-on' : ''}`} />
          </div>
          <div className="pc-header-text">
            <div className="pc-name">{partnerName}</div>
            <div className="pc-status">
              {partnerTyping ? 'typing…' : partnerOnline ? 'online' : 'offline'}
            </div>
          </div>
          <button type="button" className="pc-hbtn" onClick={() => startCall(false)} disabled={!!call} aria-label="Voice call" title="Voice call">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.66 2.62a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.46-1.23a2 2 0 0 1 2.11-.45c.84.32 1.72.54 2.62.66A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button type="button" className="pc-hbtn" onClick={() => startCall(true)} disabled={!!call} aria-label="Video call" title="Video call">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </button>
          <button type="button" className="pc-hbtn" onClick={() => setOpen(false)} aria-label="Minimize chat">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>

        {callError && (
          <div className="pc-callerror" onClick={() => setCallError(null)} role="status">
            {callError}
          </div>
        )}

        <div className="pc-list" ref={listRef}>
          {loading && <div className="pc-empty">Loading…</div>}
          {!loading && messages.length === 0 && (
            <div className="pc-empty">No messages yet — say hi</div>
          )}
          {messages.map((m, i) => {
            const callEvt = parseCallEvent(m.content);
            if (callEvt) {
              const ended = callEvt.kind === 'ended';
              let label;
              if (ended) {
                label = (callEvt.video ? 'Video call' : 'Voice call') + ' · ' + fmtDur(callEvt.seconds || 0);
              } else if (callEvt.kind === 'busy') {
                label = callEvt.video ? 'No answer · video call' : 'No answer · voice call';
              } else {
                label = callEvt.video ? 'Missed video call' : 'Missed voice call';
              }
              return (
                <div key={m.id} className="pc-row pc-system">
                  <div className={`pc-sys${ended ? ' pc-sys-ended' : ' pc-sys-missed'}`}>
                    <span className="pc-sys-icon" aria-hidden="true">
                      {callEvt.video ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.66 2.62a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.46-1.23a2 2 0 0 1 2.11-.45c.84.32 1.72.54 2.62.66A2 2 0 0 1 22 16.92z" />
                        </svg>
                      )}
                    </span>
                    <span>{label}</span>
                    <span className="pc-sys-time">{fmtTime(m.created_at)}</span>
                  </div>
                </div>
              );
            }
            const mine = m.sender_id === userId;
            const prev = messages[i - 1];
            const grouped = prev && !parseCallEvent(prev.content) && prev.sender_id === m.sender_id &&
              (new Date(m.created_at) - new Date(prev.created_at) < 90000);
            return (
              <div
                key={m.id}
                className={`pc-row ${mine ? 'pc-mine' : 'pc-theirs'} ${grouped ? 'pc-grouped' : ''}`}
              >
                <div className={`pc-bubble ${m.image_url ? 'pc-bubble-img' : ''} ${m._failed ? 'pc-bubble-failed' : ''}`}>
                  {m.image_url && (
                    <img
                      src={m.image_url}
                      alt=""
                      className="pc-img"
                      loading="lazy"
                      onClick={() => setLightbox(m.image_url)}
                    />
                  )}
                  {m.content}
                  <span className="pc-meta">
                    {fmtTime(m.created_at)} {mine && receipt(m)}
                  </span>
                </div>
                {mine && m.id === lastOwnSeen?.id && (
                  <div className="pc-seen">Seen {fmtTime(m.seen_at)}</div>
                )}
                {m._failed && <div className="pc-seen pc-failed">Not sent</div>}
              </div>
            );
          })}
          {partnerTyping && (
            <div className="pc-row pc-theirs">
              <div className="pc-bubble pc-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        {pendingImage && (
          <div className="pc-attach">
            <img src={pendingImage.previewUrl} alt="preview" />
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(pendingImage.previewUrl);
                setPendingImage(null);
              }}
              aria-label="Remove image"
            >
              ✕
            </button>
            {uploading && <div className="pc-attach-loading">Uploading…</div>}
          </div>
        )}

        <div className="pc-inputbar">
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickImage} />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={pickImage}
          />
          <button
            type="button"
            className="pc-attachbtn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Photo from gallery"
            title="Photo from gallery"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </button>
          <button
            type="button"
            className="pc-attachbtn"
            onClick={openInstantCamera}
            aria-label="Take a photo"
            title="Take a photo"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={onDraftChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={pendingImage ? 'Add a caption…' : 'Message…'}
            maxLength={1000}
          />
          <button
            type="button"
            className="pc-send"
            onClick={send}
            disabled={(!draft.trim() && !pendingImage) || uploading}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      {snapOpen && (
        <div className="pc-snap" role="dialog" aria-label="Take a photo">
          <div className="pc-snap-frame">
            <video ref={snapVideoRef} autoPlay playsInline muted className="pc-snap-video" />
            <div className="pc-snap-actions">
              <button type="button" className="pc-btn ghost" onClick={closeSnap}>Cancel</button>
              <button type="button" className="pc-btn warm" onClick={takeSnap}>Capture</button>
            </div>
          </div>
        </div>
      )}

      {call && (
        <div
          ref={callWinRef}
          className={`pc-call${draggingCall ? ' pc-call-dragging' : ''}`}
          style={callPos ? { left: callPos.left, top: callPos.top, right: 'auto' } : undefined}
        >
          <div className="pc-call-drag" onPointerDown={beginCallDrag} title="Drag to move">
            <span className="pc-call-draggrip" aria-hidden="true" />
            <span className="pc-call-draglabel">
              {call.status === 'ringing'
                ? 'Incoming call'
                : call.status === 'calling'
                  ? 'Calling…'
                  : fmtDur(callSeconds)}
            </span>
          </div>
          {call.status === 'ringing' ? (
            <div className="pc-call-ringing">
              <div className="pc-call-avatar pc-ring-anim">{(partnerName || '?').charAt(0).toUpperCase()}</div>
              <div className="pc-call-name">{partnerName}</div>
              <div className="pc-call-sub">incoming {call.video ? 'video' : 'voice'} call…</div>
              <div className="pc-call-actions">
                <button type="button" className="pc-cbtn pc-cbtn-accept" onClick={acceptCall} aria-label="Accept call">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.66 2.62a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.46-1.23a2 2 0 0 1 2.11-.45c.84.32 1.72.54 2.62.66A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
                <button type="button" className="pc-cbtn pc-cbtn-end" onClick={declineCall} aria-label="Decline call">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="pc-call-media" onPointerDown={beginCallDrag}>
                {call.video ? (
                  <>
                    <video ref={remoteVideoRef} autoPlay playsInline className="pc-video-remote" />
                    <video ref={localVideoRef} autoPlay playsInline muted className={`pc-video-local ${camOff ? 'pc-video-off' : ''}`} />
                  </>
                ) : (
                  <div className="pc-call-audioface">
                    <div className="pc-call-avatar">{(partnerName || '?').charAt(0).toUpperCase()}</div>
                    <div className="pc-call-name">{partnerName}</div>
                  </div>
                )}
              </div>
              <div className="pc-call-actions">
                <button type="button" className={`pc-cbtn ${muted ? 'pc-cbtn-active' : ''}`} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
                    {muted && <path d="M2 2l20 20" />}
                  </svg>
                </button>
                {call.video && (
                  <button type="button" className={`pc-cbtn ${camOff ? 'pc-cbtn-active' : ''}`} onClick={toggleCam} aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
                      {camOff && <path d="M2 2l20 20" />}
                    </svg>
                  </button>
                )}
                <button type="button" className="pc-cbtn pc-cbtn-end" onClick={cancelOrEndCall} aria-label="End call">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.07a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.63.7A2 2 0 0 1 22 17.07v2.86a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h2.86a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.63 2 2 0 0 1-.45 2.11L8.09 9.91" />
                    <path d="M23 1L1 23" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {lightbox && (
        <div className="pc-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </>
  );
}
