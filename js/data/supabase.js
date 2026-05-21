/* ============================================================
   supabase.js — client Supabase per auth + cloud sync
   ============================================================
   Progetto: "Samu Pokemon Game" (eu-west-3)
   La chiave publishable è SICURA da esporre nel client: lato browser
   l'unica protezione è la Row Level Security definita su public.saves.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://cijywfqpqyccgdzqoidw.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_ZzfRUFP4R2ioXbBrPD9VCg_JojGp4Ub';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:   true,                  // localStorage-backed session
    autoRefreshToken: true,
    detectSessionInUrl: true,                // gestisce il redirect OAuth
    storageKey: 'pkmn_supabase_auth_v1',
  },
});

/* ============================================================
   AUTH HELPERS
   ============================================================ */

/** Sessione attuale (o null se guest) */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Utente attuale (o null) */
export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/** Avvia login con Google.
 *  IMPORTANTE: l'OAuth deve girare a livello TOP-LEVEL window, non
 *  dentro l'iframe shell di play.html. La pagina di login di Google
 *  ha X-Frame-Options: DENY → dentro l'iframe restituirebbe
 *  "Spiacenti. Non disponi dell'autorizzazione necessaria…".
 *  Usiamo `skipBrowserRedirect: true` per ricevere l'URL e navigare
 *  manualmente `window.top.location`. */
export async function signInWithGoogle() {
  // Calcola il redirect target al top-level — atterriamo direttamente
  // su play.html così l'hash con i token (#access_token=...) viene
  // inoltrato all'iframe dal bootstrap dello shell.
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
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;

  // Naviga il TOP window (non l'iframe) verso la pagina Google
  if (data?.url) {
    try { window.top.location.href = data.url; }
    catch (e) { window.location.href = data.url; }
  }
  return data;
}

/** Logout — riporta in modalità guest */
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
