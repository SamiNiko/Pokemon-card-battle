/* ============================================================
   combat.js — motore di combattimento
   - Mosse reali per ogni Pokémon (MOVESETS)
   - STAB ×1.5 se tipo mossa = tipo del Pokémon
   - Categorie Fisiche/Speciali: ATK/DEF o SP.ATK/SP.DEF
   - Selezione mossa: 'auto' (gratis) | 'basic' (gratis) | 'finisher' (3 PP, riutilizzabile)
   - HP e PP tracciati per lato (player/enemy) per evitare collisioni di ID
   ============================================================ */

import { getTypeEffectiveness } from '../data/types.js';
import { getScaledStats }       from '../data/stats-scaling.js';

const DIRECT_BASE_POWER = 150;
const ROWS = ['front', 'back'];

// ---- Mossa automatica (nessuna mossa sbloccata o selezione 'auto') -----

function getAutoMove(pkmn) {
  return {
    name:  'Attacco Base',
    type:  pkmn.types[0],
    cat:   pkmn.stats.atk >= pkmn.stats.spAtk ? 'physical' : 'special',
    power: 50,
    isAuto: true,
  };
}

// ---- Seleziona la mossa effettiva da usare per un Pokémon --------------

function resolveMove(pkmn, isPlayer, { movesets, selectedMoves, enemySelectedMoves, playerPkmnPP, enemyPkmnPP }) {
  const set   = movesets?.[pkmn.id];
  const ppMap = isPlayer ? playerPkmnPP : enemyPkmnPP;
  const pp    = ppMap?.get(pkmn.id) ?? 0;

  if (!set) return getAutoMove(pkmn);

  // Nuovo formato: [base1, base2, finisher] (3 elementi)
  // Vecchio formato: [basic, finisher] (2 elementi) — backward compat
  const isNew    = set.length >= 3;
  const base1    = set[0];
  const base2    = isNew ? set[1] : set[0];
  const finisher = isNew ? set[2] : set[1];

  const movesMap = isPlayer ? selectedMoves : enemySelectedMoves;
  const sel      = movesMap?.get(pkmn.id) ?? 'basic1';

  if (sel === 'finisher') {
    if (pp >= 3) return { ...finisher, isFinisher: true };
    return { ...base1 };  // PP insufficienti → fall back
  }
  if (sel === 'basic2') return { ...base2 };
  // 'basic1', 'basic' (legacy), o default
  if (sel === 'basic1' || sel === 'basic') return { ...base1 };
  return getAutoMove(pkmn);  // sel === 'auto'
}

// ---- Calcolo danno con STAB --------------------------------------------

export function calcDamage(attacker, move, defender) {
  const stab    = attacker.types.includes(move.type) ? 1.5 : 1.0;
  const typeEff = getTypeEffectiveness(move.type, defender.types);

  if (move.cat === 'status' || move.power === 0) {
    return { damage: 0, typeEff: 1, stab: false, moveType: move.type, category: move.cat };
  }

  // Stats SCALATE per rarità (HP/DEF/SPD molto, ATK/SPA poco). Le base
  // di PokeAPI da sole sarebbero troppo basse per la nostra fascia HP.
  const atkS = getScaledStats(attacker);
  const defS = getScaledStats(defender);
  const atkStat = move.cat === 'physical' ? atkS.atk : atkS.spAtk;
  const defStat = move.cat === 'physical' ? defS.def : defS.spDef;

  // Smorzamento /2 per evitare oneshot: in Pokemon ufficiale la formula
  // ha un fattore livello/50 di smorzamento che qui non abbiamo.
  return {
    damage:   Math.max(1, Math.round((atkStat / defStat) * move.power * stab * typeEff * 0.5)),
    typeEff,
    stab:     stab > 1,
    moveType: move.type,
    category: move.cat,
  };
}

export function calcDirectDamage(attacker, move) {
  if (move.cat === 'status' || move.power === 0) return 0;
  const atkS = getScaledStats(attacker);
  const atkStat = move.cat === 'physical' ? atkS.atk : atkS.spAtk;
  return Math.max(1, Math.round((atkStat / 100) * DIRECT_BASE_POWER * 0.5));
}

// ---- Risoluzione turno -------------------------------------------------

/**
 * @param {object}              params
 * @param {Map<string,object>}  params.playerField
 * @param {Map<string,object>}  params.enemyField
 * @param {Map<number,number>}  params.playerPkmnHP
 * @param {Map<number,number>}  params.enemyPkmnHP
 * @param {Set<number>}         params.playerDeadIds
 * @param {Set<number>}         params.enemyDeadIds
 * @param {number}              params.playerHP
 * @param {number}              params.enemyHP
 * @param {object}              params.movesets       - MOVESETS lookup
 * @param {Map<number,string>}  params.selectedMoves  - id → 'auto'|'basic'|'finisher'
 * @param {Map<number,number>}  params.playerPkmnPP   - PP accumulati lato player
 * @param {Map<number,number>}  params.enemyPkmnPP    - PP accumulati lato enemy
 * @returns {object[]} array di eventi da animare
 */
export function resolveTurn({
  playerField, enemyField,
  playerPkmnHP, enemyPkmnHP,
  playerDeadIds, enemyDeadIds,
  playerHP, enemyHP,
  movesets, selectedMoves, enemySelectedMoves,
  playerPkmnPP, enemyPkmnPP,
}) {
  const pHP   = new Map(playerPkmnHP);
  const eHP   = new Map(enemyPkmnHP);
  const pDead = new Set(playerDeadIds);
  const eDead = new Set(enemyDeadIds);

  const hp     = { player: playerHP, enemy: enemyHP };
  const events = [];

  const moveCtx = { movesets, selectedMoves, enemySelectedMoves, playerPkmnPP, enemyPkmnPP };

  const getHP    = (side, id, base) => (side === 'player' ? pHP : eHP).get(id) ?? base;
  const setHP    = (side, id, val)  => (side === 'player' ? pHP : eHP).set(id, val);
  const isDead   = (side, id)       =>  side === 'player' ? pDead.has(id) : eDead.has(id);
  const markDead = (side, id)       => (side === 'player' ? pDead : eDead).add(id);

  const aliveEntries = (field, side) =>
    [...field.entries()].filter(([, p]) => !isDead(side, p.id));

  const playerAlive = aliveEntries(playerField, 'player');
  const enemyAlive  = aliveEntries(enemyField,  'enemy');

  const playerSpeed = playerAlive.reduce((s, [, p]) => s + p.stats.speed, 0);
  const enemySpeed  = enemyAlive.reduce((s, [, p])  => s + p.stats.speed, 0);
  const firstTeam   = playerSpeed >= enemySpeed ? 'player' : 'enemy';

  events.push({ type: 'speed_check', playerSpeed, enemySpeed, first: firstTeam });

  const playerOrder = [...playerAlive].sort(([, a], [, b]) => b.stats.speed - a.stats.speed);
  const enemyOrder  = [...enemyAlive].sort(([, a], [, b])  => b.stats.speed - a.stats.speed);

  function findTarget(field, col, defSide) {
    for (const row of ROWS) {
      const key  = `${row}-${col}`;
      const pkmn = field.get(key);
      if (pkmn && !isDead(defSide, pkmn.id)) return { slotKey: key, pkmn };
    }
    return null;
  }

  function doAttacks(attackers, defenderField, atkSide, defSide) {
    const isPlayer = atkSide === 'player';
    for (const [slotKey, attacker] of attackers) {
      if (isDead(atkSide, attacker.id)) continue;

      const move   = resolveMove(attacker, isPlayer, moveCtx);
      const col    = slotKey.split('-')[1];
      const target = findTarget(defenderField, col, defSide);

      if (target) {
        const res    = calcDamage(attacker, move, target.pkmn);
        const prevHP = getHP(defSide, target.pkmn.id, target.pkmn.stats.hp);
        const newHP  = Math.max(0, prevHP - res.damage);
        setHP(defSide, target.pkmn.id, newHP);
        if (newHP === 0) markDead(defSide, target.pkmn.id);

        events.push({
          type:          'attack',
          attackerSide:  atkSide,
          attackerSlot:  slotKey,
          attackerId:    attacker.id,
          defenderSide:  defSide,
          defenderSlot:  target.slotKey,
          targetId:      target.pkmn.id,
          damage:        res.damage,
          typeEff:       res.typeEff,
          stab:          res.stab,
          moveType:      res.moveType,
          moveName:      move.name,
          category:      res.category,
          isFinisher:    move.isFinisher ?? false,
          isAuto:        move.isAuto    ?? false,
          targetHPAfter: newHP,
          targetMaxHP:   target.pkmn.stats.hp,
          targetDied:    newHP === 0,
        });
      } else {
        const dmg = calcDirectDamage(attacker, move);
        hp[defSide] = Math.max(0, hp[defSide] - dmg);

        events.push({
          type:         'direct_damage',
          attackerSide: atkSide,
          attackerSlot: slotKey,
          attackerId:   attacker.id,
          defenderSide: defSide,
          moveName:     move.name,
          isFinisher:   move.isFinisher ?? false,
          isAuto:       move.isAuto    ?? false,
          damage:       dmg,
          hpAfter:      hp[defSide],
        });
      }
    }
  }

  if (firstTeam === 'player') {
    doAttacks(playerOrder, enemyField,  'player', 'enemy');
    doAttacks(enemyOrder,  playerField, 'enemy',  'player');
  } else {
    doAttacks(enemyOrder,  playerField, 'enemy',  'player');
    doAttacks(playerOrder, enemyField,  'player', 'enemy');
  }

  events.push({ type: 'turn_end', playerHP: hp.player, enemyHP: hp.enemy });

  return events;
}
