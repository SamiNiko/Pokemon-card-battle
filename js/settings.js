/* ============================================================
   settings.js — pagina impostazioni
   ============================================================ */

import {
  getState,
  resetState,
  setUserName,
  exportSave,
  importSave,
} from './data/state.js?v=6';

import { initTutorial }     from './data/tutorial.js?v=3';
import { SFX, getVolume, setVolume, unlockAudio } from './data/sfx.js';
import { playBGM }                                from './data/bgm.js?v=7';

// BGM anche in Impostazioni così l'utente può regolare il volume mentre
// la sente in tempo reale. Stesso brano della home/menu.
playBGM('settings');

/* Supabase + cloud sync caricati dinamicamente. Se la CDN è bloccata
   (es. ad-blocker aggressivo di Opera GX) la pagina resta funzionante
   ma il login viene disabilitato. */
let supabaseModule = null;
let cloudSyncModule = null;
async function loadCloudModules() {
  try {
    [supabaseModule, cloudSyncModule] = await Promise.all([
      import('./data/supabase.js'),
      import('./data/cloud-sync.js?v=3'),
    ]);
    return true;
  } catch (e) {
    console.warn('[settings] cloud non disponibile:', e.message);
    return false;
  }
}

const $ = id => document.getElementById(id);

let gs;

/* ================================================================
   INIT
   ================================================================ */

async function init() {
  gs = getState();

  // Tenta di caricare i moduli cloud. Se la CDN è bloccata,
  // continua senza login ma con tutto il resto funzionante.
  const cloudAvailable = await loadCloudModules();

  if (cloudAvailable) {
    // Avvia il cloud sync (gestisce login automatico se sessione esistente)
    try { await cloudSyncModule.startCloudSync(); } catch (e) { console.warn(e); }
    gs = getState();   // reload dopo l'eventuale pull cloud

    // Aggiorna UI quando lo stato auth cambia
    supabaseModule.onAuthChange(async () => {
      await new Promise(r => setTimeout(r, 300));
      gs = getState();
      refreshAccountUI();
    });
  }

  refreshAccountUI();

  // ---- Username ----
  $('inpUserName').addEventListener('change', e => {
    const newName = setUserName(e.target.value);
    e.target.value = newName;
    toast(`Nome aggiornato: ${newName}`, 'success');
  });

  // ---- Copia ID ----
  $('btnCopyId').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(gs.userId ?? '');
      toast('ID copiato negli appunti', 'success');
    } catch {
      toast('Copia non disponibile', 'error');
    }
  });

  // ---- Login / Logout ----
  $('btnAuth').addEventListener('click', handleAuthClick);

  // ---- Salvataggio ----
  $('btnExport').addEventListener('click', () => {
    try {
      exportSave();
      toast('Salvataggio esportato', 'success');
    } catch (e) {
      console.error(e);
      toast('Errore durante l\'export', 'error');
    }
  });

  $('inpImport').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importSave(file);
      toast('Salvataggio importato — ricarico…', 'success');
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Errore durante l\'import', 'error');
    } finally {
      e.target.value = '';
    }
  });

  // ---- Replay tutorial ----
  $('btnReplayTutorial')?.addEventListener('click', () => {
    initTutorial({ force: true });
  });

  // ---- Audio (master + sfx + toggle) ----
  initAudioControls();

  // ---- Reset ----
  $('btnReset').addEventListener('click',        () => $('resetModal').classList.remove('hidden'));
  $('btnResetCancel').addEventListener('click',  () => $('resetModal').classList.add('hidden'));
  $('resetBackdrop').addEventListener('click',   () => $('resetModal').classList.add('hidden'));
  $('btnResetConfirm').addEventListener('click', () => {
    resetState();
    location.href = 'index.html';
  });

  // ---- Reset solo statistiche (cronologia + lifetimeStats) ----
  $('btnResetStats')?.addEventListener('click', async () => {
    if (!confirm('Resettare cronologia battaglie e tutte le statistiche?\n\nI Pokémon e le gemme NON verranno toccate.')) return;
    try {
      const { clearMatchHistory } = await import('./data/match-history.js');
      clearMatchHistory();
      toast('Statistiche resettate', 'success');
    } catch (e) {
      console.error(e);
      toast('Errore nel reset stats', 'error');
    }
  });

  // ESC chiude modale reset
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $('resetModal').classList.add('hidden');
  });

  // Flush sync prima di chiudere la pagina (best effort)
  window.addEventListener('beforeunload', () => {
    if (cloudSyncModule) try { cloudSyncModule.flushSync(); } catch {}
  });
}

/* ================================================================
   AUTH FLOW
   ================================================================ */

async function handleAuthClick() {
  // Se i moduli cloud non sono caricati (es. ad-blocker), avvisa l'utente
  if (!supabaseModule || !cloudSyncModule) {
    toast('Login non disponibile (controlla l\'ad-blocker)', 'error');
    return;
  }

  const session = await supabaseModule.getSession();
  if (session) {
    // Logout
    const ok = confirm(
      'Sicuro di voler uscire?\n\n' +
      '✓ I tuoi progressi restano salvati sul cloud.\n\n' +
      '⚠ Su questo dispositivo verrà avviato un nuovo profilo Ospite vuoto.'
    );
    if (!ok) return;
    try {
      await cloudSyncModule.flushSync();
      await supabaseModule.signOut();
      // signOut triggera SIGNED_OUT in cloud-sync che fa reset + reload
    } catch (e) {
      toast('Errore durante il logout: ' + e.message, 'error');
    }
  } else {
    // Login con Google → redirect
    try {
      toast('Reindirizzamento verso Google…', 'success');
      await supabaseModule.signInWithGoogle();
    } catch (e) {
      toast('Errore login: ' + e.message, 'error');
    }
  }
}

async function refreshAccountUI() {
  $('inpUserName').value           = gs.userName ?? 'Allenatore';
  $('userIdDisplay').textContent   = gs.userId ?? '—';
  $('accountTypeBadge').textContent = labelForAccountType(gs.accountType);

  // Se la SDK Supabase non è caricata, mostra hint chiaro e disabilita il bottone
  if (!supabaseModule) {
    $('btnAuthLabel').textContent = '🔒 Non disponibile';
    $('authLabel').textContent    = 'Login con Google';
    $('authHint').textContent     = 'Disabilita l\'ad-blocker per usare il login cloud';
    $('btnAuth').disabled = true;
    return;
  }
  $('btnAuth').disabled = false;

  const session = await supabaseModule.getSession();
  if (session) {
    $('btnAuthLabel').textContent = '🚪 Logout';
    $('authLabel').textContent    = `Connesso come ${session.user.email ?? '—'}`;
    $('authHint').textContent     = 'I tuoi progressi sono sincronizzati sul cloud';
    $('btnAuth').classList.remove('settings-btn--primary');
    $('btnAuth').classList.add('settings-btn--danger');
  } else {
    $('btnAuthLabel').textContent = '🔑 Accedi con Google';
    $('authLabel').textContent    = 'Login con Google';
    $('authHint').textContent     = 'Sincronizza il salvataggio su tutti i tuoi dispositivi';
    $('btnAuth').classList.add('settings-btn--primary');
    $('btnAuth').classList.remove('settings-btn--danger');
  }
}

/* ================================================================
   UTILITIES
   ================================================================ */

function labelForAccountType(type) {
  switch (type) {
    case 'supabase': return 'Cloud';
    case 'google':   return 'Google';
    case 'guest':
    default:         return 'Ospite';
  }
}

let _toastTimer = null;
function toast(msg, type = 'success') {
  const el  = $('toast');
  const txt = $('toastMsg');
  txt.textContent = msg;
  el.className = `toast toast--${type}`;
  el.classList.remove('hidden');
  void el.offsetWidth;
  el.classList.add('is-shown');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('is-shown');
    setTimeout(() => el.classList.add('hidden'), 250);
  }, 2400);
}

/* ================================================================
   AUDIO CONTROLS — toggle + slider master + slider SFX (preview)
   ================================================================ */
function initAudioControls() {
  const enabledEl = $('audioEnabled');
  const masterEl  = $('masterVol');
  const sfxEl     = $('sfxVol');
  const bgmEl     = $('bgmVol');
  const masterHint = $('masterVolHint');
  const sfxHint    = $('sfxVolHint');
  const bgmHint    = $('bgmVolHint');
  if (!enabledEl || !masterEl || !sfxEl) return;

  // Carica valori salvati
  const v = getVolume();
  enabledEl.checked = v.enabled;
  masterEl.value    = v.master;
  sfxEl.value       = v.sfx;
  if (bgmEl) bgmEl.value = v.bgm ?? 50;
  masterHint.textContent = `${v.master}%`;
  sfxHint.textContent    = `${v.sfx}% · tocca lo slider per anteprima`;
  if (bgmHint) bgmHint.textContent = `${v.bgm ?? 50}% · musica di sottofondo`;

  // Toggle abilitato/disabilitato
  enabledEl.addEventListener('change', () => {
    setVolume({ enabled: enabledEl.checked });
    if (enabledEl.checked) { unlockAudio(); SFX.confirm(); }
  });

  // Slider master: anteprima al rilascio
  masterEl.addEventListener('input', () => {
    setVolume({ master: parseInt(masterEl.value, 10) });
    masterHint.textContent = `${masterEl.value}%`;
  });
  masterEl.addEventListener('change', () => { unlockAudio(); SFX.click(); });

  // Slider SFX: anteprima al rilascio con suono "hit" rappresentativo
  sfxEl.addEventListener('input', () => {
    setVolume({ sfx: parseInt(sfxEl.value, 10) });
    sfxHint.textContent = `${sfxEl.value}% · tocca lo slider per anteprima`;
  });
  sfxEl.addEventListener('change', () => { unlockAudio(); SFX.hit(); });

  // Slider BGM: regola volume musica di sottofondo (live, no anteprima
  // perché il loop sta già suonando in pagina)
  if (bgmEl) {
    bgmEl.addEventListener('input', () => {
      setVolume({ bgm: parseInt(bgmEl.value, 10) });
      if (bgmHint) bgmHint.textContent = `${bgmEl.value}% · musica di sottofondo`;
    });
    bgmEl.addEventListener('change', () => { unlockAudio(); });
  }
}

init();
