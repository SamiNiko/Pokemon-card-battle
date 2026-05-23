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

  // ENDURE_ONCE (Vigore): se il danno ucciderebbe e il difensore non ha ancora
  // attivato questa passiva, taglia il danno per lasciare 1 HP e marca usata.
  let finalDamage = Math.max(1, Math.round(damage));
  let enduredByPassive = null;
  const prevHP = opts.prevHP ?? null;
  const endureUsedSet = opts.endureUsedSet ?? null;
  if (defPassive?.meta?.kind === 'endure_once'
      && prevHP != null
      && finalDamage >= prevHP
      && endureUsedSet && !endureUsedSet.has(defender.id)) {
    finalDamage = Math.max(0, prevHP - 1);   // lascia esattamente 1 HP
    endureUsedSet.add(defender.id);
    enduredByPassive = defPassive.name;
  }

  return {
    damage:   finalDamage,
    typeEff,
    stab:     effStab > 1,
    moveType: move.type,
    category: move.cat,
    atkPassive: atkPassive?.name ?? null,
    defPassive: defPassive?.name ?? null,
    enduredByPassive,
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
  passiveState,
}) {
  const pHP   = new Map(playerPkmnHP);
  const eHP   = new Map(enemyPkmnHP);
  const pPP   = new Map(playerPkmnPP);
  const ePP   = new Map(enemyPkmnPP);
  const pDead = new Set(playerDeadIds);
  const eDead = new Set(enemyDeadIds);

  // Stato passive cross-turn (mutato dentro resolveTurn).
  //   endureUsed  : Set<pokemonId> (player + enemy uniti — gli ID Pokémon sono distinti tra owned)
  //   speedStacks : Map<`${side}:${pokemonId}`, stacks>
  const ps = passiveState ?? {};
  if (!ps.endureUsed)  ps.endureUsed  = new Set();
  if (!ps.speedStacks) ps.speedStacks = new Map();

  const hp     = { player: playerHP, enemy: enemyHP };
  const events = [];

  const moveCtx = { movesets, selectedMoves, enemySelectedMoves, playerPkmnPP: pPP, enemyPkmnPP: ePP };

  const getHP    = (side, id, base) => (side === 'player' ? pHP : eHP).get(id) ?? base;
  const setHP    = (side, id, val)  => (side === 'player' ? pHP : eHP).set(id, val);
  const getPP    = (side, id)       => ((side === 'player' ? pPP : ePP).get(id) ?? 0);
  const setPP    = (side, id, val)  => (side === 'player' ? pPP : ePP).set(id, Math.max(0, val));
  const isDead   = (side, id)       =>  side === 'player' ? pDead.has(id) : eDead.has(id);
  const markDead = (side, id)       => (side === 'player' ? pDead : eDead).add(id);
  const speedKey = (side, id)       => `${side}:${id}`;

  const aliveEntries = (field, side) =>
    [...field.entries()].filter(([, p]) => !isDead(side, p.id));

  const playerAlive = aliveEntries(playerField, 'player');
  const enemyAlive  = aliveEntries(enemyField,  'enemy');

  // ---- SPEED con stacking da Velocitàscatto -----------------------------
  // La velocità "effettiva" di un Pokemon è: base.speed * (1 + 0.15 * stacks).
  // stacks è 0 al primo turno e cresce a fine turno se la passiva è attiva.
  function effectiveSpeed(side, slotKey, p) {
    const base = p.stats.speed ?? 0;
    const stacks = ps.speedStacks.get(speedKey(side, p.id)) ?? 0;
    const pass = getActivePassive(p, slotKey);
    const per  = pass?.meta?.kind === 'speed_stack' ? (pass.meta.percent ?? 0) : 0;
    return base * (1 + per * stacks);
  }

  const playerSpeed = playerAlive.reduce((s, [k, p]) => s + effectiveSpeed('player', k, p), 0);
  const enemySpeed  = enemyAlive .reduce((s, [k, p]) => s + effectiveSpeed('enemy',  k, p), 0);
  const firstTeam   = playerSpeed >= enemySpeed ? 'player' : 'enemy';

  events.push({ type: 'speed_check', playerSpeed, enemySpeed, first: firstTeam });

  const playerOrder = [...playerAlive].sort(([ka, a], [kb, b]) =>
    effectiveSpeed('player', kb, b) - effectiveSpeed('player', ka, a));
  const enemyOrder  = [...enemyAlive ].sort(([ka, a], [kb, b]) =>
    effectiveSpeed('enemy',  kb, b) - effectiveSpeed('enemy',  ka, a));

  function findTarget(field, col, defSide) {
    for (const row of ROWS) {
      const key  = `${row}-${col}`;
      const pkmn = field.get(key);
      if (pkmn && !isDead(defSide, pkmn.id)) return { slotKey: key, pkmn };
    }
    return null;
  }

  /* Calcola la variazione di PP per l'attaccante dopo un colpo a segno.
     -3 se finisher (costo). +1 se mossa base e colpisce. Modificato da
     passive del difensore:
       - pp_block_chance (Statico): RNG, può azzerare il +1 di gain
       - extra_pp_cost (Pressione): -1 PP extra (= netto 0 invece di +1)
     IMPORTANTE: il finisher NON genera PP anche se colpisce. È una mossa
     'spesa', non deve auto-finanziarsi nel turno successivo. */
  function computePPDelta(move, isFinisher, defenderPassive, hitLanded, ppEvents) {
    let delta = 0;
    if (isFinisher) delta -= 3;
    if (!hitLanded) return { delta, ppBlocked: null, extraCost: null };
    // Finisher: niente PP gain, anche su colpo a segno.
    if (isFinisher) return { delta, ppBlocked: null, extraCost: null };

    let ppGain = 1;
    let blocked = null;
    let extra   = null;
    if (defenderPassive) {
      const m = defenderPassive.meta;
      if (m.kind === 'pp_block_chance' && Math.random() < (m.chance ?? 0)) {
        ppGain = 0;
        blocked = defenderPassive.name;
      }
      if (m.kind === 'extra_pp_cost') {
        ppGain -= (m.amount ?? 1);
        extra = defenderPassive.name;
      }
    }
    delta += ppGain;
    return { delta, ppBlocked: blocked, extraCost: extra };
  }

  // Tracking: chi è andato a 0 HP per primo nel turno. Permette di
  // emettere il 'team_defeated' una volta sola e di sapere il vincitore.
  const teamDefeatedRegistered = new Set();

  function doAttacks(attackers, defenderField, atkSide, defSide) {
    const isPlayer = atkSide === 'player';
    for (const [slotKey, attacker] of attackers) {
      if (isDead(atkSide, attacker.id)) continue;

      // STOP CONDITION: se il team avversario ha già perso (HP totale a 0),
      // non eseguire ulteriori attacchi. Lo stesso se il team attaccante ha
      // perso (un proprio attacco precedente ha generato direct_damage che
      // poi è tornato indietro? scenario edge, ma copertura).
      // Questo previene il caso "io porto enemy a 0 e poi enemy attacca
      // ancora e mi porta a 0": dopo il colpo decisivo il turno si ferma.
      if (hp[defSide] <= 0 || hp[atkSide] <= 0) break;

      const move   = resolveMove(attacker, isPlayer, moveCtx);
      const col    = slotKey.split('-')[1];
      const target = findTarget(defenderField, col, defSide);

      if (target) {
        // Calcolo passive-aware: serve sapere se il bersaglio è a HP pieno
        // (per Multiscaglia) e gli slot di entrambi. PrevHP + endureUsedSet
        // servono a Vigore per "endure_once" (sopravvive a 1 HP una volta).
        const maxHPDef  = getScaledStats(target.pkmn).hp;
        const prevHP    = getHP(defSide, target.pkmn.id, maxHPDef);
        const isFullHP  = prevHP >= maxHPDef;
        const res       = calcDamage(attacker, move, target.pkmn, {
          attackerSlot: slotKey,
          defenderSlot: target.slotKey,
          isFullHP,
          prevHP,
          endureUsedSet: ps.endureUsed,
        });
        const newHP  = Math.max(0, prevHP - res.damage);
        setHP(defSide, target.pkmn.id, newHP);
        if (newHP === 0) markDead(defSide, target.pkmn.id);

        // PP delta: gain/loss in base a passive del difensore
        const defPass = getActivePassive(target.pkmn, target.slotKey);
        const hitLanded = res.typeEff > 0 && !res.immuneByPassive;
        const ppRes = computePPDelta(move, move.isFinisher, defPass, hitLanded, events);
        setPP(atkSide, attacker.id, getPP(atkSide, attacker.id) + ppRes.delta);

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
          enduredByPassive: res.enduredByPassive ?? null,
          ppDelta:         ppRes.delta,
          ppBlockedBy:     ppRes.ppBlocked,
          ppExtraCostBy:   ppRes.extraCost,
          ppAfter:         getPP(atkSide, attacker.id),
        });
      } else {
        const dmg = calcDirectDamage(attacker, move);
        const prevTeamHP = hp[defSide];
        hp[defSide] = Math.max(0, hp[defSide] - dmg);

        // PP gain (nessun difensore → nessuna passiva incoming, ma il costo
        // del finisher si applica comunque)
        let delta = 0;
        if (move.isFinisher) delta -= 3;
        delta += 1;   // hit a segno (danno diretto è sempre "land")
        setPP(atkSide, attacker.id, getPP(atkSide, attacker.id) + delta);

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
          ppDelta:      delta,
          ppAfter:      getPP(atkSide, attacker.id),
        });

        // Se questo colpo ha portato il team avversario a 0 HP, registralo
        // come evento "team_defeated" UNA SOLA VOLTA. Battle.js lo userà
        // per assegnare la vittoria a chi è arrivato a 0 per primo.
        if (prevTeamHP > 0 && hp[defSide] <= 0 && !teamDefeatedRegistered.has(defSide)) {
          teamDefeatedRegistered.add(defSide);
          events.push({ type: 'team_defeated', side: defSide });
        }
      }
    }
  }

  // Esegui i due round di attacchi nell'ordine deciso dalla speed.
  // CRUCIALE: prima del 2° round, controlla se il 1° team ha già
  // azzerato gli HP avversari → in tal caso il secondo team NON attacca.
  // Questo è il bug del "turno simultaneo" segnalato dall'utente.
  if (firstTeam === 'player') {
    doAttacks(playerOrder, enemyField,  'player', 'enemy');
    if (hp.enemy > 0 && hp.player > 0) {
      doAttacks(enemyOrder,  playerField, 'enemy',  'player');
    }
  } else {
    doAttacks(enemyOrder,  playerField, 'enemy',  'player');
    if (hp.enemy > 0 && hp.player > 0) {
      doAttacks(playerOrder, enemyField,  'player', 'enemy');
    }
  }

  // ---- HOOK FINE TURNO: REGEN (Rigenerazione) ----
  // Per ogni Pokémon ancora vivo, se ha 'regen' attivo nella sua slot,
  // recupera percent% degli HP massimi.
  function applyRegen(field, side) {
    for (const [slotKey, p] of field.entries()) {
      if (isDead(side, p.id)) continue;
      const pass = getActivePassive(p, slotKey);
      if (!pass || pass.meta.kind !== 'regen') continue;
      if ((pass.meta.when ?? 'turn_end') !== 'turn_end') continue;
      const maxHP = getScaledStats(p).hp;
      const cur   = getHP(side, p.id, maxHP);
      if (cur <= 0) continue;
      const heal  = Math.round(maxHP * (pass.meta.percent ?? 0));
      const next  = Math.min(maxHP, cur + heal);
      if (next === cur) continue;
      setHP(side, p.id, next);
      events.push({
        type:        'regen',
        side, slotKey,
        pokemonId:   p.id,
        passiveName: pass.name,
        healed:      next - cur,
        hpAfter:     next,
        maxHP,
      });
    }
  }
  applyRegen(playerField, 'player');
  applyRegen(enemyField,  'enemy');

  // ---- HOOK FINE TURNO: SPEED STACK (Velocitàscatto) ----
  // Per ogni Pokemon ancora vivo con speed_stack attivo, +1 stack (cap a max_stacks).
  function bumpSpeedStacks(field, side) {
    for (const [slotKey, p] of field.entries()) {
      if (isDead(side, p.id)) continue;
      const pass = getActivePassive(p, slotKey);
      if (!pass || pass.meta.kind !== 'speed_stack') continue;
      const key  = speedKey(side, p.id);
      const cur  = ps.speedStacks.get(key) ?? 0;
      const max  = pass.meta.max_stacks ?? 4;
      if (cur >= max) continue;
      ps.speedStacks.set(key, cur + 1);
      events.push({
        type:        'speed_stack',
        side, slotKey,
        pokemonId:   p.id,
        passiveName: pass.name,
        stacks:      cur + 1,
        maxStacks:   max,
      });
    }
  }
  bumpSpeedStacks(playerField, 'player');
  bumpSpeedStacks(enemyField,  'enemy');

  // Aggiorna le mappe HP/PP del chiamante (battle.js) dopo i mutated locali.
  // Le mappe in input sono _copiate_ all'inizio di resolveTurn, quindi
  // ritorniamo i nuovi stati. battle.js leggera' i delta dai single event,
  // ma esponiamo anche un updatedState per i casi (regen/speed_stack).
  events.push({
    type: 'turn_end',
    playerHP: hp.player,
    enemyHP:  hp.enemy,
    updatedPlayerPkmnHP: pHP,
    updatedEnemyPkmnHP:  eHP,
    updatedPlayerPkmnPP: pPP,
    updatedEnemyPkmnPP:  ePP,
  });

  return events;
}
