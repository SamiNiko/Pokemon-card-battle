/* ============================================================
   summon.js — gacha (4 tier + Star Rail reveal)
   ============================================================ */

// Cloud sync dinamico: se la CDN Supabase è bloccata, la pagina funziona lo stesso
import('./data/cloud-sync.js?v=3').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState, saveState }         from './data/state.js?v=3';
import { MOVESETS }                    from './data/movesets.js';
import { getSummonablePool, PULL_RATES, tierLabel } from './data/rarity.js';
import { typeLabel }                                from './data/types.js';

const $ = id => document.getElementById(id);

/* Sleep cancellabile: se l'utente preme Skip, tutti gli sleep risolvono
   immediatamente così le animazioni "saltano" al punto successivo. */
let pullSkipRequested = false;
const sleep = ms => new Promise(resolve => {
  if (pullSkipRequested) { resolve(); return; }
  const t = setTimeout(resolve, ms);
  const i = setInterval(() => {
    if (pullSkipRequested) {
      clearTimeout(t);
      clearInterval(i);
      resolve();
    }
  }, 30);
  setTimeout(() => clearInterval(i), ms + 100);
});

const COST_SINGLE = 160;
const COST_MULTI  = 1600;

/* ================================================================
   POOL — fonte di verità: js/data/rarity.js
   ================================================================
   Pool e probabilità sono importate. Il banner NON include i
   leggendari (esclusivi della storia).
*/
const BANNER_POOL = getSummonablePool();
const RATE_PCT    = PULL_RATES;   // { pseudo, epic, rare, uncommon, common }

const FEATURED_IDS = [94, 130, 149, 131]; // Gengar, Gyarados, Dragonite, Lapras

/* ================================================================
   GACHA LOGIC
   ================================================================ */

function weightedPull() {
  const r = Math.random() * 100;
  let acc = 0;
  let rarity;
  // Ordine dal più raro al più comune; cumula le probabilità
  if      ((acc += RATE_PCT.pseudo)   >= r) rarity = 'pseudo';
  else if ((acc += RATE_PCT.epic)     >= r) rarity = 'epic';
  else if ((acc += RATE_PCT.rare)     >= r) rarity = 'rare';
  else if ((acc += RATE_PCT.uncommon) >= r) rarity = 'uncommon';
  else                                       rarity = 'common';

  const pool = BANNER_POOL.filter(p => p.rarity === rarity);
  if (pool.length === 0) {
    // Fallback se un tier è vuoto (es. nessun pseudo definito)
    return BANNER_POOL[Math.floor(Math.random() * BANNER_POOL.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function doPulls(n) {
  const results = Array.from({ length: n }, weightedPull);
  // Garanzia ×10: almeno 1 ★★+ se non c'è nulla sopra comune
  if (n === 10 && results.every(r => r.rarity === 'common')) {
    const pool = BANNER_POOL.filter(p => p.rarity === 'uncommon');
    if (pool.length > 0) {
      results[Math.floor(Math.random() * 10)] = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  // Cloniamo le entry così possiamo arricchirle con la fakeout chain
  // senza mutare il pool del banner
  return results.map(r => ({ ...r, fakeoutChain: planRarityChain(r.rarity) }));
}

/* ================================================================
   FAKEOUT — pianifica la catena di rarità da mostrare per un drop
   ================================================================
   Se il drop è epic (4★) o pseudo (5★), c'è una % di chance di
   mostrare una rarità più bassa, fare una pausa di tensione, poi
   "upgradare" alla rarità superiore (anche più volte di seguito).
*/
const FAKEOUT = {
  pseudo: { chance: 0.25 },   // 25% sui 5★
  epic:   { chance: 0.20 },   // 20% sui 4★
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'pseudo'];

function planRarityChain(realRarity, forceFakeout = false) {
  const realIdx = RARITY_ORDER.indexOf(realRarity);
  const cfg = FAKEOUT[realRarity];
  if (!cfg) return [realRarity];
  if (!forceFakeout && Math.random() >= cfg.chance) return [realRarity];
  // Partenza random uniforme tra 'uncommon' (idx 1) e (realIdx - 1)
  const minStart = 1;
  const maxStart = realIdx - 1;
  const startIdx = minStart + Math.floor(Math.random() * (maxStart - minStart + 1));
  const chain = [];
  for (let i = startIdx; i <= realIdx; i++) chain.push(RARITY_ORDER[i]);
  return chain;
}

/* ================================================================
   STATO GIOCATORE
   ================================================================ */

let gs;

const getGems   = ()     => gs.gems ?? 0;
const setGems   = n      => { gs.gems = n; saveState(); updateWallet(); };
const spendGems = amount => setGems(Math.max(0, getGems() - amount));

function addToOwned(id) {
  if (!gs.owned.includes(id)) gs.owned.push(id);
  saveState();
}

function updateWallet() {
  $('walletGems').textContent = getGems();
  $('walletEuro').textContent = gs.pokeuro ?? 0;
}

/* ================================================================
   BANNER — sprite featured
   ================================================================ */

function buildBanner() {
  const container = $('bannerFeatured');
  container.innerHTML = '';

  const layout = [
    { right: '6%',  sz: '130px', dur: '5.5s', delay: '0s',    z: 4 },
    { right: '22%', sz: '108px', dur: '6.2s', delay: '-1.5s', z: 3 },
    { right: '36%', sz: '90px',  dur: '4.8s', delay: '-2.8s', z: 2 },
    { right: '48%', sz: '76px',  dur: '5.8s', delay: '-0.8s', z: 1 },
  ];

  FEATURED_IDS.forEach((id, i) => {
    const pkmn = findPokemon(id);
    if (!pkmn || !layout[i]) return;
    const l = layout[i];
    const wrap = document.createElement('div');
    wrap.className = 'banner__pkmn-slot';
    wrap.style.cssText = `right:${l.right};--sz:${l.sz};--dur:${l.dur};--delay:${l.delay};z-index:${l.z}`;
    wrap.innerHTML = `<img src="${pkmn.sprite.default}" alt="${pkmn.name}" />`;
    container.appendChild(wrap);
  });
}

/* ================================================================
   CONFIRM MODAL
   ================================================================ */

let pendingPullN = 0;

function showConfirm(n) {
  pendingPullN = n;
  const cost   = n === 1 ? COST_SINGLE : COST_MULTI;
  const after  = Math.max(0, getGems() - cost);

  $('confirmTitle').textContent   = `Summon ×${n}`;
  $('confirmCost').innerHTML      = `💎 ${cost} gemme`;
  $('confirmAfter').textContent   = `Dopo: ${after} gemme  (hai ${getGems()})`;
  $('confirmModal').classList.remove('hidden');
}

$('confirmCancel').addEventListener('click',   () => $('confirmModal').classList.add('hidden'));
$('confirmBackdrop').addEventListener('click', () => $('confirmModal').classList.add('hidden'));

$('confirmOk').addEventListener('click', async () => {
  $('confirmModal').classList.add('hidden');
  await handlePull(pendingPullN);
});

$('btnPull1').addEventListener('click', () => {
  if (getGems() < COST_SINGLE) { alert('Gemme insufficienti!'); return; }
  showConfirm(1);
});

$('btnPull10').addEventListener('click', () => {
  if (getGems() < COST_MULTI) { alert('Gemme insufficienti!'); return; }
  showConfirm(10);
});

/* ================================================================
   DEBUG — pull forzato per testare animazioni
   ================================================================ */

$('btnDebug3').addEventListener('click',       () => debugForcePull('rare'));
$('btnDebug4').addEventListener('click',       () => debugForcePull('epic'));
$('btnDebug5').addEventListener('click',       () => debugForcePull('pseudo'));
$('btnDebugFakeout').addEventListener('click', () => debugForcePull('pseudo', /* forceFakeout */ true));

async function debugForcePull(rarity, forceFakeout = false) {
  const pool = BANNER_POOL.filter(p => p.rarity === rarity);
  if (pool.length === 0) {
    alert(`Nessun Pokémon ${rarity} nel pool`);
    return;
  }
  // Clono l'entry e aggiungo la fakeoutChain (force o random secondo config)
  const raw   = pool[Math.floor(Math.random() * pool.length)];
  const entry = { ...raw, fakeoutChain: planRarityChain(raw.rarity, forceFakeout) };

  pullSkipRequested = false;

  // NB: non aggiunge al posseduti e non scala gemme — è solo per test animazioni
  pullAll   = [entry];
  pullQueue = [entry];

  $('pullOverlay').classList.remove('hidden');
  $('starsScreen').classList.add('hidden');
  $('revealScreen').classList.add('hidden');
  $('summaryScreen').classList.add('hidden');

  $('btnSkipPull').classList.remove('hidden');

  // Anche il debug pull passa per l'intro, così posso verificare l'animazione completa
  await summonIntro();
  if (pullSkipRequested) { showSummary(); return; }

  await showNextResult();
}

/* ================================================================
   SKIP & HOLD-TO-CHARGE GATE
   ================================================================ */

function handleSkipClick() {
  pullSkipRequested = true;
  // Rimuovo overlay effimeri (intro, pokéball stinger, gate)
  document.querySelectorAll('.summon-intro, .stinger-pokeball').forEach(el => el.remove());
  $('pullGate').classList.add('hidden');
  $('starsScreen').classList.add('hidden');
  $('starsScreen').classList.remove('is-fading-out');
  $('revealScreen').classList.add('hidden');
  showSummary();
}

$('btnSkipPull').addEventListener('click', handleSkipClick);

/* Hold-to-charge: l'utente tiene premuto sullo schermo per "caricare"
   il portale. Quando la barra è piena, la pull prosegue. Rilasciando
   prima del completo, la barra decade lentamente. */
async function pullGate() {
  return new Promise(resolve => {
    const gate = $('pullGate');
    const fill = gate.querySelector('.pull-gate__ring-fill');
    const CIRC = 339.292;          // 2π × 54 (raggio del cerchio in SVG)
    const HOLD_MS = 1200;          // tempo per riempire al massimo
    const DECAY_FACTOR = 1.6;      // decade più lentamente del riempimento

    gate.classList.remove('hidden');
    gate.classList.remove('is-holding');

    let holding   = false;
    let progress  = 0;
    let lastTs    = 0;
    let raf       = null;
    let completed = false;

    function update(ts) {
      if (completed || pullSkipRequested) { cleanup(); return; }

      const dt = lastTs ? Math.min(50, ts - lastTs) : 16;
      lastTs = ts;

      if (holding) {
        progress = Math.min(1, progress + dt / HOLD_MS);
      } else {
        progress = Math.max(0, progress - dt / (HOLD_MS * DECAY_FACTOR));
      }

      fill.style.strokeDashoffset = CIRC * (1 - progress);

      if (progress >= 1) {
        completed = true;
        cleanup();
        return;
      }
      raf = requestAnimationFrame(update);
    }

    function startHold(e) {
      e.preventDefault();
      if (!holding) {
        holding = true;
        gate.classList.add('is-holding');
      }
    }
    function endHold() {
      if (holding) {
        holding = false;
        gate.classList.remove('is-holding');
      }
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      gate.removeEventListener('mousedown',  startHold);
      gate.removeEventListener('touchstart', startHold);
      window.removeEventListener('mouseup',   endHold);
      window.removeEventListener('touchend',  endHold);
      window.removeEventListener('mouseleave', endHold);
      gate.classList.add('hidden');
      resolve();
    }

    gate.addEventListener('mousedown',  startHold);
    gate.addEventListener('touchstart', startHold, { passive: false });
    window.addEventListener('mouseup',  endHold);
    window.addEventListener('touchend', endHold);
    window.addEventListener('mouseleave', endHold);

    raf = requestAnimationFrame(update);
  });
}

/* ================================================================
   SUMMON INTRO — "portale che carica energia"
   Il tier (intensità) è determinato dalla massima rarità nel pull,
   senza rivelare quale né dove. Il giocatore intuisce ma non sa.
   ================================================================ */

async function summonIntro() {
  /* Determino il tier dell'intro dalla rarità VISIBILE (chain[0]) per non
     spoilerare il fakeout: se un pseudo è in fakeout da "uncommon",
     l'intro mostrerà tier 1 invece di tier 4. */
  const maxIdx = Math.max(0, ...pullAll.map(r => {
    const visible = (r.fakeoutChain && r.fakeoutChain[0]) || r.rarity;
    return RARITY_ORDER.indexOf(visible);
  }));
  let tier;
  if      (maxIdx <= 1) tier = 't1';   // common / uncommon → scintille leggere
  else if (maxIdx === 2) tier = 't2';  // rare              → energia
  else if (maxIdx === 3) tier = 't3';  // epic              → fulmini
  else                   tier = 't4';  // pseudo            → distorsione spazio

  const overlay = $('pullOverlay');
  const intro   = document.createElement('div');
  intro.className = `summon-intro summon-intro--${tier}`;
  intro.innerHTML = `
    <div class="summon-intro__bg"></div>
    <div class="summon-intro__distortion"></div>
    <div class="summon-intro__portal">
      <div class="summon-intro__portal-ring summon-intro__portal-ring--1"></div>
      <div class="summon-intro__portal-ring summon-intro__portal-ring--2"></div>
      <div class="summon-intro__portal-ring summon-intro__portal-ring--3"></div>
    </div>
    <div class="summon-intro__orbits"></div>
    <div class="summon-intro__lightning"></div>
    <div class="summon-intro__particles"></div>
    <div class="summon-intro__core"></div>
  `;
  overlay.appendChild(intro);

  /* Particelle che convergono — quantità scala col tier */
  const particleCounts = { t1: 16, t2: 26, t3: 40, t4: 56 };
  const particlesEl = intro.querySelector('.summon-intro__particles');
  for (let i = 0; i < particleCounts[tier]; i++) {
    const p = document.createElement('span');
    p.className = 'summon-intro__particle';
    const angle    = Math.random() * Math.PI * 2;
    const distance = 280 + Math.random() * 220;
    p.style.setProperty('--sx', `${Math.cos(angle) * distance}px`);
    p.style.setProperty('--sy', `${Math.sin(angle) * distance}px`);
    p.style.animationDelay = `${Math.random() * 0.55}s`;
    particlesEl.appendChild(p);
  }

  /* Sagome (carte) che orbitano: quantità scala col tier */
  const orbitCounts = { t1: 3, t2: 5, t3: 7, t4: 9 };
  const orbitsEl = intro.querySelector('.summon-intro__orbits');
  const n = orbitCounts[tier];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span');
    c.className = 'summon-intro__orbit-card';
    c.style.setProperty('--orbit-angle', `${(i / n) * 360}deg`);
    c.style.animationDelay = `${i * 70}ms`;
    orbitsEl.appendChild(c);
  }

  /* Fulmini: solo tier 3 (epic) e tier 4 (pseudo) */
  if (tier === 't3' || tier === 't4') {
    const arcCount  = tier === 't3' ? 4 : 7;
    const lightning = intro.querySelector('.summon-intro__lightning');
    for (let i = 0; i < arcCount; i++) {
      const arc = document.createElement('span');
      arc.className = 'summon-intro__arc';
      arc.style.setProperty('--arc-angle', `${(i / arcCount) * 360 + Math.random() * 40}deg`);
      arc.style.animationDelay = `${700 + i * 90 + Math.random() * 60}ms`;
      lightning.appendChild(arc);
    }
  }

  void intro.offsetWidth;
  intro.classList.add('is-active');

  await sleep(1700);
  intro.remove();
}

/* ================================================================
   PULL FLOW
   ================================================================ */

let pullQueue = []; // risultati ancora da rivelare
let pullAll   = []; // tutti i risultati (per il riepilogo)

async function handlePull(n) {
  const cost = n === 1 ? COST_SINGLE : COST_MULTI;
  if (getGems() < cost) { alert('Gemme insufficienti!'); return; }

  pullSkipRequested = false;

  const results = doPulls(n);
  spendGems(cost);
  results.forEach(r => addToOwned(r.id));

  pullAll   = results;
  pullQueue = [...results];

  // Mostra overlay e nascondi tutti i sotto-schermi
  $('pullOverlay').classList.remove('hidden');
  $('starsScreen').classList.add('hidden');
  $('revealScreen').classList.add('hidden');
  $('summaryScreen').classList.add('hidden');

  // Skip disponibile per tutto il pull
  $('btnSkipPull').classList.remove('hidden');

  // Hold-to-charge gate solo per multi pull
  if (n >= 10) {
    await pullGate();
    if (pullSkipRequested) { showSummary(); return; }
  }

  // Intro "evocazione" — energia che si raccoglie, prima del primo reveal
  await summonIntro();
  if (pullSkipRequested) { showSummary(); return; }

  await showNextResult();
}

async function showNextResult() {
  if (pullSkipRequested || pullQueue.length === 0) {
    showSummary();
    return;
  }

  const entry = pullQueue.shift();

  if (entry.rarity === 'common') {
    // Comuni: mini bagliore (no stelle, no pokéball) → reveal
    await showCommonGlow();
    if (pullSkipRequested) { showSummary(); return; }
    await showReveal(entry);
  } else {
    // ★★ e oltre: prima stelle, poi reveal
    await showStars(entry);
  }
}

/* ---- Mini bagliore per i comuni (transizione card→card nella multi) ---- */

async function showCommonGlow() {
  if (pullSkipRequested) return;
  // Nascondi il reveal precedente PRIMA del bagliore, così non si vede
  // il Pokémon precedente trasparire sotto l'animazione
  $('revealScreen').classList.add('hidden');
  const overlay = $('pullOverlay');
  const glow = document.createElement('div');
  glow.className = 'common-glow';
  overlay.appendChild(glow);
  void glow.offsetWidth;
  glow.classList.add('is-active');
  await sleep(560);
  glow.remove();
}

/* ---- Stars Screen — sequenza cinematica ---- */

async function showStars(entry) {
  if (pullSkipRequested) return;

  const starsScreen = $('starsScreen');
  const nameEl      = $('starsName');
  $('starsRow').innerHTML = '';
  nameEl.textContent = '';
  nameEl.className   = 'stars-screen__name';

  // Pulisco residui di pull precedenti
  starsScreen.querySelectorAll(
    '.stars-screen__aurora, .stars-screen__beam, .cinematic-particle, .cinematic-ring'
  ).forEach(el => el.remove());

  $('revealScreen').classList.add('hidden');
  starsScreen.classList.remove('hidden');
  starsScreen.classList.remove('is-fading-out');

  // Catena rarità: [realRarity] se nessun fakeout, altrimenti es. ['rare','epic','pseudo']
  const chain = (entry.fakeoutChain && entry.fakeoutChain.length > 0)
              ? entry.fakeoutChain
              : [entry.rarity];

  /* === PRIMA TAPPA: anticipazione + stelle "normali" === */
  await playStarsStage(chain[0]);
  if (pullSkipRequested) return;

  /* === UPGRADE successivi (fakeout) === */
  for (let i = 1; i < chain.length; i++) {
    if (pullSkipRequested) return;
    await sleep(1000);                                   // pausa fra fakeout (+0.5s)
    if (pullSkipRequested) return;
    await playStarsUpgrade(chain[i - 1], chain[i]);
  }

  /* === Hold finale + stinger sulla rarità REALE === */
  if (pullSkipRequested) return;
  const finalRarity = chain[chain.length - 1];
  const holdMs = { pseudo: 1500, epic: 1200, rare: 900, uncommon: 600 }[finalRarity] ?? 600;
  await sleep(holdMs);

  starsScreen.classList.add('is-fading-out');
  await sleep(380);

  await stingerTransition(finalRarity, async () => {
    starsScreen.classList.add('hidden');
    starsScreen.classList.remove('is-fading-out');
    await showReveal(entry);
  });
}

/* ---- Helper: anticipazione + apparizione stelle per una rarità ---- */
async function playStarsStage(rarity) {
  const starsScreen = $('starsScreen');
  const starsRow    = $('starsRow');
  const starsCount  = { pseudo: 5, epic: 4, rare: 3, uncommon: 2 }[rarity] ?? 2;

  // Aurora di sfondo
  let aurora;
  if (rarity === 'rare' || rarity === 'epic' || rarity === 'pseudo') {
    aurora = document.createElement('div');
    aurora.className = `stars-screen__aurora stars-screen__aurora--${rarity}`;
    starsScreen.insertBefore(aurora, starsScreen.firstChild);
  }

  /* === PHASE 1 — Anticipazione === */
  if (rarity === 'pseudo') {
    const beam1 = document.createElement('div');
    beam1.className = 'stars-screen__beam stars-screen__beam--pseudo';
    starsScreen.appendChild(beam1);
    await sleep(80);
    beam1.classList.add('is-firing');
    await sleep(450);
    flashScreen('pseudo');
    shakeOverlay();
    await sleep(400);
    beam1.remove();
    aurora.classList.add('is-shown');
    await sleep(550);
  } else if (rarity === 'epic') {
    const beam = document.createElement('div');
    beam.className = 'stars-screen__beam';
    starsScreen.appendChild(beam);
    await sleep(60);
    beam.classList.add('is-firing');
    await sleep(600);
    flashScreen('epic');
    await sleep(400);
    beam.remove();
    aurora.classList.add('is-shown');
    await sleep(450);
  } else if (rarity === 'rare') {
    aurora.classList.add('is-shown');
    await sleep(450);
  } else if (rarity === 'uncommon') {
    await sleep(280);
  }

  /* === PHASE 2 — Stelle una alla volta === */
  const firstDelay = { pseudo: 900,  epic: 700, rare: 480, uncommon: 280 }[rarity] ?? 250;
  const nextDelay  = { pseudo: 1000, epic: 800, rare: 540, uncommon: 300 }[rarity] ?? 270;

  for (let i = 0; i < starsCount; i++) {
    if (pullSkipRequested) return;
    await sleep(i === 0 ? firstDelay : nextDelay);

    const s = document.createElement('span');
    s.className = `star-icon star-icon--${rarity}`;
    s.textContent = '★';
    starsRow.appendChild(s);
    s.getBoundingClientRect();
    s.classList.add('is-shown');

    if (rarity === 'rare' || rarity === 'epic' || rarity === 'pseudo') {
      spawnRing(s, rarity);
      const particles = { pseudo: 20, epic: 14, rare: 9 }[rarity] ?? 9;
      spawnParticles(s, rarity, particles);
      if (rarity === 'epic' || rarity === 'pseudo') {
        flashScreen(rarity);
        shakeOverlay();
      }
    }
  }
}

/* ---- Helper: upgrade fakeout — sospensione poi TUTTO INSIEME (sfondo, stelle, nuova) ---- */
async function playStarsUpgrade(fromRarity, toRarity) {
  const starsScreen = $('starsScreen');
  const starsRow    = $('starsRow');

  // 1) Segnale iniziale: solo flash + shake. Nessun cambio aurora/stelle qui.
  flashScreen(toRarity);
  shakeOverlay();

  // 2) SOSPENSIONE — silenzio teso. Lo sfondo è ancora quello "fake",
  //    le stelle sono ancora del colore vecchio. Tutto è fermo.
  if (pullSkipRequested) return;
  await sleep(900);
  if (pullSkipRequested) return;

  // 3) MOMENTO DEL REVEAL — TUTTO DI BOTTO in un solo frame:
  //    a) Aurora vecchia svanisce + nuova appare (cross-fade)
  //    b) Stelle esistenti cambiano colore + pulse
  //    c) Stella nuova viene aggiunta
  //    d) Flash + shake della rarità finale
  //    e) Ring + particelle

  // a) Aurora: cross-fade SIMULTANEO al pulse delle stelle
  starsScreen.querySelectorAll('.stars-screen__aurora').forEach(a => {
    a.classList.remove('is-shown');
    setTimeout(() => a.remove(), 700);
  });
  if (toRarity === 'rare' || toRarity === 'epic' || toRarity === 'pseudo') {
    const newAurora = document.createElement('div');
    newAurora.className = `stars-screen__aurora stars-screen__aurora--${toRarity}`;
    starsScreen.insertBefore(newAurora, starsScreen.firstChild);
    requestAnimationFrame(() => newAurora.classList.add('is-shown'));
  }

  // b) Stelle esistenti: cambio classe + pulse
  starsRow.querySelectorAll('.star-icon').forEach(el => {
    el.classList.remove(`star-icon--${fromRarity}`);
    el.classList.add(`star-icon--${toRarity}`);
    el.classList.remove('star-icon--upgraded');
    void el.offsetWidth;                              // reflow per re-trigger
    el.classList.add('star-icon--upgraded');
  });

  // c) Stella nuova — appare nello stesso frame
  const s = document.createElement('span');
  s.className = `star-icon star-icon--${toRarity}`;
  s.textContent = '★';
  starsRow.appendChild(s);
  s.getBoundingClientRect();
  s.classList.add('is-shown');

  // d/e) Effetti contestuali sulla stella nuova
  if (toRarity === 'rare' || toRarity === 'epic' || toRarity === 'pseudo') {
    spawnRing(s, toRarity);
    const particles = { pseudo: 22, epic: 16, rare: 11 }[toRarity] ?? 11;
    spawnParticles(s, toRarity, particles);
    if (toRarity === 'epic' || toRarity === 'pseudo') {
      flashScreen(toRarity);
      shakeOverlay();
    }
  }

  // 4) Aspetto che pulse (700ms) + star-appear (500ms) finiscano
  await sleep(750);
}

/* ---- Stinger transition (stile Twitch) ---- */

async function stingerTransition(rarity, switchSceneFn) {
  const overlay = $('pullOverlay');
  const stinger = document.createElement('div');
  stinger.className = `stinger-pokeball stinger-pokeball--${rarity}`;
  stinger.innerHTML = `
    <div class="pball__body">
      <div class="pball__top"></div>
      <div class="pball__bottom"></div>
      <div class="pball__band"></div>
      <div class="pball__button"></div>
    </div>
    <div class="pball__flash"></div>
  `;
  overlay.appendChild(stinger);
  void stinger.offsetWidth;

  /* FASE 1 — La pokéball appare al centro con bounce + wobble (~750ms) */
  stinger.classList.add('is-active');
  await sleep(750);

  /* FASE 2 — La pokéball si apre: due metà volano via, il bottone lampeggia,
     un'onda di luce esplode dal centro */
  stinger.classList.add('is-opening');
  await sleep(280);   // attesa fino al picco del flash (ball quasi sparita)

  /* A questo punto il flash copre il centro → cambio scena sotto */
  if (switchSceneFn) await switchSceneFn();

  /* FASE 3 — Il flash si espande oltre lo schermo e svanisce → reveal visibile */
  await sleep(620);

  stinger.remove();
}

/* ---- Helpers cinematici ---- */

function spawnParticles(originEl, rarity, count = 10) {
  const screen      = $('starsScreen');
  const screenRect  = screen.getBoundingClientRect();
  const r           = originEl.getBoundingClientRect();
  const cx          = r.left + r.width  / 2 - screenRect.left;
  const cy          = r.top  + r.height / 2 - screenRect.top;

  for (let i = 0; i < count; i++) {
    const p     = document.createElement('span');
    p.className = `cinematic-particle cinematic-particle--${rarity}`;
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist  = 60 + Math.random() * 90;
    p.style.left = `${cx}px`;
    p.style.top  = `${cy}px`;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    screen.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

function spawnRing(originEl, rarity) {
  const screen     = $('starsScreen');
  const screenRect = screen.getBoundingClientRect();
  const r          = originEl.getBoundingClientRect();
  const cx         = r.left + r.width  / 2 - screenRect.left;
  const cy         = r.top  + r.height / 2 - screenRect.top;

  const ring     = document.createElement('span');
  ring.className = `cinematic-ring cinematic-ring--${rarity}`;
  ring.style.left = `${cx}px`;
  ring.style.top  = `${cy}px`;
  screen.appendChild(ring);
  setTimeout(() => ring.remove(), 950);
}

function flashScreen(rarity) {
  const flash     = document.createElement('div');
  flash.className = `screen-flash screen-flash--${rarity}`;
  $('pullOverlay').appendChild(flash);
  void flash.offsetWidth;
  flash.classList.add('is-active');
  setTimeout(() => flash.remove(), 1000);
}

function shakeOverlay() {
  const ov = $('pullOverlay');
  ov.classList.remove('shake-epic');
  void ov.offsetWidth;
  ov.classList.add('shake-epic');
  setTimeout(() => ov.classList.remove('shake-epic'), 460);
}

/* ---- Reveal Screen ---- */

/* ---- Artwork loader: artwork dedicata se presente, altrimenti sprite ---- */
function getArtworkUrl(pkmn) {
  if (!pkmn) return '';
  const id3 = String(pkmn.id).padStart(3, '0');
  return `assets/cards/${id3}.png`;
}

async function showReveal(entry) {
  if (pullSkipRequested) return;
  const pkmn    = findPokemon(entry.id);
  const artwork = $('revealArtwork');
  const sprite  = $('revealSprite');
  const glow    = $('revealGlow');
  const right   = $('revealRight');
  const screen  = $('revealScreen');

  // Reset
  artwork.classList.remove('is-shown', 'is-missing');
  sprite.classList.remove('is-shown', 'reveal-screen__sprite--solo');
  glow.classList.remove('is-shown', 'is-pulsing--rare', 'is-pulsing--epic', 'is-pulsing--pseudo');
  screen.dataset.rarity = entry.rarity;

  if (pkmn) {
    // SPRITE (sempre, carica subito da PokéAPI cache)
    sprite.src = pkmn.sprite.default;
    sprite.alt = pkmn.name;

    // ARTWORK (può mancare → in tal caso sprite diventa "solo" e ingrandisce)
    artwork.alt = pkmn.name;
    artwork.onerror = () => {
      artwork.onerror = null;
      artwork.onload  = null;
      artwork.classList.add('is-missing');
      sprite.classList.add('reveal-screen__sprite--solo');
    };
    artwork.onload = () => {
      artwork.onerror = null;
      artwork.classList.remove('is-missing');
      sprite.classList.remove('reveal-screen__sprite--solo');
    };
    artwork.src = getArtworkUrl(pkmn);
  } else {
    artwork.src = '';
    sprite.src  = '';
  }

  // Glow colore per rarità
  const glowColors = {
    pseudo:   'radial-gradient(circle, rgba(94,232,216,0.7) 0%, rgba(255,102,204,0.4) 40%, transparent 75%)',
    epic:     'radial-gradient(circle, rgba(245,208,80,0.65) 0%, transparent 70%)',
    rare:     'radial-gradient(circle, rgba(200,168,255,0.55) 0%, transparent 70%)',
    uncommon: 'radial-gradient(circle, rgba(136,180,255,0.42) 0%, transparent 70%)',
    common:   'radial-gradient(circle, rgba(168,179,207,0.22) 0%, transparent 70%)',
  };
  glow.style.background = glowColors[entry.rarity] ?? glowColors.common;

  // Costruisce pannello dettagli
  right.innerHTML = buildDetailHTML(entry, pkmn);

  // Mostra la schermata
  screen.classList.remove('hidden');

  // Piccolo delay poi anima artwork + sprite + glow
  await sleep(60);
  artwork.classList.add('is-shown');
  sprite.classList.add('is-shown');
  glow.classList.add('is-shown');
  if      (entry.rarity === 'pseudo') glow.classList.add('is-pulsing--pseudo');
  else if (entry.rarity === 'epic')   glow.classList.add('is-pulsing--epic');
  else if (entry.rarity === 'rare')   glow.classList.add('is-pulsing--rare');

  // Anima le barre stat dopo che lo sprite è comparso
  await sleep(380);
  right.querySelectorAll('.detail-stat__bar').forEach(bar => {
    const val = parseInt(bar.dataset.val ?? '0', 10);
    bar.style.width = `${Math.min(100, (val / 250) * 100)}%`;
  });
}

/* Costruisce HTML del pannello dettagli */
function buildDetailHTML(entry, pkmn) {
  if (!pkmn) return `<p style="color:var(--text-muted);font-size:0.85rem">Dati non disponibili</p>`;

  const starsStr    = { pseudo: '★★★★★', epic: '★★★★', rare: '★★★', uncommon: '★★', common: '★' }[entry.rarity];
  const rarityLabel = { pseudo: 'Pseudo Leggendario', epic: 'Epico', rare: 'Raro', uncommon: 'Non Comune', common: 'Comune' }[entry.rarity];

  const typeColors = {
    normal:'#a8a878', fire:'#f08030',   water:'#6890f0',  grass:'#78c850',
    electric:'#f8d030', ice:'#98d8d8', fighting:'#c03028', poison:'#a040a0',
    ground:'#e0c068', flying:'#a890f0', psychic:'#f85888', bug:'#a8b820',
    rock:'#b8a038',   ghost:'#705898',  dragon:'#7038f8',  dark:'#705848',
    steel:'#b8b8d0',  fairy:'#ee99ac',
  };

  const typeBadges = (pkmn.types ?? []).map(t =>
    `<span class="detail-type-badge" style="background:${typeColors[t] ?? '#888'}">${typeLabel(t)}</span>`
  ).join('');

  const s = pkmn.stats ?? {};
  const statRows = [
    { label: 'HP',   val: s.hp    ?? 0 },
    { label: 'ATK',  val: s.atk   ?? 0 },
    { label: 'DEF',  val: s.def   ?? 0 },
    { label: 'SP.A', val: s.spAtk ?? 0 },
    { label: 'VEL',  val: s.speed ?? 0 },
  ].map(({ label, val }) => {
    const barColor = val >= 110 ? '#f5d050' : val >= 80 ? '#78c850' : val >= 50 ? '#6890f0' : '#a8b3cf';
    return `
      <div class="detail-stat">
        <span class="detail-stat__label">${label}</span>
        <div class="detail-stat__bar-wrap">
          <div class="detail-stat__bar" style="background:${barColor}" data-val="${val}"></div>
        </div>
        <span class="detail-stat__val">${val}</span>
      </div>`;
  }).join('');

  const moves  = MOVESETS[pkmn.id] ?? [];
  const roles  = ['Base', 'Finale'];
  const moveRows = moves.slice(0, 2).map((m, i) => `
    <div class="detail-move">
      <span class="detail-move__role">${roles[i] ?? ''}</span>
      <span class="detail-move__name">${m.name}</span>
      <span class="detail-move__type" style="background:${typeColors[m.type] ?? '#888'}">${typeLabel(m.type)}</span>
      <span class="detail-move__power">${m.power > 0 ? m.power : '—'}</span>
    </div>`
  ).join('');

  return `
    <div class="detail-rarity detail-rarity--${entry.rarity}">
      <span class="detail-rarity__stars">${starsStr}</span>
      <span class="detail-rarity__label">${rarityLabel}</span>
    </div>
    <div class="detail-name">${pkmn.name}</div>
    <div class="detail-types">${typeBadges}</div>
    <span class="detail-section-label">Base Stats</span>
    <div class="detail-stats">${statRows}</div>
    <span class="detail-section-label">Mosse</span>
    <div class="detail-moves">${moveRows || '<p style="color:var(--text-muted);font-size:0.75rem">Nessuna mossa</p>'}</div>
    <div class="detail-passiva">
      <span class="detail-passiva__label">Passiva</span>
      <span class="detail-passiva__text">In arrivo…</span>
    </div>
  `;
}

/* ---- Detail mode dal rewind: il bottone "Avanti →" diventa "✕ Chiudi" ---- */
let isShowingDetailFromSummary = false;

$('revealNext').addEventListener('click', () => {
  if (isShowingDetailFromSummary) {
    isShowingDetailFromSummary = false;
    $('revealNext').textContent = 'Avanti →';
    $('revealScreen').classList.add('hidden');
    $('summaryScreen').classList.remove('hidden');
  } else {
    showNextResult();
  }
});

async function showCardDetail(entry) {
  isShowingDetailFromSummary = true;
  $('summaryScreen').classList.add('hidden');
  $('revealNext').textContent = '✕ Chiudi';
  await showReveal(entry);
}

/* ---- Summary Screen ---- */

function showSummary() {
  // Pulisco eventuali overlay effimeri ancora vivi
  document.querySelectorAll('.summon-intro, .stinger-pokeball').forEach(el => el.remove());
  $('pullGate').classList.add('hidden');
  $('btnSkipPull').classList.add('hidden');

  $('revealScreen').classList.add('hidden');
  $('starsScreen').classList.add('hidden');
  $('starsScreen').classList.remove('is-fading-out');
  $('summaryScreen').classList.remove('hidden');
  $('revealNext').textContent = 'Avanti →';     // reset etichetta

  const container = $('summaryCards');
  container.innerHTML = '';

  const starsMap = { pseudo: '★★★★★', epic: '★★★★', rare: '★★★', uncommon: '★★', common: '★' };

  pullAll.forEach((entry, i) => {
    const pkmn = findPokemon(entry.id);
    // Bottone per accessibilità (cliccabile + focus visible + keyboard)
    const card = document.createElement('button');
    card.type  = 'button';
    card.className = `summary-card summary-card--${entry.rarity}`;
    card.style.animationDelay = `${i * 45}ms`;
    card.dataset.rarity = entry.rarity;
    card.setAttribute('aria-label', `${pkmn?.name ?? '#' + entry.id} — apri carta`);
    card.innerHTML = `
      <div class="summary-card__art-frame">
        <img class="summary-card__art" alt="${pkmn?.name ?? ''}" />
      </div>
      <span class="summary-card__stars">${starsMap[entry.rarity]}</span>
      <span class="summary-card__name">${pkmn?.name ?? `#${entry.id}`}</span>
    `;

    // Carica artwork con fallback allo sprite
    const img = card.querySelector('.summary-card__art');
    if (pkmn) {
      img.onerror = () => {
        img.onerror = null;
        img.classList.add('is-fallback');
        img.src = pkmn.sprite.default;
      };
      img.src = getArtworkUrl(pkmn);
    }

    // Click → apri detail
    card.addEventListener('click', () => showCardDetail(entry));

    container.appendChild(card);
  });
}

// Chiudi overlay dopo il riepilogo
$('pullClose').addEventListener('click', () => {
  $('pullOverlay').classList.add('hidden');
});

/* ================================================================
   MODAL PROBABILITÀ
   ================================================================ */

function buildRatesModal() {
  const groups = { pseudo: [], epic: [], rare: [], uncommon: [], common: [] };
  for (const e of BANNER_POOL) {
    if (groups[e.rarity]) groups[e.rarity].push(e);
  }

  const body          = $('ratesList');
  body.innerHTML      = '';

  const rarityOrder   = ['pseudo', 'epic', 'rare', 'uncommon', 'common'];
  const rarityLabel   = { pseudo:'Pseudo Leggendario', epic:'Epico', rare:'Raro', uncommon:'Non Comune', common:'Comune' };
  const rarityStars   = { pseudo:'★★★★★', epic:'★★★★', rare:'★★★', uncommon:'★★', common:'★' };

  for (const rarity of rarityOrder) {
    const entries = groups[rarity];
    if (!entries.length) continue;
    const pctEach = (RATE_PCT[rarity] / entries.length).toFixed(3);

    const section = document.createElement('div');
    section.className = 'rates-section';
    section.innerHTML = `
      <div class="rates-section__header">
        <span class="rates-section__stars rates-section__stars--${rarity}">${rarityStars[rarity]}</span>
        <span class="rates-section__label">${rarityLabel[rarity]}</span>
        <span class="rates-section__total">${RATE_PCT[rarity]}% tot · ${pctEach}% ciascuno</span>
      </div>
      <div class="rates-grid"></div>
    `;
    body.appendChild(section);

    const grid = section.querySelector('.rates-grid');
    for (const e of entries) {
      const pkmn = findPokemon(e.id);
      if (!pkmn) continue;
      const item = document.createElement('div');
      item.className = 'rates-entry';
      item.innerHTML = `
        <img class="rates-entry__sprite" src="${pkmn.sprite.default}" alt="${pkmn.name}" loading="lazy" />
        <span class="rates-entry__name">${pkmn.name}</span>
        <span class="rates-entry__pct">${pctEach}%</span>
      `;
      grid.appendChild(item);
    }
  }
}

$('btnRates').addEventListener('click', () => {
  buildRatesModal();
  $('ratesModal').classList.remove('hidden');
});
$('btnRatesClose').addEventListener('click',  () => $('ratesModal').classList.add('hidden'));
$('ratesBackdrop').addEventListener('click',  () => $('ratesModal').classList.add('hidden'));

/* ================================================================
   KEYBOARD
   ================================================================ */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $('confirmModal').classList.add('hidden');
    $('ratesModal').classList.add('hidden');
  }
});

/* ================================================================
   INIT
   ================================================================ */

(async () => {
  try {
    await loadAllPokemon();
    gs = getState();

    // Debug: gemme se a 0
    if ((gs.gems ?? 0) === 0) { gs.gems = 9999; saveState(); }

    updateWallet();
    buildBanner();

    const loading = $('loadingOverlay');
    loading.classList.add('is-hidden');
    setTimeout(() => loading.remove(), 350);
  } catch (e) {
    console.error(e);
    $('loadingOverlay').innerHTML = `
      <p style="color:var(--danger)">Errore caricamento.</p>
      <a class="btn btn--primary" href="index.html">← Home</a>
    `;
  }
})();
