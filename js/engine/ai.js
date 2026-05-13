/* ============================================================
   ai.js — intelligenza artificiale del nemico
   ============================================================
   Strategie:
   - aiPlaceCards: piazza 3 Pokémon scegliendo i migliori per HP% e potenza
   - aiChooseMoves: per ogni Pokémon in campo, sceglie 'basic' o 'finisher'
     in base al danno effettivo contro il bersaglio (type matchup-aware)
*/

import { getTypeEffectiveness } from '../data/types.js';

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

  // Score ogni Pokémon: privilegia HP% alti e potenza offensiva
  const scored = alive.map(pkmn => {
    const maxHP     = pkmn.stats.hp;
    const currentHP = hpMap?.get(pkmn.id) ?? maxHP;
    const hpPct     = maxHP > 0 ? currentHP / maxHP : 0;
    const offense   = Math.max(pkmn.stats.atk, pkmn.stats.spAtk);
    const score     = hpPct * (offense + pkmn.stats.speed * 0.5);
    return { pkmn, score };
  }).sort((a, b) => b.score - a.score);

  // I 3 migliori vanno in campo, ordinati per speed in front-left/center/right
  // (slot center privilegia il più offensivo, ai lati i secondari)
  const top3 = scored.slice(0, 3).map(s => s.pkmn);
  if (top3.length === 0) return new Map();

  // Sort: il più offensivo al centro, gli altri ai lati
  const sortedByOffense = [...top3].sort((a, b) =>
    Math.max(b.stats.atk, b.stats.spAtk) - Math.max(a.stats.atk, a.stats.spAtk)
  );
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
    const [basic, finisher] = set;
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
      selections.set(attacker.id, canFinisher ? 'finisher' : 'basic');
      continue;
    }

    // Calcola danno atteso con ciascuna mossa
    const basicDmg    = estimateDamage(attacker, basic,    target);
    const finisherDmg = canFinisher ? estimateDamage(attacker, finisher, target) : -1;

    if (finisherDmg < 0) {
      selections.set(attacker.id, 'basic');
      continue;
    }

    // Scegli la mossa che fa più danno al target (considera STAB + tipo)
    if (finisherDmg > basicDmg) {
      selections.set(attacker.id, 'finisher');
    } else {
      selections.set(attacker.id, 'basic');
    }
  }

  return selections;
}

/* ---- Helpers ---- */

/** Stima il danno di una mossa (stessa formula di combat.js calcDamage). */
function estimateDamage(attacker, move, defender) {
  if (!move || move.cat === 'status' || move.power === 0) return 0;
  const stab    = attacker.types.includes(move.type) ? 1.5 : 1.0;
  const typeEff = getTypeEffectiveness(move.type, defender.types);
  const atkStat = move.cat === 'physical' ? attacker.stats.atk   : attacker.stats.spAtk;
  const defStat = move.cat === 'physical' ? defender.stats.def   : defender.stats.spDef;
  return Math.max(1, Math.round((atkStat / defStat) * move.power * stab * typeEff));
}
