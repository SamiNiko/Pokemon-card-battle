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

/* ============================================================
   RNG DETERMINISTICO (per PvP)
   ============================================================
   Math.random() chiamato indipendentemente sui due client diverge
   immediatamente → desync. In PvP entrambi i client conoscono
   matchId e turno: derivo un seed da quei due valori, costruisco
   un Mulberry32, lo passo in resolveTurn. Stesso seed → stessa
   sequenza di numeri → stesso esito.

   Per AI/Trainer/Tutorial (single-player) si usa Math.random e
   bona — non c'è niente da sincronizzare.
   ============================================================ */
function _hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function _mulberry32(seed) {
  let st = seed >>> 0;
  return function rng() {
    st = (st + 0x6D2B79F5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}
/** Crea un RNG deterministico da matchId + turno. Da usare in PvP. */
export function makeDeterministicRng(matchId, turn) {
  return _mulberry32(_hashString(`${matchId}:${turn}`));
}

/* ============================================================
   HELD ITEMS — effetti in battaglia
   ============================================================
   Gli oggetti tenuti modificano stat, danno e HP. Sono applicati
   qui nel motore (sorgente di verità deterministica). La mappa
   held è { pokemonId → itemObject } passata da battle.js.

   Categorie di effetto:
     - STAT     : modificano le stat effettive (applyItemStats)
     - OUT_MULT : moltiplicano il danno inflitto (itemOutgoingMult)
     - IN_MULT  : moltiplicano il danno subito (itemIncomingMult)
     - HOOK     : effetti a evento (heal, reflect, self-damage, regen)
   Il LOCK dei Choice item è UI-side (battle.js), qui applichiamo
   solo i loro boost di stat.
   ============================================================ */

/** Applica i modificatori di STAT di un oggetto sulle stat scalate.
 *  ctx: { hpFrac, isFrontline, isFirstTurnIn } — condizioni contestuali. */
function applyItemStats(s, item, ctx = {}) {
  if (!item) return s;
  const out = { ...s };
  switch (item.id) {
    case 'bendascelta':    out.atk   = Math.round(out.atk   * 1.25); break;  // +25% ATK
    case 'lentiscelta':    out.spAtk = Math.round(out.spAtk * 1.25); break;  // +25% SP.ATK
    case 'stolascelta':    out.speed += 30; break;                            // +30 VEL
    case 'ancora-pesante': out.def   = Math.round(out.def * 1.20); out.speed = Math.max(0, out.speed - 15); break;
    case 'corpetto-assalto': if (ctx.isFrontline) out.spDef = Math.round(out.spDef * 1.15); break;
    case 'turbo-booster':  if (ctx.isFirstTurnIn) out.speed += 40; break;
    case 'metalpolvere':   out.def   = Math.round(out.def   * 2); break;     // Ditto
    case 'velopolvere':    out.speed = Math.round(out.speed * 2); break;     // Ditto
    case 'osso-spesso':    out.atk   = Math.round(out.atk   * 2); break;     // Cubone/Marowak
    case 'elettropalla':   out.atk = Math.round(out.atk * 2); out.spAtk = Math.round(out.spAtk * 2); break; // Pikachu
  }
  // Bacche: si attivano quando gli HP sono sotto il 35%.
  if (ctx.hpFrac != null && ctx.hpFrac < 0.35) {
    if (item.id === 'baccasalak')  out.speed += 25;
    if (item.id === 'baccalici')   out.atk   = Math.round(out.atk   * 1.20);
    if (item.id === 'baccapitaya') out.spAtk = Math.round(out.spAtk * 1.20);
  }
  return out;
}

/** Moltiplicatore del danno INFLITTO dall'attaccante per via dell'oggetto. */
function itemOutgoingMult(item, move, ctx = {}) {
  if (!item) return 1;
  let m = 1;
  if (item.boostType && move.type === item.boostType)        m *= 1.15;  // potenziamenti tipo (18)
  if (item.id === 'assorbisfera')                            m *= 1.20;  // +20% danno (e -5% HP, hook)
  if (item.id === 'cristallo-finisher' && move.isFinisher)   m *= 1.25;  // finisher +25%
  if (item.id === 'distortozona' && ctx.isSlowest)           m *= 1.20;  // se più lento in campo
  return m;
}

/** Moltiplicatore del danno SUBITO dal difensore per via dell'oggetto. */
function itemIncomingMult(item, move, ctx = {}) {
  if (!item) return 1;
  // Scudo Riflesso: la PRIMA mossa speciale subita ogni turno → metà danno.
  if (item.id === 'scudo-riflesso' && move.cat === 'special' && ctx.firstSpecialThisTurn) return 0.5;
  return 1;
}

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

  // Stats SCALATE per rarità + item + eventuale boost ATK / debuff DEF (Ultrapotenza).
  // Gli oggetti modificano le stat effettive prima del calcolo.
  const atkItem = opts.attackerItem ?? null;
  const defItem = opts.defenderItem ?? null;
  const atkS = applyItemStats(getScaledStats(attacker), atkItem, { hpFrac: opts.attackerHPFrac });
  const defS = applyItemStats(getScaledStats(defender), defItem, { isFrontline: opts.defenderIsFrontline });
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
  // OUTGOING item (potenziamenti tipo, assorbisfera, cristallo finisher, distortozona)
  damage *= itemOutgoingMult(atkItem, move, { isSlowest: opts.attackerIsSlowest });

  // INCOMING modifiers (resistenze del difensore)
  if (defPassive) {
    const m = defPassive.meta;
    if (m.kind === 'type_resist' && (m.types ?? []).includes(move.type))      damage *= (m.mult ?? 1);
    if (m.kind === 'cat_resist'  &&  m.cat === move.cat)                      damage *= (m.mult ?? 1);
    if (m.kind === 'first_hit_resist' && opts.isFullHP)                       damage *= (1 - (m.amount ?? 0));
  }
  // INCOMING item (scudo riflesso)
  damage *= itemIncomingMult(defItem, move, { firstSpecialThisTurn: opts.firstSpecialThisTurn });

  // ENDURE_ONCE (Vigore): se il danno ucciderebbe e il difensore non ha ancora
  // attivato questa passiva, taglia il danno per lasciare 1 HP e marca usata.
  let finalDamage = Math.max(1, Math.round(damage));
  let enduredByPassive = null;
  let survivedByItem = null;
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

  // FOCALNASTRO: se il difensore era a HP PIENI e il colpo lo ucciderebbe,
  // sopravvive con 1 HP. Diversamente da Vigore non ha limite d'uso, ma
  // richiede HP pieni all'impatto.
  if (defItem?.id === 'focalnastro' && !enduredByPassive
      && prevHP != null && opts.isFullHP && finalDamage >= prevHP) {
    finalDamage = Math.max(0, prevHP - 1);
    survivedByItem = defItem.name;
  }

  // BITORZOLELMO: riflette il 12% del danno FISICO subito all'attaccante.
  let reflectDamage = 0;
  if (defItem?.id === 'bitorzolelmo' && move.cat === 'physical' && finalDamage > 0) {
    reflectDamage = Math.max(1, Math.round(finalDamage * 0.12));
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
    survivedByItem,
    reflectDamage,
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
  playerHeld, enemyHeld,
  rng,
}) {
  // RNG: in PvP arriva un Mulberry32 seedato (matchId+turno) → entrambi i
  // client tirano la stessa sequenza. Senza rng usiamo Math.random (single
  // player: AI/Trainer/Tutorial, dove non c'è nulla da sincronizzare).
  const _rand = typeof rng === 'function' ? rng : Math.random;
  const pHP   = new Map(playerPkmnHP);
  const eHP   = new Map(enemyPkmnHP);
  const pPP   = new Map(playerPkmnPP);
  const ePP   = new Map(enemyPkmnPP);
  const pDead = new Set(playerDeadIds);
  const eDead = new Set(enemyDeadIds);

  // Oggetti tenuti (Map pokemonId → item). Vuoti se non passati.
  const pHeld = playerHeld ?? new Map();
  const eHeld = enemyHeld  ?? new Map();
  const heldFor = (side, id) => (side === 'player' ? pHeld : eHeld).get(id) ?? null;

  // Stato passive/item cross-turn (mutato dentro resolveTurn).
  //   endureUsed  : Set<pokemonId> già "salvati" da Vigore (endure_once)
  //   speedStacks : Map<`${side}:${pokemonId}`, stacks> per Velocitàscatto
  //   fieldSeen   : Set<`${side}:${pokemonId}`> per Turbo Booster (primo turno in campo)
  //   ppHitCount  : Map<`${side}:${pokemonId}`, n> per Amplificatore PP
  const ps = passiveState ?? {};
  if (!ps.endureUsed)  ps.endureUsed  = new Set();
  if (!ps.speedStacks) ps.speedStacks = new Map();
  if (!ps.fieldSeen)   ps.fieldSeen   = new Set();
  if (!ps.ppHitCount)  ps.ppHitCount  = new Map();

  const hp     = { player: playerHP, enemy: enemyHP };
  const events = [];

  // Set per Scudo Riflesso: difensori che hanno già subito la loro PRIMA
  // mossa speciale in QUESTO turno (la prima dimezza, le successive no).
  const firstSpecialUsed = new Set();   // chiavi `${side}:${id}`

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
    let spd = base * (1 + per * stacks);
    // Modificatori di velocità da oggetto (stolascelta, ancora-pesante,
    // turbo-booster, velopolvere, baccasalak su HP bassi).
    const item = heldFor(side, p.id);
    if (item) {
      const maxHP        = getScaledStats(p).hp || 1;
      const hpFrac       = getHP(side, p.id, maxHP) / maxHP;
      const isFirstTurnIn = !ps.fieldSeen.has(speedKey(side, p.id));
      spd = applyItemStats({ atk: 0, spAtk: 0, def: 0, spDef: 0, speed: spd },
                           item, { hpFrac, isFirstTurnIn }).speed;
    }
    return spd;
  }

  const playerSpeed = playerAlive.reduce((s, [k, p]) => s + effectiveSpeed('player', k, p), 0);
  const enemySpeed  = enemyAlive .reduce((s, [k, p]) => s + effectiveSpeed('enemy',  k, p), 0);
  const firstTeam   = playerSpeed >= enemySpeed ? 'player' : 'enemy';

  events.push({ type: 'speed_check', playerSpeed, enemySpeed, first: firstTeam });

  const playerOrder = [...playerAlive].sort(([ka, a], [kb, b]) =>
    effectiveSpeed('player', kb, b) - effectiveSpeed('player', ka, a));
  const enemyOrder  = [...enemyAlive ].sort(([ka, a], [kb, b]) =>
    effectiveSpeed('enemy',  kb, b) - effectiveSpeed('enemy',  ka, a));

  // Velocità minima in campo (per Distortozona): il Pokémon il cui speed
  // effettivo è il minimo tra TUTTI i vivi in campo prende il bonus danno.
  const allSpeeds = [
    ...playerAlive.map(([k, p]) => effectiveSpeed('player', k, p)),
    ...enemyAlive .map(([k, p]) => effectiveSpeed('enemy',  k, p)),
  ];
  const minFieldSpeed = allSpeeds.length ? Math.min(...allSpeeds) : 0;

  // Marca i Pokémon come "visti in campo" (Turbo Booster non ri-scatta).
  for (const [k, p] of [...playerAlive]) ps.fieldSeen.add(speedKey('player', p.id));
  for (const [k, p] of [...enemyAlive])  ps.fieldSeen.add(speedKey('enemy',  p.id));

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
      if (m.kind === 'pp_block_chance' && _rand() < (m.chance ?? 0)) {
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

        // ---- Contesto OGGETTI ----
        const atkItem  = heldFor(atkSide, attacker.id);
        const defItem  = heldFor(defSide, target.pkmn.id);
        const atkMaxHP = getScaledStats(attacker).hp || 1;
        const atkHPFrac = getHP(atkSide, attacker.id, atkMaxHP) / atkMaxHP;
        const defIsFrontline = target.slotKey.startsWith('front');
        const atkIsSlowest   = Math.abs(effectiveSpeed(atkSide, slotKey, attacker) - minFieldSpeed) < 0.001;
        // Scudo Riflesso: questa è la prima mossa speciale subita nel turno?
        const defKey = speedKey(defSide, target.pkmn.id);
        const firstSpecialThisTurn = move.cat === 'special'
          && defItem?.id === 'scudo-riflesso' && !firstSpecialUsed.has(defKey);
        if (firstSpecialThisTurn) firstSpecialUsed.add(defKey);

        const res       = calcDamage(attacker, move, target.pkmn, {
          attackerSlot: slotKey,
          defenderSlot: target.slotKey,
          isFullHP,
          prevHP,
          endureUsedSet: ps.endureUsed,
          attackerItem: atkItem,
          defenderItem: defItem,
          attackerHPFrac: atkHPFrac,
          defenderIsFrontline: defIsFrontline,
          attackerIsSlowest: atkIsSlowest,
          firstSpecialThisTurn,
        });
        const newHP  = Math.max(0, prevHP - res.damage);
        setHP(defSide, target.pkmn.id, newHP);
        if (newHP === 0) markDead(defSide, target.pkmn.id);

        // PP delta: gain/loss in base a passive del difensore
        const defPass = getActivePassive(target.pkmn, target.slotKey);
        const hitLanded = res.typeEff > 0 && !res.immuneByPassive;
        const ppRes = computePPDelta(move, move.isFinisher, defPass, hitLanded, events);
        let ppTotal = ppRes.delta;
        // AMPLIFICATORE PP: ogni 2 colpi a segno → +1 PP bonus.
        let ppBonusItem = null;
        if (atkItem?.id === 'amplificatore-pp' && hitLanded && !move.isFinisher) {
          const k = speedKey(atkSide, attacker.id);
          const n = (ps.ppHitCount.get(k) ?? 0) + 1;
          ps.ppHitCount.set(k, n);
          if (n % 2 === 0) { ppTotal += 1; ppBonusItem = atkItem.name; }
        }
        setPP(atkSide, attacker.id, getPP(atkSide, attacker.id) + ppTotal);

        // ---- HOOK OGGETTI: heal / reflect / self-damage ----
        const itemEvents = [];

        // CONCHINELLA: l'attaccante recupera il 15% del danno inflitto.
        if (atkItem?.id === 'conchinella' && res.damage > 0) {
          const heal = Math.max(1, Math.round(res.damage * 0.15));
          const curA = getHP(atkSide, attacker.id, atkMaxHP);
          if (curA > 0) {
            const nextA = Math.min(atkMaxHP, curA + heal);
            if (nextA > curA) {
              setHP(atkSide, attacker.id, nextA);
              itemEvents.push({ type: 'item_heal', side: atkSide, pokemonId: attacker.id,
                itemName: atkItem.name, healed: nextA - curA, hpAfter: nextA, maxHP: atkMaxHP });
            }
          }
        }

        // ASSORBISFERA: dopo aver attaccato, l'attaccante perde il 5% degli HP max.
        if (atkItem?.id === 'assorbisfera') {
          const curA = getHP(atkSide, attacker.id, atkMaxHP);
          if (curA > 0) {
            const loss  = Math.max(1, Math.round(atkMaxHP * 0.05));
            const nextA = Math.max(0, curA - loss);
            setHP(atkSide, attacker.id, nextA);
            if (nextA === 0) markDead(atkSide, attacker.id);
            itemEvents.push({ type: 'item_recoil', side: atkSide, pokemonId: attacker.id,
              itemName: atkItem.name, lost: curA - nextA, hpAfter: nextA, maxHP: atkMaxHP });
          }
        }

        // BITORZOLELMO: riflette danno fisico all'attaccante.
        if (res.reflectDamage > 0) {
          const curA = getHP(atkSide, attacker.id, atkMaxHP);
          if (curA > 0) {
            const nextA = Math.max(0, curA - res.reflectDamage);
            setHP(atkSide, attacker.id, nextA);
            if (nextA === 0) markDead(atkSide, attacker.id);
            itemEvents.push({ type: 'item_reflect', side: atkSide, pokemonId: attacker.id,
              itemName: defItem?.name ?? 'Bitorzolelmo', damage: curA - nextA, hpAfter: nextA, maxHP: atkMaxHP });
          }
        }

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
          survivedByItem:   res.survivedByItem ?? null,
          ppDelta:         ppTotal,
          ppBlockedBy:     ppRes.ppBlocked,
          ppExtraCostBy:   ppRes.extraCost,
          ppBonusBy:       ppBonusItem,
          ppAfter:         getPP(atkSide, attacker.id),
        });
        // Eventi item DOPO l'attacco (così l'animazione del colpo va prima)
        for (const ie of itemEvents) events.push(ie);
      } else {
        const dmg = calcDirectDamage(attacker, move);
        const prevTeamHP = hp[defSide];
        hp[defSide] = Math.max(0, hp[defSide] - dmg);

        // PP gain (nessun difensore → nessuna passiva incoming, ma il costo
        // del finisher si applica comunque).
        // IMPORTANTE: il finisher NON genera PP anche a colpo a segno (vedi
        // commento simmetrico in computePPDelta sopra). Una mossa 'spesa'
        // non deve auto-finanziarsi.
        let delta = 0;
        if (move.isFinisher) delta -= 3;
        else delta += 1;   // base/auto: hit a segno → +1 (danno diretto è sempre "land")
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

  // ---- HOOK FINE TURNO: AVANZI (item) → +6% HP max ----
  function applyAvanzi(field, side) {
    for (const [slotKey, p] of field.entries()) {
      if (isDead(side, p.id)) continue;
      const item = heldFor(side, p.id);
      if (item?.id !== 'avanzi') continue;
      const maxHP = getScaledStats(p).hp;
      const cur   = getHP(side, p.id, maxHP);
      if (cur <= 0) continue;
      const heal  = Math.max(1, Math.round(maxHP * 0.06));
      const next  = Math.min(maxHP, cur + heal);
      if (next === cur) continue;
      setHP(side, p.id, next);
      events.push({
        type:      'item_heal',
        side,
        pokemonId: p.id,
        itemName:  item.name,
        healed:    next - cur,
        hpAfter:   next,
        maxHP,
      });
    }
  }
  applyAvanzi(playerField, 'player');
  applyAvanzi(enemyField,  'enemy');

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
