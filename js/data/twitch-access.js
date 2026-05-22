/* ============================================================
   twitch-access.js — gate Twitch follower + bonus sub
   ============================================================
   API:
     checkAccess()        → { loggedIn, isFollower, isSubscriber, twitchLogin, twitchId }
     getCachedAccess()    → ultimo risultato salvato in localStorage (sync, no fetch)
     clearAccessCache()   → invalida la cache (al logout)

   Strategia:
     - Follower check  → edge function `check-twitch-access` (usa app token
       del broadcaster, non si può fare client-side per via degli scope).
     - Subscriber check → client-side con il provider_token dell'utente
       (richiede scope `user:read:subscriptions` concesso al login).

   Cache: 5 minuti in localStorage per non spammare l'API a ogni navigazione.
   ============================================================ */

import { supabase, getSession, TWITCH_CLIENT_ID, TWITCH_BROADCASTER_ID } from './supabase.js';

const ACCESS_CACHE_KEY = 'pkmn_twitch_access_v1';
const ACCESS_TTL_MS    = 5 * 60 * 1000;   // 5 minuti

/** Risultato di default (utente non loggato o errore) */
const EMPTY = Object.freeze({
  loggedIn:     false,
  isFollower:   false,
  isSubscriber: false,
  twitchLogin:  null,
  twitchId:     null,
  checkedAt:    0,
  error:        null,
});

/** Cache hit (sync, non fa rete). Ritorna null se scaduta o assente. */
export function getCachedAccess() {
  try {
    const raw = localStorage.getItem(ACCESS_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.checkedAt > ACCESS_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

/** Cancella cache (chiamare al logout) */
export function clearAccessCache() {
  try { localStorage.removeItem(ACCESS_CACHE_KEY); } catch {}
}

/** Check completo. Usa cache se fresca, altrimenti chiama edge function +
 *  Twitch API per il sub status. */
export async function checkAccess(opts = {}) {
  const { force = false } = opts;

  // Cache hit
  if (!force) {
    const cached = getCachedAccess();
    if (cached) return cached;
  }

  const session = await getSession();
  if (!session) {
    return { ...EMPTY };
  }

  const twitchLogin = session.user?.user_metadata?.preferred_username
                   ?? session.user?.user_metadata?.nickname
                   ?? session.user?.user_metadata?.name
                   ?? 'twitch_user';
  const twitchId    = session.user?.user_metadata?.provider_id
                   ?? session.user?.user_metadata?.sub
                   ?? null;
  const providerToken = session.provider_token ?? null;

  // 1. Follower check client-side via /helix/channels/followed
  //    (l'endpoint /channels/followers richiede scope moderator: NON è il
  //    nostro caso. /channels/followed invece usa lo scope user:read:follows
  //    che l'utente concede a noi al login.)
  let isFollower = false;
  if (providerToken && twitchId) {
    try {
      const url = `https://api.twitch.tv/helix/channels/followed?user_id=${twitchId}&broadcaster_id=${TWITCH_BROADCASTER_ID}`;
      const res = await fetch(url, {
        headers: {
          'Client-Id':     TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${providerToken}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        isFollower = Array.isArray(json.data) && json.data.length > 0;
      } else {
        console.warn('[twitch-access] /channels/followed failed:', res.status, await res.text());
      }
    } catch (e) {
      console.warn('[twitch-access] follow check error:', e);
    }
  }

  // 2. Subscriber check client-side via /helix/subscriptions/user
  let isSubscriber = false;
  if (providerToken && twitchId) {
    try {
      const url = `https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${TWITCH_BROADCASTER_ID}&user_id=${twitchId}`;
      const res = await fetch(url, {
        headers: {
          'Client-Id':     TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${providerToken}`,
        },
      });
      // 200 = abbonato; 404 = non abbonato; altro = errore (assumiamo no sub)
      isSubscriber = res.status === 200;
    } catch (e) {
      console.warn('[twitch-access] sub check failed:', e);
    }
  }

  const result = {
    loggedIn: true,
    isFollower,
    isSubscriber,
    twitchLogin,
    twitchId,
    checkedAt: Date.now(),
    error: null,
  };

  try { localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(result)); } catch {}
  return result;
}

/** Shortcut per UI: vero se l'utente può giocare (follower o sub). */
export function canPlay(access) {
  if (!access || !access.loggedIn) return false;
  return access.isFollower || access.isSubscriber;
}
