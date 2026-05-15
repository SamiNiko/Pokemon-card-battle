/* ============================================================
   story-state.js — helpers per lo stato della modalità storia
   ============================================================
   Lo state della storia vive dentro getState().storyState e usa
   la stessa persistenza (localStorage + futuro cloud sync).

   Forma:
   storyState = {
     currentScene:        'biancavilla',     // scena attualmente visualizzata
     flags:               { ... },           // 'oak-introduced': true, ecc.
     hotspotsConsumed:    [ 'pokeball-1' ],  // hotspot già "usati" (pokeball, cestini)
     trainersDefeated:    [ ],               // ID allenatori sconfitti
     dialogsSeen:         [ ],               // dialoghi che hanno già fatto onEnter
     badges:              [ ],               // medaglie ottenute
     chapter:             0,                 // capitolo corrente (UI)
   }
*/

import { getState, saveState } from './state.js?v=3';

const DEFAULT_STORY_STATE = {
  currentScene:      'biancavilla',
  flags:             {},
  hotspotsConsumed:  [],
  trainersDefeated:  [],
  dialogsSeen:       [],
  badges:            [],
  chapter:           0,
  visitedLocations:  [],   // ID delle mapLocation visitate (per fast-travel)
};

export function getStoryState() {
  const s = getState();
  if (!s.storyState) {
    s.storyState = structuredClone(DEFAULT_STORY_STATE);
    saveState();
  } else {
    // Backfill se mancano chiavi (es. dopo aggiornamenti dello schema)
    for (const k of Object.keys(DEFAULT_STORY_STATE)) {
      if (s.storyState[k] === undefined) s.storyState[k] = structuredClone(DEFAULT_STORY_STATE[k]);
    }
  }
  return s.storyState;
}

export function resetStory() {
  const s = getState();
  s.storyState = structuredClone(DEFAULT_STORY_STATE);
  saveState();
}

/* ---- Scena corrente ---- */
export function getCurrentScene() {
  return getStoryState().currentScene;
}
export function setCurrentScene(sceneId) {
  getStoryState().currentScene = sceneId;
  saveState();
}

/* ---- Flags (eventi globali) ---- */
export function hasFlag(flag) {
  return Boolean(getStoryState().flags[flag]);
}
export function setFlag(flag) {
  getStoryState().flags[flag] = true;
  saveState();
}
export function clearFlag(flag) {
  delete getStoryState().flags[flag];
  saveState();
}

/* ---- Hotspot consumati (granularità massima) ---- */
export function isHotspotConsumed(id) {
  return getStoryState().hotspotsConsumed.includes(id);
}
export function consumeHotspot(id) {
  const ss = getStoryState();
  if (!ss.hotspotsConsumed.includes(id)) {
    ss.hotspotsConsumed.push(id);
    saveState();
  }
}

/* ---- Trainer sconfitti ---- */
export function isTrainerDefeated(id) {
  return getStoryState().trainersDefeated.includes(id);
}
export function markTrainerDefeated(id) {
  const ss = getStoryState();
  if (!ss.trainersDefeated.includes(id)) {
    ss.trainersDefeated.push(id);
    saveState();
  }
}

/* ---- Dialoghi visti (per gli onEnter automatici) ---- */
export function isDialogSeen(id) {
  return getStoryState().dialogsSeen.includes(id);
}
export function markDialogSeen(id) {
  const ss = getStoryState();
  if (!ss.dialogsSeen.includes(id)) {
    ss.dialogsSeen.push(id);
    saveState();
  }
}

/* ---- Location visitate (fast-travel) ---- */
export function isLocationVisited(id) {
  return getStoryState().visitedLocations.includes(id);
}
export function markLocationVisited(id) {
  const ss = getStoryState();
  if (!ss.visitedLocations.includes(id)) {
    ss.visitedLocations.push(id);
    saveState();
  }
}
export function getVisitedLocations() {
  return [...getStoryState().visitedLocations];
}

/* ---- Medaglie ---- */
export function addBadge(badge) {
  const ss = getStoryState();
  if (!ss.badges.includes(badge)) {
    ss.badges.push(badge);
    saveState();
  }
}

/* ---- Ottieni Pokémon dalla storia ---- */
export function givePokemon(id) {
  const s = getState();
  if (!s.owned.includes(id)) {
    s.owned.push(id);
    saveState();
    return true;
  }
  return false;
}

/* ---- Valuta requisiti dichiarativi ----
   I requisiti sono oggetti tipo:
     { flag: 'oak-introduced' }              → richiede flag set
     { notFlag: 'starter-chosen' }           → richiede flag NON set
     { trainerDefeated: 'brock' }            → richiede trainer sconfitto
     { hotspotConsumed: 'pokeball-bulb' }    → richiede hotspot consumato
     { allOf: [ ...req ] }                   → tutti veri
     { anyOf: [ ...req ] }                   → almeno uno
   Ritorna { ok: boolean, reason?: string }
*/
export function evalRequires(req) {
  if (!req) return { ok: true };

  if (req.allOf) {
    for (const r of req.allOf) {
      const res = evalRequires(r);
      if (!res.ok) return res;
    }
    return { ok: true };
  }
  if (req.anyOf) {
    for (const r of req.anyOf) {
      if (evalRequires(r).ok) return { ok: true };
    }
    return { ok: false, reason: req.errorMsg };
  }

  if (req.flag             && !hasFlag(req.flag))                     return { ok: false, reason: req.errorMsg };
  if (req.notFlag          && hasFlag(req.notFlag))                   return { ok: false, reason: req.errorMsg };
  if (req.trainerDefeated  && !isTrainerDefeated(req.trainerDefeated)) return { ok: false, reason: req.errorMsg };
  if (req.hotspotConsumed  && !isHotspotConsumed(req.hotspotConsumed)) return { ok: false, reason: req.errorMsg };

  return { ok: true };
}
