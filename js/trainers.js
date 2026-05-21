/* ============================================================
   trainers.js — Pagina lista Allenatori (sostituto temporaneo
   della Storia). Click su un trainer → modal con preview team +
   bottone Sfida → naviga a battle.html?mode=trainer&id=X
   ============================================================ */

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { TRAINERS, getTrainer, getUnlockedTrainers, getTrainerTotalStars, getTrainerDifficulty } from './data/trainers.js?v=8';
import { getTrainersBeaten, isTrainerBeaten } from './data/state.js?v=6';
import { getRarity, tierStars }               from './data/rarity.js';
import { playBGM }                            from './data/bgm.js?v=7';

playBGM('trainers');

const $  = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

let unlocked = [];

(async () => {
  await loadAllPokemon();
  refreshUnlocked();
  renderList();
  renderProgress();
  bindModalCloseHandlers();
})();

function refreshUnlocked() {
  unlocked = new Set(getUnlockedTrainers(getTrainersBeaten()));
}

function renderProgress() {
  const beaten = getTrainersBeaten();
  $('#trainersProgress').textContent = `${beaten.length} / ${TRAINERS.length}`;
}

function renderList() {
  const root = $('#trainersList');
  root.innerHTML = '';
  TRAINERS.forEach((t, idx) => {
    const beaten   = isTrainerBeaten(t.id);
    const unlock   = unlocked.has(t.id);
    const teamPkmn = t.team.map(id => findPokemon(id)).filter(Boolean);
    const diff     = getTrainerDifficulty(t);
    const stars    = getTrainerTotalStars(t);

    const card = document.createElement('button');
    card.type  = 'button';
    card.className = 'trainer-card' + (beaten ? ' is-beaten' : '') + (!unlock ? ' is-locked' : '');
    card.style.setProperty('--trainer-color', t.color);
    card.disabled = !unlock;

    // Team preview: 6 sprite circolari (anche se team < 6, riempie)
    const teamHTML = teamPkmn.map(p => `
      <span class="trainer-card__pkmn" data-rarity="${getRarity(p.id)}" title="${p.name} · ${'★'.repeat(tierStars(getRarity(p.id)))}">
        <img src="${p.sprite.default}" alt="${p.name}" loading="lazy" />
      </span>
    `).join('');

    // Avatar: usa lo sprite del trainer (Pokemon Showdown) con fallback all'emoji
    const avatarHTML = t.sprite
      ? `<img class="trainer-card__sprite" src="${t.sprite}" alt="${t.name}"
             onerror="this.outerHTML='${t.badge}'" />`
      : t.badge;

    // Costellazione: somma stelle del team + tier difficoltà (Facile→Campione)
    const constellationHTML = `
      <div class="trainer-card__constellation" title="Difficoltà: ${diff.label}" style="--diff-color:${diff.color}">
        <span class="trainer-card__diff-label">${diff.label}</span>
        <span class="trainer-card__stars">${'★'.repeat(Math.min(7, diff.tier))}<span class="trainer-card__stars-dim">${'★'.repeat(7 - Math.min(7, diff.tier))}</span></span>
        <span class="trainer-card__star-count">${stars}★ totali</span>
      </div>`;

    card.innerHTML = `
      <div class="trainer-card__num">${String(idx + 1).padStart(2, '0')}</div>
      <div class="trainer-card__badge">${avatarHTML}</div>
      <div class="trainer-card__main">
        <h3 class="trainer-card__name">${t.name}</h3>
        <p class="trainer-card__title">${t.title}</p>
        <div class="trainer-card__team">${teamHTML}</div>
        ${constellationHTML}
      </div>
      <div class="trainer-card__right">
        ${beaten
          ? '<span class="trainer-card__status trainer-card__status--beaten">✓ Battuto</span>'
          : unlock
            ? `<span class="trainer-card__reward"><span>💎</span> ${t.reward}</span><span class="trainer-card__hint">Tocca per dettagli</span>`
            : '<span class="trainer-card__status trainer-card__status--locked">🔒 Bloccato</span>'
        }
      </div>
    `;

    if (unlock) card.addEventListener('click', () => openTrainerModal(t.id));
    root.appendChild(card);
  });
}

/* ============================================================
   MODAL TRAINER — preview team + bottone Sfida
   ============================================================ */

let currentTrainerId = null;

function openTrainerModal(id) {
  const t = getTrainer(id);
  if (!t) return;
  currentTrainerId = id;

  const modal = $('#trainerModal');
  modal.style.setProperty('--trainer-color', t.color);
  // Avatar grande in alto: sprite con fallback emoji
  $('#trainerModalBadge').innerHTML = t.sprite
    ? `<img class="trainer-modal__sprite" src="${t.sprite}" alt="${t.name}"
           onerror="this.outerHTML='${t.badge}'" />`
    : t.badge;
  $('#trainerModalTitle').textContent     = t.name;
  $('#trainerModalTitleSub').textContent  = t.title;
  $('#trainerModalIntro').textContent     = t.intro;

  // Indicatore difficoltà sul modal
  const diff = getTrainerDifficulty(t);
  const stars = getTrainerTotalStars(t);
  const diffEl = $('#trainerModalDifficulty');
  if (diffEl) {
    diffEl.style.setProperty('--diff-color', diff.color);
    diffEl.innerHTML = `
      <span class="trainer-modal__diff-label">${diff.label}</span>
      <span class="trainer-modal__diff-stars">${'★'.repeat(Math.min(7, diff.tier))}<span class="trainer-modal__diff-stars-dim">${'★'.repeat(7 - Math.min(7, diff.tier))}</span></span>
      <span class="trainer-modal__diff-count">${stars}★ team</span>
    `;
  }

  // Team preview con artwork PNG
  const teamEl = $('#trainerModalTeam');
  teamEl.innerHTML = '';
  t.team.forEach(pid => {
    const p = findPokemon(pid);
    if (!p) return;
    const card = document.createElement('div');
    card.className = 'trainer-modal__pkmn';
    card.dataset.rarity = getRarity(p.id);
    card.innerHTML = `
      <img class="trainer-modal__pkmn-img" src="assets/cards/${String(p.id).padStart(3,'0')}.webp"
           alt="${p.name}"
           onerror="this.onerror=null;this.classList.add('is-fallback');this.src='${p.sprite.default}';" />
      <span class="trainer-modal__pkmn-name">${p.name}</span>
    `;
    teamEl.appendChild(card);
  });

  // Reward visibile solo se non già battuto. Mostriamo sia gemme che pokeuro.
  const rewardEl = $('#trainerModalReward');
  if (isTrainerBeaten(t.id)) {
    rewardEl.classList.add('is-claimed');
    rewardEl.innerHTML = `
      <span>✓</span>
      <b>Già battuto</b>
      <span class="trainer-modal__reward-sub">Nessuna ricompensa</span>
    `;
  } else {
    const coinReward = Math.round(t.reward / 2);
    rewardEl.classList.remove('is-claimed');
    rewardEl.innerHTML = `
      <span>💎</span>
      <b>${t.reward}</b>
      <span style="margin: 0 8px; opacity:.5;">+</span>
      <b>${coinReward}</b>
      <span>🪙</span>
      <span class="trainer-modal__reward-sub">alla prima vittoria</span>
    `;
  }

  modal.classList.remove('hidden');
}

function closeTrainerModal() {
  $('#trainerModal').classList.add('hidden');
  currentTrainerId = null;
}

function bindModalCloseHandlers() {
  $$('[data-trainer-close]').forEach(el => el.addEventListener('click', closeTrainerModal));
  $('#trainerModalFight').addEventListener('click', () => {
    if (!currentTrainerId) return;
    // Naviga a battle.html con mode=trainer & id, il team avversario
    // viene caricato in battle.js da trainers.js.
    window.location.href = `battle.html?mode=trainer&id=${encodeURIComponent(currentTrainerId)}`;
  });
}
