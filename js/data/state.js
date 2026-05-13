/* ============================================================
   state.js — stato del giocatore persistito su localStorage
   Predisposto per cloud sync futuro (vedi onSave + identity).
   ============================================================ */

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
  teams: [[], [], [], []],            // 4 slot team (A, B, C, D) — sempre 4
  activeTeam: 0,                      // indice del team correntemente visualizzato/usato in battaglia
  gear: {},

  /* ---- Valute ---- */
  gems:    0,
  pokeuro: 0,
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
  if (current.includes(id)) return false;
  if (current.length >= 6) return false;
  setTeamSlot(slot, [...current, id]);
  return true;
}

export function removeFromTeamSlot(slot, id) {
  const current = getTeamSlot(slot);
  setTeamSlot(slot, current.filter(x => x !== id));
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

/* Compat: operano sul team correntemente attivo */
export function setTeam(ids)       { setTeamSlot(getState().activeTeam ?? 0, ids); }
export function addToTeam(id)      { return addToTeamSlot(getState().activeTeam ?? 0, id); }
export function removeFromTeam(id) { removeFromTeamSlot(getState().activeTeam ?? 0, id); }

export function isOwned(id) {
  return getState().owned.includes(id);
}

export function getStars(id) {
  return getState().stars[id] ?? 1;
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
