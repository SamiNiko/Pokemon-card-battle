/* ============================================================
   ai.js — intelligenza artificiale del nemico
   ============================================================
   Strategie:
   - aiPlaceCards: piazza 3 Pokémon scegliendo i migliori per HP% e potenza
   - aiChooseMoves: per ogni Pokémon in campo, sceglie 'basic' o 'finisher'
     in base al danno effettivo contro il bersaglio (type matchup-aware)
*/

import { getTypeEffectiveness } from '../data/types.js';
import { getScaledStats }       from '../data/stats-scaling.js?v=3';
import { getPassive }           from '../data/passives.js';
import { calcDamage }           from './combat.js';

const FRONT_SLOTS = ['front-left', 'front-center', 'front-right'];
const BACK_SLOTS  = ['back-left',  'back-center',  'back-right'];
const ALL_SLOTS   = [...FRONT_SLOTS, ...BACK_SLOTS];
const COLUMNS     = ['left', 'center', 'right'];
const ROWS        = ['front', 'back'];

/**
 * Decide il campo dell'AI per il turno corrente.
 * Sceglie i Pokémon con punteggio = HP% × (atk migliore + speed/2),
 * così le carte fresche e offensive vengono in campo per prime.
 *
 * @param {number[]}        teamIds      - IDs del team nemico (in ordine team)
 * @param {Set<number>}     deadIds      - IDs Pokémon eliminati
 * @param {Function}        findPokemon  - (id) => pkmn | null
 * @param {object}          [opts]
 * @param {Map<number,number>} [opts.hpMap] - HP correnti (per privilegiare i sani)
 * @returns {Map<string, object>}        - slotKey → pkmn
 */
export function aiPlaceCards(teamIds, deadIds, findPokemon, opts = {}) {
  const { hpMap = null } = opts;

  // Alive Pokémon con dati
  const alive = teamIds
    .filter(id => !deadIds.has(id))
    .map(id => findPokemon(id))
    .filter(Boolean);

  if (alive.length === 0) return new Map();

  // Score ogni Pokémon: privilegia HP% alti e potenza offensiva.
  // Tutto in spazio SCALED per coerenza con battle (hpMap è già scaled).
  const scored = alive.map(pkmn => {
    const sc        = getScaledStats(pkmn);
    const maxHP     = sc.hp;
    const currentHP = hpMap?.get(pkmn.id) ?? maxHP;
    const hpPct     = maxHP > 0 ? currentHP / maxHP : 0;
    const offense   = Math.max(sc.atk, sc.spAtk);
    const score     = hpPct * (offense + sc.speed * 0.5);
    return { pkmn, score };
  }).sort((a, b) => b.score - a.score);

  // I 3 migliori vanno in campo
  const top3 = scored.slice(0, 3).map(s => s.pkmn);
  if (top3.length === 0) return new Map();

  // Sort per offense (pmiù offensivi prima nel greedy assignment)
  const offOf = p => { const sc = getScaledStats(p); return Math.max(sc.atk, sc.spAtk); };
  const sortedByOffense = [...top3].sort((a, b) => offOf(b) - offOf(a));

  /* ASSEGNAZIONE INTELLIGENTE (vs il vecchio "tutto in front"):
     1. Per ogni Pokemon, calcola la sua slot ideale = una delle sue activeSlots
        di passiva (se ce l'ha), così la passiva si attiva in battle.
     2. Greedy: assegna in ordine di offense, ogni Pokemon prende la sua slot
        ideale se libera, altrimenti la migliore slot front libera che copra
        una colonna ancora non coperta.
     3. Vincolo: cerchiamo di coprire tutte e 3 le colonne (left/center/right)
        per non lasciare buchi in cui il giocatore farebbe direct damage. */
  const field         = new Map();
  const usedSlots     = new Set();
  const coveredCols   = new Set();

  function tryAssign(pkmn, slotKey) {
    if (usedSlots.has(slotKey)) return false;
    field.set(slotKey, pkmn);
    usedSlots.add(slotKey);
    coveredCols.add(slotKey.split('-')[1]);
    return true;
  }

  // Pass 1: prova a piazzare ognuno in una sua activeSlot di passiva
  const stillNeed = [];
  for (const pkmn of sortedByOffense) {
    const pass = getPassive(pkmn.id);
    const preferred = pass?.activeSlots ?? [];
    // Tra le preferite, scegli quella che ALSO copre una colonna nuova
    let placed = false;
    const uncoveredPreferred = preferred.filter(s => !coveredCols.has(s.split('-')[1]));
    for (const slot of uncoveredPreferred) {
      if (tryAssign(pkmn, slot)) { placed = true; break; }
    }
    // Se non ha trovato preferite uncovered, prendi la prima preferita libera
    if (!placed) {
      for (const slot of preferred) {
        if (tryAssign(pkmn, slot)) { placed = true; break; }
      }
    }
    if (!placed) stillNeed.push(pkmn);
  }

  // Pass 2: pokemon rimanenti — piazza per coprire colonne mancanti
  for (const pkmn of stillNeed) {
    let placed = false;
    // Prima cerca front-slot in colonna scoperta
    for (const col of COLUMNS) {
      if (coveredCols.has(col)) continue;
      if (tryAssign(pkmn, `front-${col}`)) { placed = true; break; }
    }
    if (!placed) {
      // Tutte le colonne sono coperte; fallback: prima slot front libera
      for (const slot of FRONT_SLOTS) {
        if (tryAssign(pkmn, slot)) { placed = true; break; }
      }
      // Nemmeno front libero (= già 3 in front) → tenta back
      if (!placed) {
        for (const slot of BACK_SLOTS) {
          if (tryAssign(pkmn, slot)) { placed = true; break; }
        }
      }
    }
  }

  return field;
}

/**
 * Sceglie quale mossa usare per ogni Pokémon nemico in campo.
 * Confronta il danno atteso di Basic vs Finisher contro il bersaglio
 * effettivo (Pokémon nemico nella stessa colonna o danno diretto).
 *
 * @param {object}              params
 * @param {Map<string,object>}  params.attackerField  - campo del lato AI
 * @param {Map<string,object>}  params.defenderField  - campo del lato player
 * @param {Map<number,number>}  params.attackerPP     - PP accumulati dall'AI
 * @param {object}              params.movesets       - MOVESETS lookup
 * @param {Set<number>}         params.defenderDead   - IDs Pokémon morti lato player
 * @returns {Map<number, string>} id → 'basic' | 'finisher' | 'auto'
 */
export function aiChooseMoves({ attackerField, defenderField, attackerPP, movesets, defenderDead }) {
  const selections = new Map();

  for (const [slotKey, attacker] of attackerField) {
    const set = movesets?.[attacker.id];
    if (!set) {
      selections.set(attacker.id, 'auto');
      continue;
    }
    // Nuovo formato: [base1, base2, finisher] — backward compat con 2 elementi
    const isNew    = set.length >= 3;
    const base1    = set[0];
    const base2    = isNew ? set[1] : set[0];
    const finisher = isNew ? { ...set[2], isFinisher: true } : { ...set[1], isFinisher: true };
    const pp = attackerPP?.get(attacker.id) ?? 0;
    const canFinisher = pp >= 3;

    // Trova target nella stessa colonna (front prima, poi back)
    const col = slotKey.split('-')[1];
    let target = null;
    let targetSlot = null;
    for (const row of ROWS) {
      const tKey = `${row}-${col}`;
      const pkmn = defenderField.get(tKey);
      if (pkmn && !defenderDead?.has(pkmn.id)) {
        target = pkmn;
        targetSlot = tKey;
        break;
      }
    }

    // Nessun target → danno diretto. Finisher è sempre meglio (più power).
    if (!target) {
      selections.set(attacker.id, canFinisher ? 'finisher' : 'basic1');
      continue;
    }

    // Calcola danno atteso usando calcDamage che considera le passive
    // (boost di tipo, resistenze, immunità, STAB raddoppiato, ecc.)
    const dmgOpts = { attackerSlot: slotKey, defenderSlot: targetSlot, isFullHP: false };
    const b1Res        = calcDamage(attacker, base1, target, dmgOpts);
    const b2Res        = calcDamage(attacker, base2, target, dmgOpts);
    const finisherRes  = canFinisher ? calcDamage(attacker, finisher, target, dmgOpts) : null;
    const b1Dmg        = b1Res.damage;
    const b2Dmg        = b2Res.damage;
    const finisherDmg  = finisherRes?.damage ?? -1;
    const bestBaseDmg  = Math.max(b1Dmg, b2Dmg);
    const bestBaseKey  = b1Dmg >= b2Dmg ? 'basic1' : 'basic2';

    if (finisherDmg < 0) {
      selections.set(attacker.id, bestBaseKey);
      continue;
    }

    // Scegli la mossa che fa più danno al target.
    // EXTRA: se base move basta a uccidere il target (overkill), risparmia
    // i PP del finisher per un futuro target con più HP.
    const targetMaxHP = getScaledStats(target).hp;
    const baseKills = bestBaseDmg >= targetMaxHP * 0.95;   // soglia tolerance
    if (baseKills) {
      selections.set(attacker.id, bestBaseKey);
    } else {
      selections.set(attacker.id, finisherDmg > bestBaseDmg ? 'finisher' : bestBaseKey);
    }
  }

  return selections;
}

/* ---- Helpers ---- */
/* (estimateDamage rimosso: ora usiamo calcDamage dal combat engine che già
   considera STAB, type effectiveness, passive boost/resist, immunità,
   stab_boost di Adattabilità, ecc.) */
