/* ============================================================
   legendary-cinematic.js — animazione fullscreen per la cattura
                            di un Pokémon Leggendario nella storia
   ============================================================
   API:
     await playLegendaryCinematic(pokemon)
       Crea overlay, anima le 5 fasi, aspetta click utente, distrugge overlay.
       pokemon = oggetto pokeapi con { id, name, sprite.default }

   Fasi:
     1) Anticipazione    (0.0s → 1.2s) — screen-shake + flash + "Leggendario!"
     2) Beam + Aurora    (1.2s → 2.2s) — fascio di luce verticale + aurora cromatica
     3) Sprite reveal    (2.2s → 4.7s) — sprite emerge crescendo, particelle, anelli
     4) Name reveal      (4.7s → 5.7s) — nome letter-by-letter + sottotitolo
     5) Continue (wait)  (5.7s → click) — bottone "Continua →"
*/

const sleep = ms => new Promise(r => setTimeout(r, ms));

const PARTICLE_COLORS = ['#f5d050', '#5ee8d8', '#c8a8ff', '#ff66cc', '#ffffff'];

export async function playLegendaryCinematic(pokemon) {
  if (!pokemon) return;

  const overlay = buildOverlay(pokemon);
  document.body.appendChild(overlay);

  // Trigger reflow per attivare la transizione di apertura
  void overlay.offsetWidth;
  overlay.classList.add('is-shown');

  // ── Fase 1: anticipazione ──────────────────────────────
  await sleep(60);
  overlay.classList.add('phase-1');
  triggerScreenShake(overlay);

  // ── Fase 2: beam + aurora ──────────────────────────────
  await sleep(1200);
  overlay.classList.add('phase-2');
  flashScreen(overlay);

  // ── Fase 3: sprite reveal ──────────────────────────────
  await sleep(1000);
  overlay.classList.add('phase-3');
  spawnContinuousParticles(overlay);
  spawnExpandingRings(overlay);

  // ── Fase 4: name reveal ────────────────────────────────
  await sleep(2500);
  overlay.classList.add('phase-4');
  animateNameTypewriter(overlay.querySelector('.lcin__name'), pokemon.name);
  flashScreen(overlay);

  // ── Fase 5: continue ───────────────────────────────────
  await sleep(1000);
  overlay.classList.add('phase-5');

  // Aspetta il click utente
  await waitForClick(overlay.querySelector('.lcin__continue'));

  // Chiusura
  overlay.classList.remove('is-shown');
  overlay.classList.add('is-closing');
  await sleep(450);
  overlay.remove();
}

/* ============================================================
   COSTRUZIONE OVERLAY
   ============================================================ */

function buildOverlay(pokemon) {
  const el = document.createElement('div');
  el.className = 'legendary-cinematic';
  el.innerHTML = `
    <div class="lcin__bg-aurora"></div>
    <div class="lcin__bg-dark"></div>

    <div class="lcin__beam"></div>

    <div class="lcin__sprite-stage">
      <div class="lcin__sprite-glow"></div>
      <img class="lcin__sprite" src="${pokemon.sprite?.default ?? ''}" alt="${pokemon.name ?? ''}" draggable="false" />
    </div>

    <div class="lcin__top-text">
      <span class="lcin__top-text-line lcin__top-text-line--1">Un Pokémon</span>
      <span class="lcin__top-text-line lcin__top-text-line--2">LEGGENDARIO!</span>
    </div>

    <div class="lcin__name-stage">
      <h1 class="lcin__name"></h1>
      <div class="lcin__subtitle">
        <span class="lcin__stars">★ ★ ★ ★ ★ ★</span>
        <span class="lcin__rarity-label">UNICO · SOLO NELLA STORIA</span>
      </div>
    </div>

    <button class="lcin__continue">Continua →</button>
  `;
  return el;
}

/* ============================================================
   EFFETTI DINAMICI
   ============================================================ */

function triggerScreenShake(overlay) {
  overlay.classList.add('lcin-shake');
  setTimeout(() => overlay.classList.remove('lcin-shake'), 600);
}

function flashScreen(overlay) {
  const flash = document.createElement('div');
  flash.className = 'lcin__flash';
  overlay.appendChild(flash);
  void flash.offsetWidth;
  flash.classList.add('is-active');
  setTimeout(() => flash.remove(), 700);
}

/** Genera particelle continue che emergono dallo sprite e si disperdono. */
function spawnContinuousParticles(overlay) {
  const stage = overlay.querySelector('.lcin__sprite-stage');
  let active = true;
  overlay.addEventListener('click', () => { active = false; }, { once: true });

  function spawnOne() {
    if (!active || !overlay.isConnected) return;
    const p = document.createElement('span');
    p.className = 'lcin__particle';
    const angle = Math.random() * Math.PI * 2;
    const dist  = 200 + Math.random() * 240;
    const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    p.style.setProperty('--dx',    `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy',    `${Math.sin(angle) * dist}px`);
    p.style.setProperty('--color', color);
    p.style.setProperty('--life',  `${1.2 + Math.random() * 0.8}s`);
    stage.appendChild(p);
    setTimeout(() => p.remove(), 2200);
  }

  // Spawna 3-5 particelle ogni ~80ms
  const interval = setInterval(() => {
    if (!active || !overlay.isConnected) { clearInterval(interval); return; }
    const burst = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burst; i++) spawnOne();
  }, 80);
}

/** Anelli che si espandono dallo sprite. */
function spawnExpandingRings(overlay) {
  const stage = overlay.querySelector('.lcin__sprite-stage');
  let active = true;
  overlay.addEventListener('click', () => { active = false; }, { once: true });

  function spawnRing() {
    if (!active || !overlay.isConnected) return;
    const r = document.createElement('span');
    r.className = 'lcin__ring';
    r.style.setProperty('--color', PARTICLE_COLORS[Math.floor(Math.random() * 3)]);
    stage.appendChild(r);
    setTimeout(() => r.remove(), 1600);
  }

  spawnRing();
  const interval = setInterval(() => {
    if (!active || !overlay.isConnected) { clearInterval(interval); return; }
    spawnRing();
  }, 700);
}

/** Anima il nome lettera per lettera (typewriter). */
function animateNameTypewriter(el, name) {
  if (!el) return;
  const cleanName = (name ?? '').toUpperCase();
  el.innerHTML = '';
  for (const ch of cleanName) {
    const span = document.createElement('span');
    span.className = 'lcin__name-char';
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
  }
  // Stagger ogni 60ms
  el.querySelectorAll('.lcin__name-char').forEach((char, i) => {
    char.style.animationDelay = `${i * 60}ms`;
  });
}

function waitForClick(btn) {
  return new Promise(resolve => {
    if (!btn) { resolve(); return; }
    btn.addEventListener('click', () => resolve(), { once: true });
  });
}
