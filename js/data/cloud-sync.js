/* ============================================================
   cloud-sync.js — sincronizzazione stato con Supabase
   ============================================================
   - Si aggancia all'hook onSave() di state.js
   - Quando l'utente fa login: pull dello stato remoto (o push iniziale)
   - Quando fa una modifica: push debounced (1.5s) sul cloud
   - Stato locale (localStorage) resta sempre come fallback offline
*/

import { supabase, getSession, onAuthChange } from './supabase.js';
import { getState, saveState, onSave }        from './state.js';

const SAVE_DEBOUNCE_MS = 1500;

let _pushTimer = null;
let _pendingState = null;
let _started = false;

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Avvia il sistema di cloud sync. Va chiamato una volta all'avvio
 * di ogni pagina che ha bisogno della sincronizzazione (settings, ecc.).
 */
export async function startCloudSync() {
  if (_started) return;
  _started = true;

  // 1. Se c'è una sessione esistente, fai pull dello stato remoto subito
  const session = await getSession();
  if (session) {
    await syncOnLogin(session.user);
  }

  // 2. Registra listener per login/logout futuri
  onAuthChange(async (event, sess) => {
    if (event === 'SIGNED_IN' && sess?.user) {
      await syncOnLogin(sess.user);
    } else if (event === 'SIGNED_OUT') {
      // Torna a modalità guest: lo state locale resta, ma non viene più pushato
      const s = getState();
      s.accountType = 'guest';
      saveState();
    }
  });

  // 3. Aggancia hook onSave: ogni saveState() rimbalza sul cloud (debounced)
  onSave(state => {
    if (state.accountType !== 'supabase') return;
    _pendingState = state;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(pushPending, SAVE_DEBOUNCE_MS);
  });
}

/**
 * Forza un push immediato (utile prima del logout o chiusura pagina).
 */
export async function flushSync() {
  if (_pushTimer) {
    clearTimeout(_pushTimer);
    _pushTimer = null;
  }
  if (_pendingState) await pushPending();
}

/* ============================================================
   INTERNAL
   ============================================================ */

async function syncOnLogin(user) {
  const localState = getState();
  const remoteState = await pullFromCloud(user.id);

  if (remoteState) {
    // Cloud esiste → adottalo come fonte di verità (sovrascrive locale)
    Object.assign(localState, remoteState, {
      userId:      user.id,
      userName:    remoteState.userName ?? user.user_metadata?.full_name ?? localState.userName,
      accountType: 'supabase',
    });
    saveState();
    console.log('[cloud] Pulled state from Supabase');
  } else {
    // Primo login → migra lo state guest sul cloud
    localState.userId      = user.id;
    localState.userName    = user.user_metadata?.full_name ?? localState.userName;
    localState.accountType = 'supabase';
    saveState();              // triggera anche il push (debounced)
    await pushToCloud(localState);
    console.log('[cloud] Pushed initial state to Supabase');
  }
}

async function pullFromCloud(userId) {
  const { data, error } = await supabase
    .from('saves')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[cloud] Pull failed:', error);
    return null;
  }
  return data?.state ?? null;
}

async function pushToCloud(state) {
  const { error } = await supabase
    .from('saves')
    .upsert({
      user_id:    state.userId,
      state:      state,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) console.warn('[cloud] Push failed:', error);
  return !error;
}

async function pushPending() {
  if (!_pendingState) return;
  const state = _pendingState;
  _pendingState = null;
  await pushToCloud(state);
}

/* ============================================================
   AUTO-START
   ============================================================
   Importare questo file da una qualsiasi pagina avvia il sync
   automaticamente. Idempotente: chiamate ripetute non hanno effetto.
*/
startCloudSync().catch(e => console.warn('[cloud] startup failed:', e));

