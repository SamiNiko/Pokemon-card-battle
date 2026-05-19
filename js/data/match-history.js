/* ============================================================
   match-history.js
   API per registrare i risultati delle battaglie e aggregare
   le statistiche di carriera del giocatore.

   I dati sono persistiti dentro lo stato giocatore (vedi state.js,
   campi `matchHistory` e `lifetimeStats`). Il cloud sync li
   propaga automaticamente come parte dello stato.
   ============================================================ */

import { getState, saveState } from './state.js?v=6';

const MAX_HISTORY = 50;   // numero massimo di partite tenute in cronologia

/* ================================================================
   API PUBBLICA
   ================================================================ */

/**
 * Registra una battaglia conclusa. Aggiorna sia `matchHistory`
 * che `lifetimeStats` in modo atomico, poi salva lo stato.
 *
 * @param {object} entry
 * @param {'win'|'loss'|'draw'} entry.result
 * @param {'pvp'|'ai'|'story'}  entry.mode
 * @param {string}              entry.opponent      - nome avversario
 * @param {number}              entry.durationSec   - durata in secondi
 * @param {number}              entry.turns         - numero di turni completati
 * @param {number[]}            entry.myTeam        - id Pokémon del giocatore
 * @param {number[]}            entry.enemyTeam     - id Pokémon avversario
 * @param {number}              entry.damageDealt   - HP totali inflitti
 * @param {number}              entry.damageTaken   - HP totali subiti
 */
export function recordMatch(entry) {
  const s = getState();

  /* ---- 1. Crea l'entry storica ---- */
  const record = {
    id:          generateId(),
    timestamp:   Date.now(),
    result:      entry.result,
    mode:        entry.mode ?? 'ai',
    opponent:    (entry.opponent ?? '—').slice(0, 32),
    durationSec: Math.max(0, Math.round(entry.durationSec ?? 0)),
    turns:       Math.max(0, entry.turns ?? 0),
    myTeam:      Array.isArray(entry.myTeam)    ? entry.myTeam.slice(0, 6)    : [],
    enemyTeam:   Array.isArray(entry.enemyTeam) ? entry.enemyTeam.slice(0, 6) : [],
    damageDealt: Math.max(0, Math.round(entry.damageDealt ?? 0)),
    damageTaken: Math.max(0, Math.round(entry.damageTaken ?? 0)),
  };

  /* ---- 2. Inserisci in cima alla cronologia ---- */
  if (!Array.isArray(s.matchHistory)) s.matchHistory = [];
  s.matchHistory.unshift(record);
  if (s.matchHistory.length > MAX_HISTORY) {
    s.matchHistory.length = MAX_HISTORY;
  }

  /* ---- 3. Aggiorna lifetimeStats ---- */
  const stats = s.lifetimeStats;
  stats.totalMatches      = (stats.totalMatches ?? 0) + 1;
  stats.damageDealt       = (stats.damageDealt  ?? 0) + record.damageDealt;
  stats.damageTaken       = (stats.damageTaken  ?? 0) + record.damageTaken;
  stats.totalPlayTimeSec  = (stats.totalPlayTimeSec ?? 0) + record.durationSec;

  if (record.result === 'win') {
    stats.wins = (stats.wins ?? 0) + 1;
    if (record.mode === 'pvp') stats.pvpWins = (stats.pvpWins ?? 0) + 1;
    else                       stats.aiWins  = (stats.aiWins  ?? 0) + 1;
    stats.currentStreak = Math.max(1, (stats.currentStreak ?? 0) + 1);
    if (stats.currentStreak > (stats.longestStreak ?? 0)) {
      stats.longestStreak = stats.currentStreak;
    }
  } else if (record.result === 'loss') {
    stats.losses = (stats.losses ?? 0) + 1;
    if (record.mode === 'pvp') stats.pvpLosses = (stats.pvpLosses ?? 0) + 1;
    else                       stats.aiLosses  = (stats.aiLosses  ?? 0) + 1;
    // streak negativa
    stats.currentStreak = Math.min(-1, (stats.currentStreak ?? 0) - 1);
  } else {
    stats.draws = (stats.draws ?? 0) + 1;
    stats.currentStreak = 0;
  }

  /* ---- 4. Conta utilizzo Pokémon (solo quelli del giocatore) ---- */
  if (!stats.pokemonUsage)    stats.pokemonUsage    = {};
  if (!stats.pokemonWinsWith) stats.pokemonWinsWith = {};
  for (const id of record.myTeam) {
    stats.pokemonUsage[id] = (stats.pokemonUsage[id] ?? 0) + 1;
    if (record.result === 'win') {
      stats.pokemonWinsWith[id] = (stats.pokemonWinsWith[id] ?? 0) + 1;
    }
  }

  saveState();
  return record;
}

/**
 * @returns {Array} la cronologia (più recenti per primi)
 */
export function getMatchHistory() {
  return getState().matchHistory ?? [];
}

/**
 * @returns {object} le statistiche aggregate (clone-safe)
 */
export function getLifetimeStats() {
  return getState().lifetimeStats ?? {};
}

/**
 * Restituisce i top N Pokémon per utilizzo.
 * @param {number} n
 * @returns {Array<{id:number, count:number, wins:number, winRate:number}>}
 */
export function getTopPokemon(n = 3) {
  const stats   = getLifetimeStats();
  const usage   = stats.pokemonUsage    ?? {};
  const winsW   = stats.pokemonWinsWith ?? {};

  return Object.keys(usage)
    .map(id => {
      const count = usage[id] ?? 0;
      const wins  = winsW[id] ?? 0;
      return {
        id:      Number(id),
        count,
        wins,
        winRate: count > 0 ? wins / count : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Resetta cronologia + stats (per debug / reset profilo).
 * Non viene esposto in UI a meno che non sia necessario.
 */
export function clearMatchHistory() {
  const s = getState();
  s.matchHistory  = [];
  s.lifetimeStats = {
    totalMatches:     0, wins: 0, losses: 0, draws: 0,
    aiWins:           0, aiLosses: 0,
    pvpWins:          0, pvpLosses: 0,
    damageDealt:      0, damageTaken: 0,
    currentStreak:    0, longestStreak: 0,
    pokemonUsage:     {}, pokemonWinsWith: {},
    totalPlayTimeSec: 0,
  };
  saveState();
}

/* ================================================================
   FORMATTING HELPERS (esportati per UI)
   ================================================================ */

/** Formatta una durata in secondi come "Xm Ys" oppure "Ys". */
export function formatDuration(sec) {
  if (!sec || sec < 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Formatta un timestamp come "Oggi, HH:MM" / "Ieri, HH:MM" / "DD MMM, HH:MM". */
export function formatRelativeDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (sameDay)    return `Oggi, ${time}`;
  if (isYesterday) return `Ieri, ${time}`;

  const months = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${time}`;
}

/* ================================================================
   INTERNI
   ================================================================ */

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 12);
  }
  return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
