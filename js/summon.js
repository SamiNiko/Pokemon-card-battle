/* ============================================================
   summon.js — gacha (4 tier + Star Rail reveal)
   ============================================================ */

// Cloud sync dinamico: se la CDN Supabase è bloccata, la pagina funziona lo stesso
import('./data/cloud-sync.js').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState, saveState }         from './data/state.js';
import { MOVESETS }                    from './data/movesets.js';
import { getSummonablePool, PULL_RATES, tierLabel } from './data/rarity.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  return results;
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

$('btnDebug3').addEventListener('click', () => debugForcePull('rare'));
$('btnDebug4').addEventListener('click', () => debugForcePull('epic'));

async function debugForcePull(rarity) {
  const pool = BANNER_POOL.filter(p => p.rarity === rarity);
  if (pool.length === 0) {
    alert(`Nessun Pokémon ${rarity} nel pool`);
    return;
  }
  const entry = pool[Math.floor(Math.random() * pool.length)];

  // NB: non aggiunge al posseduti e non scala gemme — è solo per test animazioni
  pullAll   = [entry];
  pullQueue = [entry];

  $('pullOverlay').classList.remove('hidden');
  $('starsScreen').classList.add('hidden');
  $('revealScreen').classList.add('hidden');
  $('summaryScreen').classList.add('hidden');

  await showNextResult();
}

/* ================================================================
   PULL FLOW
   ================================================================ */

let pullQueue = []; // risultati ancora da rivelare
let pullAll   = []; // tutti i risultati (per il riepilogo)

async function handlePull(n) {
  const cost = n === 1 ? COST_SINGLE : COST_MULTI;
  if (getGems() < cost) { alert('Gemme insufficienti!'); return; }

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

  await showNextResult();
}

async function showNextResult() {
  if (pullQueue.length === 0) {
    showSummary();
    return;
  }

  const entry = pullQueue.shift();

  if (entry.rarity === 'common') {
    // Comuni: vai direttamente al reveal (senza schermata stelle)
    await showReveal(entry);
  } else {
    // ★★ e oltre: prima stelle, poi reveal
    await showStars(entry);
  }
}

/* ---- Stars Screen — sequenza cinematica ---- */

async function showStars(entry) {
  const pkmn       = findPokemon(entry.id);
  const rarity     = entry.rarity;
  const starsCount = { pseudo: 5, epic: 4, rare: 3, uncommon: 2 }[rarity] ?? 2;

  // Reset
  const starsScreen = $('starsScreen');
  const nameEl      = $('starsName');
  $('starsRow').innerHTML = '';
  nameEl.textContent = '';
  nameEl.className   = 'stars-screen__name';

  // Rimuovi residui di pull precedenti
  starsScreen.querySelectorAll('.stars-screen__aurora, .stars-screen__beam, .cinematic-particle, .cinematic-ring').forEach(el => el.remove());

  // Aurora di sfondo (rare/epic)
  let aurora;
  if (rarity === 'rare' || rarity === 'epic') {
    aurora = document.createElement('div');
    aurora.className = `stars-screen__aurora stars-screen__aurora--${rarity}`;
    starsScreen.insertBefore(aurora, starsScreen.firstChild);
  }

  $('revealScreen').classList.add('hidden');
  starsScreen.classList.remove('hidden');

  /* === PHASE 1 — Anticipazione (solo epic) === */
  if (rarity === 'epic') {
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
    await sleep(280);
  } else if (rarity === 'rare') {
    aurora.classList.add('is-shown');
    await sleep(200);
  }

  /* === PHASE 2 — Stelle una alla volta === */
  const firstDelay = { epic: 280, rare: 220, uncommon: 200 }[rarity] ?? 200;
  const nextDelay  = { epic: 380, rare: 290, uncommon: 210 }[rarity] ?? 210;

  for (let i = 0; i < starsCount; i++) {
    await sleep(i === 0 ? firstDelay : nextDelay);

    const s = document.createElement('span');
    s.className = `star-icon star-icon--${rarity}`;
    s.textContent = '★';
    $('starsRow').appendChild(s);
    s.getBoundingClientRect(); // reflow
    s.classList.add('is-shown');

    if (rarity === 'rare' || rarity === 'epic') {
      spawnRing(s, rarity);
      spawnParticles(s, rarity, rarity === 'epic' ? 14 : 9);

      if (rarity === 'epic') {
        flashScreen('epic');
        shakeOverlay();
      }
    }
  }

  /* === PHASE 3 — Nome === */
  await sleep(rarity === 'epic' ? 560 : 440);
  nameEl.textContent = pkmn?.name ?? `#${entry.id}`;
  nameEl.classList.add('is-shown');
  if (rarity === 'epic')      nameEl.classList.add('stars-screen__name--epic');
  else if (rarity === 'rare') nameEl.classList.add('stars-screen__name--rare');

  /* === PHASE 4 — Hold prima del reveal === */
  const holdMs = { epic: 1700, rare: 1150, uncommon: 700 }[rarity] ?? 700;
  await sleep(holdMs);

  starsScreen.classList.add('hidden');
  await showReveal(entry);
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
  setTimeout(() => flash.remove(), 550);
}

function shakeOverlay() {
  const ov = $('pullOverlay');
  ov.classList.remove('shake-epic');
  void ov.offsetWidth;
  ov.classList.add('shake-epic');
  setTimeout(() => ov.classList.remove('shake-epic'), 460);
}

/* ---- Reveal Screen ---- */

async function showReveal(entry) {
  const pkmn   = findPokemon(entry.id);
  const sprite = $('revealSprite');
  const glow   = $('revealGlow');
  const right  = $('revealRight');

  // Reset animazioni
  sprite.classList.remove('is-shown');
  glow.classList.remove('is-shown', 'is-pulsing--rare', 'is-pulsing--epic');

  // Imposta sprite
  sprite.src = pkmn ? pkmn.sprite.default : '';
  sprite.alt = pkmn ? pkmn.name : '';

  // Glow colore per rarità
  const glowColors = {
    epic:     'radial-gradient(circle, rgba(245,208,80,0.65) 0%, transparent 70%)',
    rare:     'radial-gradient(circle, rgba(200,168,255,0.55) 0%, transparent 70%)',
    uncommon: 'radial-gradient(circle, rgba(136,180,255,0.42) 0%, transparent 70%)',
    common:   'radial-gradient(circle, rgba(168,179,207,0.22) 0%, transparent 70%)',
  };
  glow.style.background = glowColors[entry.rarity] ?? glowColors.common;

  // Costruisce pannello dettagli
  right.innerHTML = buildDetailHTML(entry, pkmn);

  // Mostra la schermata
  $('revealScreen').classList.remove('hidden');

  // Piccolo delay poi anima sprite + glow
  await sleep(60);
  sprite.classList.add('is-shown');
  glow.classList.add('is-shown');
  if (entry.rarity === 'epic')      glow.classList.add('is-pulsing--epic');
  else if (entry.rarity === 'rare') glow.classList.add('is-pulsing--rare');

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
    `<span class="detail-type-badge" style="background:${typeColors[t] ?? '#888'}">${t}</span>`
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
      <span class="detail-move__type" style="background:${typeColors[m.type] ?? '#888'}">${m.type}</span>
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

// Bottone "Avanti →" nella schermata reveal
$('revealNext').addEventListener('click', () => showNextResult());

/* ---- Summary Screen ---- */

function showSummary() {
  $('revealScreen').classList.add('hidden');
  $('starsScreen').classList.add('hidden');
  $('summaryScreen').classList.remove('hidden');

  const container = $('summaryCards');
  container.innerHTML = '';

  const starsMap = { pseudo: '★★★★★', epic: '★★★★', rare: '★★★', uncommon: '★★', common: '★' };

  pullAll.forEach((entry, i) => {
    const pkmn = findPokemon(entry.id);
    const card = document.createElement('div');
    card.className = `summary-card summary-card--${entry.rarity}`;
    card.style.animationDelay = `${i * 45}ms`;
    card.innerHTML = `
      ${pkmn ? `<img src="${pkmn.sprite.default}" alt="${pkmn.name}" />` : ''}
      <span class="summary-card__stars">${starsMap[entry.rarity]}</span>
      <span class="summary-card__name">${pkmn?.name ?? `#${entry.id}`}</span>
    `;
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
  const groups = { epic: [], rare: [], uncommon: [], common: [] };
  for (const e of BANNER_POOL) groups[e.rarity].push(e);

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
