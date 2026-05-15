/* ============================================================
   tutorial.js — Onboarding slide tour
   ============================================================
   - Mostra una sequenza di "card" centrali con icona + testo
   - Prima esecuzione: dopo welcome overlay, alla prima apertura
     della home. Salva flag in localStorage al completamento/skip.
   - Riavviabile dalle Impostazioni con { force: true }.

   API:
     initTutorial({ force?: boolean })  → mostra il tutorial se
       force è true OPPURE se il flag non è ancora settato.
     isTutorialDone()                   → true se il flag è settato.
     resetTutorial()                    → cancella il flag.
   ============================================================ */

const FLAG_KEY = 'pkmn_tutorial_done_v1';

const STEPS = [
  {
    icon:  '👋',
    title: 'Benvenuto, allenatore!',
    body:  'Costruisci la tua squadra di Pokémon, sfida i Capipalestra di Kanto e i giocatori di tutto il mondo. Ti mostro le basi in pochi secondi.',
    accent:'#5ee8d8',
  },
  {
    icon:  '✨',
    title: 'Apri pacchetti — Summon',
    body:  'Dalla home, tocca <b>Summon</b> per aprire un pacchetto e ottenere nuovi Pokémon. Più rara è la carta, più forte sarà in battaglia. I primi pacchetti sono gratis!',
    accent:'#99a8ff',
  },
  {
    icon:  '📦',
    title: 'Collezione & Team',
    body:  'In <b>Collezione</b> vedi tutti i Pokémon che possiedi. Crea fino a <b>4 team</b> diversi con da 3 a 6 carte ciascuno. Il team selezionato è quello che porti in battaglia.',
    accent:'#4dad5b',
  },
  {
    icon:  '⚔',
    title: 'La battaglia',
    body:  'Posiziona fino a <b>3 carte</b> sul campo (griglia 3×2). Ogni turno scegli quale mossa usare: <b>Base</b> sempre disponibile, <b>Finisher</b> più forte ma costa 3 PP. Vince chi azzera gli HP avversari.',
    accent:'#ffcb05',
  },
  {
    icon:  '🛍',
    title: 'Oggetti tenuti — Negozio',
    body:  'Nel <b>Negozio</b> compri oggetti che i Pokémon possono <b>tenere</b> in battaglia: bacche curative, potenziamenti di tipo, difese, scelte irreversibili. Ogni Pokémon può tenere 1 oggetto per team.',
    accent:'#f4a017',
  },
  {
    icon:  '🎉',
    title: 'Sei pronto!',
    body:  'Comincia da <b>Summon</b> per ottenere le tue prime carte, poi vai in <b>Collezione</b> per impostare il team. Buona caccia, allenatore! Potrai rivedere questo tutorial dalle <b>Impostazioni</b>.',
    accent:'#ffcb05',
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

/** Mostra il tutorial. Se {force:false} e il flag è settato, non fa nulla. */
export function initTutorial({ force = false } = {}) {
  if (!force && isTutorialDone()) return;

  // Crea l'overlay una volta sola
  let overlay = document.getElementById('tutorialOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.className = 'tutorial-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="tutorial-overlay__backdrop" data-tutorial-skip></div>
      <div class="tutorial-card" role="document">
        <button class="tutorial-card__close" data-tutorial-skip aria-label="Salta tutorial">✕</button>

        <div class="tutorial-card__icon-wrap">
          <span class="tutorial-card__icon" id="tutorialIcon">👋</span>
        </div>

        <div class="tutorial-card__step-info">
          <span class="tutorial-card__step-num" id="tutorialStepNum">1 / ${STEPS.length}</span>
          <div class="tutorial-card__dots" id="tutorialDots"></div>
        </div>

        <h2 class="tutorial-card__title" id="tutorialTitle">—</h2>
        <p class="tutorial-card__body" id="tutorialBody">—</p>

        <div class="tutorial-card__actions">
          <button class="btn tutorial-card__btn-back" id="btnTutorialBack" type="button">← Indietro</button>
          <button class="btn btn--primary tutorial-card__btn-next" id="btnTutorialNext" type="button">Avanti →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Dots
    const dotsRoot = overlay.querySelector('#tutorialDots');
    STEPS.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'tutorial-card__dot';
      dot.dataset.step = String(i);
      dotsRoot.appendChild(dot);
    });

    // Listeners
    overlay.querySelectorAll('[data-tutorial-skip]').forEach(el => {
      el.addEventListener('click', () => endTutorial(overlay));
    });
    overlay.querySelector('#btnTutorialBack').addEventListener('click', () => {
      stepDelta(-1, overlay);
    });
    overlay.querySelector('#btnTutorialNext').addEventListener('click', () => {
      const next = currentStep + 1;
      if (next >= STEPS.length) {
        endTutorial(overlay);
      } else {
        stepDelta(+1, overlay);
      }
    });
    // ESC = salta
    document.addEventListener('keydown', e => {
      if (overlay.classList.contains('is-visible') && e.key === 'Escape') {
        endTutorial(overlay);
      }
    });
  }

  currentStep = 0;
  renderStep(overlay);
  // Apri con un tick di delay per permettere transition CSS
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
  // Disabilita scroll body durante il tutorial
  document.body.style.overflow = 'hidden';
}

let currentStep = 0;

function stepDelta(delta, overlay) {
  const next = Math.max(0, Math.min(STEPS.length - 1, currentStep + delta));
  if (next === currentStep) return;
  currentStep = next;
  // Sotto-animazione: fade della card
  const card = overlay.querySelector('.tutorial-card');
  card.classList.add('is-transitioning');
  setTimeout(() => {
    renderStep(overlay);
    card.classList.remove('is-transitioning');
  }, 150);
}

function renderStep(overlay) {
  const step = STEPS[currentStep];
  overlay.querySelector('#tutorialIcon').textContent  = step.icon;
  overlay.querySelector('#tutorialTitle').textContent = step.title;
  overlay.querySelector('#tutorialBody').innerHTML    = step.body;
  overlay.querySelector('#tutorialStepNum').textContent = `${currentStep + 1} / ${STEPS.length}`;
  overlay.style.setProperty('--tutorial-accent', step.accent ?? '#ffcb05');

  // Dots
  overlay.querySelectorAll('.tutorial-card__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === currentStep);
    dot.classList.toggle('is-past',   i <  currentStep);
  });

  // Pulsanti
  overlay.querySelector('#btnTutorialBack').disabled = currentStep === 0;
  overlay.querySelector('#btnTutorialNext').textContent =
    currentStep === STEPS.length - 1 ? '✓ Inizia' : 'Avanti →';
}

function endTutorial(overlay) {
  overlay.classList.remove('is-visible');
  document.body.style.overflow = '';
  markDone();
  setTimeout(() => { overlay.remove(); }, 350);
}
