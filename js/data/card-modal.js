/* ============================================================
   card-modal.js — Modal full-card riusabile
   ============================================================
   API:
     openCardModal(pokemonId)   apre il modal per il Pokémon
     closeCardModal()           chiude se aperto
   ============================================================ */

import { findPokemon }                       from './pokeapi.js';
import { MOVESETS }                          from './movesets.js?v=3';
import { getRarity, tierStars, tierLabel }   from './rarity.js';
import { getEquipped }                       from './state.js?v=4';
import { findItem }                          from './items.js?v=3';
import { typeLabel }                          from './types.js';
import { getPassive }                        from './passives.js';

const TYPE_COLORS = {
  normal:'#a8a878', fire:'#f08030',   water:'#6890f0',  grass:'#78c850',
  electric:'#f8d030', ice:'#98d8d8',  fighting:'#c03028', poison:'#a040a0',
  ground:'#e0c068',  flying:'#a890f0', psychic:'#f85888', bug:'#a8b820',
  rock:'#b8a038',    ghost:'#705898',  dragon:'#7038f8',  dark:'#705848',
  steel:'#b8b8d0',   fairy:'#ee99ac',
};

const GLOW_PER_RARITY = {
  pseudo:   'radial-gradient(circle, rgba(94,232,216,0.7) 0%, rgba(255,102,204,0.4) 40%, transparent 75%)',
  epic:     'radial-gradient(circle, rgba(245,208,80,0.65) 0%, transparent 70%)',
  rare:     'radial-gradient(circle, rgba(200,168,255,0.55) 0%, transparent 70%)',
  uncommon: 'radial-gradient(circle, rgba(136,180,255,0.42) 0%, transparent 70%)',
  common:   'radial-gradient(circle, rgba(168,179,207,0.22) 0%, transparent 70%)',
};

function getArtworkUrl(pkmn) {
  if (!pkmn) return '';
  return `assets/cards/${String(pkmn.id).padStart(3, '0')}.webp`;
}

let modalEl = null;

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'card-modal hidden';
  modalEl.innerHTML = `
    <div class="card-modal__backdrop" data-card-close></div>
    <div class="card-modal__card">
      <button class="card-modal__close" data-card-close aria-label="Chiudi">✕</button>
      <div class="card-modal__shine" aria-hidden="true"></div>
      <div class="card-modal__left">
        <div class="card-modal__glow"></div>
        <img class="card-modal__artwork" alt="" />
        <img class="card-modal__sprite" alt="" />
      </div>
      <div class="card-modal__right">
        <div class="card-pages" data-page="0">
          <div class="card-page card-page--1" data-page-index="0"></div>
          <div class="card-page card-page--2" data-page-index="1"></div>
        </div>
        <button class="card-modal__nav card-modal__nav--prev" data-page-nav="prev" aria-label="Pagina precedente">‹</button>
        <button class="card-modal__nav card-modal__nav--next" data-page-nav="next" aria-label="Pagina successiva">›</button>
        <div class="card-modal__pagination">
          <span class="card-modal__dot is-active" data-page-dot="0"></span>
          <span class="card-modal__dot" data-page-dot="1"></span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  modalEl.querySelectorAll('[data-card-close]').forEach(el => {
    el.addEventListener('click', closeCardModal);
  });

  // Navigazione carosello: frecce + dots
  modalEl.querySelectorAll('[data-page-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.pageNav;
      const pages = modalEl.querySelector('.card-pages');
      const cur = parseInt(pages.dataset.page, 10) || 0;
      const next = dir === 'next' ? Math.min(1, cur + 1) : Math.max(0, cur - 1);
      setModalPage(next);
    });
  });
  modalEl.querySelectorAll('[data-page-dot]').forEach(dot => {
    dot.addEventListener('click', () => setModalPage(parseInt(dot.dataset.pageDot, 10)));
  });

  // Swipe gesture su touch device
  let touchStartX = 0, touchStartY = 0, touchTracking = false;
  const right = modalEl.querySelector('.card-modal__right');
  right.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchTracking = true;
  }, { passive: true });
  right.addEventListener('touchend', e => {
    if (!touchTracking) return;
    touchTracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    // Solo swipe orizzontale (dx > 50px, dy < 30px)
    if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
      const pages = modalEl.querySelector('.card-pages');
      const cur = parseInt(pages.dataset.page, 10) || 0;
      if (dx < 0 && cur === 0) setModalPage(1);   // swipe left → next
      if (dx > 0 && cur === 1) setModalPage(0);   // swipe right → prev
    }
  }, { passive: true });

  // ESC chiude, frecce ← → cambiano pagina
  document.addEventListener('keydown', e => {
    if (modalEl.classList.contains('hidden')) return;
    if (e.key === 'Escape')                  closeCardModal();
    else if (e.key === 'ArrowRight')         setModalPage(1);
    else if (e.key === 'ArrowLeft')          setModalPage(0);
  });
  return modalEl;
}

/** Cambia pagina del carosello (0 o 1) + aggiorna dots e disabilita frecce ai bordi. */
function setModalPage(idx) {
  if (!modalEl) return;
  const pages = modalEl.querySelector('.card-pages');
  pages.dataset.page = String(idx);
  modalEl.querySelectorAll('[data-page-dot]').forEach(dot => {
    dot.classList.toggle('is-active', parseInt(dot.dataset.pageDot, 10) === idx);
  });
  modalEl.querySelector('[data-page-nav="prev"]').disabled = idx === 0;
  modalEl.querySelector('[data-page-nav="next"]').disabled = idx === 1;
}

export function openCardModal(pokemonId, opts = {}) {
  const pkmn = findPokemon(pokemonId);
  if (!pkmn) return;
  const rarity   = getRarity(pokemonId);
  const teamSlot = opts.teamSlot ?? null;

  const modal   = ensureModal();
  const card    = modal.querySelector('.card-modal__card');
  const artwork = modal.querySelector('.card-modal__artwork');
  const sprite  = modal.querySelector('.card-modal__sprite');
  const right   = modal.querySelector('.card-modal__right');
  const glow    = modal.querySelector('.card-modal__glow');

  card.dataset.rarity = rarity;
  artwork.classList.remove('is-missing');
  sprite.classList.remove('is-solo');

  // Sprite (sempre carica subito)
  sprite.src = pkmn.sprite.default;
  sprite.alt = pkmn.name;

  // Artwork con fallback automatico
  artwork.alt = pkmn.name;
  artwork.onerror = () => {
    artwork.onerror = null;
    artwork.classList.add('is-missing');
    sprite.classList.add('is-solo');
  };
  artwork.onload = () => {
    artwork.classList.remove('is-missing');
    sprite.classList.remove('is-solo');
  };
  artwork.src = getArtworkUrl(pkmn);

  // Pannello destro — 2 pagine (carosello)
  const page1 = modal.querySelector('.card-page--1');
  const page2 = modal.querySelector('.card-page--2');
  page1.innerHTML = buildPage1HTML({ id: pokemonId, rarity }, pkmn);
  page2.innerHTML = buildPage2HTML({ id: pokemonId, teamSlot },  pkmn);
  // Apro sempre dalla pagina 1
  setModalPage(0);

  // Glow di rarità
  glow.style.background = GLOW_PER_RARITY[rarity] ?? GLOW_PER_RARITY.common;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Anima le barre stat dopo il fade-in
  setTimeout(() => {
    right.querySelectorAll('.detail-stat__bar').forEach(bar => {
      const val = parseInt(bar.dataset.val ?? '0', 10);
      bar.style.width = `${Math.min(100, (val / 250) * 100)}%`;
    });
  }, 220);
}

export function closeCardModal() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ---- PAGINA 1: rarità + nome + tipi + stats ------------------------ */
function buildPage1HTML(entry, pkmn) {
  const starsStr  = '★'.repeat(tierStars(entry.rarity));
  const rarityLbl = tierLabel(entry.rarity);

  const typeBadges = (pkmn.types ?? []).map(t =>
    `<span class="detail-type-badge" style="background:${TYPE_COLORS[t] ?? '#888'}">${typeLabel(t)}</span>`
  ).join('');

  const s = pkmn.stats ?? {};
  // Categoria attacco del Pokemon: physical se ATK >= SP.ATK, altrimenti special.
  // Tutte le mosse del Pokemon hanno questa categoria (cfr. movesets.js).
  // Quindi mostro SOLO la stat di attacco rilevante (ATK o SP.A), non entrambe.
  const isPhys = (s.atk ?? 0) >= (s.spAtk ?? 0);
  const atkRow = isPhys
    ? { label: 'ATK',  val: s.atk   ?? 0 }
    : { label: 'SP.A', val: s.spAtk ?? 0 };
  const statRows = [
    { label: 'HP',    val: s.hp    ?? 0 },
    atkRow,
    { label: 'DEF',   val: s.def   ?? 0 },
    { label: 'SP.D',  val: s.spDef ?? 0 },
    { label: 'VEL',   val: s.speed ?? 0 },
  ].map(({ label, val }) => {
    const barColor = val >= 110 ? '#f5d050'
                   : val >= 80  ? '#78c850'
                   : val >= 50  ? '#6890f0'
                   : '#a8b3cf';
    return `
      <div class="detail-stat">
        <span class="detail-stat__label">${label}</span>
        <div class="detail-stat__bar-wrap">
          <div class="detail-stat__bar" style="background:${barColor}" data-val="${val}"></div>
        </div>
        <span class="detail-stat__val">${val}</span>
      </div>`;
  }).join('');

  return `
    <div class="detail-rarity detail-rarity--${entry.rarity}">
      <span class="detail-rarity__stars">${starsStr}</span>
      <span class="detail-rarity__label">${rarityLbl}</span>
    </div>
    <div class="detail-name">${pkmn.name}</div>
    <div class="detail-types">${typeBadges}</div>
    <span class="detail-section-label">Base Stats</span>
    <div class="detail-stats">${statRows}</div>
  `;
}

/* ---- PAGINA 2: mosse + oggetto + passiva con mini-grid ------------- */
function buildPage2HTML(entry, pkmn) {
  // Mosse: [base1, base2, finisher] nuovo formato, [base, finisher] vecchio
  const moves   = MOVESETS[pkmn.id] ?? [];
  const isNew   = moves.length >= 3;
  const roles   = isNew ? ['Base 1', 'Base 2', 'Finale'] : ['Base', 'Finale'];
  const moveRows = moves.map((m, i) => `
    <div class="detail-move">
      <span class="detail-move__role">${roles[i] ?? ''}</span>
      <span class="detail-move__name">${m.name}</span>
      <span class="detail-move__type" style="background:${TYPE_COLORS[m.type] ?? '#888'}">${typeLabel(m.type)}</span>
      <span class="detail-move__power">${m.power > 0 ? m.power : '—'}</span>
    </div>`
  ).join('');

  // Oggetto tenuto (per-team)
  const teamSlot = entry.teamSlot;
  const heldId   = getEquipped(pkmn.id, teamSlot);
  const heldItem = heldId ? findItem(heldId) : null;
  const teamLabel = teamSlot != null ? ` (Team ${teamSlot + 1})` : '';
  const heldHTML = heldItem
    ? `<div class="detail-held">
         <span class="detail-held__icon">${heldItem.image
            ? `<img src="${heldItem.image}" alt="${heldItem.name}" onerror="this.outerHTML='${heldItem.icon}'" />`
            : heldItem.icon}</span>
         <div class="detail-held__body">
           <span class="detail-held__label">Oggetto tenuto${teamLabel}</span>
           <span class="detail-held__name">${heldItem.name}</span>
           <span class="detail-held__desc">${heldItem.description}</span>
         </div>
       </div>`
    : `<div class="detail-held detail-held--empty">
         <span class="detail-held__icon">🎒</span>
         <div class="detail-held__body">
           <span class="detail-held__label">Oggetto tenuto${teamLabel}</span>
           <span class="detail-held__name detail-held__name--empty">Nessuno</span>
           <span class="detail-held__desc">Equipaggia un oggetto dalla Collezione → Team.</span>
         </div>
       </div>`;

  // Passiva con mini-grid 3×2
  const passiveHTML = (() => {
    const passive = getPassive(pkmn.id);
    if (!passive) {
      return `<div class="detail-passiva">
        <span class="detail-passiva__label">Passiva</span>
        <span class="detail-passiva__text">In arrivo…</span>
      </div>`;
    }
    const SLOTS_ORDER = [
      'front-left', 'front-center', 'front-right',
      'back-left',  'back-center',  'back-right',
    ];
    const activeSet = new Set(passive.activeSlots);
    const gridCells = SLOTS_ORDER.map(s => {
      const isActive = activeSet.has(s);
      return `<span class="passiva-grid__cell${isActive ? ' is-active' : ''}" data-slot="${s}"></span>`;
    }).join('');
    return `<div class="detail-passiva">
      <span class="detail-passiva__label">Passiva — ${passive.name}</span>
      <span class="detail-passiva__text">${passive.effect}</span>
      <div class="detail-passiva__field">
        <div class="passiva-grid" aria-label="Posizioni di attivazione">${gridCells}</div>
        <span class="detail-passiva__hint">Attiva nelle caselle illuminate</span>
      </div>
    </div>`;
  })();

  return `
    <span class="detail-section-label">Mosse</span>
    <div class="detail-moves">${moveRows || '<p style="color:var(--text-muted);font-size:0.75rem">Nessuna mossa</p>'}</div>
    ${heldHTML}
    ${passiveHTML}
  `;
}
