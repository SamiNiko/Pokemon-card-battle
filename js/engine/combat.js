/* ============================================================
   combat.js — motore di combattimento
   - Mosse reali per ogni Pokémon (MOVESETS)
   - STAB ×1.5 se tipo mossa = tipo del Pokémon
   - Categorie Fisiche/Speciali: ATK/DEF o SP.ATK/SP.DEF
   - Selezione mossa: 'auto' (gratis) | 'basic' (gratis) | 'finisher' (3 PP, riutilizzabile)
   - HP e PP tracciati per lato (player/enemy) per evitare collisioni di ID
   ============================================================ */

import { getTypeEffectiveness } from '../data/types.js';
import { getScaledStats }       from '../data/stats-scaling.js?v=3';
import { getPassive }           from '../data/passives.js';

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

/**
 * Calcola il danno di una mossa, applicando i modificatori delle passive
 * di attaccante e difensore SE sono attive nelle loro rispettive slot.
 *
 * opts.attackerSlot  - slot key dell'attaccante (es. 'front-center')
 * opts.defenderSlot  - slot key del difensore
 * opts.isFullHP      - true se il difensore è a HP pieno (per Multiscaglia)
 */
export function calcDamage(attacker, move, defender, opts = {}) {
  const stab    = attacker.types.includes(move.type) ? 1.5 : 1.0;
  const typeEff = getTypeEffectiveness(move.type, defender.types);

  if (move.cat === 'status' || move.power === 0) {
    return { damage: 0, typeEff: 1, stab: false, moveType: move.type, category: move.cat };
  }

  // Passive attive (se Pokemon è nello slot giusto)
  const atkPassive = getActivePassive(attacker, opts.attackerSlot);
  const defPassive = getActivePassive(defender, opts.defenderSlot);

  // IMMUNITY check: la passiva del difensore può azzerare il danno
  if (defPassive && isImmune(defPassive.meta, move)) {
    return { damage: 0, typeEff: 0, stab: false, moveType: move.type, category: move.cat, immuneByPassive: defPassive.name };
  }

  // Stab effettivo: alcune passive lo raddoppiano (Adattabilità)
  let effStab = stab;
  if (atkPassive?.meta?.kind === 'stab_boost' && stab > 1) effStab = atkPassive.meta.mult ?? 2.0;

  // Stats SCALATE per rarità + eventuale boost ATK / debuff DEF (Ultrapotenza)
  const atkS = getScaledStats(attacker);
  const defS = getScaledStats(defender);
  let atkStat = move.cat === 'physical' ? atkS.atk : atkS.spAtk;
  let defStat = move.cat === 'physical' ? defS.def : defS.spDef;
  if (atkPassive?.meta?.kind === 'atk_boost_def_drop') {
    atkStat = Math.round(atkStat * (atkPassive.meta.atk_mult ?? 1));
  }
  if (defPassive?.meta?.kind === 'atk_boost_def_drop') {
    defStat = Math.round(defStat * (defPassive.meta.def_mult ?? 1));
  }

  let damage = (atkStat / defStat) * move.power * effStab * typeEff;

  // OUTGOING modifiers (boost danno dell'attaccante)
  if (atkPassive) {
    const m = atkPassive.meta;
    if (m.kind === 'type_boost'       && m.type  === move.type)               damage *= (m.mult ?? 1);
    if (m.kind === 'type_boost_multi' && (m.types ?? []).includes(move.type)) damage *= (m.mult ?? 1);
    if (m.kind === 'base_move_boost'  && !move.isFinisher)                    damage *= (m.mult ?? 1);
    if (m.kind === 'finisher_boost'   &&  move.isFinisher)                    damage *= (m.mult ?? 1);
  }

  // INCOMING modifiers (resistenze del difensore)
  if (defPassive) {
    const m = defPassive.meta;
    if (m.kind === 'type_resist' && (m.types ?? []).includes(move.type))      damage *= (m.mult ?? 1);
    if (m.kind === 'cat_resist'  &&  m.cat === move.cat)                      damage *= (m.mult ?? 1);
    if (m.kind === 'first_hit_resist' && opts.isFullHP)                       damage *= (1 - (m.amount ?? 0));
  }

  return {
    damage:   Math.max(1, Math.round(damage)),
    typeEff,
    stab:     effStab > 1,
    moveType: move.type,
    category: move.cat,
    atkPassive: atkPassive?.name ?? null,
    defPassive: defPassive?.name ?? null,
  };
}

/** True se la passiva del difensore rende il Pokemon immune a questa mossa. */
function isImmune(meta, move) {
  if (!meta || meta.kind !== 'immune') return false;
  if ((meta.types ?? []).includes(move.type)) return true;
  return false;
}

/** Restituisce la passiva di un Pokemon SE attiva nella slot corrente. */
function getActivePassive(pkmn, slotKey) {
  if (!pkmn || !slotKey) return null;
  const p = getPassive(pkmn.id);
  if (!p) return null;
  if (!p.activeSlots.includes(slotKey)) return null;
  return p;
}

export function calcDirectDamage(attacker, move) {
  if (move.cat === 'status' || move.power === 0) return 0;
  const atkS = getScaledStats(attacker);
  const atkStat = move.cat === 'physical' ? atkS.atk : atkS.spAtk;
  return Math.max(1, Math.round((atkStat / 100) * DIRECT_BASE_POWER));
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
        // Calcolo passive-aware: serve sapere se il bersaglio è a HP pieno
        // (per Multiscaglia) e gli slot di entrambi
        const maxHPDef  = getScaledStats(target.pkmn).hp;
        const prevHP    = getHP(defSide, target.pkmn.id, maxHPDef);
        const isFullHP  = prevHP >= maxHPDef;
        const res       = calcDamage(attacker, move, target.pkmn, {
          attackerSlot: slotKey,
          defenderSlot: target.slotKey,
          isFullHP,
        });
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
          targetMaxHP:   maxHPDef,
          targetDied:    newHP === 0,
          // Marker per eventuale animazione/log dedicato
          atkPassive:    res.atkPassive,
          defPassive:    res.defPassive,
          immuneByPassive: res.immuneByPassive ?? null,
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
