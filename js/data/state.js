/* ============================================================
   state.js — stato del giocatore persistito su localStorage
   Predisposto per cloud sync futuro (vedi onSave + identity).
   ============================================================ */

import { isItemAllowedForPokemon } from './items.js?v=3';
import { LEGGENDARI }              from './rarity.js';

/** Costanti / errori espliciti che le API possono ritornare */
export const ERR_LEGENDARY_LIMIT = 'legendary_limit';
export const ERR_TEAM_FULL       = 'team_full';
export const ERR_ALREADY_IN_TEAM = 'already_in_team';

const STATE_KEY    = 'pkmn_player_state_v1';
const SAVE_FORMAT  = 'pokemon-card-battle/v1';

const DEFAULT_STATE = {
  /* ---- Identità giocatore (preparata per auth futuro) ----
     userId      : UUID generato localmente per i "guest". Quando l'utente
                   effettuerà login (Supabase/Firebase/...) verrà sostituito
                   dal vero ID dell'account.
     accountType : 'guest' ora, 'supabase' / 'google' / ... in futuro.
     createdAt   : timestamp creazione profilo (utile per migrazioni).
  */
  userId:      null,
  userName:    'Allenatore',
  accountType: 'guest',
  createdAt:   null,

  /* ---- Progressi ---- */
  owned: [],                          // vuoto all'inizio: si popola via summon / storia
  stars: {},
  /* Livelli per Pokémon: { pokemonId: 1..5 }.
     Si guadagna 1 livello quando peschi un duplicato dal summon (max 5).
     I leggendari sono sempre LV.MAX (no scaling — vedi stats-scaling.js).
     Display: LV 10/20/30/40/50 (livello × 10). */
  levels: {},
  teams: [[], [], [], []],            // 4 slot team (1, 2, 3, 4) — sempre 4
  activeTeam: 0,                      // indice del team correntemente visualizzato/usato in battaglia
  /* gearByTeam: 4 mappe { pokemonId: itemId }, una per ogni team slot.
     Un Pokémon può tenere un oggetto DIVERSO in team diversi (es. Alakazam
     ha Cucchiaio Torto in team 1 ma niente in team 2). */
  gearByTeam: [{}, {}, {}, {}],

  /* ---- Valute ---- */
  gems:    0,
  pokeuro: 0,

  /* ---- Inventario oggetti acquistati ----
     { itemId: quantity }. Si popola dallo shop. */
  inventory: {},

  /* ---- Cronologia battaglie + statistiche aggregate ----
     matchHistory : ultime ~50 battaglie (le più vecchie vengono droppate)
     lifetimeStats: contatori cumulativi non azzerabili.
     Vedi js/data/match-history.js per l'API di scrittura. */
  matchHistory: [],
  lifetimeStats: {
    totalMatches:    0,
    wins:            0,
    losses:          0,
    draws:           0,
    aiWins:          0,
    aiLosses:        0,
    pvpWins:         0,
    pvpLosses:       0,
    damageDealt:     0,
    damageTaken:     0,
    currentStreak:   0,   // streak corrente (positivo = vittorie consecutive, negativo = sconfitte)
    longestStreak:   0,   // miglior streak di vittorie consecutive
    pokemonUsage:    {},  // { id → numero di volte schierato in team }
    pokemonWinsWith: {},  // { id → numero di vittorie ottenute con quel pokémon in team }
    totalPlayTimeSec: 0,
  },
};

let _state = null;

/* ================================================================
   HOOK SAVE — punto di estensione per cloud sync
   ================================================================
   Quando aggiungeremo Supabase, registreremo qui un listener che
   pusha lo stato sul cloud (con debounce). Il resto del codice non
   deve cambiare.
*/
const _saveListeners = new Set();

export function onSave(callback) {
  _saveListeners.add(callback);
  return () => _saveListeners.delete(callback);
}

/* ================================================================
   API PUBBLICA
   ================================================================ */

export function getState() {
  if (_state) return _state;
  _state = readAndMigrate();
  return _state;
}

export function saveState() {
  if (!_state) return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn('Impossibile salvare in localStorage:', e);
  }
  // Notifica i listener (cloud sync, telemetria, ecc.)
  for (const cb of _saveListeners) {
    try { cb(_state); } catch (e) { console.warn('Save listener error:', e); }
  }
}

export function resetState() {
  localStorage.removeItem(STATE_KEY);
  _state = null;
}

/* ---- Profilo ---- */

export function setUserName(name) {
  const clean = (name ?? '').trim().slice(0, 24) || 'Allenatore';
  const s = getState();
  s.userName = clean;
  saveState();
  return clean;
}

/* ---- Team (slot A=0, B=1, C=2, D=3) ----
   Non esiste più un "team attivo separato": il team correntemente
   selezionato (gs.activeTeam) È quello usato in battaglia. */

export function getTeamSlot(slot) {
  const s = getState();
  return (s.teams ?? [])[slot] ?? [];
}

export function setTeamSlot(slot, ids) {
  const s = getState();
  if (!Array.isArray(s.teams)) s.teams = [[], [], [], []];
  s.teams[slot] = ids.slice(0, 6);
  saveState();
}

export function addToTeamSlot(slot, id) {
  const current = getTeamSlot(slot);
  if (current.includes(id))   return { ok: false, reason: ERR_ALREADY_IN_TEAM };
  if (current.length >= 6)    return { ok: false, reason: ERR_TEAM_FULL };
  // Regola: massimo 1 Leggendario per team (sono già fortissimi al raccoglimento,
  // non hanno costellazione/livelli, e devono essere "evento" non "stack").
  if (LEGGENDARI.includes(id) && current.some(tid => LEGGENDARI.includes(tid))) {
    return { ok: false, reason: ERR_LEGENDARY_LIMIT };
  }
  setTeamSlot(slot, [...current, id]);
  return { ok: true };
}

export function removeFromTeamSlot(slot, id) {
  const current = getTeamSlot(slot);
  setTeamSlot(slot, current.filter(x => x !== id));
  // Stacca anche l'eventuale oggetto equipaggiato a questo Pokémon in QUESTO team
  const s = getState();
  if (Array.isArray(s.gearByTeam) && s.gearByTeam[slot]) {
    if (s.gearByTeam[slot][id] != null) {
      delete s.gearByTeam[slot][id];
      saveState();
    }
  }
}

export function getActiveTeam() {
  const s = getState();
  return (s.teams ?? [])[s.activeTeam ?? 0] ?? [];
}

export function setActiveTeam(slot) {
  const s = getState();
  s.activeTeam = Math.max(0, Math.min(3, slot));
  saveState();
}

export function isOwned(id) {
  return getState().owned.includes(id);
}

/* ================================================================
   LIVELLI POKEMON (1..6, mostrati come LV 50/60/70/80/90/100)
   ================================================================
   - Default 1 quando un Pokemon viene ottenuto per la prima volta (LV.50)
   - Sale di 1 ad ogni duplicato (max 6 = LV.100)
   - I leggendari sono SEMPRE livello MAX (bypassato in stats-scaling).
*/
export const MAX_LEVEL = 6;

/** Ritorna il livello 1..MAX_LEVEL di un Pokemon. */
export function getLevel(pokemonId) {
  const s = getState();
  const l = s.levels?.[pokemonId] ?? 1;
  return Math.max(1, Math.min(MAX_LEVEL, l));
}

/** Setta esplicitamente il livello (clamp 1..MAX_LEVEL). */
export function setLevel(pokemonId, level) {
  const s = getState();
  if (!s.levels) s.levels = {};
  s.levels[pokemonId] = Math.max(1, Math.min(MAX_LEVEL, level));
  saveState();
}

/** Aggiunge un Pokemon all'inventario.
 *  - Se non posseduto: lo aggiunge a `owned` e mette livello 1.
 *  - Se già posseduto e livello < MAX: livello +1.
 *  - Se già posseduto e livello = MAX: nessun cambio (ritorna { alreadyMax: true }).
 *  Ritorna { gained, leveledUp, alreadyMax, newLevel }. */
export function addPokemonOrLevelUp(pokemonId) {
  const s = getState();
  if (!s.owned)  s.owned  = [];
  if (!s.levels) s.levels = {};

  if (!s.owned.includes(pokemonId)) {
    s.owned.push(pokemonId);
    s.levels[pokemonId] = 1;
    saveState();
    return { gained: true, leveledUp: false, alreadyMax: false, newLevel: 1 };
  }
  const cur = s.levels[pokemonId] ?? 1;
  if (cur < MAX_LEVEL) {
    s.levels[pokemonId] = cur + 1;
    saveState();
    return { gained: false, leveledUp: true, alreadyMax: false, newLevel: cur + 1 };
  }
  return { gained: false, leveledUp: false, alreadyMax: true, newLevel: cur };
}

/* ================================================================
   INVENTORY (oggetti tenuti)
   ================================================================
   Regola: 1 copia max per oggetto. Lo state.inventory è { itemId: true }.
*/

export function ownsItem(itemId) {
  const s = getState();
  return !!(s.inventory && s.inventory[itemId]);
}

export function addItem(itemId) {
  if (!itemId) return false;
  const s = getState();
  if (!s.inventory) s.inventory = {};
  if (s.inventory[itemId]) return false;            // già posseduto, no-op
  s.inventory[itemId] = true;
  saveState();
  return true;
}

export function getOwnedItems() {
  const inv = getState().inventory || {};
  return Object.keys(inv).filter(k => inv[k]);
}

/* ================================================================
   GEAR (oggetti equipaggiati per-team-per-Pokémon)
   ================================================================
   state.gearByTeam[slotIdx] = { pokemonId: itemId }
   Regole:
   - Un oggetto può essere su UN solo Pokémon all'interno dello stesso team
     (no duplicati intra-team).
   - Cross-team OK: Alakazam può tenere Cucchiaio Torto in team 1 e
     un altro oggetto (o niente) in team 2.
   Tutte le API accettano un teamSlot opzionale; default = activeTeam.
*/

function _resolveTeamSlot(s, teamSlot) {
  if (teamSlot == null) teamSlot = s.activeTeam ?? 0;
  return Math.max(0, Math.min(3, teamSlot));
}
function _ensureGearByTeam(s) {
  if (!Array.isArray(s.gearByTeam) || s.gearByTeam.length !== 4) {
    s.gearByTeam = [{}, {}, {}, {}];
  }
  for (let i = 0; i < 4; i++) {
    if (!s.gearByTeam[i] || typeof s.gearByTeam[i] !== 'object') s.gearByTeam[i] = {};
  }
}

export function getEquipped(pokemonId, teamSlot = null) {
  const s = getState();
  _ensureGearByTeam(s);
  const slot = _resolveTeamSlot(s, teamSlot);
  return s.gearByTeam[slot][pokemonId] ?? null;
}

export function getPokemonHoldingItem(itemId, teamSlot = null) {
  const s = getState();
  _ensureGearByTeam(s);
  const slot = _resolveTeamSlot(s, teamSlot);
  for (const [pkId, it] of Object.entries(s.gearByTeam[slot])) {
    if (it === itemId) return Number(pkId);
  }
  return null;
}

/** Tutti gli usi (per-team) di un oggetto. Restituisce [{teamSlot, pokemonId}, ...]. */
export function getItemUsages(itemId) {
  const s = getState();
  _ensureGearByTeam(s);
  const out = [];
  for (let t = 0; t < 4; t++) {
    for (const [pkId, it] of Object.entries(s.gearByTeam[t])) {
      if (it === itemId) out.push({ teamSlot: t, pokemonId: Number(pkId) });
    }
  }
  return out;
}

/** Equipaggia itemId su pokemonId nel team specificato (default = active).
 *  Se nello stesso team l'oggetto era su un altro Pokémon, lo stacca da lì.
 *  Rifiuta se l'oggetto è esclusivo di altri Pokémon. */
export function equipItem(pokemonId, itemId, teamSlot = null) {
  if (!pokemonId || !itemId) return false;
  const s = getState();
  if (!s.inventory || !s.inventory[itemId]) return false;   // non posseduto
  // Vincolo restrictedTo (oggetti esclusivi)
  if (!isItemAllowedForPokemon(itemId, pokemonId)) return false;
  _ensureGearByTeam(s);
  const slot = _resolveTeamSlot(s, teamSlot);
  const gear = s.gearByTeam[slot];
  // Stacca eventuale possessore precedente NELLO STESSO team
  const prev = getPokemonHoldingItem(itemId, slot);
  if (prev != null && prev !== pokemonId) delete gear[prev];
  gear[pokemonId] = itemId;
  saveState();
  return true;
}

/* ================================================================
   EXPORT / IMPORT — backup manuale
   ================================================================
   Formato di file:
   {
     format:     'pokemon-card-battle/v1',
     exportedAt: ISO timestamp,
     state:      { ...DEFAULT_STATE }
   }
*/

export function exportSave() {
  const state   = getState();
  const payload = {
    format:     SAVE_FORMAT,
    exportedAt: new Date().toISOString(),
    state,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href     = url;
  a.download = `pokemon-card-battle-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return payload;
}

export async function importSave(file) {
  const text   = await file.text();
  const parsed = JSON.parse(text);
  // Accetta sia il nuovo formato { format, state } sia uno state nudo (legacy)
  const incoming = parsed?.state ?? parsed;

  if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.owned)) {
    throw new Error('Il file non sembra un salvataggio valido.');
  }

  // Sostituisce lo stato, preservando però l'userId esistente se l'incoming
  // non ne ha uno proprio (così l'utente non perde la sua identità locale).
  const current = _state ?? readAndMigrate();
  _state = ensureIdentity({
    ...structuredClone(DEFAULT_STATE),
    ...incoming,
    // Se l'import non ha userId, riusa quello attuale
    userId:    incoming.userId    ?? current.userId,
    createdAt: incoming.createdAt ?? current.createdAt,
  });
  saveState();
  return _state;
}

/* ================================================================
   HELPERS INTERNI
   ================================================================ */

function readAndMigrate() {
  let loaded = null;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) loaded = JSON.parse(raw);
  } catch (e) {
    console.warn('Stato corrotto, reset:', e);
  }

  // Migrazione: vecchio team+savedTeams → nuovo teams[4]
  if (loaded && loaded.team !== undefined && !Array.isArray(loaded.teams)) {
    const oldTeam   = Array.isArray(loaded.team) ? loaded.team : [];
    const oldSaved  = Array.isArray(loaded.savedTeams) ? loaded.savedTeams : [];
    loaded.teams = [oldTeam, oldSaved[0] ?? [], oldSaved[1] ?? [], oldSaved[2] ?? []];
    if (loaded.activeTeam == null) loaded.activeTeam = 0;
    delete loaded.team;
    delete loaded.savedTeams;
  }

  const merged = ensureIdentity({
    ...structuredClone(DEFAULT_STATE),
    ...(loaded ?? {}),
  });

  // Normalizza: teams deve sempre essere un array di 4
  if (!Array.isArray(merged.teams)) merged.teams = [[], [], [], []];
  while (merged.teams.length < 4) merged.teams.push([]);
  merged.teams = merged.teams.slice(0, 4).map(t => Array.isArray(t) ? t : []);
  if (typeof merged.activeTeam !== 'number') merged.activeTeam = 0;

  // Migrazione: inventory (save pre-shop)
  if (!merged.inventory || typeof merged.inventory !== 'object') merged.inventory = {};

  // Migrazione: gearByTeam (save pre-loadout-per-team).
  // Il vecchio `gear` globale viene riversato nel team attivo, gli altri 3 partono vuoti.
  if (!Array.isArray(merged.gearByTeam) || merged.gearByTeam.length !== 4) {
    const oldGear = (merged.gear && typeof merged.gear === 'object') ? merged.gear : {};
    const initial = [{}, {}, {}, {}];
    const idx = (typeof merged.activeTeam === 'number') ? merged.activeTeam : 0;
    initial[Math.max(0, Math.min(3, idx))] = { ...oldGear };
    merged.gearByTeam = initial;
  } else {
    // Garantisce che tutti e 4 i team siano oggetti validi
    for (let i = 0; i < 4; i++) {
      if (!merged.gearByTeam[i] || typeof merged.gearByTeam[i] !== 'object') {
        merged.gearByTeam[i] = {};
      }
    }
  }

  // Migrazione: aggiungi matchHistory + lifetimeStats se mancano (save pre-stats)
  if (!Array.isArray(merged.matchHistory)) merged.matchHistory = [];
  if (!merged.lifetimeStats || typeof merged.lifetimeStats !== 'object') {
    merged.lifetimeStats = structuredClone(DEFAULT_STATE.lifetimeStats);
  } else {
    // Riempi eventuali nuovi campi senza azzerare i valori esistenti
    const defaultStats = DEFAULT_STATE.lifetimeStats;
    for (const k of Object.keys(defaultStats)) {
      if (merged.lifetimeStats[k] === undefined) {
        merged.lifetimeStats[k] = typeof defaultStats[k] === 'object'
          ? structuredClone(defaultStats[k])
          : defaultStats[k];
      }
    }
  }

  // Persisti subito al primo avvio / dopo migrazione
  if (!loaded || !loaded.userId || !Array.isArray(loaded?.teams)) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(merged)); } catch {}
  }

  return merged;
}

function ensureIdentity(state) {
  if (!state.userId) {
    state.userId      = generateGuestId();
    state.createdAt   = Date.now();
    state.accountType = 'guest';
  }
  return state;
}

function generateGuestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'guest-' + crypto.randomUUID();
  }
  // Fallback per browser molto vecchi
  return 'guest-' + Date.now().toString(36) + '-' +
         Math.random().toString(36).slice(2, 10);
}
