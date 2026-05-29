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
import { getEquipped }                       from './state.js?v=7';
import { findItem }                          from './items.js?v=3';
import { typeLabel }                          from './types.js';
import { getPassive }                        from './passives.js';
import { getScaledStats, levelLabel }        from './stats-scaling.js?v=3';

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

/* Stato della navigazione "tra carte" (prev/next Pokemon nel modal).
   Popolato da openCardModal quando opts.navList è passato. */
let _navList  = null;     // array di Pokémon ID nella sequenza corrente
let _navIndex = 0;        // indice corrente
let _navOpts  = {};       // opts (teamSlot ecc.) riusato per ogni card

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'card-modal hidden';
  modalEl.innerHTML = `
    <div class="card-modal__backdrop" data-card-close></div>
    <button class="card-modal__card-nav card-modal__card-nav--prev hidden" data-card-nav="prev" aria-label="Pokémon precedente">‹</button>
    <button class="card-modal__card-nav card-modal__card-nav--next hidden" data-card-nav="next" aria-label="Pokémon successivo">›</button>
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

  // Navigazione tra Pokémon (esterno, ai lati del card-modal).
  modalEl.querySelectorAll('[data-card-nav]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      navigateCard(btn.dataset.cardNav);
    });
  });

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

  // ESC chiude. Su mobile / con nav-list attiva, ← → cambiano Pokémon
  // (più utile); altrimenti cambiano pagina del singolo Pokémon.
  document.addEventListener('keydown', e => {
    if (modalEl.classList.contains('hidden')) return;
    if (e.key === 'Escape') { closeCardModal(); return; }
    if (e.key === 'ArrowRight') {
      if (_navList && _navIndex < _navList.length - 1) navigateCard('next');
      else setModalPage(1);
    } else if (e.key === 'ArrowLeft') {
      if (_navList && _navIndex > 0) navigateCard('prev');
      else setModalPage(0);
    }
  });
  return modalEl;
}

/** Naviga al prev/next Pokémon nella lista corrente (se presente). */
function navigateCard(dir) {
  if (!_navList) return;
  if (dir === 'prev' && _navIndex > 0) _navIndex--;
  else if (dir === 'next' && _navIndex < _navList.length - 1) _navIndex++;
  else return;
  // Re-render mantenendo navList intatto.
  const nextId = _navList[_navIndex];
  openCardModal(nextId, { ..._navOpts, navList: _navList, navIndex: _navIndex });
}

function updateCardNavButtons() {
  if (!modalEl) return;
  const prev = modalEl.querySelector('[data-card-nav="prev"]');
  const next = modalEl.querySelector('[data-card-nav="next"]');
  if (!_navList || _navList.length <= 1) {
    prev?.classList.add('hidden');
    next?.classList.add('hidden');
    return;
  }
  prev?.classList.remove('hidden');
  next?.classList.remove('hidden');
  if (prev) prev.disabled = _navIndex === 0;
  if (next) next.disabled = _navIndex === _navList.length - 1;
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

/**
 * Apre il modal per un Pokemon.
 * opts:
 *   - teamSlot:     se != null, mostra l'oggetto del team specifico (default = active)
 *   - heldOverride: oggetto item (o null) da mostrare invece di getEquipped.
 *                   Usato in battaglia per le carte avversarie: senza
 *                   override il modal pesca dall'inventario del player,
 *                   mostrando l'oggetto SBAGLIATO sul nemico.
 *   - heldHidden:   true → nasconde del tutto la riga "Oggetto tenuto"
 *                   (es. nemico in PvE senza items definiti).
 */
export function openCardModal(pokemonId, opts = {}) {
  const pkmn = findPokemon(pokemonId);
  if (!pkmn) return;
  const rarity   = getRarity(pokemonId);
  const teamSlot = opts.teamSlot ?? null;

  // Aggiorna lo stato di navigazione "tra carte". Se opts include navList,
  // i bottoni laterali ‹ › appariranno e cambieranno Pokémon senza chiudere.
  if (Array.isArray(opts.navList) && opts.navList.length > 0) {
    _navList  = opts.navList;
    _navIndex = Math.max(0, Math.min(_navList.length - 1, opts.navIndex ?? _navList.indexOf(pokemonId)));
    // Salvo opts "puliti" da riusare nelle navigate (senza il navList/index circolari).
    const { navList, navIndex, ...rest } = opts;
    _navOpts = rest;
  } else if (opts.navList === null) {
    // Reset esplicito
    _navList = null; _navIndex = 0; _navOpts = {};
  }

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

  // Artwork con fallback automatico allo sprite se la webp custom manca
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
  page2.innerHTML = buildPage2HTML({ id: pokemonId, teamSlot, heldOverride: opts.heldOverride, heldHidden: opts.heldHidden },  pkmn);
  // openOnPage: 0 (default = pagina 1 con stats) o 1 (pagina 2 con item/passiva)
  setModalPage(opts.openOnPage === 1 ? 1 : 0);

  // Glow di rarità
  glow.style.background = GLOW_PER_RARITY[rarity] ?? GLOW_PER_RARITY.common;

  // Aggiorna visibilità/state dei bottoni di navigazione tra carte
  updateCardNavButtons();

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Anima le barre stat dopo il fade-in
  setTimeout(() => {
    right.querySelectorAll('.detail-stat__bar').forEach(bar => {
      const val = parseInt(bar.dataset.val ?? '0', 10);
      const label = bar.dataset.label ?? 'HP';
      const max   = STAT_MAX[label] ?? 250;
      bar.style.width = `${Math.min(100, (val / max) * 100)}%`;
    });
  }, 220);
}

// Max scale per stat (per le bar) — proporzionato ai valori scalati massimi
// che possono apparire in pool: HP fino a ~1100 (Snorlax leg sim.), DEF/SP.D
// fino a ~700 (tank epici), ATK/SP.A fino a ~300, VEL fino a 160.
const STAT_MAX = {
  HP:    1100,
  ATK:   320,
  'SP.A':320,
  DEF:   700,
  'SP.D':700,
  VEL:   180,
};

export function closeCardModal() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ---- PAGINA 1: rarità + nome + tipi + ruolo + stats + meta -------- */
// Colori fissi per stat — distingue a colpo d'occhio phys vs spec senza
// dover leggere la label. ATK (fisica) e SP.A (speciale) hanno colori
// nettamente diversi così la categoria del Pokemon è subito chiara.
const STAT_COLORS = {
  HP:    '#4dad5b',   // verde (vitalità)
  ATK:   '#ee1515',   // rosso (attacco fisico)
  'SP.A':'#a040a0',   // viola (attacco speciale)
  DEF:   '#6890f0',   // blu (difesa fisica)
  'SP.D':'#5ee8d8',   // ciano (difesa speciale)
  VEL:   '#ffcb05',   // giallo (velocità)
};

// Icone per stat: aiutano a distinguere ATK/SP.A e DEF/SP.D a colpo d'occhio.
const STAT_ICONS = {
  HP:    '❤',
  ATK:   '⚔',
  'SP.A':'✨',
  DEF:   '🛡',
  'SP.D':'🌀',
  VEL:   '⚡',
};

function buildPage1HTML(entry, pkmn) {
  const starsStr  = '★'.repeat(tierStars(entry.rarity));
  const rarityLbl = tierLabel(entry.rarity);

  const typeBadges = (pkmn.types ?? []).map(t =>
    `<span class="detail-type-badge" style="background:${TYPE_COLORS[t] ?? '#888'}">${typeLabel(t)}</span>`
  ).join('');

  // Stats SCALATE per rarità (HP/DEF molto su, ATK/SP.A poco su)
  const s = getScaledStats(pkmn);
  // Categoria attacco del Pokemon: physical se ATK base >= SP.ATK base.
  // Uso le RAW stats per la decisione, non le scaled (la categoria non cambia col scaling).
  const raw = pkmn.stats ?? {};
  const isPhys = (raw.atk ?? 0) >= (raw.spAtk ?? 0);
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
    const color = STAT_COLORS[label] ?? '#a8b3cf';
    const icon  = STAT_ICONS[label]  ?? '';
    return `
      <div class="detail-stat">
        <span class="detail-stat__label" style="color:${color}"><span aria-hidden="true" style="margin-right:4px">${icon}</span>${label}</span>
        <div class="detail-stat__bar-wrap">
          <div class="detail-stat__bar" style="background:${color}" data-val="${val}" data-label="${label}"></div>
        </div>
        <span class="detail-stat__val">${val}</span>
      </div>`;
  }).join('');

  // ---- Profilo Difensivo: indica chiaramente se è più tank Fisico o Speciale.
  // Risolve l'assenza di indicatore SP.D: ora c'è un badge esplicito.
  const defS  = s.def   ?? 0;
  const sdefS = s.spDef ?? 0;
  const defDelta = Math.abs(defS - sdefS);
  const defThreshold = Math.max(defS, sdefS) * 0.12;   // bilanciato se < 12% di scarto
  let defRole;
  if (defDelta <= defThreshold)       defRole = { icon: '⚖', label: 'Difesa Bilanciata', color: '#a8b3cf' };
  else if (defS > sdefS)              defRole = { icon: '🛡', label: 'Tank Fisico',       color: '#6890f0' };
  else                                defRole = { icon: '🌀', label: 'Tank Speciale',     color: '#5ee8d8' };

  // ---- Ruolo (cat + role label) ----
  const roleIcon  = isPhys ? '⚔' : '✨';
  const roleLabel = isPhys ? 'Attaccante Fisico' : 'Attaccante Speciale';
  const roleColor = isPhys ? '#ee1515' : '#a040a0';

  // ---- Meta: BST totale, altezza, peso ----
  const bst    = (s.hp ?? 0) + (s.atk ?? 0) + (s.def ?? 0) + (s.spAtk ?? 0) + (s.spDef ?? 0) + (s.speed ?? 0);
  // PokeAPI: height in decimetri, weight in ettogrammi
  const heightM = pkmn.height ? (pkmn.height / 10).toFixed(1) : '—';
  const weightK = pkmn.weight ? (pkmn.weight / 10).toFixed(1) : '—';

  return `
    <div class="detail-rarity detail-rarity--${entry.rarity}">
      <span class="detail-rarity__stars">${starsStr}</span>
      <span class="detail-rarity__label">${rarityLbl}</span>
      <span class="detail-rarity__level">${levelLabel(pkmn.id)}</span>
    </div>
    <div class="detail-name">${pkmn.name}</div>
    <div class="detail-types">${typeBadges}</div>

    <div class="detail-role-row">
      <div class="detail-role" style="--role-color:${roleColor}">
        <span class="detail-role__icon">${roleIcon}</span>
        <span class="detail-role__label">${roleLabel}</span>
      </div>
      <div class="detail-role detail-role--def" style="--role-color:${defRole.color}">
        <span class="detail-role__icon">${defRole.icon}</span>
        <span class="detail-role__label">${defRole.label}</span>
      </div>
    </div>

    <span class="detail-section-label">Base Stats</span>
    <div class="detail-stats">${statRows}</div>

    <div class="detail-meta">
      <div class="detail-meta__item">
        <span class="detail-meta__label">Totale</span>
        <span class="detail-meta__value detail-meta__value--bst">${bst}</span>
      </div>
      <div class="detail-meta__item">
        <span class="detail-meta__label">Altezza</span>
        <span class="detail-meta__value">${heightM} m</span>
      </div>
      <div class="detail-meta__item">
        <span class="detail-meta__label">Peso</span>
        <span class="detail-meta__value">${weightK} kg</span>
      </div>
    </div>
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

  // Oggetto tenuto (per-team).
  // Priorità: heldOverride (es. enemy in battaglia) > getEquipped del player.
  // Se heldHidden: niente sezione (utile per nemici PvE senza items).
  const teamSlot   = entry.teamSlot;
  let heldItem = null;
  if (entry.heldOverride !== undefined) {
    heldItem = entry.heldOverride;   // può essere null o un item object
  } else {
    const heldId = getEquipped(pkmn.id, teamSlot);
    heldItem = heldId ? findItem(heldId) : null;
  }
  const teamLabel = teamSlot != null ? ` (Team ${teamSlot + 1})` : '';
  let heldHTML = '';
  if (entry.heldHidden) {
    heldHTML = '';   // nessuna sezione oggetto (es. nemico PvE)
  } else if (heldItem) {
    heldHTML = `<div class="detail-held">
         <span class="detail-held__icon">${heldItem.image
            ? `<img src="${heldItem.image}" alt="${heldItem.name}" onerror="this.outerHTML='${heldItem.icon}'" />`
            : heldItem.icon}</span>
         <div class="detail-held__body">
           <span class="detail-held__label">Oggetto tenuto${teamLabel}</span>
           <span class="detail-held__name">${heldItem.name}</span>
           <span class="detail-held__desc">${heldItem.description}</span>
         </div>
       </div>`;
  } else {
    heldHTML = `<div class="detail-held detail-held--empty">
         <span class="detail-held__icon">🎒</span>
         <div class="detail-held__body">
           <span class="detail-held__label">Oggetto tenuto${teamLabel}</span>
           <span class="detail-held__name detail-held__name--empty">Nessuno</span>
           <span class="detail-held__desc">Equipaggia un oggetto dalla Collezione → Team.</span>
         </div>
       </div>`;
  }

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
