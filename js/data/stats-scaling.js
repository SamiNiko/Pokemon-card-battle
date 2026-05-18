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

import { getRarity } from './rarity.js';

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

/** Restituisce le stats SCALATE per il Pokemon (in base alla sua rarità).
 *  Non muta il pokemon originale — ritorna un oggetto nuovo `{ hp, atk, def, spAtk, spDef, speed }`.
 *  Usa questo invece di `pkmn.stats` in TUTTO il codice del gameplay e visualizzazione. */
export function getScaledStats(pkmn) {
  const s = pkmn?.stats ?? {};
  const rarity = getRarity(pkmn?.id);
  const m = MULT[rarity] ?? MULT.common;
  return {
    hp:    ROUND((s.hp    ?? 0) * m.tank),
    atk:   ROUND((s.atk   ?? 0) * m.atk),
    def:   ROUND((s.def   ?? 0) * m.tank),
    spAtk: ROUND((s.spAtk ?? 0) * m.atk),
    spDef: ROUND((s.spDef ?? 0) * m.tank),
    speed: ROUND((s.speed ?? 0) * m.speed),
  };
}

/** Restituisce i moltiplicatori per una rarità (utility per UI/debug). */
export function getRarityMultiplier(rarity) {
  return MULT[rarity] ?? MULT.common;
}

/** Esposto per dashboard / debugging. */
export const STAT_MULT_BY_RARITY = MULT;
