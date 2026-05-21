/* ============================================================
   tutorial-battle.js — popup spiegativi durante la battaglia tutorial
   ------------------------------------------------------------
   Richiamato da battle.js quando MODE === 'tutorial'. Mostra un popup
   ancorato in 3 posizioni possibili (top/center/bottom) con un
   pulsante "OK" per proseguire. Ogni step è mostrato UNA SOLA volta
   per sessione (flag in-memory). Battle.js fa pause/resume del flow
   in base alla presenza del popup.

   API:
     showTutorialStep(id)   mostra il popup id se non già visto
     onStepDismissed(cb)    callback al click "OK"/skip
     isPopupOpen()          true se un popup è attualmente visibile
     setTutorialMode(on)    attiva/disattiva tutto (no-op se off)
   ============================================================ */

const STEPS = {
  welcome: {
    icon: '👋',
    title: 'Benvenuto al tutorial battaglia',
    body:  'Ti insegno passo passo come funziona il combattimento. Niente fretta — il timer è disabilitato per tutto il tutorial.',
    cta:   'Iniziamo →',
    pos:   'center',
  },
  placement: {
    icon: '🎯',
    title: 'Posizionamento',
    body:  'Trascina i tuoi Pokémon dalla panchina alla griglia 3×2. Puoi metterne fino a 3 contemporaneamente.',
    cta:   'OK, ho capito',
    pos:   'top',
  },
  passiveSlots: {
    icon: '✨',
    title: 'Slot della passiva',
    body:  'Quando prendi in mano un Pokémon, gli slot dove la sua passiva si attiva diventano <b>ciano pulsante</b>. Piazzarlo lì sblocca un bonus (es. +25% danno al tipo Fuoco).',
    cta:   'Capito',
    pos:   'center',
  },
  movePicker: {
    icon: '⚔',
    title: 'Scegli la mossa',
    body:  '<b>Click sinistro</b> su una tua carta apre il menu delle mosse: Base 1 e Base 2 sono sempre disponibili, il <b>Finisher</b> richiede 3 PP.<br><br><b>Click destro</b> apre i dettagli completi della carta (stat, mosse, passiva).',
    cta:   'Ho capito',
    pos:   'center',
  },
  confirm: {
    icon: '✅',
    title: 'Conferma turno',
    body:  'Quando sei pronto, premi il bottone "<b>Conferma turno</b>" in centro per vedere risolversi il turno.',
    cta:   'OK',
    pos:   'top',
  },
  speed: {
    icon: '⚡',
    title: 'Ordine di velocità',
    body:  'La somma delle velocità dei Pokémon in campo decide chi agisce per primo. Più sei veloce, più colpisci all\'inizio del turno.',
    cta:   'Continua',
    pos:   'center',
  },
  typeEff: {
    icon: '💥',
    title: 'Efficacia dei tipi',
    body:  'Le mosse hanno un <b>tipo</b> (Fuoco, Acqua, Erba…). Contro tipi deboli fanno <b>×2 danno</b> (super efficace), contro tipi resistenti <b>×0.5</b>, contro immunità <b>0</b>.',
    cta:   'OK',
    pos:   'center',
  },
  pp: {
    icon: '★',
    title: 'PP — Punti Potere',
    body:  'Ogni colpo a segno guadagna +1 PP all\'attaccante. Con 3 PP puoi scegliere il <b>Finisher</b> della carta: mossa più potente, ma consuma tutti i 3 PP.',
    cta:   'Capito',
    pos:   'center',
  },
  directDamage: {
    icon: '🎯',
    title: 'Danno diretto',
    body:  'Se una colonna avversaria è <b>vuota</b>, il tuo Pokémon attacca direttamente la barra HP del team avversario. Coprire tutte le 3 colonne è importante per non subire questo danno.',
    cta:   'OK',
    pos:   'center',
  },
  win: {
    icon: '🏆',
    title: 'Hai vinto!',
    body:  'Bravo! Hai imparato le basi del combattimento. Ora puoi cominciare a sfidare la <b>Lega Kanto</b> dal menu "Gioca → Allenatori". Buona caccia, allenatore!',
    cta:   '👑 Vai agli Allenatori',
    pos:   'center',
    onCta: () => { window.location.href = 'trainers.html'; },
  },
  lose: {
    icon: '🔄',
    title: 'Riprova',
    body:  'Sei stato sconfitto! Nessun problema — è solo un tutorial. Ricarica per riprovare con un nuovo team.',
    cta:   '↻ Riprova',
    pos:   'center',
    onCta: () => { window.location.reload(); },
  },
};

const shownSteps = new Set();
let isActive = false;
let dismissCallbacks = [];

/** Abilita/disabilita il sistema. Se off, ogni chiamata è no-op. */
export function setTutorialMode(on) {
  isActive = !!on;
}

export function isTutorialActive() { return isActive; }

/** True se attualmente è visibile un popup. battle.js può usarlo per
 *  mettere in pausa il flow (es. attendere prima di rivelare il prossimo
 *  evento). */
export function isPopupOpen() {
  return !!document.querySelector('.tutb-popup');
}

export function onStepDismissed(cb) {
  if (typeof cb === 'function') dismissCallbacks.push(cb);
}

/** Mostra il popup dello step se non è già stato visto in questa sessione.
 *  Ritorna una Promise che risolve quando l'utente lo chiude. */
export function showTutorialStep(id) {
  return new Promise(resolve => {
    if (!isActive) { resolve(false); return; }
    if (shownSteps.has(id)) { resolve(false); return; }
    const step = STEPS[id];
    if (!step) { resolve(false); return; }
    shownSteps.add(id);

    // Costruisci overlay + popup
    const overlay = document.createElement('div');
    overlay.className = `tutb-overlay tutb-overlay--${step.pos}`;
    overlay.innerHTML = `
      <div class="tutb-backdrop"></div>
      <div class="tutb-popup" role="dialog" aria-modal="true">
        <div class="tutb-popup__icon">${step.icon}</div>
        <h3 class="tutb-popup__title">${step.title}</h3>
        <p class="tutb-popup__body">${step.body}</p>
        <button class="tutb-popup__cta" type="button">${step.cta}</button>
        <button class="tutb-popup__skip" type="button" title="Salta tutto il tutorial">✕</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    const close = () => {
      overlay.classList.remove('is-visible');
      setTimeout(() => overlay.remove(), 300);
      dismissCallbacks.forEach(cb => { try { cb(id); } catch {} });
      resolve(true);
    };

    overlay.querySelector('.tutb-popup__cta').addEventListener('click', () => {
      close();
      if (step.onCta) step.onCta();
    });
    overlay.querySelector('.tutb-popup__skip').addEventListener('click', () => {
      // Skip: chiudi il popup e disabilita tutto il tutorial per il resto
      isActive = false;
      shownSteps.add('__all__');
      close();
    });
    // Click sul backdrop chiude (eccetto win/lose)
    if (!step.onCta) {
      overlay.querySelector('.tutb-backdrop').addEventListener('click', close);
    }
  });
}
