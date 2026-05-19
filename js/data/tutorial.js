/* ============================================================
   tutorial.js — Onboarding guidato con spotlight
   ============================================================
   - Step di 2 tipi:
       'welcome'/'closing' → card centrale (modal classico)
       'spotlight'         → maschera scura + tooltip ancorato a un
                             elemento reale della UI (target selector)
   - Prima esecuzione: dopo il welcome overlay, alla prima apertura
     della home. Salva flag in localStorage al completamento/skip.
   - Riavviabile dalle Impostazioni con { force: true }.

   API:
     initTutorial({ force?: boolean })  → mostra il tutorial se
       force è true OPPURE se il flag non è ancora settato.
     isTutorialDone()                   → true se il flag è settato.
     resetTutorial()                    → cancella il flag.
   ============================================================ */

const FLAG_KEY = 'pkmn_tutorial_done_v2';   // bump versione: nuovo tutorial

/* Definizione step. type:
     - 'welcome'/'closing': testo centrato.
     - 'spotlight': evidenzia un elemento via selector + tooltip ancorato.
   Per 'spotlight':
     target       — CSS selector dell'elemento da evidenziare
     placement    — 'top'|'bottom'|'left'|'right' (default 'bottom')
     padding      — pixel di buffer attorno all'hole (default 12) */
const STEPS = [
  {
    type:  'welcome',
    icon:  '👋',
    title: 'Benvenuto, allenatore!',
    body:  'Costruisci la tua squadra, sfida i bot e i giocatori di tutto il mondo. Ti accompagno in un giro veloce: <b>2 minuti</b> e sei pronto.',
    accent:'#5ee8d8',
  },
  {
    type:    'spotlight',
    target:  '#btnSummon',
    placement: 'right',
    icon:    '✨',
    title:   'Summon — apri pacchetti',
    body:    'Da qui apri pacchetti e ottieni nuovi Pokémon. Più <b>rara</b> è la carta, più sarà forte in battaglia. I primi pacchetti sono gratis: parti da qui!',
    accent:  '#99a8ff',
  },
  {
    type:    'spotlight',
    target:  '#btnCollection',
    placement: 'right',
    icon:    '📦',
    title:   'Collezione — team & Pokémon',
    body:    'Tutti i Pokémon che ottieni finiscono qui. Crei fino a <b>4 team</b> diversi, scegli il team che vuoi giocare e visualizzi ogni carta con stat, mosse e passiva.',
    accent:  '#4dad5b',
  },
  {
    type:    'spotlight',
    target:  '#btnPlay',
    placement: 'right',
    icon:    '⚔',
    title:   'Gioca — battaglie',
    body:    'Da qui entri in battaglia: <b>contro AI</b> per allenarti, in <b>storia</b> per affrontare i capi-palestra di Kanto, o <b>online</b> contro altri giocatori.',
    accent:  '#ffcb05',
  },
  {
    type:    'spotlight',
    target:  '.menu-btn--shop',
    placement: 'right',
    icon:    '🛍',
    title:   'Negozio — oggetti tenuti',
    body:    'Compri oggetti che i Pokémon possono <b>tenere</b> in battaglia: bacche curative, potenziamenti di tipo, difese, scelte irreversibili. Ogni Pokémon può tenere 1 oggetto per team.',
    accent:  '#f4a017',
  },
  {
    type:    'spotlight',
    target:  '#btnSettings',
    placement: 'right',
    icon:    '⚙',
    title:   'Impostazioni',
    body:    'Audio, grafica, account, cloud sync. In fondo trovi anche il bottone per <b>rivedere questo tutorial</b> quando vuoi.',
    accent:  '#a040a0',
  },
  {
    type:    'welcome',     // riusa il layout centrato
    icon:    '🎉',
    title:   'Sei pronto!',
    body:    'Comincia da <b>✨ Summon</b> per ottenere le prime carte, poi <b>📦 Collezione</b> per impostare il team e infine <b>⚔ Gioca</b> per il tuo primo match. Buona caccia, allenatore!',
    accent:  '#ffcb05',
  },
];

export function isTutorialDone() {
  try { return localStorage.getItem(FLAG_KEY) === '1'; } catch { return false; }
}

export function resetTutorial() {
  try { localStorage.removeItem(FLAG_KEY); } catch {}
}

function markDone() {
  try { localStorage.setItem(FLAG_KEY, '1'); } catch {}
}

let currentStep = 0;
let overlayEl   = null;
let resizeRaf   = null;

/** Mostra il tutorial. Se {force:false} e il flag è settato, non fa nulla. */
export function initTutorial({ force = false } = {}) {
  if (!force && isTutorialDone()) return;

  // Cleanup eventuale istanza precedente
  document.getElementById('tutorialOverlay')?.remove();

  overlayEl = document.createElement('div');
  overlayEl.id = 'tutorialOverlay';
  overlayEl.className = 'tutorial-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.innerHTML = `
    <div class="tutorial-overlay__backdrop" data-tutorial-skip></div>
    <div class="tutorial-spotlight" aria-hidden="true"></div>
    <div class="tutorial-card" role="document">
      <button class="tutorial-card__close" data-tutorial-skip aria-label="Salta tutorial">✕</button>

      <div class="tutorial-card__icon-wrap">
        <span class="tutorial-card__icon">👋</span>
      </div>

      <div class="tutorial-card__step-info">
        <span class="tutorial-card__step-num">1 / ${STEPS.length}</span>
        <div class="tutorial-card__dots"></div>
      </div>

      <h2 class="tutorial-card__title">—</h2>
      <p class="tutorial-card__body">—</p>

      <div class="tutorial-card__actions">
        <button class="btn tutorial-card__btn-back" type="button">← Indietro</button>
        <button class="btn btn--primary tutorial-card__btn-next" type="button">Avanti →</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlayEl);

  // Dots
  const dotsRoot = overlayEl.querySelector('.tutorial-card__dots');
  STEPS.forEach(() => {
    const dot = document.createElement('span');
    dot.className = 'tutorial-card__dot';
    dotsRoot.appendChild(dot);
  });

  // Listeners
  overlayEl.querySelectorAll('[data-tutorial-skip]').forEach(el => {
    el.addEventListener('click', () => endTutorial());
  });
  overlayEl.querySelector('.tutorial-card__btn-back').addEventListener('click', () => stepDelta(-1));
  overlayEl.querySelector('.tutorial-card__btn-next').addEventListener('click', () => {
    if (currentStep + 1 >= STEPS.length) endTutorial();
    else stepDelta(+1);
  });

  // ESC = salta
  document.addEventListener('keydown', onKeyDown);

  // Riposiziona spotlight al resize/scroll
  window.addEventListener('resize',  scheduleReposition);
  window.addEventListener('scroll',  scheduleReposition, true);

  currentStep = 0;
  renderStep();
  requestAnimationFrame(() => overlayEl.classList.add('is-visible'));
}

function onKeyDown(e) {
  if (!overlayEl?.classList.contains('is-visible')) return;
  if (e.key === 'Escape')    endTutorial();
  if (e.key === 'ArrowRight' && currentStep + 1 < STEPS.length) stepDelta(+1);
  if (e.key === 'ArrowLeft'  && currentStep > 0)                stepDelta(-1);
}

function stepDelta(delta) {
  const next = Math.max(0, Math.min(STEPS.length - 1, currentStep + delta));
  if (next === currentStep) return;
  currentStep = next;
  const card = overlayEl.querySelector('.tutorial-card');
  card.classList.add('is-transitioning');
  setTimeout(() => {
    renderStep();
    card.classList.remove('is-transitioning');
  }, 140);
}

function renderStep() {
  const step = STEPS[currentStep];
  overlayEl.querySelector('.tutorial-card__icon').textContent  = step.icon ?? '·';
  overlayEl.querySelector('.tutorial-card__title').textContent = step.title;
  overlayEl.querySelector('.tutorial-card__body').innerHTML    = step.body;
  overlayEl.querySelector('.tutorial-card__step-num').textContent = `${currentStep + 1} / ${STEPS.length}`;
  overlayEl.style.setProperty('--tutorial-accent', step.accent ?? '#ffcb05');

  overlayEl.querySelectorAll('.tutorial-card__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === currentStep);
    dot.classList.toggle('is-past',   i <  currentStep);
  });

  overlayEl.querySelector('.tutorial-card__btn-back').disabled  = currentStep === 0;
  overlayEl.querySelector('.tutorial-card__btn-next').textContent =
    currentStep === STEPS.length - 1 ? '✓ Inizia' : 'Avanti →';

  // Mode classes
  overlayEl.classList.toggle('is-spotlight', step.type === 'spotlight');

  // Spotlight: aggancia il buco e posiziona la card vicino al target
  if (step.type === 'spotlight') {
    repositionSpotlight();
  } else {
    // No spotlight: card centrata, niente buco
    const spot = overlayEl.querySelector('.tutorial-spotlight');
    spot.style.opacity = '0';
    spot.style.pointerEvents = 'none';
    const card = overlayEl.querySelector('.tutorial-card');
    card.style.position = '';
    card.style.left     = '';
    card.style.top      = '';
  }
}

function scheduleReposition() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    if (STEPS[currentStep]?.type === 'spotlight') repositionSpotlight();
  });
}

/* Sposta il "buco" della maschera sopra il target e la card vicino. */
function repositionSpotlight() {
  const step = STEPS[currentStep];
  const target = document.querySelector(step.target);
  const spot = overlayEl.querySelector('.tutorial-spotlight');
  const card = overlayEl.querySelector('.tutorial-card');

  if (!target) {
    // Fallback: se il target non esiste in pagina, comportati come welcome
    spot.style.opacity = '0';
    card.style.position = '';
    card.style.left = '';
    card.style.top = '';
    return;
  }

  const rect = target.getBoundingClientRect();
  const pad  = step.padding ?? 12;

  spot.style.opacity = '1';
  spot.style.left   = `${rect.left   - pad}px`;
  spot.style.top    = `${rect.top    - pad}px`;
  spot.style.width  = `${rect.width  + pad * 2}px`;
  spot.style.height = `${rect.height + pad * 2}px`;

  // Posiziona la card vicino al target. placement preferito: 'left'/'right'/'top'/'bottom'
  // Se non c'è spazio, fallback al centro pagina.
  const cardRect = card.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const gap = 24;
  let cx, cy;

  const place = step.placement ?? 'bottom';
  if (place === 'left' && rect.left - gap - cardRect.width > 8) {
    cx = rect.left  - gap - cardRect.width;
    cy = Math.max(8, Math.min(vh - cardRect.height - 8, rect.top + rect.height / 2 - cardRect.height / 2));
  } else if (place === 'right' && rect.right + gap + cardRect.width < vw - 8) {
    cx = rect.right + gap;
    cy = Math.max(8, Math.min(vh - cardRect.height - 8, rect.top + rect.height / 2 - cardRect.height / 2));
  } else if (place === 'top' && rect.top - gap - cardRect.height > 8) {
    cy = rect.top - gap - cardRect.height;
    cx = Math.max(8, Math.min(vw - cardRect.width - 8, rect.left + rect.width / 2 - cardRect.width / 2));
  } else if (place === 'bottom' && rect.bottom + gap + cardRect.height < vh - 8) {
    cy = rect.bottom + gap;
    cx = Math.max(8, Math.min(vw - cardRect.width - 8, rect.left + rect.width / 2 - cardRect.width / 2));
  } else {
    // Fallback: posiziona al centro orizzontale, sotto se possibile sennò sopra
    cx = (vw - cardRect.width) / 2;
    cy = rect.bottom + gap + cardRect.height < vh - 8
       ? rect.bottom + gap
       : Math.max(8, rect.top - gap - cardRect.height);
  }

  card.style.position = 'fixed';
  card.style.left = `${cx}px`;
  card.style.top  = `${cy}px`;
}

function endTutorial() {
  if (!overlayEl) return;
  overlayEl.classList.remove('is-visible');
  document.body.style.overflow = '';
  markDone();
  document.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', scheduleReposition);
  window.removeEventListener('scroll', scheduleReposition, true);
  const ref = overlayEl;
  overlayEl = null;
  setTimeout(() => ref.remove(), 350);
}
