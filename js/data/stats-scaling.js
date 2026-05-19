/* ============================================================
   stats-scaling.js — Stats scalate per rarità (bilanciamento)
   ------------------------------------------------------------
   Le base stats di PokeAPI (HP 45 Bulbasaur, HP 78 Charizard, ecc.)
   sono troppo basse rispetto alle potenze delle mosse: ogni
   attacco oneshot un Pokemon. Applichiamo moltiplicatori per
   rarità così:

     - HP / DEF / SP.D crescono MOLTO con la rarità (tank scalano)
     - ATK / SP.A crescono POCO con la rarità (attaccanti moderati)
     - VEL non scala (turn order)

   Risultato: Pokemon più rari sopravvivono più colpi, e i
   leggendari hanno un netto distacco da pseudo/epici (no
   costellazione, quindi devono partire già forti).

   In futuro la "costellazione" (= livelli) sarà un'ulteriore
   moltiplicazione applicata sopra a questa.
   ============================================================ */

import { getRarity }                from './rarity.js';
import { getLevel, MAX_LEVEL }       from './state.js?v=6';

/**
 * Moltiplicatori per rarità:
 *   tank  → applicato a HP, DEF, SP.D
 *   atk   → applicato a ATK, SP.A
 *   speed → applicato a VEL (1.0 = no scaling)
 *
 * NB: leggendari hanno un salto netto verso pseudo/epici, perché
 * non hanno costellazione che li potenzi nel tempo.
 */
const MULT = {
  common:    { tank: 2.8, atk: 1.5, speed: 1.0 },
  uncommon:  { tank: 3.0, atk: 1.7, speed: 1.0 },
  rare:      { tank: 3.2, atk: 2.0, speed: 1.0 },
  epic:      { tank: 3.4, atk: 2.5, speed: 1.0 },  // tarato: Charizard vs Venusaur super-eff = oneshot
  pseudo:    { tank: 3.7, atk: 2.8, speed: 1.0 },
  legendary: { tank: 4.5, atk: 3.5, speed: 1.0 },  // NETTO DISTACCO
};

const ROUND = x => Math.round(x);

/** Bonus stats per livello: LV1=+0%, ..., LV6=+20% (max).
 *  6 step lineari (4% per livello) per arrivare a +20% al livello max.
 *  I leggendari NON ricevono questo bonus (sono già forti di base). */
const LEVEL_BOOST = [1.00, 1.04, 1.08, 1.12, 1.16, 1.20];

/** Restituisce le stats SCALATE per il Pokemon (in base alla sua rarità + livello attuale).
 *  Non muta il pokemon originale — ritorna un oggetto nuovo `{ hp, atk, def, spAtk, spDef, speed }`.
 *  Usa questo invece di `pkmn.stats` in TUTTO il codice del gameplay e visualizzazione. */
export function getScaledStats(pkmn) {
  const rarity = getRarity(pkmn?.id);
  const level = rarity === 'legendary' ? MAX_LEVEL : getLevel(pkmn?.id ?? 0);
  return getScaledStatsAtLevel(pkmn, level);
}

/** Stessa cosa di getScaledStats ma con livello esplicito (per anteprime/animazioni level-up).
 *  I leggendari ignorano comunque `level` e usano MAX_LEVEL (no boost). */
export function getScaledStatsAtLevel(pkmn, level) {
  const s = pkmn?.stats ?? {};
  const rarity = getRarity(pkmn?.id);
  const m = MULT[rarity] ?? MULT.common;
  const lv = rarity === 'legendary' ? MAX_LEVEL : Math.max(1, Math.min(MAX_LEVEL, level | 0));
  const boost = rarity === 'legendary' ? 1.0 : (LEVEL_BOOST[lv - 1] ?? 1.0);
  return {
    hp:    ROUND((s.hp    ?? 0) * m.tank * boost),
    atk:   ROUND((s.atk   ?? 0) * m.atk  * boost),
    def:   ROUND((s.def   ?? 0) * m.tank * boost),
    spAtk: ROUND((s.spAtk ?? 0) * m.atk  * boost),
    spDef: ROUND((s.spDef ?? 0) * m.tank * boost),
    speed: ROUND((s.speed ?? 0) * m.speed),     // VEL non scala né con rarità né con livello
  };
}

/** Display dei livelli 1..6 → 50/60/70/80/90/100. Progressione regolare (+10 per livello).
 *  Prima volta = LV.50 (d'impatto), max = LV.100. */
export const LEVEL_DISPLAY = [50, 60, 70, 80, 90, 100];

/** Display-friendly: ritorna il livello come label "LV. 50" o "LV. MAX" per leggendari. */
export function levelLabel(pokemonId) {
  const rarity = getRarity(pokemonId);
  if (rarity === 'legendary') return 'LV. MAX';
  const lvl = getLevel(pokemonId);
  return `LV. ${LEVEL_DISPLAY[lvl - 1] ?? LEVEL_DISPLAY[0]}`;
}

/** Solo il numero del livello display (per UI dettagliata). */
export function levelNumber(pokemonId) {
  const rarity = getRarity(pokemonId);
  if (rarity === 'legendary') return LEVEL_DISPLAY[LEVEL_DISPLAY.length - 1];
  const lvl = getLevel(pokemonId);
  return LEVEL_DISPLAY[lvl - 1] ?? LEVEL_DISPLAY[0];
}

/** Restituisce i moltiplicatori per una rarità (utility per UI/debug). */
export function getRarityMultiplier(rarity) {
  return MULT[rarity] ?? MULT.common;
}

/** Esposto per dashboard / debugging. */
export const STAT_MULT_BY_RARITY = MULT;
