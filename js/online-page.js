/* ============================================================
   online-page.js — orchestrazione della pagina matchmaking
   ============================================================
   Stati gestiti:
     connecting     → connessione iniziale al server
     no-team        → l'utente non ha Pokémon nel team attivo
     searching      → in coda, attesa avversario
     matched        → trovato! mostra VS e countdown 3-2-1
     error          → server non raggiungibile
     opponent-left  → l'avversario ha lasciato la coda
   Quando il match è confermato → redirect a battle.html?mode=pvp&matchId=...
*/

// Cloud sync dinamico: se la CDN Supabase è bloccata, la pagina funziona lo stesso
import('./data/cloud-sync.js?v=3').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState, getActiveTeam }     from './data/state.js?v=6';
import { createOnlineClient }          from './data/online.js';

const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ============================================================
   STATO RUNTIME
   ============================================================ */

let client       = null;
let myTeam       = [];
let opponentInfo = null;   // { userId, userName }
let opponentTeam = null;
let matchId      = null;
let mySide       = null;   // 'a' | 'b'
let queueStart   = 0;
let queueTimer   = null;
let countdownTimer = null;

/* ============================================================
   BOOTSTRAP
   ============================================================ */

(async () => {
  // 1. Carica Pokémon (per renderizzare sprite team)
  try { await loadAllPokemon(); } catch (e) { console.warn(e); }

  // 2. Verifica team
  const gs = getState();
  myTeam = getActiveTeam();
  if (!myTeam || myTeam.length === 0) {
    setPhase('no-team');
    setStatus('connecting', 'Team vuoto');
    return;
  }

  renderMyTeam();
  setPhase('connecting');
  setStatus('connecting', 'Connessione…');

  // 3. Connetti al server
  client = createOnlineClient();
  registerHandlers();
  try {
    await client.connect({ userId: gs.userId, userName: gs.userName ?? 'Allenatore' });
    setStatus('online', 'Connesso');
    // 4. Entra in coda
    enterQueue();
  } catch (e) {
    console.error(e);
    setPhase('error');
    setStatus('error', 'Offline');
    $('errorMsg').textContent = 'Server di gioco non raggiungibile. Verifica che sia in esecuzione.';
  }

  // Listeners pulsanti
  $('btnExitOnline').addEventListener('click', e => {
    e.preventDefault();
    leaveAndGoHome();
  });
  $('btnCancelQueue').addEventListener('click', () => {
    client?.leaveQueue();
    leaveAndGoHome();
  });
  $('btnRetry').addEventListener('click', () => location.reload());
  $('btnRequeue').addEventListener('click', () => {
    setPhase('connecting');
    enterQueue();
  });

  // Cleanup al cambio pagina: SOLO disconnect, NIENTE leave-match!
  // Se navighiamo verso battle.html, la grace period del server (30s)
  // mantiene il match attivo per il resume-match. Se chiamassimo qui
  // leaveMatch, il server distruggerebbe il match e il PvP non
  // potrebbe più riprendere.
  window.addEventListener('beforeunload', () => {
    try { client?.disconnect(); } catch {}
  });
})();

/* ============================================================
   WEBSOCKET HANDLERS
   ============================================================ */

function registerHandlers() {
  client.on('connected', () => {
    setStatus('online', 'Connesso');
  });

  client.on('disconnected', () => {
    setStatus('error', 'Disconnesso');
    if (matchId) {
      // Stavamo in un match → ritorna a home
      toast('Connessione persa.', 'error');
      setTimeout(() => leaveAndGoHome(), 1200);
    }
  });

  client.on('queued', payload => {
    setPhase('searching');
    startQueueTimer();
  });

  client.on('matchFound', payload => {
    stopQueueTimer();
    matchId      = payload.matchId;
    mySide       = payload.side;
    opponentInfo = payload.opponent;
    onMatchFound();
  });

  client.on('bothReady', payload => {
    opponentTeam = payload.opponentTeam ?? [];
    renderOpponentTeam();
    startCountdown();
  });

  client.on('opponentLeft', () => {
    stopCountdown();
    matchId = null;
    opponentInfo = null;
    setPhase('opponent-left');
  });

  client.on('error', err => {
    console.error('[online] error', err);
  });
}

/* ============================================================
   QUEUE & MATCH FLOW
   ============================================================ */

function enterQueue() {
  if (!client?.connected) {
    setPhase('error');
    return;
  }
  client.joinQueue();
}

function onMatchFound() {
  setPhase('matched');
  $('myName').textContent       = getState().userName ?? 'Tu';
  $('opponentName').textContent = opponentInfo?.userName ?? 'Avversario';

  // Invia subito il nostro team al server
  client.submitTeam(myTeam);

  // L'avversario potrebbe inviare il suo team prima/dopo del nostro;
  // quando entrambi sono pronti, riceveremo 'bothReady' → countdown
  $('matchTitle').textContent = 'Avversario trovato!';
  $('matchHint').innerHTML    = 'In attesa che l\'avversario confermi il team…';
}

function startCountdown() {
  let n = 3;
  $('matchTitle').textContent = 'Battaglia in partenza!';
  $('matchHint').innerHTML    = `Inizio in <strong id="countdown">${n}</strong>…`;
  stopCountdown();
  countdownTimer = setInterval(() => {
    n--;
    if (n <= 0) {
      stopCountdown();
      goToBattle();
      return;
    }
    const cd = $('countdown');
    if (cd) cd.textContent = String(n);
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

function goToBattle() {
  // Passa parametri via sessionStorage (più sicuro/pulito di URL params per dati lunghi)
  sessionStorage.setItem('pvp:matchId',      matchId);
  sessionStorage.setItem('pvp:side',         mySide);
  sessionStorage.setItem('pvp:myTeam',       JSON.stringify(myTeam));
  sessionStorage.setItem('pvp:opponentTeam', JSON.stringify(opponentTeam));
  sessionStorage.setItem('pvp:opponentName', opponentInfo?.userName ?? 'Avversario');
  window.location.href = 'battle.html?mode=pvp';
}

/* ============================================================
   UI HELPERS
   ============================================================ */

function setPhase(name) {
  $$('.phase').forEach(p => {
    p.classList.toggle('hidden', p.dataset.phase !== name);
  });
}

function setStatus(kind, label) {
  $('statusDot').className = `status-dot is-${kind}`;
  $('statusLabel').textContent = label;
}

function renderMyTeam() {
  const container = $('myTeamPreview');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const id   = myTeam[i];
    const pkmn = id ? findPokemon(id) : null;
    const slot = document.createElement('div');
    slot.className = pkmn ? 'team-slot-mini' : 'team-slot-mini is-empty';
    if (pkmn) {
      slot.innerHTML = `<img src="${pkmn.sprite.default}" alt="${pkmn.name}" loading="lazy" />`;
    }
    container.appendChild(slot);
  }

  // Anche dentro VS-screen
  const matchContainer = $('myTeamMatch');
  if (matchContainer) {
    matchContainer.innerHTML = container.innerHTML;
  }
}

function renderOpponentTeam() {
  const container = $('opponentTeam');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const id   = opponentTeam[i];
    const pkmn = id ? findPokemon(id) : null;
    const slot = document.createElement('div');
    slot.className = pkmn ? 'team-slot-mini' : 'team-slot-mini is-empty';
    if (pkmn) {
      slot.innerHTML = `<img src="${pkmn.sprite.default}" alt="${pkmn.name}" loading="lazy" />`;
    }
    container.appendChild(slot);
  }
}

function startQueueTimer() {
  queueStart = Date.now();
  $('queueTime').textContent = '0s';
  stopQueueTimer();
  queueTimer = setInterval(() => {
    const sec = Math.floor((Date.now() - queueStart) / 1000);
    $('queueTime').textContent = `${sec}s`;
  }, 1000);
}

function stopQueueTimer() {
  if (queueTimer) { clearInterval(queueTimer); queueTimer = null; }
}

function leaveAndGoHome() {
  stopQueueTimer();
  stopCountdown();
  // Notifica server che ESPLICITAMENTE abbandono (anche se non in match,
  // è un no-op lato server). Importante per non lasciare l'avversario
  // ad aspettare 30s di grace.
  try { client?.leaveMatch(); } catch {}
  try { client?.disconnect(); } catch {}
  window.location.href = 'index.html';
}

/* ============================================================
   TOAST
   ============================================================ */

let _toastTimer = null;
function toast(msg, type = 'success') {
  const el = $('onlineToast');
  const txt = $('onlineToastMsg');
  if (!el) return;
  txt.textContent = msg;
  el.className = `online-toast online-toast--${type}`;
  el.classList.remove('hidden');
  void el.offsetWidth;
  el.classList.add('is-shown');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('is-shown');
    setTimeout(() => el.classList.add('hidden'), 250);
  }, 2400);
}
