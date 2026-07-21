// src/lib/avatars.js — avatar persistence + catalog of ids.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function getDuoAvatars(code) {
  if (!code) return { avatar_a: null, avatar_b: null };
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_duo_avatars', { p_duo_code: code });
  if (error) return { avatar_a: null, avatar_b: null };
  return data || { avatar_a: null, avatar_b: null };
}

export async function setMyAvatar(code, avatarId) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('set_my_avatar', {
    p_duo_code: code,
    p_avatar: avatarId
  });
  if (error) throw new Error(error.message);
  return data;
}

/* ===== PURE catalog (no imports below) ===== */

export const AVATAR_GROUPS = [
  {
    id: 'girls', label: 'Girls',
    ids: ['girl-bob', 'girl-long', 'girl-pigtails', 'girl-bun', 'girl-curls',
          'girl-braids', 'girl-pony', 'girl-wavy', 'girl-spacebuns', 'girl-hijab',
          'girl-pixie', 'girl-bow']
  },
  {
    id: 'boys', label: 'Boys',
    ids: ['boy-crop', 'boy-spiky', 'boy-curly', 'boy-side', 'boy-cap',
          'boy-shaggy', 'boy-afro', 'boy-fade', 'boy-curtains', 'boy-beanie']
  },
  {
    id: 'pets', label: 'Pets',
    ids: ['pet-cat', 'pet-dog', 'pet-bunny', 'pet-bear', 'pet-panda',
          'pet-fox', 'pet-penguin', 'pet-frog', 'pet-hamster', 'pet-owl',
          'pet-koala', 'pet-mouse']
  },
  {
    id: 'fun', label: 'Fun',
    ids: ['fun-robot', 'fun-ghost', 'fun-alien', 'fun-mushroom', 'fun-cactus',
          'fun-planet']
  }
];

export const AVATAR_IDS = AVATAR_GROUPS.flatMap(g => g.ids);
