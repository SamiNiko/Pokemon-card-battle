/* ============================================================
   battle.js — schermata di combattimento
   - Drag & drop: panchina ↔ griglia (max 3 carte in campo)
   - Motore di combattimento: speed check → attacchi sequenziali → HP
   - AI base: schiera i primi 3 Pokémon vivi in front row
   ============================================================ */

import { loadAllPokemon, findPokemon }         from './data/pokeapi.js';
import { getState, getActiveTeam, getEquipped, saveState, markTrainerBeaten, isTrainerBeaten } from './data/state.js?v=6';
import { findItem }                            from './data/items.js?v=3';
import { resolveTurn }                         from './engine/combat.js';
import { getPassive }                          from './data/passives.js';
import { aiPlaceCards, aiChooseMoves }         from './engine/ai.js';
import { MOVESETS }                            from './data/movesets.js?v=3';
import { createOnlineClient }                  from './data/online.js';
import { recordMatch }                         from './data/match-history.js';
import { typeLabel }                           from './data/types.js';
import { openCardModal }                       from './data/card-modal.js?v=9';
import { SFX }                                 from './data/sfx.js';
import { getScaledStats }                      from './data/stats-scaling.js?v=3';
import { playBGM }                             from './data/bgm.js?v=5';

/* ---- Modalità: 'ai' (CPU random) | 'pvp' (online) | 'trainer' (Allenatore Kanto) ---- */
const URL_PARAMS = new URLSearchParams(location.search);
const _modeParam = URL_PARAMS.get('mode');
const MODE       = _modeParam === 'pvp'     ? 'pvp'
                 : _modeParam === 'trainer' ? 'trainer'
                 :                            'ai';
const TRAINER_ID = MODE === 'trainer' ? URL_PARAMS.get('id') : null;

// BGM: scelta differenziata per tipo di battaglia. Se il file MP3
// corrispondente non esiste, bgm.js fa fallback al loop procedurale.
const TRAINER_CATEGORIES = {
  // Capipalestra → battle-gym
  brock:'gym', misty:'gym', surge:'gym', erika:'gym',
  koga:'gym',  sabrina:'gym', blaine:'gym', giovanni:'gym',
  // Boss intermedi → battle-trainer
  rocketboss:'trainer', rival:'trainer',
  // Elite Four + Champion → battle-champion
  lorelei:'champion', bruno:'champion', agatha:'champion',
  lance:'champion', blue:'champion',
  // Oak ha la sua traccia dedicata
  oak: 'oak',
};
function pickBattleTrack() {
  if (MODE !== 'trainer') return 'battle';
  const cat = TRAINER_CATEGORIES[TRAINER_ID];
  if (cat === 'oak')      return 'boss-oak';
  if (cat === 'gym')      return 'battle-gym';
  if (cat === 'trainer')  return 'battle-trainer';
  if (cat === 'champion') return 'battle-champion';
  return 'boss';   // fallback per trainer non mappato (e per AI = 'battle')
}
playBGM(pickBattleTrack());

/* ---- Utility ---- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Moltiplicatore velocità (4d-3): 1 = normale, 2 = doppio — persiste in localStorage */
let speedMultiplier = localStorage.getItem('pkmn_speed_up') === '2' ? 2 : 1;
if (speedMultiplier === 2) document.body.classList.add('speed-up');

const sleep = ms => new Promise(res => setTimeout(res, Math.round(ms / speedMultiplier)));
const cap   = s => s[0].toUpperCase() + s.slice(1);

/** URL artwork fullart per il Pokémon (assets/cards/NNN.webp). */
function getArtworkUrl(pkmn) {
  if (!pkmn) return '';
  return `assets/cards/${String(pkmn.id).padStart(3, '0')}.webp`;
}

const COLS          = ['left', 'center', 'right'];
const PLAYER_MAX_HP = 3000;
const ENEMY_MAX_HP  = 3000;
const TURN_SECONDS  = 60;
const FIELD_LIMIT   = 3;   // max carte in campo contemporaneamente

/* ============================================================
   STATO BATTAGLIA
   ============================================================ */
const bs = {
  phase:          'placement',   // 'placement' | 'resolving' | 'ended'
  turn:           1,
  startedAt:      Date.now(),     // per calcolare la durata della battaglia
  matchRecorded:  false,          // evita doppio insert in caso di rerun di endGame
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
  /* Stato passive cross-turn (mutato da resolveTurn):
       - endureUsed  : Set<pokemonId> già "salvati" da Vigore (endure_once)
       - speedStacks : Map<`${side}:${id}`, stacks> per Velocitàscatto */
  passiveState:   { endureUsed: new Set(), speedStacks: new Map() },
  selectedMoves:  new Map(),    // id → 'auto'|'basic'|'finisher' (default: 'basic')
  playerField:    new Map(),    // slotKey → pkmn
  enemyField:     new Map(),
  playerHeld:     new Map(),    // pokemonId → item (oggetto tenuto del team attivo)
  enemyHeld:      new Map(),    // pokemonId → item (vuoto in AI mode, popolato in PvP futuro)
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
  } else if (MODE === 'trainer') {
    // ---- TRAINER mode ----
    // Carica il team del trainer da js/data/trainers.js. Se l'id non
    // esiste o il team è vuoto, fallback al team random.
    const { getTrainer } = await import('./data/trainers.js?v=8');
    const t = getTrainer(TRAINER_ID);
    const playerTeam = getActiveTeam();
    bs.playerTeamIds = playerTeam.length > 0 ? playerTeam : [25, 6, 9, 3, 94, 65];
    if (t && Array.isArray(t.team) && t.team.length > 0) {
      bs.enemyTeamIds = [...t.team];
      // Personalizza nome/avatar avversario col trainer
      const enemyNameEl   = $('#enemyName');
      const enemyAvatarEl = $('#enemyAvatar');
      if (enemyNameEl)   enemyNameEl.textContent   = t.name;
      if (enemyAvatarEl) {
        // Sprite del trainer come avatar (con fallback emoji badge)
        if (t.sprite) {
          enemyAvatarEl.innerHTML = `<img class="trainer-avatar-img" src="${t.sprite}" alt="${t.name}"
            onerror="this.outerHTML='${t.badge ?? t.name[0] ?? 'T'}'" />`;
          enemyAvatarEl.classList.add('has-trainer-sprite');
        } else {
          enemyAvatarEl.textContent = t.badge ?? (t.name[0] ?? 'T');
        }
      }
      // SFX intro drammatico — annuncia l'inizio della sfida col trainer
      setTimeout(() => SFX.trainerIntro?.(), 400);
    } else {
      bs.enemyTeamIds = pickRandomEnemyTeam(6);
    }
  } else {
    // ---- AI mode (default): team avversario casuale dal pool dei 151 ----
    const playerTeam = getActiveTeam();
    bs.playerTeamIds = playerTeam.length > 0 ? playerTeam : [25, 6, 9, 3, 94, 65];
    bs.enemyTeamIds  = pickRandomEnemyTeam(6);
  }

  // Helper: pick random enemy team (no leggendari per equilibrio)
  function pickRandomEnemyTeam(n) {
    const ids = [];
    const NON_LEGENDARY_MAX = 150;
    const used = new Set();
    while (ids.length < n) {
      const r = 1 + Math.floor(Math.random() * NON_LEGENDARY_MAX);
      if (used.has(r)) continue;
      if ([144, 145, 146, 150, 151].includes(r)) continue;  // skip leggendari
      used.add(r);
      ids.push(r);
    }
    return ids;
  }

  // HP e PP iniziali — player e enemy separati per evitare collisioni di ID
  for (const id of bs.playerTeamIds) {
    const p = findPokemon(id);
    if (!p) continue;
    bs.playerPkmnHP.set(p.id, getScaledStats(p).hp);
    bs.playerPkmnPP.set(p.id, 0);
  }
  for (const id of bs.enemyTeamIds) {
    const p = findPokemon(id);
    if (!p) continue;
    bs.enemyPkmnHP.set(p.id, getScaledStats(p).hp);
    bs.enemyPkmnPP.set(p.id, 0);
  }

  // Oggetti tenuti: carica dall'active team del player (in PvP serve un payload dedicato dal server, TODO)
  for (const id of bs.playerTeamIds) {
    const itemId = getEquipped(id);  // null se nessuno
    if (!itemId) continue;
    const it = findItem(itemId);
    if (it) bs.playerHeld.set(id, it);
  }

  renderPlayerBench();
  renderEnemyBench();
  setupSlotDrop();
  setupBenchDrop();
  setupTargetPreview();
  setupLogToggle();
  bindMovePickerStaticHandlers();
  updateSpeedPreview();
  startTimer();

  // Log iniziale: oggetti tenuti
  log(`Battaglia iniziata — ${bs.pvp ? 'PvP' : 'vs CPU'}`, 'turn');
  for (const [pkmnId, item] of bs.playerHeld) {
    const p = findPokemon(pkmnId);
    if (p) log(`${p.name} tiene ${item.name}`, 'item');
  }

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

    const card = makeCard(p, 'self', 'field');

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

    const card = makeCard(p, 'enemy', 'field');

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
    if (pkmn) slot.appendChild(makeCard(pkmn, 'self', 'field', slot.dataset.slotKey));
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
    if (pkmn) slot.appendChild(makeCard(pkmn, 'enemy', 'field', slot.dataset.slotKey));
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
  const sel   = bs.selectedMoves.get(id) ?? 'basic1';
  if (!set) return '⚔ Attacco Base';
  // Nuovo formato [base1, base2, finisher] (3 elementi) o vecchio [basic, finisher] (2)
  const isNew    = set.length >= 3;
  const base1    = set[0];
  const base2    = isNew ? set[1] : set[0];
  const finisher = isNew ? set[2] : set[1];
  if (sel === 'finisher' && pp >= 3) return `★ ${finisher.name}`;
  if (sel === 'basic2')              return `⚔ ${base2.name}`;
  return `⚔ ${base1.name}`; // 'basic1', 'basic' (legacy), 'auto', o finisher senza PP
}

/** Aggiorna il footer della mossa sulle carte del lato indicato */
function updateCardMove(id, htmlSide) {
  const label = getMoveLabel(id, htmlSide);
  $$(`[data-move="${id}"][data-move-side="${htmlSide}"]`).forEach(el => { el.textContent = label; });
}

/* ============================================================
   MOVE PICKER — modal per scegliere quale mossa userà il Pokemon
   ============================================================ */
let movePickerPkmnId = null;

function openMovePicker(pkmn) {
  const modal   = $('#movePickerModal');
  const titleEl = $('#movePickerTitle');
  const subEl   = $('#movePickerSub');
  const optsEl  = $('#movePickerOptions');
  if (!modal || !optsEl) return;

  movePickerPkmnId = pkmn.id;
  const set = MOVESETS[pkmn.id];
  const pp  = bs.playerPkmnPP.get(pkmn.id) ?? 0;
  const sel = bs.selectedMoves.get(pkmn.id) ?? 'basic1';

  titleEl.textContent = `Mossa di ${cap(pkmn.name)}`;
  subEl.innerHTML     = `PP attuali: ${pp}/3 · <span style="opacity:.7">tasto destro per i dettagli della carta</span>`;

  // Formato moves: [base1, base2, finisher] (nuovo) o [basic, finisher] (legacy)
  let options = [];
  if (set && set.length >= 3) {
    options = [
      { key: 'basic1',   role: 'Base 1',  move: set[0], icon: '⚔' },
      { key: 'basic2',   role: 'Base 2',  move: set[1], icon: '⚔' },
      { key: 'finisher', role: 'Finisher', move: set[2], icon: '★', cost: 3 },
    ];
  } else if (set && set.length >= 2) {
    options = [
      { key: 'basic1',   role: 'Base',     move: set[0], icon: '⚔' },
      { key: 'finisher', role: 'Finisher', move: set[1], icon: '★', cost: 3 },
    ];
  } else {
    options = [{ key: 'basic1', role: 'Auto', move: { name: 'Attacco Base', type: pkmn.types[0], power: 50, cat: 'physical' }, icon: '⚔' }];
  }

  optsEl.innerHTML = options.map(opt => {
    const isSel       = opt.key === sel;
    const insuffPP    = (opt.cost ?? 0) > pp;
    const disabled    = insuffPP ? 'disabled' : '';
    const ppLabel     = opt.cost ? `<span class="move-option__cost ${insuffPP ? 'is-low' : ''}">★ ${opt.cost} PP</span>` : '';
    const catLabel    = opt.move.cat === 'special' ? 'Speciale' : opt.move.cat === 'physical' ? 'Fisica' : '—';
    return `
      <button class="move-option ${isSel ? 'is-selected' : ''}" data-move-sel="${opt.key}" ${disabled}>
        <div class="move-option__role-wrap">
          <span class="move-option__icon">${opt.icon}</span>
          <span class="move-option__role">${opt.role}</span>
        </div>
        <div class="move-option__main">
          <div class="move-option__name-row">
            <span class="move-option__name">${opt.move.name ?? '—'}</span>
            <span class="type-badge move-option__type" data-type="${opt.move.type ?? 'normal'}">${typeLabel(opt.move.type ?? 'normal')}</span>
          </div>
          <div class="move-option__meta">
            <span class="move-option__cat">${catLabel}</span>
            <span class="move-option__sep">·</span>
            <span class="move-option__power">Potenza ${opt.move.power ?? '—'}</span>
            ${ppLabel}
          </div>
        </div>
        ${isSel ? '<span class="move-option__check">✓</span>' : ''}
      </button>
    `;
  }).join('');

  modal.classList.remove('hidden');
}

function closeMovePicker() {
  $('#movePickerModal')?.classList.add('hidden');
  movePickerPkmnId = null;
}

// Event delegation per i bottoni del picker (montato una volta sola)
document.addEventListener('click', e => {
  // Click sulla scelta di mossa
  const opt = e.target.closest('.move-option');
  if (opt && !opt.hasAttribute('disabled') && movePickerPkmnId != null) {
    const key = opt.dataset.moveSel;
    bs.selectedMoves.set(movePickerPkmnId, key);
    updateCardMove(movePickerPkmnId, 'self');
    SFX.moveSelect?.();
    closeMovePicker();
    return;
  }
});
// Cancel / backdrop / details
function bindMovePickerStaticHandlers() {
  const closeBtns = ['movePickerBackdrop', 'movePickerCancel'];
  for (const id of closeBtns) {
    $('#' + id)?.addEventListener('click', closeMovePicker);
  }
  $('#movePickerDetails')?.addEventListener('click', () => {
    const id = movePickerPkmnId;
    closeMovePicker();
    if (id != null) openCardModal(id);
  });
}

/* ============================================================
   CARD — costruzione elemento DOM
   variant: 'bench' (sprite compatta) | 'field' (fullart in campo)
   ============================================================ */
function makeCard(pkmn, side, variant = 'bench', slotKey = null) {
  const el  = document.createElement('div');
  el.className         = variant === 'field' ? 'card card--battle card--fullart' : 'card card--battle';
  el.dataset.pokemonId = pkmn.id;
  el.dataset.side      = side;
  el.dataset.variant   = variant;

  const hpMap  = side === 'self' ? bs.playerPkmnHP  : bs.enemyPkmnHP;
  const ppMap  = side === 'self' ? bs.playerPkmnPP  : bs.enemyPkmnPP;
  const heldMap = side === 'self' ? bs.playerHeld   : bs.enemyHeld;
  const curHP  = hpMap.get(pkmn.id) ?? getScaledStats(pkmn).hp;
  const curPP  = ppMap.get(pkmn.id) ?? 0;
  const moveLabel = getMoveLabel(pkmn.id, side);
  const held   = heldMap.get(pkmn.id) ?? null;

  // Icona oggetto tenuto (solo se equipaggiato)
  const heldHTML = held
    ? `<span class="card__held" title="${held.name}">
         ${held.image
           ? `<img src="${held.image}" alt="${held.name}" onerror="this.outerHTML='${held.icon}'" />`
           : held.icon}
       </span>`
    : '';

  // Badge passiva attiva: appare SOLO se la card è su una slot del campo
  // (slotKey != null) E la passiva del Pokemon include quella slot tra le
  // sue activeSlots. Aiuta il giocatore a capire quando il posizionamento
  // sblocca la passiva.
  let passiveBadgeHTML = '';
  if (slotKey) {
    const pass = getPassive(pkmn.id);
    if (pass && pass.activeSlots.includes(slotKey)) {
      passiveBadgeHTML = `<span class="card__passive-badge" title="${pass.name}: ${pass.effect}" data-passive-name="${pass.name}">✨</span>`;
    }
  }

  if (variant === 'field') {
    // Variante fullart in campo: artwork con fallback sprite
    el.innerHTML = `
      <span class="card__hp card__hp--field" data-hp="${pkmn.id}" data-hp-side="${side}">${curHP}</span>
      <span class="card__pp card__pp--field" data-pp="${pkmn.id}" data-pp-side="${side}">PP ${curPP}</span>
      ${heldHTML}
      ${passiveBadgeHTML}
      <div class="card__sprite">
        <img class="card__img" src="${getArtworkUrl(pkmn)}" alt="${pkmn.name}"
             onerror="this.onerror=null;this.classList.add('is-fallback');this.src='${pkmn.sprite.default}';" />
      </div>
      <div class="card__name">${pkmn.name}</div>
      <div class="card__types">
        ${pkmn.types.map(t => `<span class="type-badge" data-type="${t}">${typeLabel(t)}</span>`).join('')}
      </div>
      <div class="card__move card__move--field" data-move="${pkmn.id}" data-move-side="${side}">${moveLabel}</div>
    `;
  } else {
    // Bench compatta — sprite + info essenziali
    el.innerHTML = `
      <span class="card__hp" data-hp="${pkmn.id}" data-hp-side="${side}">${curHP}</span>
      <span class="card__pp" data-pp="${pkmn.id}" data-pp-side="${side}">PP ${curPP}</span>
      ${heldHTML}
      <div class="card__sprite">
        <img src="${pkmn.sprite.default}" alt="${pkmn.name}" loading="lazy" />
      </div>
      <div class="card__name">${pkmn.name}</div>
      <div class="card__types">
        ${pkmn.types.map(t => `<span class="type-badge" data-type="${t}">${typeLabel(t)}</span>`).join('')}
      </div>
      <div class="card__move" data-move="${pkmn.id}" data-move-side="${side}">${moveLabel}</div>
    `;
  }

  // Click handlers:
  //   - Carta del giocatore (bench o campo) viva, fuori da resolving:
  //       click sx → MOVE PICKER (selezione mossa per il prossimo turno)
  //       click dx → CARD MODAL (dettagli completi: stat/mosse/passiva)
  //     Separazione per velocità: il picker è frequente, il modal è
  //     consultazione → due input distinti evitano il passaggio forzato.
  //   - Carte avversarie o KO o in fase resolving: qualsiasi click apre
  //     direttamente il card-modal.
  // Soppresso durante il drag (vedi onDragEnd / onTouchDragEnd).
  const isOwnAndActive = side === 'self' && !bs.playerDeadIds.has(pkmn.id) && bs.phase !== 'resolving';
  el.addEventListener('click', e => {
    if (el.classList.contains('was-dragged')) return;
    if (isOwnAndActive) openMovePicker(pkmn);
    else                openCardModal(pkmn.id);
  });
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (el.classList.contains('was-dragged')) return;
    openCardModal(pkmn.id);
  });

  // Drag & drop solo per carte del giocatore (non morte, non in fase resolving)
  if (side === 'self' && !bs.playerDeadIds.has(pkmn.id)) {
    el.draggable = true;
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend',   onDragEnd);
    // Supporto touch / pen (mobile): long-press 180ms → drag manuale con ghost
    attachTouchDrag(el, pkmn);
    // touch-action: none impedisce lo scroll della pagina durante il drag
    el.style.touchAction = 'none';
  }

  return el;
}

/* ============================================================
   DRAG & DROP
   ============================================================ */

/* Evidenzia gli slot del campo giocatore in cui la passiva del Pokemon
   trascinato si attiverebbe. Effetto visivo guida per il giocatore. */
function highlightPassiveSlots(pokemonId) {
  const pass = getPassive(pokemonId);
  if (!pass) return;
  for (const slot of $$('#playerGrid .grid__slot')) {
    if (pass.activeSlots.includes(slot.dataset.slotKey)) {
      slot.classList.add('is-passive-slot');
    }
  }
}
function clearPassiveSlots() {
  $$('.grid__slot.is-passive-slot').forEach(s => s.classList.remove('is-passive-slot'));
}

function onDragStart(e) {
  if (bs.phase !== 'placement') { e.preventDefault(); return; }

  const card     = e.currentTarget;
  dragId         = parseInt(card.dataset.pokemonId, 10);
  dragFromSlot   = card.closest('[data-slot-key]')?.dataset.slotKey ?? 'bench';

  card.classList.add('is-dragging');
  highlightPassiveSlots(dragId);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragId));
}

function onDragEnd(e) {
  const card = e.currentTarget;
  card.classList.remove('is-dragging');
  // Marca brevemente la carta come "was-dragged" così il click sintetico finale viene ignorato
  card.classList.add('was-dragged');
  setTimeout(() => card.classList.remove('was-dragged'), 100);
  $$('.grid__slot').forEach(s => s.classList.remove('is-drop-target'));
  clearPassiveSlots();
  dragId       = null;
  dragFromSlot = null;
}

/* ============================================================
   TOUCH DRAG & DROP (mobile)
   HTML5 DnD non funziona su touch. Implementiamo un drag manuale
   con pointer events: long-press 180ms su una carta del player
   inizia il drag, dito che si muove sposta un "ghost" della carta,
   rilascio piazza nello slot sottostante (o bench se valido).
   ============================================================ */
let touchGhost   = null;     // elemento clone che segue il dito
let touchSrcCard = null;     // card originale in trascinamento
let touchPress   = null;     // timer del long-press
let touchActive  = false;    // true mentre il drag è in corso

function attachTouchDrag(cardEl, pkmn) {
  cardEl.addEventListener('pointerdown', e => {
    // Solo touch / pen — il mouse usa HTML5 DnD nativo
    if (e.pointerType === 'mouse') return;
    if (bs.phase !== 'placement') return;
    if (bs.playerDeadIds.has(pkmn.id)) return;

    const startX = e.clientX, startY = e.clientY;

    // Long-press: dopo 180ms inizia il drag (evita drag accidentali su tap)
    touchPress = setTimeout(() => {
      touchPress = null;
      startTouchDrag(cardEl, pkmn, startX, startY);
    }, 180);

    // Cancella il long-press se il dito si muove troppo prima dei 180ms (è uno scroll/swipe)
    const onEarlyMove = ev => {
      if (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8) {
        clearTimeout(touchPress); touchPress = null;
        cardEl.removeEventListener('pointermove', onEarlyMove);
      }
    };
    cardEl.addEventListener('pointermove', onEarlyMove, { once: false });
    cardEl.addEventListener('pointerup',   () => {
      clearTimeout(touchPress); touchPress = null;
      cardEl.removeEventListener('pointermove', onEarlyMove);
    }, { once: true });
  });
}

function startTouchDrag(cardEl, pkmn, x, y) {
  touchActive  = true;
  touchSrcCard = cardEl;
  dragId       = pkmn.id;
  dragFromSlot = cardEl.closest('[data-slot-key]')?.dataset.slotKey ?? 'bench';

  cardEl.classList.add('is-dragging');
  highlightPassiveSlots(pkmn.id);

  // Crea il ghost: clone della card, posizionato dove il dito è
  const rect = cardEl.getBoundingClientRect();
  touchGhost = cardEl.cloneNode(true);
  touchGhost.classList.add('touch-drag-ghost');
  touchGhost.classList.remove('is-dragging');
  Object.assign(touchGhost.style, {
    position: 'fixed',
    left:     `${x - rect.width / 2}px`,
    top:      `${y - rect.height / 2}px`,
    width:    `${rect.width}px`,
    height:   `${rect.height}px`,
    margin:   '0',
    zIndex:   '9999',
    pointerEvents: 'none',
    opacity:  '0.92',
    transform: 'scale(1.06)',
  });
  document.body.appendChild(touchGhost);

  // Listener globali per move/up
  document.addEventListener('pointermove', onTouchDragMove);
  document.addEventListener('pointerup',   onTouchDragEnd);
  document.addEventListener('pointercancel', onTouchDragEnd);
}

function onTouchDragMove(e) {
  if (!touchActive || !touchGhost) return;
  e.preventDefault();
  const rect = touchGhost.getBoundingClientRect();
  touchGhost.style.left = `${e.clientX - rect.width / 2}px`;
  touchGhost.style.top  = `${e.clientY - rect.height / 2}px`;

  // Trova lo slot sotto al dito (nascondi temporaneamente il ghost)
  touchGhost.style.display = 'none';
  const below = document.elementFromPoint(e.clientX, e.clientY);
  touchGhost.style.display = '';

  $$('.grid__slot.is-drop-target').forEach(s => s.classList.remove('is-drop-target'));
  const slot = below?.closest('#playerGrid .grid__slot');
  if (slot) {
    const occ = bs.playerField.get(slot.dataset.slotKey);
    if (!occ || occ.id === dragId) slot.classList.add('is-drop-target');
  }
}

function onTouchDragEnd(e) {
  if (!touchActive) return;
  touchActive = false;

  // Trova target finale
  touchGhost && (touchGhost.style.display = 'none');
  const below = document.elementFromPoint(e.clientX, e.clientY);
  const slot  = below?.closest('#playerGrid .grid__slot');
  const bench = below?.closest('#playerBench');

  // Cleanup visivo
  touchGhost?.remove();
  touchGhost = null;
  touchSrcCard?.classList.remove('is-dragging');
  // Marca was-dragged per sopprimere il click sintetico finale (analogo a HTML5 DnD)
  if (touchSrcCard) {
    touchSrcCard.classList.add('was-dragged');
    const c = touchSrcCard;
    setTimeout(() => c.classList.remove('was-dragged'), 150);
  }
  touchSrcCard = null;
  $$('.grid__slot.is-drop-target').forEach(s => s.classList.remove('is-drop-target'));
  clearPassiveSlots();

  document.removeEventListener('pointermove',   onTouchDragMove);
  document.removeEventListener('pointerup',     onTouchDragEnd);
  document.removeEventListener('pointercancel', onTouchDragEnd);

  // Applica il drop
  if (slot) {
    placeCardOnSlot(dragId, slot.dataset.slotKey, dragFromSlot);
  } else if (bench && dragFromSlot !== 'bench') {
    bs.playerField.delete(dragFromSlot);
    renderField();
  }

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
  SFX.cardPlace();
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
  SFX.confirm();

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
    passiveState:       bs.passiveState,
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
  log(`— Turno ${bs.turn} —`, 'turn');

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
   Pacing: tutti i tempi centralizzati in ANIM. 1.4× più lenti
   rispetto alla v1, con una pausa di lettura tra ogni evento
   significativo per dare tempo al giocatore di capire cosa è
   successo. speedMultiplier (1× / 2×) li scala tutti.
   ============================================================ */
const ANIM = {
  speedCheck:    1900,   // era 1400
  attackBuildup:  220,   // era 150 — attaccante "carica"
  hitImpact:      450,   // era 700 — durata visiva del colpo
  faintReveal:    520,   // era 350 — pausa prima del fade KO
  damageFloat:   1300,   // era 950 — il numero del danno resta più a lungo
  ppFloat:       1150,   // era 850
  hpShake:        500,   // era 350 — shake della HP bar su danno diretto
  betweenEvents:  300,   // PAUSA DI LETTURA tra eventi consecutivi
  finisherCharge: 480,   // pre-carica dorata prima del lunge per la mossa Finisher
};

async function playEvents(events) {
  for (const ev of events) {

    if (ev.type === 'speed_check') {
      const label = ev.first === 'player' ? 'Vai per primo! ▶' : '◀ Avversario va per primo!';
      setPhase(`⚡ Speed Tu: ${ev.playerSpeed} — Avversario: ${ev.enemySpeed} — ${label}`);
      log(`Velocità — Tu ${ev.playerSpeed} vs Avversario ${ev.enemySpeed} (${ev.first === 'player' ? 'tu attacchi prima' : 'loro attaccano prima'})`, 'speed');
      SFX.speedCheck();
      await sleep(ANIM.speedCheck);
    }

    else if (ev.type === 'attack') {
      const pkmnName = findPokemon(ev.attackerId)?.name ?? `#${ev.attackerId}`;
      const defName  = findPokemon(ev.targetId)?.name  ?? `#${ev.targetId}`;

      // Aggiorna HP nella mappa corretta per lato (evita collisioni di ID)
      const hpMap = ev.defenderSide === 'player' ? bs.playerPkmnHP : bs.enemyPkmnHP;
      hpMap.set(ev.targetId, ev.targetHPAfter);

      const atkEl = findCardEl(ev.attackerSide, ev.attackerSlot);
      const defEl = findCardEl(ev.defenderSide, ev.defenderSlot);

      // FINISHER: carica preliminare prima dell'attacco
      if (ev.isFinisher && atkEl) {
        atkEl.classList.add('is-finisher');
        SFX.finisherCharge();
        await sleep(ANIM.finisherCharge);
        atkEl.classList.remove('is-finisher');
      }

      // Animazione attaccante (lunge)
      if (atkEl) {
        atkEl.classList.add('is-attacking');
        await sleep(ANIM.attackBuildup);
      }

      // Danno + effetto tipo
      const effText  = ev.typeEff >= 2 ? ' ×2!' : ev.typeEff === 0 ? '' : ev.typeEff < 1 ? ' ×½' : '';
      const effLabel = ev.typeEff >= 2 ? ' SUPER EFFICACE!'
                     : ev.typeEff === 0 ? ' (immune)'
                     : ev.typeEff < 1   ? ' (poco efficace)'
                     : '';
      const fin = ev.isFinisher ? '★ ' : '';
      const kind = ev.typeEff === 0 ? 'immune'
                 : ev.typeEff >= 2 ? 'super'
                 : ev.typeEff < 1  ? 'weak'
                 : 'attack';
      log(`${fin}${pkmnName} attacca ${defName} — ${ev.damage > 0 ? `−${ev.damage} HP` : 'nessun danno'}${effLabel}`, kind);
      if (ev.atkPassive)      log(`✨ ${pkmnName}: passiva ${ev.atkPassive} attiva`, 'item');
      if (ev.defPassive)      log(`🛡 ${defName}: passiva ${ev.defPassive} attiva`, 'item');
      if (ev.immuneByPassive) log(`∅ ${defName} immune grazie a ${ev.immuneByPassive}`, 'immune');

      if (defEl) {
        // Shake + flash overlay sul bersaglio
        const flashKind = ev.typeEff >= 2 ? 'is-hit-super'
                        : ev.typeEff === 0 ? 'is-hit-immune'
                        : ev.typeEff < 1   ? 'is-hit-weak'
                        : '';
        defEl.classList.add('is-hit');
        if (flashKind) defEl.classList.add(flashKind);
        setTimeout(() => defEl.classList.remove('is-hit', 'is-hit-super', 'is-hit-weak', 'is-hit-immune'), 460);

        // Screen flash + sound su super-effective
        if (ev.typeEff >= 2) {
          document.body.classList.add('is-super-flash');
          setTimeout(() => document.body.classList.remove('is-super-flash'), 560);
        }

        // SFX impact a seconda di efficacia / finisher
        if (ev.isFinisher)            SFX.finisherHit();
        else if (ev.typeEff >= 2)      SFX.superHit();
        else if (ev.typeEff === 0)     SFX.immune();
        else if (ev.typeEff < 1)       SFX.weakHit();
        else                           SFX.hit();

        showDamageFloat(defEl, ev.damage, ev.typeEff, effText);
        updateCardHP(ev.targetId, ev.targetHPAfter, ev.defenderSide);

        if (ev.targetDied) {
          if (ev.defenderSide === 'player') bs.playerDeadIds.add(ev.targetId);
          else                              bs.enemyDeadIds.add(ev.targetId);
          log(`${defName} è stato messo KO!`, 'ko');
          await sleep(ANIM.faintReveal);
          defEl.classList.add('is-ko-anim');
          SFX.ko();
          // Dopo l'animazione di KO, lascia lo stato fainted permanente
          setTimeout(() => {
            defEl.classList.remove('is-ko-anim');
            defEl.classList.add('is-fainted');
          }, 960);
        }
      }

      // PP: ora calcolato dall'engine (ev.ppAfter). L'engine ha già applicato:
      //   - costo finisher (-3)
      //   - +1 hit a segno (typeEff > 0 e non immune)
      //   - blocco da Statico (pp_block_chance) → emette ev.ppBlockedBy
      //   - extra cost da Pressione (extra_pp_cost) → emette ev.ppExtraCostBy
      const atkPPMap    = ev.attackerSide === 'player' ? bs.playerPkmnPP : bs.enemyPkmnPP;
      const atkHtmlSide = ev.attackerSide === 'player' ? 'self' : 'enemy';
      if (ev.ppAfter != null) {
        atkPPMap.set(ev.attackerId, ev.ppAfter);
        updateCardPP(ev.attackerId, ev.ppAfter, atkHtmlSide);
        if (atkEl && (ev.ppDelta ?? 0) > 0) showPPFloat(atkEl);
      }
      if (ev.ppBlockedBy) {
        const atkName = findPokemon(ev.attackerId)?.name ?? 'Pokémon';
        log(`${cap(ev.ppBlockedBy)}: ${cap(atkName)} non ha guadagnato PP!`, 'passive');
      }
      if (ev.ppExtraCostBy) {
        const atkName = findPokemon(ev.attackerId)?.name ?? 'Pokémon';
        log(`${cap(ev.ppExtraCostBy)}: ${cap(atkName)} consuma 1 PP extra.`, 'passive');
      }
      if (ev.enduredByPassive) {
        const defName = findPokemon(ev.targetId)?.name ?? 'Pokémon';
        log(`${cap(ev.enduredByPassive)}! ${cap(defName)} sopravvive con 1 HP!`, 'passive');
      }

      await sleep(ANIM.hitImpact);
      if (atkEl) atkEl.classList.remove('is-attacking');
      await sleep(ANIM.betweenEvents);
    }

    else if (ev.type === 'direct_damage') {

      // Animazione attaccante
      const atkEl = findCardEl(ev.attackerSide, ev.attackerSlot);
      if (atkEl) {
        atkEl.classList.add('is-attacking');
        await sleep(ANIM.attackBuildup);
      }

      if (ev.defenderSide === 'player') bs.playerHP = ev.hpAfter;
      else                              bs.enemyHP  = ev.hpAfter;

      const sideAttr = ev.defenderSide === 'player' ? 'self' : 'enemy';
      const hpBarEl  = $(`.hp-bar[data-side="${sideAttr}"]`);
      if (hpBarEl) {
        hpBarEl.classList.add('is-shaking');
        setTimeout(() => hpBarEl.classList.remove('is-shaking'), ANIM.hpShake);
      }

      const targetLabel = ev.defenderSide === 'player' ? 'a te' : "all'avversario";
      setPhase(`💥 Colonna vuota! −${ev.damage} HP ${targetLabel}`);
      log(`Colonna vuota — danno diretto −${ev.damage} HP ${targetLabel}`, 'direct');
      SFX.directHit();
      updateHPBar('player');
      updateHPBar('enemy');

      // PP: ora viene dall'engine (ev.ppAfter è già aggiornato)
      const atkPPMap2    = ev.attackerSide === 'player' ? bs.playerPkmnPP : bs.enemyPkmnPP;
      const atkHtmlSide2 = ev.attackerSide === 'player' ? 'self' : 'enemy';
      if (ev.ppAfter != null) {
        atkPPMap2.set(ev.attackerId, ev.ppAfter);
        updateCardPP(ev.attackerId, ev.ppAfter, atkHtmlSide2);
        if (atkEl && (ev.ppDelta ?? 0) > 0) showPPFloat(atkEl);
      }

      await sleep(ANIM.hitImpact);
      if (atkEl) atkEl.classList.remove('is-attacking');
      await sleep(ANIM.betweenEvents);
    }

    else if (ev.type === 'regen') {
      // Rigenerazione: il Pokemon recupera HP a fine turno
      const htmlSide = ev.side === 'player' ? 'self' : 'enemy';
      const cardEl   = findCardEl(ev.side, ev.slotKey);
      const name     = findPokemon(ev.pokemonId)?.name ?? 'Pokémon';
      log(`${cap(ev.passiveName)}: ${cap(name)} recupera ${ev.healed} HP.`, 'passive');
      // Aggiorna la mappa HP locale e l'UI della card
      const hpMap = ev.side === 'player' ? bs.playerPkmnHP : bs.enemyPkmnHP;
      hpMap.set(ev.pokemonId, ev.hpAfter);
      updateCardHP(ev.pokemonId, ev.hpAfter, htmlSide);
      if (cardEl) {
        cardEl.classList.add('is-regen-anim');
        setTimeout(() => cardEl.classList.remove('is-regen-anim'), 900);
      }
      await sleep(420);
    }

    else if (ev.type === 'speed_stack') {
      // Velocitàscatto: +1 stack di velocità (display nel log)
      const name = findPokemon(ev.pokemonId)?.name ?? 'Pokémon';
      log(`${cap(ev.passiveName)}: ${cap(name)} +${Math.round(15 * ev.stacks)}% Velocità (${ev.stacks}/${ev.maxStacks}).`, 'passive');
      const cardEl = findCardEl(ev.side, ev.slotKey);
      if (cardEl) {
        cardEl.classList.add('is-speed-stack-anim');
        setTimeout(() => cardEl.classList.remove('is-speed-stack-anim'), 700);
      }
      await sleep(220);
    }

    else if (ev.type === 'turn_end') {
      bs.playerHP = ev.playerHP;
      bs.enemyHP  = ev.enemyHP;
      // Allineiamo le mappe HP/PP locali con quelle aggiornate dall'engine
      // (regen + speed_stack non emettono cambi diretti di HP nelle hit events,
      // ma applyRegen le ha mutate nello scope di resolveTurn).
      if (ev.updatedPlayerPkmnHP) bs.playerPkmnHP = ev.updatedPlayerPkmnHP;
      if (ev.updatedEnemyPkmnHP)  bs.enemyPkmnHP  = ev.updatedEnemyPkmnHP;
      if (ev.updatedPlayerPkmnPP) bs.playerPkmnPP = ev.updatedPlayerPkmnPP;
      if (ev.updatedEnemyPkmnPP)  bs.enemyPkmnPP  = ev.updatedEnemyPkmnPP;
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

/* Reward gemme per modalità ONLINE (PvP). Nessun cap giornaliero per ora
   (early access con cerchia ristretta). Per AI/storia/allenatori le reward
   sono gestite altrove (es. story-state.js, trainers.js). */
const ONLINE_REWARD_WIN  = 50;
const ONLINE_REWARD_LOSS = 10;
const ONLINE_REWARD_DRAW = 25;   // edge case se mai si arriva qui

async function endGame(result) {
  bs.phase = 'ended';
  stopTimer();
  setPhase(result === 'win' ? '🏆 Hai vinto!' : '💀 Hai perso!');
  log(result === 'win' ? 'Hai vinto la battaglia!' : 'Hai perso la battaglia.', result === 'win' ? 'win' : 'lose');
  // Trainer victory ha un jingle dedicato (più ricco); per AI/PvP standard
  if (result === 'win') {
    if (MODE === 'trainer') SFX.trainerVictory?.();
    else                    SFX.victory();
  } else {
    SFX.defeat();
  }

  // ---- Reward in gemme ---------------------------------------------
  // PvP: win 50, loss 10, draw 25 (sempre).
  // Trainer: reward custom (vedi data/trainers.js) SOLO alla PRIMA vittoria.
  // AI random: nessuna reward (allenamento puro).
  let gemReward = 0;
  if (MODE === 'pvp') {
    gemReward = result === 'win'  ? ONLINE_REWARD_WIN
              : result === 'lose' ? ONLINE_REWARD_LOSS
              :                     ONLINE_REWARD_DRAW;
    const gs = getState();
    gs.gems = (gs.gems ?? 0) + gemReward;
    saveState();
    log(`💎 Hai ricevuto +${gemReward} gemme!`, 'item');
    SFX.gemReward?.();
  } else if (MODE === 'trainer' && result === 'win' && TRAINER_ID) {
    // Marca battuto + assegna reward UNA SOLA volta
    const alreadyBeaten = isTrainerBeaten(TRAINER_ID);
    if (!alreadyBeaten) {
      markTrainerBeaten(TRAINER_ID);
      // Carica reward dal modulo trainers
      try {
        const { getTrainer } = await import('./data/trainers.js?v=8');
        const t = getTrainer(TRAINER_ID);
        if (t && typeof t.reward === 'number' && t.reward > 0) {
          gemReward = t.reward;
          const gs = getState();
          gs.gems = (gs.gems ?? 0) + gemReward;
          saveState();
          log(`🏆 PRIMA VITTORIA contro ${t.name}! +${gemReward} gemme!`, 'item');
          SFX.gemReward?.();
          // Suono separato di "sblocco" se non era l'ultimo trainer
          setTimeout(() => SFX.unlock?.(), 600);
        }
      } catch (e) { console.warn('trainer reward failed', e); }
    } else {
      log(`Hai battuto di nuovo questo Allenatore. Nessuna nuova ricompensa.`, 'info');
    }
  }

  // Registra il risultato nella cronologia (una sola volta)
  if (!bs.matchRecorded) {
    bs.matchRecorded = true;
    try {
      recordMatch({
        result,
        mode:        bs.pvp ? 'pvp' : 'ai',
        opponent:    bs.pvp?.opponentName ?? 'CPU',
        durationSec: Math.round((Date.now() - bs.startedAt) / 1000),
        turns:       bs.turn,
        myTeam:      [...bs.playerTeamIds],
        enemyTeam:   [...bs.enemyTeamIds],
        // La barra HP del team va da PLAYER_MAX_HP (3000) a 0 → il damage
        // totale subito/inflitto si ricava per differenza.
        damageDealt: Math.max(0, ENEMY_MAX_HP  - bs.enemyHP),
        damageTaken: Math.max(0, PLAYER_MAX_HP - bs.playerHP),
      });
    } catch (e) {
      console.warn('Impossibile registrare la battaglia:', e);
    }
  }

  const btn = $('#btnConfirm');
  btn.textContent = 'Torna alla Home';
  btn.disabled    = false;
  // Rimuove il listener confirmTurn registrato in init() e lo sostituisce
  // con la navigazione alla home. Evita che doppio click triggeri entrambi.
  btn.removeEventListener('click', confirmTurn);
  btn.addEventListener('click', () => { window.location.href = 'index.html'; }, { once: true });

  // End-game overlay: appare dopo ~0.8s per non sovrapporsi all'animazione KO
  setTimeout(() => showEndGameScreen(result, gemReward), 850);
}

/** Mostra l'overlay fullscreen di fine partita. Adatta i testi/sprite
 *  in base alla modalità (trainer/AI/PvP) e mostra la reward animata. */
async function showEndGameScreen(result, gemReward) {
  const overlay = $('#endgameOverlay');
  if (!overlay) return;

  // ---- Determina trainer info (solo se mode=trainer) ----
  let trainer = null;
  if (MODE === 'trainer' && TRAINER_ID) {
    try {
      const { getTrainer } = await import('./data/trainers.js?v=8');
      trainer = getTrainer(TRAINER_ID);
    } catch {}
  }

  // ---- Sprite/icona ----
  const spriteEl = $('#endgameSprite');
  if (trainer?.sprite) {
    spriteEl.innerHTML = `<img src="${trainer.sprite}" alt="${trainer.name}"
      onerror="this.outerHTML='${trainer.badge ?? '⚔'}'" />`;
  } else if (result === 'win') {
    spriteEl.textContent = '🏆';
  } else {
    spriteEl.textContent = '💀';
  }

  // ---- Risultato / sottotitolo ----
  const resultEl = $('#endgameResult');
  const subEl    = $('#endgameSub');
  if (result === 'win') {
    resultEl.textContent = '🏆 Vittoria!';
    resultEl.className   = 'endgame-panel__result endgame-panel__result--win';
    if (trainer) subEl.textContent = `Hai battuto ${trainer.name} — ${trainer.title}`;
    else if (MODE === 'pvp') subEl.textContent = 'Hai sconfitto il tuo avversario online';
    else subEl.textContent = 'Hai sconfitto l\'AI';
  } else {
    resultEl.textContent = '💀 Sconfitta';
    resultEl.className   = 'endgame-panel__result endgame-panel__result--lose';
    if (trainer) subEl.textContent = `${trainer.name} ti ha battuto. Riprova!`;
    else if (MODE === 'pvp') subEl.textContent = 'Il tuo avversario ha avuto la meglio';
    else subEl.textContent = 'L\'AI ha avuto la meglio';
  }

  // ---- Reward ----
  const rewardEl   = $('#endgameReward');
  const amountEl   = $('#endgameRewardAmount');
  if (gemReward > 0) {
    rewardEl.classList.remove('hidden');
    // Counter animato 0 → gemReward
    const DUR = 900;
    const startT = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - startT) / DUR);
      const e = 1 - Math.pow(1 - t, 3);
      amountEl.textContent = `+${Math.round(gemReward * e)}`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else {
    rewardEl.classList.add('hidden');
  }

  // ---- Bottoni ----
  const secondaryEl = $('#endgameSecondary');
  const primaryEl   = $('#endgamePrimary');
  // Reset listeners (clone trick) — l'overlay può essere mostrato più volte teoricamente
  const sNew = secondaryEl.cloneNode(true);
  const pNew = primaryEl.cloneNode(true);
  secondaryEl.replaceWith(sNew);
  primaryEl.replaceWith(pNew);

  if (MODE === 'trainer') {
    sNew.textContent = '← Allenatori';
    sNew.addEventListener('click', () => { window.location.href = 'trainers.html'; });
    if (result === 'win') {
      pNew.textContent = 'Continua ▸';
      pNew.addEventListener('click', () => { window.location.href = 'trainers.html'; });
    } else {
      pNew.textContent = '↻ Riprova';
      pNew.addEventListener('click', () => { window.location.reload(); });
    }
  } else if (MODE === 'pvp') {
    sNew.textContent = '← Home';
    sNew.addEventListener('click', () => { window.location.href = 'index.html'; });
    pNew.textContent = '🌐 Cerca match';
    pNew.addEventListener('click', () => { window.location.href = 'online.html'; });
  } else {
    sNew.textContent = '← Home';
    sNew.addEventListener('click', () => { window.location.href = 'index.html'; });
    pNew.textContent = '↻ Rivincita';
    pNew.addEventListener('click', () => { window.location.reload(); });
  }

  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
}

/* showRewardToast() rimosso — sostituito da showEndGameScreen()
   (overlay fullscreen più ricco con sprite trainer + reward animata). */

/* ============================================================
   FASE LABEL
   ============================================================ */
function setPhase(text) {
  const el = $('#phaseLabel');
  if (el) el.textContent = text;
}

/* ============================================================
   COMBAT LOG — drawer in basso-sinistra
   ============================================================ */
const LOG_MAX = 80;
const LOG_KIND_ICON = {
  info:    '·',
  attack:  '⚔',
  super:   '💥',
  weak:    '🛡',
  immune:  '∅',
  ko:      '☠',
  turn:    '🔁',
  speed:   '⚡',
  direct:  '🎯',
  item:    '🎒',
  passive: '✨',
  win:     '🏆',
  lose:    '💀',
};

/** Aggiunge una riga al combat log. kind controlla l'icona e il colore. */
function log(message, kind = 'info') {
  const body = $('#battleLogBody');
  if (!body) return;
  const row = document.createElement('div');
  row.className = `battle-log__row battle-log__row--${kind}`;
  const icon = LOG_KIND_ICON[kind] ?? '·';
  row.innerHTML = `<span class="battle-log__icon">${icon}</span><span class="battle-log__msg">${message}</span>`;
  body.appendChild(row);
  // Cap entries per evitare DOM gonfio
  while (body.children.length > LOG_MAX) body.firstChild.remove();
  body.scrollTop = body.scrollHeight;
}

function setupLogToggle() {
  const drawer = $('#battleLog');
  const toggle = $('#battleLogToggle');
  if (!drawer || !toggle) return;
  toggle.addEventListener('click', () => {
    const open = drawer.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

/* Chiude tutte le modal aperte (usato anche dal listener Escape) */
function closeAllModals() {
  $$('.modal').forEach(m => m.classList.add('hidden'));
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
