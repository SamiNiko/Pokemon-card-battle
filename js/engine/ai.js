/* ============================================================
   ai.js — intelligenza artificiale del nemico
   ============================================================
   Strategie:
   - aiPlaceCards: piazza 3 Pokémon scegliendo i migliori per HP% e potenza
   - aiChooseMoves: per ogni Pokémon in campo, sceglie 'basic' o 'finisher'
     in base al danno effettivo contro il bersaglio (type matchup-aware)
*/

import { getTypeEffectiveness } from '../data/types.js';
import { getScaledStats }       from '../data/stats-scaling.js?v=2';

const FRONT_SLOTS = ['front-left', 'front-center', 'front-right'];
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

  // I 3 migliori vanno in campo, ordinati per speed in front-left/center/right
  // (slot center privilegia il più offensivo, ai lati i secondari)
  const top3 = scored.slice(0, 3).map(s => s.pkmn);
  if (top3.length === 0) return new Map();

  // Sort: il più offensivo al centro, gli altri ai lati (su scaled stats)
  const offOf = p => { const sc = getScaledStats(p); return Math.max(sc.atk, sc.spAtk); };
  const sortedByOffense = [...top3].sort((a, b) => offOf(b) - offOf(a));
  // Layout: [left, center, right] — quello più offensivo va al centro
  const layout = [];
  if (sortedByOffense[1]) layout.push(sortedByOffense[1]); // left = secondo
  if (sortedByOffense[0]) layout.push(sortedByOffense[0]); // center = primo
  if (sortedByOffense[2]) layout.push(sortedByOffense[2]); // right = terzo

  const field = new Map();
  layout.forEach((pkmn, i) => {
    field.set(FRONT_SLOTS[i], pkmn);
  });
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
    const finisher = isNew ? set[2] : set[1];
    const pp = attackerPP?.get(attacker.id) ?? 0;
    const canFinisher = pp >= 3;

    // Trova target nella stessa colonna (front prima, poi back)
    const col = slotKey.split('-')[1];
    let target = null;
    for (const row of ROWS) {
      const pkmn = defenderField.get(`${row}-${col}`);
      if (pkmn && !defenderDead?.has(pkmn.id)) {
        target = pkmn;
        break;
      }
    }

    // Nessun target → danno diretto. Finisher è sempre meglio (più power).
    if (!target) {
      selections.set(attacker.id, canFinisher ? 'finisher' : 'basic1');
      continue;
    }

    // Calcola danno atteso con ciascuna mossa
    const b1Dmg       = estimateDamage(attacker, base1,    target);
    const b2Dmg       = estimateDamage(attacker, base2,    target);
    const finisherDmg = canFinisher ? estimateDamage(attacker, finisher, target) : -1;
    const bestBaseDmg = Math.max(b1Dmg, b2Dmg);
    const bestBaseKey = b1Dmg >= b2Dmg ? 'basic1' : 'basic2';

    if (finisherDmg < 0) {
      selections.set(attacker.id, bestBaseKey);
      continue;
    }

    // Scegli la mossa che fa più danno al target
    selections.set(attacker.id, finisherDmg > bestBaseDmg ? 'finisher' : bestBaseKey);
  }

  return selections;
}

/* ---- Helpers ---- */

/** Stima il danno di una mossa (stessa formula di combat.js calcDamage). */
function estimateDamage(attacker, move, defender) {
  if (!move || move.cat === 'status' || move.power === 0) return 0;
  const stab    = attacker.types.includes(move.type) ? 1.5 : 1.0;
  const typeEff = getTypeEffectiveness(move.type, defender.types);
  const atkS = getScaledStats(attacker);
  const defS = getScaledStats(defender);
  const atkStat = move.cat === 'physical' ? atkS.atk : atkS.spAtk;
  const defStat = move.cat === 'physical' ? defS.def : defS.spDef;
  return Math.max(1, Math.round((atkStat / defStat) * move.power * stab * typeEff));
}
