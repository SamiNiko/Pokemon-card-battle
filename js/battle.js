/* ============================================================
   battle.js — schermata di combattimento
   - Drag & drop: panchina ↔ griglia (max 3 carte in campo)
   - Motore di combattimento: speed check → attacchi sequenziali → HP
   - AI base: schiera i primi 3 Pokémon vivi in front row
   ============================================================ */

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState, getActiveTeam }     from './data/state.js';
import { resolveTurn }                 from './engine/combat.js';
import { aiPlaceCards, aiChooseMoves } from './engine/ai.js';
import { MOVESETS }                    from './data/movesets.js';
import { createOnlineClient }          from './data/online.js';

/* ---- Modalità: 'ai' (default vs CPU) | 'pvp' (online vs altro player) ---- */
const URL_PARAMS = new URLSearchParams(location.search);
const MODE       = URL_PARAMS.get('mode') === 'pvp' ? 'pvp' : 'ai';

/* ---- Utility ---- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Moltiplicatore velocità (4d-3): 1 = normale, 2 = doppio — persiste in localStorage */
let speedMultiplier = localStorage.getItem('pkmn_speed_up') === '2' ? 2 : 1;
if (speedMultiplier === 2) document.body.classList.add('speed-up');

const sleep = ms => new Promise(res => setTimeout(res, Math.round(ms / speedMultiplier)));
const cap   = s => s[0].toUpperCase() + s.slice(1);

const COLS          = ['left', 'center', 'right'];
const PLAYER_MAX_HP = 3000;
const ENEMY_MAX_HP  = 3000;
const TURN_SECONDS  = 30;
const FIELD_LIMIT   = 3;   // max carte in campo contemporaneamente

/* ============================================================
   STATO BATTAGLIA
   ============================================================ */
const bs = {
  phase:          'placement',   // 'placement' | 'resolving' | 'ended'
  turn:           1,
  playerHP:       PLAYER_MAX_HP,
  enemyHP:        ENEMY_MAX_HP,
  playerTeamIds:  [],
  enemyTeamIds:   [],
  // HP e morti separati per lato — evita collisioni quando i due team condividono Pokémon con lo stesso ID
  playerPkmnHP:   new Map(),    // id → HP corrente (lato giocatore)
  enemyPkmnHP:    new Map(),    // id → HP corrente (lato nemico)
  playerDeadIds:  new Set(),
  enemyDeadIds:   new Set(),
  playerPkmnPP:   new Map(),    // id → PP accumulati lato player (evita collisioni ID)
  enemyPkmnPP:    new Map(),    // id → PP accumulati lato enemy
  selectedMoves:  new Map(),    // id → 'auto'|'basic'|'finisher' (default: 'basic')
  playerField:    new Map(),    // slotKey → pkmn
  enemyField:     new Map(),
  timeLeft:       TURN_SECONDS,
  timerHandle:    null,
  /* ---- Stato PvP (solo se MODE === 'pvp') ---- */
  pvp: MODE === 'pvp' ? {
    client:                 null,    // istanza createOnlineClient
    matchId:                null,
    side:                   null,    // 'a' | 'b'
    opponentName:           'Avversario',
    pendingOpponentAction:  null,    // { turn, placement, moves } in attesa di essere processato
    awaitOpponentResolver:  null,    // resolver della Promise di waitForOpponent()
    disconnected:           false,
  } : null,
};

/* ---- Stato drag & drop ---- */
let dragId       = null;   // pokemonId in trascinamento
let dragFromSlot = null;   // 'bench' | slotKey (es. 'front-left')

/* ============================================================
   INIT
   ============================================================ */
init();

async function init() {
  buildGrid('#playerGrid', 'self');
  buildGrid('#enemyGrid',  'enemy');

  try {
    const msgEl = $('#loadingMsg');
    await loadAllPokemon((done, total) => {
      if (msgEl) msgEl.textContent = `Caricamento Pokémon: ${done} / ${total}`;
    });
  } catch (err) {
    console.error('Errore caricamento Pokémon:', err);
    showLoadingError(err);
    return; // blocca l'init — la UI di errore gestisce il retry
  }

  // Nascondi overlay di caricamento
  const overlay = $('#loadingOverlay');
  if (overlay) {
    overlay.classList.add('is-hidden');
    setTimeout(() => overlay.remove(), 350);
  }

  if (bs.pvp) {
    // ---- PvP: leggi match data da sessionStorage ----
    bs.pvp.matchId      = sessionStorage.getItem('pvp:matchId');
    bs.pvp.side         = sessionStorage.getItem('pvp:side');
    bs.pvp.opponentName = sessionStorage.getItem('pvp:opponentName') ?? 'Avversario';

    try {
      bs.playerTeamIds = JSON.parse(sessionStorage.getItem('pvp:myTeam')       ?? '[]');
      bs.enemyTeamIds  = JSON.parse(sessionStorage.getItem('pvp:opponentTeam') ?? '[]');
    } catch {
      bs.playerTeamIds = [];
      bs.enemyTeamIds  = [];
    }

    if (!bs.pvp.matchId || bs.playerTeamIds.length === 0 || bs.enemyTeamIds.length === 0) {
      console.error('PvP: dati match mancanti. Torno alla home.');
      window.location.href = 'index.html';
      return;
    }

    const pvpOk = await setupPvPConnection();
    if (!pvpOk) {
      // Setup PvP fallito → pulisci sessionStorage stantio + torna alla home
      ['pvp:matchId','pvp:side','pvp:myTeam','pvp:opponentTeam','pvp:opponentName']
        .forEach(k => sessionStorage.removeItem(k));
      alert('Impossibile riprendere il match PvP. Il match è scaduto o il server è stato riavviato. Torno alla home per ricominciare il matchmaking.');
      window.location.href = 'index.html';
      return;
    }

    // Personalizza HUD con i nomi reali dei giocatori
    const myName = getState().userName ?? 'Tu';
    const enemyNameEl   = $('#enemyName');
    const enemyAvatarEl = $('#enemyAvatar');
    const playerNameEl  = $('#playerName');
    const playerAvatarEl = $('#playerAvatar');
    if (enemyNameEl)    enemyNameEl.textContent    = bs.pvp.opponentName;
    if (enemyAvatarEl)  enemyAvatarEl.textContent  = (bs.pvp.opponentName[0] ?? 'P').toUpperCase();
    if (playerNameEl)   playerNameEl.textContent   = myName;
    if (playerAvatarEl) playerAvatarEl.textContent = (myName[0] ?? 'T').toUpperCase();
  } else {
    // ---- AI mode (default) ----
    const playerTeam = getActiveTeam();
    bs.playerTeamIds = playerTeam.length > 0 ? playerTeam : [25, 6, 9, 3, 94, 65];
    bs.enemyTeamIds  = [6, 9, 3, 25, 94, 65];
  }

  // HP e PP iniziali — player e enemy separati per evitare collisioni di ID
  for (const id of bs.playerTeamIds) {
    const p = findPokemon(id);
    if (!p) continue;
    bs.playerPkmnHP.set(p.id, p.stats.hp);
    bs.playerPkmnPP.set(p.id, 0);
  }
  for (const id of bs.enemyTeamIds) {
    const p = findPokemon(id);
    if (!p) continue;
    bs.enemyPkmnHP.set(p.id, p.stats.hp);
    bs.enemyPkmnPP.set(p.id, 0);
  }

  renderPlayerBench();
  renderEnemyBench();
  setupSlotDrop();
  setupBenchDrop();
  setupTargetPreview();
  updateSpeedPreview();
  startTimer();

  $('#btnConfirm').addEventListener('click', confirmTurn);
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', closeAllModals));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
    if (e.key === ' ' && bs.phase === 'placement') { e.preventDefault(); confirmTurn(); }
  });

  // Pulsante speed-up (4d-3)
  $('#btnSpeedUp')?.addEventListener('click', toggleSpeedUp);
  updateSpeedUpBtn();

  // Modal conferma uscita (4a-4)
  $('.battle__exit')?.addEventListener('click', e => {
    // In PvP: SEMPRE mostra il modal (uscire = abbandono)
    // In AI: solo se partita effettivamente iniziata (turn > 1)
    if (bs.phase !== 'ended' && (bs.pvp || bs.turn > 1)) {
      e.preventDefault();
      const exitModal = $('#exitModal');
      if (exitModal) {
        exitModal.classList.remove('hidden');
        // Cambia testo se PvP
        const title = exitModal.querySelector('.modal__title');
        if (bs.pvp && title) title.textContent = 'Abbandonare la partita?';
      }
    }
  });
  $('#exitCancel')?.addEventListener('click', () => $('#exitModal')?.classList.add('hidden'));
  $('#exitModalBackdrop')?.addEventListener('click', () => $('#exitModal')?.classList.add('hidden'));

  // Conferma uscita: in PvP notifica il server prima di uscire
  const exitConfirm = $('#exitConfirm') ?? document.querySelector('[href="index.html"].btn--danger, [href="index.html"].btn--primary');
  exitConfirm?.addEventListener('click', e => {
    if (bs.pvp?.client) {
      try { bs.pvp.client.leaveMatch(); } catch {}
      try { bs.pvp.client.disconnect(); } catch {}
    }
  });

  // Cleanup all'uscita imprevista (chiusura tab, refresh, ecc.)
  window.addEventListener('beforeunload', () => {
    if (bs.pvp?.client && bs.phase !== 'ended') {
      try { bs.pvp.client.leaveMatch(); } catch {}
      try { bs.pvp.client.disconnect(); } catch {}
    }
  });
}

/* ============================================================
   GRIGLIA — costruzione slot
   ============================================================ */
function buildGrid(sel, side) {
  const root = $(sel);
  if (!root) return;
  root.innerHTML = '';

  // Player: front in alto (vicino al centro), back in basso
  // Enemy:  back in alto, front in basso (vicino al centro)
  const rows = side === 'self' ? ['front', 'back'] : ['back', 'front'];

  for (const row of rows) {
    for (const col of COLS) {
      const slot = document.createElement('div');
      slot.className = 'grid__slot';
      slot.dataset.row     = row;
      slot.dataset.col     = col;
      slot.dataset.side    = side;
      slot.dataset.slotKey = `${row}-${col}`;
      slot.innerHTML = `<span class="grid__slot-label">${cap(row)} ${cap(col)}</span>`;
      root.appendChild(slot);
    }
  }
}

/* ============================================================
   PANCHINA — render
   ============================================================ */
function renderPlayerBench() {
  const bench = $('#playerBench');
  if (!bench) return;
  bench.innerHTML = '';

  // Panchina STATICA: tutti i 6 Pokémon sempre visibili.
  // In campo  → is-deployed (fantasma, non trascinabile dalla bench)
  // Sconfitto → is-fainted  (grigio, non interattivo)
  // Libero    → normale, trascinabile
  const fieldIds = new Set([...bs.playerField.values()].map(p => p.id));

  for (const id of bs.playerTeamIds) {
    const p = findPokemon(id);
    if (!p) continue;

    const card = makeCard(p, 'self');

    if (bs.playerDeadIds.has(p.id)) {
      card.classList.add('is-fainted');
    } else if (fieldIds.has(p.id)) {
      card.classList.add('is-deployed');
      card.draggable = false;
    }

    bench.appendChild(card);
  }
}

function renderEnemyBench() {
  const bench = $('#enemyBench');
  if (!bench) return;
  bench.innerHTML = '';

  // Panchina STATICA: tutti i 6 Pokémon avversari sempre visibili.
  const fieldIds = new Set([...bs.enemyField.values()].map(p => p.id));

  for (const id of bs.enemyTeamIds) {
    const p = findPokemon(id);
    if (!p) continue;

    const card = makeCard(p, 'enemy');

    if (bs.enemyDeadIds.has(p.id)) {
      card.classList.add('is-fainted');
    } else if (fieldIds.has(p.id)) {
      card.classList.add('is-deployed');
    }

    bench.appendChild(card);
  }
}

/* ============================================================
   CAMPO — render
   ============================================================ */
function renderField() {
  $$('#playerGrid .grid__slot').forEach(slot => {
    slot.querySelectorAll('.card').forEach(c => c.remove());
    const pkmn = bs.playerField.get(slot.dataset.slotKey);
    if (pkmn) slot.appendChild(makeCard(pkmn, 'self'));
  });
  renderPlayerBench();
  updateSpeedPreview();
  updatePlacementHint();
}

function updatePlacementHint() {
  const el = $('#placementHint');
  if (!el) return;
  if (bs.phase !== 'placement') { el.textContent = ''; return; }
  const n = bs.playerField.size;
  el.textContent = `${n} / ${FIELD_LIMIT} carte posizionate`;
  el.style.color = n === FIELD_LIMIT ? 'var(--success)' : 'var(--text-dim)';
}

function renderEnemyField() {
  $$('#enemyGrid .grid__slot').forEach(slot => {
    slot.querySelectorAll('.card').forEach(c => c.remove());
    const pkmn = bs.enemyField.get(slot.dataset.slotKey);
    if (pkmn) slot.appendChild(makeCard(pkmn, 'enemy'));
  });
  renderEnemyBench();
}

/* ============================================================
   MOSSE — label e aggiornamento sulla carta
   ============================================================ */

/** Restituisce la stringa da mostrare nel footer della carta.
 *  htmlSide: 'self' | 'enemy' */
function getMoveLabel(id, htmlSide) {
  const ppMap = htmlSide === 'self' ? bs.playerPkmnPP : bs.enemyPkmnPP;
  const pp    = ppMap.get(id) ?? 0;
  const set   = MOVESETS[id];
  const sel   = bs.selectedMoves.get(id) ?? 'basic';
  if (!set) return '⚔ Attacco Base';
  if (sel === 'finisher' && pp >= 3) return `★ ${set[1].name}`;
  return `⚔ ${set[0].name}`; // 'basic', 'auto', o finisher senza PP → stessa mossa
}

/** Aggiorna il footer della mossa sulle carte del lato indicato */
function updateCardMove(id, htmlSide) {
  const label = getMoveLabel(id, htmlSide);
  $$(`[data-move="${id}"][data-move-side="${htmlSide}"]`).forEach(el => { el.textContent = label; });
}

/* ============================================================
   CARD — costruzione elemento DOM
   ============================================================ */
function makeCard(pkmn, side) {
  const el  = document.createElement('div');
  el.className         = 'card';
  el.dataset.pokemonId = pkmn.id;
  el.dataset.side      = side;

  const hpMap  = side === 'self' ? bs.playerPkmnHP  : bs.enemyPkmnHP;
  const ppMap  = side === 'self' ? bs.playerPkmnPP  : bs.enemyPkmnPP;
  const curHP  = hpMap.get(pkmn.id) ?? pkmn.stats.hp;
  const curPP  = ppMap.get(pkmn.id) ?? 0;
  const moveLabel = getMoveLabel(pkmn.id, side);

  el.innerHTML = `
    <span class="card__hp" data-hp="${pkmn.id}" data-hp-side="${side}">${curHP}</span>
    <span class="card__pp" data-pp="${pkmn.id}" data-pp-side="${side}">PP ${curPP}</span>
    <div class="card__sprite">
      <img src="${pkmn.sprite.default}" alt="${pkmn.name}" loading="lazy" />
    </div>
    <div class="card__name">${pkmn.name}</div>
    <div class="card__types">
      ${pkmn.types.map(t => `<span class="type-badge" data-type="${t}">${t}</span>`).join('')}
    </div>
    <div class="card__move" data-move="${pkmn.id}" data-move-side="${side}">${moveLabel}</div>
  `;

  // Tasto destro → scheda Pokémon
  el.addEventListener('contextmenu', e => { e.preventDefault(); openSheet(pkmn, side); });

  // Drag & drop solo per carte del giocatore (non morte, non in fase resolving)
  if (side === 'self' && !bs.playerDeadIds.has(pkmn.id)) {
    el.draggable = true;
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend',   onDragEnd);
  }

  return el;
}

/* ============================================================
   DRAG & DROP
   ============================================================ */
function onDragStart(e) {
  if (bs.phase !== 'placement') { e.preventDefault(); return; }

  const card     = e.currentTarget;
  dragId         = parseInt(card.dataset.pokemonId, 10);
  dragFromSlot   = card.closest('[data-slot-key]')?.dataset.slotKey ?? 'bench';

  card.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragId));
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('is-dragging');
  $$('.grid__slot').forEach(s => s.classList.remove('is-drop-target'));
  dragId       = null;
  dragFromSlot = null;
}

/** Collega gli event listener di drop a tutti gli slot della griglia del giocatore */
function setupSlotDrop() {
  $$('#playerGrid .grid__slot').forEach(slot => {
    slot.addEventListener('dragover', e => {
      if (bs.phase !== 'placement' || dragId === null) return;
      const occupant = bs.playerField.get(slot.dataset.slotKey);
      // Accetta drop se: slot vuoto, oppure occupato dalla stessa carta
      if (!occupant || occupant.id === dragId) {
        e.preventDefault();
        slot.classList.add('is-drop-target');
      }
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('is-drop-target');
    });

    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('is-drop-target');
      if (dragId === null) return;
      placeCardOnSlot(dragId, slot.dataset.slotKey, dragFromSlot);
    });
  });
}

/** Permette di tornare in panchina trascinando da uno slot alla bench */
function setupBenchDrop() {
  const bench = $('#playerBench');
  if (!bench) return;

  bench.addEventListener('dragover', e => {
    if (bs.phase !== 'placement' || dragFromSlot === 'bench') return;
    e.preventDefault();
  });

  bench.addEventListener('drop', e => {
    e.preventDefault();
    if (dragId === null || dragFromSlot === 'bench') return;
    bs.playerField.delete(dragFromSlot);
    renderField();
  });
}

/** Posiziona un Pokémon su uno slot della griglia */
function placeCardOnSlot(pokemonId, targetSlotKey, fromSlotKey) {
  const pkmn = findPokemon(pokemonId);
  if (!pkmn) return;

  // Libera lo slot di partenza
  if (fromSlotKey !== 'bench') bs.playerField.delete(fromSlotKey);

  // Se lo slot target è già occupato da un ALTRO, lo rimuoviamo (torna in panchina)
  const existing = bs.playerField.get(targetSlotKey);
  if (existing && existing.id !== pokemonId) bs.playerField.delete(targetSlotKey);

  // Controlla limite 3 carte in campo
  if (!bs.playerField.has(targetSlotKey) && bs.playerField.size >= FIELD_LIMIT) {
    // Limite raggiunto: rimetti la carta dov'era
    if (fromSlotKey !== 'bench') bs.playerField.set(fromSlotKey, pkmn);
    setPhase('Max 3 carte in campo!');
    setTimeout(() => setPhase('Posiziona le tue carte'), 1500);
    renderField();
    return;
  }

  bs.playerField.set(targetSlotKey, pkmn);
  renderField();
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer() {
  bs.timeLeft = TURN_SECONDS;
  updateTimerDisplay();
  bs.timerHandle = setInterval(() => {
    if (bs.phase !== 'placement') { clearInterval(bs.timerHandle); return; }
    bs.timeLeft--;
    updateTimerDisplay();
    if (bs.timeLeft <= 0) { clearInterval(bs.timerHandle); confirmTurn(); }
  }, 1000);
}

function stopTimer() { clearInterval(bs.timerHandle); }

function updateTimerDisplay() {
  const el = $('#timerValue');
  if (el) el.textContent = bs.timeLeft;
}

/* ============================================================
   TURNO — conferma e risoluzione
   ============================================================ */
async function confirmTurn() {
  if (bs.phase !== 'placement') return;
  bs.phase = 'resolving';
  stopTimer();
  updatePlacementHint();  // svuota l'hint durante la risoluzione

  const btn = $('#btnConfirm');
  btn.disabled = true;
  setPhase('Risoluzione in corso…');

  // ---- Acquisisce campo + mosse avversario (AI o player remoto) ----
  let enemySelectedMoves;
  if (bs.pvp) {
    const result = await acquireOpponentTurnPvP();
    if (!result) {
      // Avversario disconnesso → vittoria
      endGame('win');
      return;
    }
    bs.enemyField      = result.enemyField;
    enemySelectedMoves = result.enemySelectedMoves;
  } else {
    // AI mode: piazzamento + scelta mossa locali
    bs.enemyField = aiPlaceCards(bs.enemyTeamIds, bs.enemyDeadIds, findPokemon, {
      hpMap: bs.enemyPkmnHP,
    });
    enemySelectedMoves = aiChooseMoves({
      attackerField: bs.enemyField,
      defenderField: bs.playerField,
      attackerPP:    bs.enemyPkmnPP,
      movesets:      MOVESETS,
      defenderDead:  bs.playerDeadIds,
    });
  }
  renderEnemyField();
  await sleep(500);

  const events = resolveTurn({
    playerField:        bs.playerField,
    enemyField:         bs.enemyField,
    playerPkmnHP:       bs.playerPkmnHP,
    enemyPkmnHP:        bs.enemyPkmnHP,
    playerDeadIds:      bs.playerDeadIds,
    enemyDeadIds:       bs.enemyDeadIds,
    playerHP:           bs.playerHP,
    enemyHP:            bs.enemyHP,
    movesets:           MOVESETS,
    selectedMoves:      bs.selectedMoves,
    enemySelectedMoves,
    playerPkmnPP:       bs.playerPkmnPP,
    enemyPkmnPP:        bs.enemyPkmnPP,
  });

  // Anima la sequenza
  await playEvents(events);

  // Controlla vittoria / sconfitta
  if (bs.playerHP <= 0 || isTeamWiped(bs.playerTeamIds, 'player')) { endGame('lose'); return; }
  if (bs.enemyHP  <= 0 || isTeamWiped(bs.enemyTeamIds,  'enemy'))  { endGame('win');  return; }

  // Nuovo turno — rimuovi i morti dal campo
  for (const [key, pkmn] of bs.playerField) { if (bs.playerDeadIds.has(pkmn.id)) bs.playerField.delete(key); }
  for (const [key, pkmn] of bs.enemyField)  { if (bs.enemyDeadIds.has(pkmn.id))  bs.enemyField.delete(key); }

  await sleep(600);
  bs.turn++;
  $('#turnNumber').textContent = bs.turn;

  bs.phase = 'placement';
  btn.disabled = false;
  setPhase('Posiziona le tue carte');
  renderField();        // aggiorna anche placementHint via updatePlacementHint()
  renderEnemyField();
  startTimer();
}

/* ============================================================
   PVP — sincronizzazione via WebSocket
   ============================================================
   Strategia: combat è deterministico. Entrambi i client mandano
   la propria azione al server, ricevono quella avversaria, poi
   calcolano localmente lo stesso resolveTurn. Stessi input →
   stessi eventi → stesso esito.
*/

async function setupPvPConnection() {
  const gs = getState();
  bs.pvp.client = createOnlineClient();
  registerPvPHandlers();

  // Listener per il flow di resume (verrà rimosso dopo)
  let resumePromiseResolve, resumePromiseReject;
  const resumePromise = new Promise((resolve, reject) => {
    resumePromiseResolve = resolve;
    resumePromiseReject  = reject;
  });
  const offResumed = bs.pvp.client.on('matchResumed', () => {
    console.log('[pvp] ✅ match riassociato sul server');
    resumePromiseResolve(true);
  });
  const offNotFound = bs.pvp.client.on('matchNotFound', () => {
    console.error('[pvp] ❌ match non trovato sul server (scaduto?)');
    resumePromiseReject(new Error('Match scaduto, torna alla home e riprova'));
  });

  try {
    await bs.pvp.client.connect({
      userId:   gs.userId,
      userName: gs.userName ?? 'Allenatore',
    });

    // Riassocia questo nuovo clientId al match già esistente sul server
    console.log('[pvp] 🔄 resume-match', bs.pvp.matchId.slice(0,8), 'side:', bs.pvp.side);
    bs.pvp.client.resumeMatch(bs.pvp.matchId, bs.pvp.side, gs.userId);

    // Aspetta conferma (timeout 5s)
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout resume-match')), 5000));
    await Promise.race([resumePromise, timeout]);
    return true;
  } catch (e) {
    console.error('PvP: setup fallito:', e);
    return false;
  } finally {
    offResumed?.();
    offNotFound?.();
  }
}

function registerPvPHandlers() {
  const c = bs.pvp.client;

  c.on('opponentAction', payload => {
    console.log('[pvp] 📥 Ricevuta azione avversario, turn:', payload?.turn,
                'awaiting:', !!bs.pvp.awaitOpponentResolver);
    if (bs.pvp.awaitOpponentResolver) {
      const resolver = bs.pvp.awaitOpponentResolver;
      bs.pvp.awaitOpponentResolver = null;
      resolver(payload);
    } else {
      bs.pvp.pendingOpponentAction = payload;
      console.log('[pvp] 📦 Azione messa in pending');
    }
  });

  c.on('opponentLeft', () => {
    console.log('[pvp] 👋 Avversario disconnesso');
    bs.pvp.disconnected = true;
    if (bs.pvp.awaitOpponentResolver) {
      const resolver = bs.pvp.awaitOpponentResolver;
      bs.pvp.awaitOpponentResolver = null;
      resolver(null);
    }
  });

  c.on('disconnected', () => {
    if (bs.phase !== 'ended') {
      console.warn('[pvp] ⚠️  connessione persa al server');
    }
  });

  c.on('unknown', msg => {
    console.warn('[pvp] messaggio sconosciuto dal server:', msg);
  });
}

/**
 * Invia la mia azione del turno e attende quella dell'avversario.
 * Ritorna { enemyField, enemySelectedMoves } oppure null se disconnesso.
 */
async function acquireOpponentTurnPvP() {
  const myAction = buildMyAction();
  console.log('[pvp] 📤 Invio azione turno', bs.turn, myAction);

  const sent = bs.pvp.client.sendTurnAction(bs.turn, myAction.placement, myAction.moves);
  console.log('[pvp] sendTurnAction returned:', sent, 'connected:', bs.pvp.client.connected);

  setPhase('In attesa dell\'avversario…');

  // Warning se l'attesa è troppo lunga (oltre 60s) — probabile problema di rete/server
  const warnTimer = setTimeout(() => {
    if (bs.pvp.awaitOpponentResolver || bs.pvp.pendingOpponentAction === null) {
      console.warn('[pvp] ⏳ Attesa avversario > 60s — possibile problema lato server o avversario');
      setPhase('⚠️ Avversario non risponde da 60s…');
    }
  }, 60_000);

  const oppAction = await waitForOpponent();
  clearTimeout(warnTimer);

  if (!oppAction) {
    console.log('[pvp] waitForOpponent → null (disconnesso)');
    return null;
  }

  console.log('[pvp] ✅ Azione avversario acquisita, turn:', oppAction.turn);

  const enemyField         = buildFieldFromPlacement(oppAction.placement, bs.enemyTeamIds);
  const enemySelectedMoves = new Map(
    Object.entries(oppAction.moves ?? {}).map(([id, choice]) => [Number(id), choice])
  );

  console.log('[pvp] enemyField pokemons:', [...enemyField.values()].map(p => p.name));

  return { enemyField, enemySelectedMoves };
}

/** Estrae placement + selectedMoves del player in formato serializzabile. */
function buildMyAction() {
  const placement = {};
  for (const [slotKey, pkmn] of bs.playerField) {
    placement[slotKey] = pkmn.id;
  }
  const moves = {};
  // Per ogni Pokémon in campo, registra la scelta mossa (default 'basic')
  for (const [, pkmn] of bs.playerField) {
    moves[pkmn.id] = bs.selectedMoves.get(pkmn.id) ?? 'basic';
  }
  return { placement, moves };
}

/** Da {slotKey: pokemonId} a Map<slotKey, pkmn>. Valida che gli ID
    appartengano davvero al team dell'avversario (anti-cheat minimo). */
function buildFieldFromPlacement(placementObj, validTeamIds) {
  const field    = new Map();
  const validSet = new Set(validTeamIds);
  for (const [slotKey, pokemonId] of Object.entries(placementObj ?? {})) {
    if (!validSet.has(pokemonId)) continue;
    const pkmn = findPokemon(pokemonId);
    if (pkmn) field.set(slotKey, pkmn);
  }
  return field;
}

/** Promise che si risolve quando arriva l'azione avversaria (o null se disconnesso). */
function waitForOpponent() {
  return new Promise(resolve => {
    if (bs.pvp.disconnected) {
      resolve(null);
      return;
    }
    // Se l'azione è già arrivata mentre confermavamo, usala subito
    if (bs.pvp.pendingOpponentAction) {
      const action = bs.pvp.pendingOpponentAction;
      bs.pvp.pendingOpponentAction = null;
      resolve(action);
      return;
    }
    bs.pvp.awaitOpponentResolver = resolve;
  });
}

/* ============================================================
   ANIMAZIONE EVENTI
   ============================================================ */
async function playEvents(events) {
  for (const ev of events) {

    if (ev.type === 'speed_check') {
      const label = ev.first === 'player' ? 'Vai per primo! ▶' : '◀ Avversario va per primo!';
      setPhase(`⚡ Speed Tu: ${ev.playerSpeed} — Avversario: ${ev.enemySpeed} — ${label}`);
      await sleep(1400);
    }

    else if (ev.type === 'attack') {
      const pkmnName = findPokemon(ev.attackerId)?.name ?? `#${ev.attackerId}`;
      const defName  = findPokemon(ev.targetId)?.name  ?? `#${ev.targetId}`;

      // Aggiorna HP nella mappa corretta per lato (evita collisioni di ID)
      const hpMap = ev.defenderSide === 'player' ? bs.playerPkmnHP : bs.enemyPkmnHP;
      hpMap.set(ev.targetId, ev.targetHPAfter);

      const atkEl = findCardEl(ev.attackerSide, ev.attackerSlot);
      const defEl = findCardEl(ev.defenderSide, ev.defenderSlot);

      // Animazione attaccante
      if (atkEl) {
        atkEl.classList.add('is-attacking');
        await sleep(150);
      }

      // Danno + effetto tipo
      if (defEl) {
        const effText = ev.typeEff >= 2 ? ' ×2!' : ev.typeEff === 0 ? '' : ev.typeEff < 1 ? ' ×½' : '';
        showDamageFloat(defEl, ev.damage, ev.typeEff, effText);
        updateCardHP(ev.targetId, ev.targetHPAfter, ev.defenderSide);

        if (ev.targetDied) {
          if (ev.defenderSide === 'player') bs.playerDeadIds.add(ev.targetId);
          else                              bs.enemyDeadIds.add(ev.targetId);
          await sleep(350);
          defEl.classList.add('is-fainted');
        }
      }

      // PP: deduzione Finisher (costo 3) poi guadagno per colpo a segno
      const atkPPMap  = ev.attackerSide === 'player' ? bs.playerPkmnPP : bs.enemyPkmnPP;
      const atkHtmlSide = ev.attackerSide === 'player' ? 'self' : 'enemy';
      if (ev.isFinisher) {
        atkPPMap.set(ev.attackerId, Math.max(0, (atkPPMap.get(ev.attackerId) ?? 0) - 3));
      }
      if (ev.typeEff > 0) {
        const newPP = (atkPPMap.get(ev.attackerId) ?? 0) + 1;
        atkPPMap.set(ev.attackerId, newPP);
        updateCardPP(ev.attackerId, newPP, atkHtmlSide);
        if (atkEl) showPPFloat(atkEl);
      }

      await sleep(700);
      if (atkEl) atkEl.classList.remove('is-attacking');
    }

    else if (ev.type === 'direct_damage') {

      // Animazione attaccante
      const atkEl = findCardEl(ev.attackerSide, ev.attackerSlot);
      if (atkEl) {
        atkEl.classList.add('is-attacking');
        await sleep(150);
      }

      if (ev.defenderSide === 'player') bs.playerHP = ev.hpAfter;
      else                              bs.enemyHP  = ev.hpAfter;

      const sideAttr = ev.defenderSide === 'player' ? 'self' : 'enemy';
      const hpBarEl  = $(`.hp-bar[data-side="${sideAttr}"]`);
      if (hpBarEl) {
        hpBarEl.classList.add('is-shaking');
        setTimeout(() => hpBarEl.classList.remove('is-shaking'), 350);
      }

      setPhase(`💥 Colonna vuota! −${ev.damage} HP ${ev.defenderSide === 'player' ? 'a te' : "all'avversario"}`);
      updateHPBar('player');
      updateHPBar('enemy');

      // PP: deduzione Finisher poi guadagno (danno diretto conta come hit)
      const atkPPMap2   = ev.attackerSide === 'player' ? bs.playerPkmnPP : bs.enemyPkmnPP;
      const atkHtmlSide2 = ev.attackerSide === 'player' ? 'self' : 'enemy';
      if (ev.isFinisher) {
        atkPPMap2.set(ev.attackerId, Math.max(0, (atkPPMap2.get(ev.attackerId) ?? 0) - 3));
      }
      const newPP2 = (atkPPMap2.get(ev.attackerId) ?? 0) + 1;
      atkPPMap2.set(ev.attackerId, newPP2);
      updateCardPP(ev.attackerId, newPP2, atkHtmlSide2);
      if (atkEl) showPPFloat(atkEl);

      await sleep(700);
      if (atkEl) atkEl.classList.remove('is-attacking');
    }

    else if (ev.type === 'turn_end') {
      bs.playerHP = ev.playerHP;
      bs.enemyHP  = ev.enemyHP;
      updateHPBar('player');
      updateHPBar('enemy');
    }
  }
}

/** Trova l'elemento DOM della carta in un dato slot */
function findCardEl(side, slotKey) {
  const gridId = side === 'player' ? 'playerGrid' : 'enemyGrid';
  const slot   = $(`#${gridId} [data-slot-key="${slotKey}"]`);
  return slot ? slot.querySelector('.card') : null;
}

/** Mostra "+1 PP" fluttuante in basso sulla carta attaccante */
function showPPFloat(cardEl) {
  const float = document.createElement('div');
  float.className = 'pp-float';
  float.textContent = '+1 PP';
  cardEl.appendChild(float);
  setTimeout(() => float.remove(), 850);
}

/** Mostra un numero di danno fluttuante sopra la carta */
function showDamageFloat(cardEl, damage, typeEff, extra = '') {
  if (typeEff === 0) {
    const immune = document.createElement('div');
    immune.className = 'damage-float is-immune';
    immune.textContent = 'Immune!';
    cardEl.appendChild(immune);
    setTimeout(() => immune.remove(), 950);
    return;
  }

  const float = document.createElement('div');
  float.className = 'damage-float';
  if (typeEff >= 2) float.classList.add('is-super');
  else if (typeEff < 1) float.classList.add('is-weak');
  float.textContent = `-${damage}${extra}`;
  cardEl.appendChild(float);
  setTimeout(() => float.remove(), 950);
}

/** Aggiorna i badge HP della carta corretta (filtra per lato per evitare collisioni di ID) */
function updateCardHP(pokemonId, newHP, side) {
  const sideAttr = side === 'player' ? 'self' : 'enemy';
  $$(`[data-hp="${pokemonId}"][data-hp-side="${sideAttr}"]`).forEach(el => { el.textContent = newHP; });
}

/** Aggiorna il badge PP e il footer mossa per il lato corretto.
 *  htmlSide: 'self' | 'enemy' */
function updateCardPP(pokemonId, newPP, htmlSide) {
  $$(`[data-pp="${pokemonId}"][data-pp-side="${htmlSide}"]`).forEach(el => {
    el.textContent = `PP ${newPP}`;
  });
  updateCardMove(pokemonId, htmlSide);
}

/** Aggiorna la barra HP del giocatore o dell'avversario */
function updateHPBar(side) {
  const sideAttr  = side === 'player' ? 'self' : 'enemy';
  const currentHP = side === 'player' ? bs.playerHP : bs.enemyHP;
  const maxHP     = side === 'player' ? PLAYER_MAX_HP : ENEMY_MAX_HP;

  const bar = $(`.hp-bar[data-side="${sideAttr}"]`);
  if (!bar) return;

  bar.querySelector('.hp-bar__fill').style.width =
    `${Math.max(0, (currentHP / maxHP) * 100)}%`;

  const cur = bar.querySelector('[data-hp-current]');
  if (cur) cur.textContent = Math.max(0, currentHP);
}

/* ============================================================
   FINE PARTITA
   ============================================================ */
function isTeamWiped(teamIds, side) {
  const dead = side === 'player' ? bs.playerDeadIds : bs.enemyDeadIds;
  return teamIds.every(id => dead.has(id));
}

function endGame(result) {
  bs.phase = 'ended';
  stopTimer();
  setPhase(result === 'win' ? '🏆 Hai vinto!' : '💀 Hai perso!');

  const btn = $('#btnConfirm');
  btn.textContent = 'Torna alla Home';
  btn.disabled    = false;
  btn.onclick     = () => { window.location.href = 'index.html'; };
}

/* ============================================================
   FASE LABEL
   ============================================================ */
function setPhase(text) {
  const el = $('#phaseLabel');
  if (el) el.textContent = text;
}

/* ============================================================
   SCHEDA POKÉMON (popup tasto destro)
   ============================================================ */
const sheet      = $('#pokeSheet');
const sheetTitle = $('#pokeSheetTitle');
const sheetBody  = $('#sheetBody');
let sheetPkmn    = null;
let sheetHtmlSide = 'self'; // 'self' | 'enemy'

function openSheet(pkmn, htmlSide = 'self') {
  sheetPkmn     = pkmn;
  sheetHtmlSide = htmlSide;
  sheetTitle.textContent = pkmn.name;
  renderSheetTab('stats');
  sheet.classList.remove('hidden');

  $$('.sheet__tab').forEach(t => {
    t.classList.toggle('is-active', t.dataset.sheetTab === 'stats');
    t.onclick = () => {
      $$('.sheet__tab').forEach(x => x.classList.remove('is-active'));
      t.classList.add('is-active');
      renderSheetTab(t.dataset.sheetTab);
    };
  });
}

function renderSheetTab(tab) {
  if (!sheetPkmn) return;
  const p = sheetPkmn;

  if (tab === 'stats') {
    const ppMap = sheetHtmlSide === 'self' ? bs.playerPkmnPP : bs.enemyPkmnPP;
    const curPP = ppMap.get(p.id) ?? 0;
    const stats = [
      ['HP',     p.stats.hp,    255, 'hp'],
      ['ATK',    p.stats.atk,   190, 'atk'],
      ['DEF',    p.stats.def,   230, 'def'],
      ['SP.ATK', p.stats.spAtk, 194, 'spatk'],
      ['SP.DEF', p.stats.spDef, 230, 'spdef'],
      ['SPEED',  p.stats.speed, 180, 'speed'],
    ];
    sheetBody.innerHTML = `
      <div class="stat-list">
        ${stats.map(([n, v, mx, cls]) => `
          <span class="stat-list__name">${n}</span>
          <span class="stat-list__bar">
            <span class="stat-list__bar-fill stat-list__bar-fill--${cls}" style="width:${Math.min(100, (v / mx) * 100)}%"></span>
          </span>
          <span class="stat-list__value">${v}</span>
        `).join('')}
        <span class="stat-list__name" style="color:var(--accent)">PP</span>
        <span class="stat-list__bar">
          <span class="stat-list__bar-fill stat-list__bar-fill--pp" style="width:${Math.min(100, (curPP / 3) * 100)}%"></span>
        </span>
        <span class="stat-list__value" style="color:var(--accent)">${curPP}</span>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;">
        ${p.types.map(t => `<span class="type-badge" data-type="${t}">${t}</span>`).join('')}
      </div>
    `;
  } else if (tab === 'moves') {
    const set     = MOVESETS[p.id];
    const ppMap   = sheetHtmlSide === 'self' ? bs.playerPkmnPP : bs.enemyPkmnPP;
    const pp      = ppMap.get(p.id) ?? 0;
    const selMove = bs.selectedMoves.get(p.id) ?? 'basic';
    const isPlayerCard = sheetHtmlSide === 'self';

    const catIcon  = cat => cat === 'physical' ? '⚔' : cat === 'special' ? '✨' : '◎';
    const catLabel = cat => cat === 'physical' ? 'Fisico' : cat === 'special' ? 'Speciale' : 'Stato';

    const renderMove = (move, key, isSelected, canUse) => {
      const stab   = p.types.includes(move.type);
      const dimmed = !canUse ? ' style="opacity:0.45"' : '';
      return `
        <div class="move-row${isSelected ? ' move-row--active' : ''}"${dimmed}>
          ${stab ? '<div class="move-row__header"><span class="move-row__stab">STAB</span></div>' : ''}
          <div class="move-row__name">
            <span class="type-badge" data-type="${move.type}">${move.type}</span>
            ${catIcon(move.cat)} ${move.name}
            <span class="move-row__meta">${catLabel(move.cat)} · PWR ${move.power}</span>
          </div>
          ${isPlayerCard && canUse
            ? `<button class="btn btn--sm${isSelected ? ' btn--primary' : ''}" data-select-move="${key}">
                 ${isSelected ? '✓ Selezionata' : 'Seleziona'}
               </button>`
            : ''}
        </div>
      `;
    };

    const autoMove = {
      name: 'Attacco Base', type: p.types[0],
      cat:  p.stats.atk >= p.stats.spAtk ? 'physical' : 'special',
      power: 50,
    };

    // sel 'auto' trattato come 'basic' visivamente — entrambe le opzioni libere
    const effSel = (selMove === 'auto') ? 'basic' : selMove;

    const rows = set
      ? [
          renderMove(set[0],  'basic',    effSel === 'basic',    true),
          renderMove(set[1],  'finisher', effSel === 'finisher', pp >= 3),
        ]
      : [renderMove(autoMove, 'basic', true, true)];

    sheetBody.innerHTML = `<div class="moves-list">${rows.join('')}</div>`;

    sheetBody.querySelectorAll('[data-select-move]').forEach(btn => {
      btn.addEventListener('click', () => {
        bs.selectedMoves.set(p.id, btn.dataset.selectMove);
        updateCardMove(p.id, sheetHtmlSide);
        renderSheetTab('moves');
      });
    });
  } else if (tab === 'gear') {
    sheetBody.innerHTML = `
      <p style="color:var(--text-dim);margin-bottom:12px;">Ogni Pokémon può tenere 1 oggetto.</p>
      <div style="width:96px;aspect-ratio:1;">
        <div class="grid__slot" style="width:100%;height:100%;min-height:0;"></div>
      </div>
    `;
  }
}

function closeAllModals() {
  $$('.modal').forEach(m => m.classList.add('hidden'));
  sheetPkmn = null;
}

/* ============================================================
   TARGET PREVIEW (4d-1)
   Hover su una carta del giocatore in campo → evidenzia lo slot
   nemico che verrebbe attaccato (stessa colonna, front prima).
   ============================================================ */
function setupTargetPreview() {
  let currentCard = null;

  document.addEventListener('mouseover', e => {
    // Preview attiva solo in fase di posizionamento
    if (bs.phase !== 'placement') {
      if (currentCard) { clearTargetPreview(); currentCard = null; }
      return;
    }

    const card = e.target.closest('#playerGrid .card');
    if (card === currentCard) return; // nessun cambiamento
    currentCard = card;
    clearTargetPreview();
    if (!card) return;

    const slot = card.closest('.grid__slot');
    if (!slot?.dataset.col) return;

    const col       = slot.dataset.col;
    const frontSlot = $(`#enemyGrid [data-slot-key="front-${col}"]`);
    const backSlot  = $(`#enemyGrid [data-slot-key="back-${col}"]`);

    // Cerca il primo bersaglio non morto: front prima, poi back
    if (frontSlot?.querySelector('.card:not(.is-fainted)')) {
      frontSlot.classList.add('is-targeted');
    } else if (backSlot?.querySelector('.card:not(.is-fainted)')) {
      backSlot.classList.add('is-targeted');
    } else {
      // Colonna vuota → danno diretto all'avversario
      frontSlot?.classList.add('is-targeted-empty');
      backSlot?.classList.add('is-targeted-empty');
    }
  });
}

function clearTargetPreview() {
  $$('#enemyGrid .is-targeted, #enemyGrid .is-targeted-empty').forEach(s => {
    s.classList.remove('is-targeted', 'is-targeted-empty');
  });
}

/* ============================================================
   SPEED PREVIEW (4d-2)
   Mostra i totali di Speed di entrambi i team e chi va prima.
   Aggiornato ogni volta che il campo del giocatore cambia.
   ============================================================ */
function updateSpeedPreview() {
  const el = $('#speedPreview');
  if (!el || bs.phase !== 'placement') return;

  // Speed del giocatore: somma delle carte in campo
  let playerSpeed = 0;
  for (const pkmn of bs.playerField.values()) {
    playerSpeed += pkmn.stats.speed;
  }

  // Speed stimata dell'AI: primi 3 Pokémon vivi (stessa logica di ai.js)
  let enemySpeed = 0;
  let placed = 0;
  for (const id of bs.enemyTeamIds) {
    if (placed >= 3) break;
    if (bs.enemyDeadIds.has(id)) continue;
    const p = findPokemon(id);
    if (p) { enemySpeed += p.stats.speed; placed++; }
  }

  if (bs.playerField.size === 0) {
    el.textContent = '⚡ — vs —';
    el.style.color = '';
    return;
  }

  const label = playerSpeed > enemySpeed ? '▶ Tu prima'
              : playerSpeed < enemySpeed ? '◀ Loro prima'
              : '= Pari';
  el.textContent = `⚡ ${playerSpeed} vs ${enemySpeed} — ${label}`;
  el.style.color = playerSpeed >= enemySpeed ? 'var(--success)' : 'var(--danger)';
}

/* ============================================================
   SPEED-UP TOGGLE (4d-3)
   ⏩ 1× / 2× — dimezza sleep + animation-duration via classe CSS.
   ============================================================ */
function toggleSpeedUp() {
  speedMultiplier = speedMultiplier === 1 ? 2 : 1;
  localStorage.setItem('pkmn_speed_up', String(speedMultiplier));
  document.body.classList.toggle('speed-up', speedMultiplier === 2);
  updateSpeedUpBtn();
}

function updateSpeedUpBtn() {
  const btn = $('#btnSpeedUp');
  if (btn) btn.textContent = speedMultiplier === 2 ? '⏩ 2×' : '⏩ 1×';
}

/** Mostra un errore nell'overlay di caricamento con bottone di retry */
function showLoadingError(err) {
  const overlay = $('#loadingOverlay');
  if (!overlay) return;

  const isAbort = err?.name === 'AbortError';
  const msg = isAbort
    ? 'Timeout: PokeAPI non risponde.'
    : `Errore di rete: ${err?.message ?? err}`;

  overlay.innerHTML = `
    <p style="color:var(--danger);font-weight:700;font-size:1.1rem;">⚠ Caricamento fallito</p>
    <p style="color:var(--text-dim);font-size:0.9rem;max-width:320px;text-align:center;">${msg}</p>
    <div style="display:flex;gap:12px;margin-top:8px;">
      <button class="btn btn--primary" onclick="location.reload()">Riprova</button>
      <a class="btn" href="index.html">← Home</a>
    </div>
  `;
}
