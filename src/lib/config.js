// config.js — DuoArcade Spike 001 · ready to use
// Both values are filled in. Replace the old config.js in your spike
// folder with this file, then redeploy the folder to Netlify.

export const CONFIG = {
  SUPABASE_URL: 'https://bzlerfibdvemuwhxxzdh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_OeS2MJjlWDzSkcfyGhDw3A_Nkw03_XY',

  /**
   * Live gameplay transport for sync.rt() only.
   *   'supabase' — Realtime broadcast
   *   'socket'   — DuoArcade Socket.IO game server (Fly.io)
   * Override with Vite env: VITE_GAME_RT=socket|supabase
   */
  GAME_RT: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GAME_RT)
    ? String(import.meta.env.VITE_GAME_RT).toLowerCase()
    : 'socket',

  /** Socket.IO game server URL when GAME_RT=socket */
  GAME_RT_URL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GAME_RT_URL)
    ? String(import.meta.env.VITE_GAME_RT_URL)
    : 'https://duoarcade-server.fly.dev',
};
