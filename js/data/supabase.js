/* ============================================================
   supabase.js — client Supabase per auth Twitch + cloud sync
   ============================================================
   Auth: SOLO Twitch (niente Google né guest mode).
   Solo i follower/sub del broadcaster possono giocare — vedi
   twitch-access.js + edge function check-twitch-access.

   La chiave publishable è SICURA da esporre nel client: la
   protezione vera è la Row Level Security su public.saves.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://cijywfqpqyccgdzqoidw.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_ZzfRUFP4R2ioXbBrPD9VCg_JojGp4Ub';

/* ============================================================
   Costanti Twitch — valori PUBBLICI, ok hardcodare nel client.
   ============================================================ */
export const TWITCH_CLIENT_ID       = 'ntgjwu4dxl3rya4na0tk133gt1btaf';
export const TWITCH_BROADCASTER_ID  = '250476450';
export const TWITCH_CHANNEL_URL     = 'https://www.twitch.tv/samuel_04_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'pkmn_supabase_auth_v1',
  },
});

/* ============================================================
   AUTH HELPERS
   ============================================================ */

/** Sessione attuale (o null se non loggato) */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Utente attuale (o null) */
export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/** Avvia login con Twitch.
 *
 *  Come per Google: la pagina di login di Twitch ha X-Frame-Options: DENY
 *  → niente iframe. Usiamo skipBrowserRedirect e navighiamo window.top.
 *
 *  Scopes:
 *    - user:read:subscriptions → permette di verificare se l'utente è
 *      iscritto al canale del broadcaster (bonus sub).
 *    (il check follower invece usa l'app token nel edge function) */
export async function signInWithTwitch() {
  let topOrigin, topPathname;
  try {
    topOrigin   = window.top.location.origin;
    topPathname = window.top.location.pathname;
  } catch (e) {
    topOrigin   = window.location.origin;
    topPathname = window.location.pathname;
  }
  const basePath   = topPathname.replace(/[^/]+$/, '');
  const redirectTo = topOrigin + basePath + 'play.html';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitch',
    options: {
      redirectTo,
      // user:read:subscriptions → check sub. user:read:follows → check follow.
      scopes: 'user:read:subscriptions user:read:follows',
      skipBrowserRedirect: true,
      // force_verify=true → mostra SEMPRE la pagina di autorizzazione Twitch
      // anche se l'utente è già loggato lì. Senza questo, dopo signOut
      // Supabase la sessione Twitch in cookie continua a fare auto-login
      // sullo stesso account → impossibile cambiare account. Twitch mostra
      // un link 'use a different account' in quella pagina.
      queryParams: {
        force_verify: 'true',
      },
    },
  });
  if (error) throw error;

  if (data?.url) {
    try { window.top.location.href = data.url; }
    catch (e) { window.location.href = data.url; }
  }
  return data;
}

/** Logout */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Listener per cambiamenti di sessione (login / logout / refresh) */
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => subscription.unsubscribe();
}
