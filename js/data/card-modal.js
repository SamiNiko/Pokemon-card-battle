/* ============================================================
   card-modal.js — Modal full-card riusabile
   ============================================================
   API:
     openCardModal(pokemonId)   apre il modal per il Pokémon
     closeCardModal()           chiude se aperto
   ============================================================ */

import { findPokemon }                       from './pokeapi.js';
import { MOVESETS }                          from './movesets.js?v=2';
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
      <div class="card-modal__right"></div>
    </div>
  `;
  document.body.appendChild(modalEl);

  modalEl.querySelectorAll('[data-card-close]').forEach(el => {
    el.addEventListener('click', closeCardModal);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) closeCardModal();
  });
  return modalEl;
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

  // Pannello destro
  right.innerHTML = buildCardDetailHTML({ id: pokemonId, rarity, teamSlot }, pkmn);

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

/* ---- HTML del pannello destro (riusa le classi .detail-* del card-modal.css) ---- */
function buildCardDetailHTML(entry, pkmn) {
  // tierStars(rarity) restituisce il NUMERO di stelle: convertiamo in stringa Unicode
  const starsStr    = '★'.repeat(tierStars(entry.rarity));
  const rarityLbl   = tierLabel(entry.rarity);

  const typeBadges = (pkmn.types ?? []).map(t =>
    `<span class="detail-type-badge" style="background:${TYPE_COLORS[t] ?? '#888'}">${typeLabel(t)}</span>`
  ).join('');

  const s = pkmn.stats ?? {};
  const statRows = [
    { label: 'HP',   val: s.hp    ?? 0 },
    { label: 'ATK',  val: s.atk   ?? 0 },
    { label: 'DEF',  val: s.def   ?? 0 },
    { label: 'SP.A', val: s.spAtk ?? 0 },
    { label: 'VEL',  val: s.speed ?? 0 },
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

  // Oggetto tenuto (per-team): se entry.teamSlot è dato, usa quello, altrimenti activeTeam.
  // Se non c'è un team specifico (es. dal Pokédex), mostra anche il numero del team.
  const teamSlot = entry.teamSlot;
  const heldId   = getEquipped(pkmn.id, teamSlot);
  const heldItem = heldId ? findItem(heldId) : null;
  const teamLabel = teamSlot != null ? ` (Team ${teamSlot + 1})` : '';
  const heldHTML = heldItem
    ? `<div class="detail-held">
         <span class="detail-held__icon">${heldItem.icon}</span>
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

  return `
    <div class="detail-rarity detail-rarity--${entry.rarity}">
      <span class="detail-rarity__stars">${starsStr}</span>
      <span class="detail-rarity__label">${rarityLbl}</span>
    </div>
    <div class="detail-name">${pkmn.name}</div>
    <div class="detail-types">${typeBadges}</div>
    <span class="detail-section-label">Base Stats</span>
    <div class="detail-stats">${statRows}</div>
    <span class="detail-section-label">Mosse</span>
    <div class="detail-moves">${moveRows || '<p style="color:var(--text-muted);font-size:0.75rem">Nessuna mossa</p>'}</div>
    ${heldHTML}
    ${(() => {
      const passive = getPassive(pkmn.id);
      if (!passive) {
        return `<div class="detail-passiva">
          <span class="detail-passiva__label">Passiva</span>
          <span class="detail-passiva__text">In arrivo…</span>
        </div>`;
      }
      // Friendly slot labels: front-center → "Centro fronte" etc.
      const SLOT_LABEL = {
        'front-left': 'Fronte Sx', 'front-center': 'Fronte Centro', 'front-right': 'Fronte Dx',
        'back-left':  'Retro Sx',  'back-center':  'Retro Centro',  'back-right':  'Retro Dx',
      };
      const slots = passive.activeSlots.map(s => SLOT_LABEL[s] ?? s).join(' · ');
      return `<div class="detail-passiva">
        <span class="detail-passiva__label">Passiva — ${passive.name}</span>
        <span class="detail-passiva__text">${passive.effect}</span>
        <span class="detail-passiva__slots">Attiva in: <b>${slots}</b></span>
      </div>`;
    })()}
  `;
}
