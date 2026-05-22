/* ============================================================
   cloud-sync.js — sincronizzazione stato con Supabase
   ============================================================
   - Si aggancia all'hook onSave() di state.js
   - Quando l'utente fa login: pull dello stato remoto (o push iniziale)
   - Quando fa una modifica: push debounced (1.5s) sul cloud
   - Stato locale (localStorage) resta sempre come fallback offline
*/

import { supabase, getSession, onAuthChange }          from './supabase.js';
import { getState, saveState, onSave, resetState }     from './state.js?v=6';

const SAVE_DEBOUNCE_MS  = 1500;
const CLOUD_USED_FLAG   = 'pkmn_cloud_account_used';  // anti-dupe device flag
const GUEST_BACKUP_KEY  = 'pkmn_guest_backup_v1';     // snapshot guest pre-login

/** Lo state ha progressi che varrebbe la pena salvare? */
function _hasMeaningfulProgress(state) {
  return (state.owned ?? []).length > 0
      || (state.lifetimeStats?.totalMatches ?? 0) > 0
      || (state.gems    ?? 0) > 0
      || (state.pokeuro ?? 0) > 0;
}

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

  // Traccia l'ultimo user_id sincronizzato per evitare di rifare syncOnLogin
  // ad ogni event SIGNED_IN (Supabase JS può rifirearlo a ogni token refresh,
  // che farebbe pullFromCloud + Object.assign sovrascrivendo lo state locale
  // → reward post-battaglia perse perché overwrite con dati cloud vecchi).
  let _lastSyncedUserId = session?.user?.id ?? null;

  // 2. Registra listener per login/logout futuri
  onAuthChange(async (event, sess) => {
    if (event === 'SIGNED_IN' && sess?.user) {
      // Skip se stesso utente già sincronizzato (è un token refresh, non
      // un nuovo login). Lo state locale + cloud push lavorano normalmente.
      if (_lastSyncedUserId === sess.user.id) {
        console.log('[cloud] SIGNED_IN per utente già sincronizzato (token refresh) → no-op');
        return;
      }
      _lastSyncedUserId = sess.user.id;
      await syncOnLogin(sess.user);
    } else if (event === 'SIGNED_OUT') {
      _lastSyncedUserId = null;
      // Logout: reset dello state locale. Poi:
      // - se c'è un backup guest (era il tuo state prima del login),
      //   lo ripristiniamo → ritorni esattamente dov'eri prima.
      // - altrimenti, parte un guest nuovo (zero progressi).
      try {
        let backup = null;
        try {
          const raw = localStorage.getItem(GUEST_BACKUP_KEY);
          if (raw) backup = JSON.parse(raw);
        } catch {}

        resetState();   // pulisce lo state corrente (cloud)

        if (backup && typeof backup === 'object') {
          // Restore: il backup era guest, riprende il suo userId originale
          backup.accountType = 'guest';
          // Salva direttamente in localStorage senza passare per getState
          // (che genererebbe un altro nuovo guest userId)
          localStorage.setItem('pkmn_player_state_v1', JSON.stringify(backup));
          // Una volta ripristinato il backup, lo cancelliamo
          // (se rientra in cloud e logga di nuovo, ne farà uno nuovo)
          localStorage.removeItem(GUEST_BACKUP_KEY);
          console.log('[cloud] Logout: ripristinato guest state da backup');
        } else {
          console.log('[cloud] Logout: nessun backup → guest fresh');
        }
      } catch (e) {
        console.warn('[cloud] reset on signout failed:', e);
      }
      // Reload per UI fresca (le pagine cacheano un riferimento a gs)
      location.reload();
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
  const localState  = getState();

  // Backup del guest state (se ne vale la pena) PRIMA di sovrascrivere.
  if (localState.accountType === 'guest' && _hasMeaningfulProgress(localState)) {
    try {
      localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify(localState));
    } catch (e) {
      console.warn('[cloud] backup guest failed:', e);
    }
  }

  const { state: remoteState, error: pullError } = await pullFromCloud(user.id);

  // CASO 1: errore di rete/RLS → NON resettare niente, NON fare anti-dupe.
  // Il vecchio codice ritornava null e cadeva nel branch anti-dupe che
  // resettava lo state e ricaricava la pagina → BATTAGLIA INTERROTTA.
  // Ora invece: mantieni lo state locale, marca come supabase se necessario,
  // e lascia che il push debounced normale spinga le modifiche al prossimo
  // tentativo. La rete tornerà OK presto.
  if (pullError) {
    console.warn('[cloud] Pull errato, MANTENGO state locale:', pullError);
    if (localState.accountType !== 'supabase' || localState.userId !== user.id) {
      localState.userId      = user.id;
      localState.userName    = user.user_metadata?.full_name ?? localState.userName;
      localState.accountType = 'supabase';
      saveState();
    }
    return;
  }

  // CASO 2: cloud ha già una riga per questo utente → fonte di verità
  if (remoteState) {
    Object.assign(localState, remoteState, {
      userId:      user.id,
      userName:    remoteState.userName ?? user.user_metadata?.full_name ?? localState.userName,
      accountType: 'supabase',
    });
    saveState();
    localStorage.setItem(CLOUD_USED_FLAG, '1');
    console.log('[cloud] Pulled state from Supabase');
    return;
  }

  // CASO 3: cloud LEGITTIMAMENTE vuoto (no row found, no error)
  const hasCloudBefore = localStorage.getItem(CLOUD_USED_FLAG) === '1';
  const localHasProgress = _hasMeaningfulProgress(localState);

  if (hasCloudBefore && !localHasProgress) {
    // Anti-dupe vero: device ha visto cloud, local senza progresso → fresh.
    // NON faccio piu' location.reload() (era troppo invasivo: poteva
    // killare una battaglia in corso). Lo state viene aggiornato in place.
    resetState();
    const fresh = getState();
    fresh.userId      = user.id;
    fresh.userName    = user.user_metadata?.full_name ?? 'Allenatore';
    fresh.accountType = 'supabase';
    saveState();
    await pushToCloud(fresh);
    console.log('[cloud] Nuovo account su device già usato → fresh save');
    return;
  }

  // Tutti gli altri casi (primo login OR local con progresso): mantieni
  // lo state locale, marca come supabase e pushalo al cloud.
  localState.userId      = user.id;
  localState.userName    = user.user_metadata?.full_name ?? localState.userName;
  localState.accountType = 'supabase';
  saveState();
  await pushToCloud(localState);
  localStorage.setItem(CLOUD_USED_FLAG, '1');
  console.log('[cloud] State locale migrato/sincronizzato al cloud');
}

async function pullFromCloud(userId) {
  try {
    const { data, error } = await supabase
      .from('saves')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[cloud] Pull error:', error);
      return { state: null, error };
    }
    return { state: data?.state ?? null, error: null };
  } catch (e) {
    console.warn('[cloud] Pull exception:', e);
    return { state: null, error: e };
  }
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

