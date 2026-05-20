/* ============================================================
   stats.js — pagina statistiche & cronologia battaglie
   ============================================================ */

// Cloud sync caricato dinamicamente (non bloccante)
import('./data/cloud-sync.js?v=3').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState }                    from './data/state.js?v=6';
import {
  getMatchHistory,
  getLifetimeStats,
  getTopPokemon,
  formatDuration,
  formatRelativeDate,
} from './data/match-history.js';
import {
  LEGGENDARI, PSEUDO_LEGGENDARI, EPICI, RARI, NON_COMUNI, COMUNI,
  getRarity, tierLabel, tierStars, tierColor,
} from './data/rarity.js';
import { openCardModal } from './data/card-modal.js?v=9';
import { playBGM }       from './data/bgm.js?v=4';

playBGM('stats');

const $ = id => document.getElementById(id);

/* ================================================================
   INIT
   ================================================================ */

(async function init() {
  try {
    await loadAllPokemon();
  } catch (e) {
    console.warn('Caricamento Pokémon parziale:', e);
  }

  renderCollection();
  renderStats();
  renderTopPokemon();
  renderHistory();
  bindModalClose();
})();

/* ================================================================
   COLLECTION — completion globale + breakdown per rarità
   ================================================================ */

const RARITY_BUCKETS = [
  { key: 'legendary', label: 'Leggendari',          ids: LEGGENDARI       },
  { key: 'pseudo',    label: 'Pseudo Leggendari',   ids: PSEUDO_LEGGENDARI },
  { key: 'epic',      label: 'Epici',               ids: EPICI            },
  { key: 'rare',      label: 'Rari',                ids: RARI             },
  { key: 'uncommon',  label: 'Non Comuni',          ids: NON_COMUNI       },
  { key: 'common',    label: 'Comuni',              ids: COMUNI           },
];

function renderCollection() {
  const owned = new Set(getState().owned ?? []);
  const total = LEGGENDARI.length + PSEUDO_LEGGENDARI.length + EPICI.length
              + RARI.length + NON_COMUNI.length + COMUNI.length;
  const ownedCount = [...owned].filter(id => id >= 1 && id <= 151).length;
  const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

  $('collectionCount').textContent   = `${ownedCount} / ${total}`;
  $('collectionFill').style.width    = `${pct}%`;
  $('collectionPercent').textContent = `${pct}%`;

  // Breakdown per rarità
  const container = $('rarityBreakdown');
  container.innerHTML = '';
  for (const bucket of RARITY_BUCKETS) {
    const ownedHere = bucket.ids.filter(id => owned.has(id)).length;
    const totalHere = bucket.ids.length;
    const pctHere   = totalHere > 0 ? Math.round((ownedHere / totalHere) * 100) : 0;
    const color     = tierColor(bucket.key);
    const stars     = '★'.repeat(tierStars(bucket.key));

    const card = document.createElement('div');
    card.className = `rarity-card rarity-card--${bucket.key}`;
    card.innerHTML = `
      <div class="rarity-card__header">
        <span class="rarity-card__stars" style="color:${color}">${stars}</span>
        <span class="rarity-card__label">${bucket.label}</span>
      </div>
      <div class="rarity-card__count">
        <span class="rarity-card__owned">${ownedHere}</span>
        <span class="rarity-card__total">/ ${totalHere}</span>
      </div>
      <div class="rarity-card__bar">
        <div class="rarity-card__fill" style="width:${pctHere}%; background:${color}"></div>
      </div>
    `;
    container.appendChild(card);
  }
}

/* ================================================================
   STATS — numeri grandi
   ================================================================ */

function renderStats() {
  const s = getLifetimeStats();
  const total = s.totalMatches ?? 0;
  const wins  = s.wins         ?? 0;
  const losses = s.losses      ?? 0;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) + '%' : '—';

  $('statTotal').textContent     = total;
  $('statWins').textContent      = wins;
  $('statLosses').textContent    = losses;
  $('statWinRate').textContent   = winRate;

  const streak = s.currentStreak ?? 0;
  $('statStreak').textContent = streak === 0
    ? '0'
    : streak > 0 ? `🔥 ${streak}` : `❄ ${Math.abs(streak)}`;
  $('statBestStreak').textContent = `🔥 ${s.longestStreak ?? 0}`;

  $('statAi').textContent  = `${s.aiWins  ?? 0} / ${(s.aiWins  ?? 0) + (s.aiLosses  ?? 0)}`;
  $('statPvp').textContent = `${s.pvpWins ?? 0} / ${(s.pvpWins ?? 0) + (s.pvpLosses ?? 0)}`;

  $('statDmgDealt').textContent = (s.damageDealt ?? 0).toLocaleString('it-IT');
  $('statDmgTaken').textContent = (s.damageTaken ?? 0).toLocaleString('it-IT');

  const playTime = s.totalPlayTimeSec ?? 0;
  const totalMin = Math.floor(playTime / 60);
  $('statPlayTime').textContent = totalMin > 60
    ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
    : `${totalMin}m`;

  $('statAvgDuration').textContent = total > 0
    ? formatDuration(Math.round(playTime / total))
    : '—';
}

/* ================================================================
   TOP POKÉMON
   ================================================================ */

function renderTopPokemon() {
  const top = getTopPokemon(5);
  const container = $('topPokemon');

  if (top.length === 0) {
    container.innerHTML = '<p class="stats-empty">Nessun dato — gioca le tue prime battaglie!</p>';
    return;
  }

  container.innerHTML = '';
  top.forEach((entry, idx) => {
    const pkmn = findPokemon(entry.id);
    if (!pkmn) return;
    const rarity = getRarity(entry.id);
    const color  = tierColor(rarity);
    const winPct = (entry.winRate * 100).toFixed(0);

    const row = document.createElement('button');
    row.type  = 'button';
    row.className = 'mvp-row';
    row.title = 'Apri carta';
    row.innerHTML = `
      <span class="mvp-row__rank">#${idx + 1}</span>
      <img class="mvp-row__sprite" src="${pkmn.sprite.default}" alt="${pkmn.name}" />
      <div class="mvp-row__info">
        <span class="mvp-row__name">${pkmn.name}</span>
        <span class="mvp-row__rarity" style="color:${color}">${tierLabel(rarity)}</span>
      </div>
      <div class="mvp-row__stats">
        <span class="mvp-row__count">${entry.count}× schierato</span>
        <span class="mvp-row__winrate">${entry.wins} vinte (${winPct}%)</span>
      </div>
    `;
    row.addEventListener('click', () => openCardModal(entry.id));
    container.appendChild(row);
  });
}

/* ================================================================
   MATCH HISTORY — lista
   ================================================================ */

function renderHistory() {
  const history = getMatchHistory();
  const list = $('matchList');

  if (history.length === 0) {
    list.innerHTML = '<p class="stats-empty">Nessuna battaglia registrata. Vai a Gioca per cominciare!</p>';
    return;
  }

  list.innerHTML = '';
  history.forEach(match => {
    const row = document.createElement('button');
    row.className = `match-row match-row--${match.result}`;
    row.type = 'button';

    const myIcons = match.myTeam.slice(0, 6).map(id => {
      const p = findPokemon(id);
      return p ? `<img class="match-row__icon" src="${p.sprite.default}" alt="" />` : '';
    }).join('');

    const enemyIcons = match.enemyTeam.slice(0, 6).map(id => {
      const p = findPokemon(id);
      return p ? `<img class="match-row__icon" src="${p.sprite.default}" alt="" />` : '';
    }).join('');

    const resultIcon = match.result === 'win' ? '🏆' : match.result === 'loss' ? '💀' : '⚖';
    const resultLabel = match.result === 'win' ? 'Vittoria' : match.result === 'loss' ? 'Sconfitta' : 'Pareggio';
    const modeBadge = match.mode === 'pvp' ? '🌐 PvP' : match.mode === 'story' ? '🗺 Storia' : '🤖 CPU';

    row.innerHTML = `
      <div class="match-row__main">
        <div class="match-row__verdict">
          <span class="match-row__icon-big">${resultIcon}</span>
          <span class="match-row__label">${resultLabel}</span>
        </div>
        <div class="match-row__meta">
          <span class="match-row__mode">${modeBadge}</span>
          <span class="match-row__opponent">vs ${escapeHtml(match.opponent)}</span>
          <span class="match-row__date">${formatRelativeDate(match.timestamp)}</span>
        </div>
      </div>
      <div class="match-row__teams">
        <div class="match-row__team match-row__team--mine">${myIcons}</div>
        <span class="match-row__vs">vs</span>
        <div class="match-row__team match-row__team--enemy">${enemyIcons}</div>
      </div>
      <div class="match-row__stats">
        <span>⏱ ${formatDuration(match.durationSec)}</span>
        <span>🔄 ${match.turns} turni</span>
      </div>
    `;
    row.addEventListener('click', () => openMatchModal(match));
    list.appendChild(row);
  });
}

/* ================================================================
   MATCH DETAIL MODAL
   ================================================================ */

function openMatchModal(match) {
  const body = $('matchModalBody');

  const myTeamHtml = match.myTeam.map(id => {
    const p = findPokemon(id);
    if (!p) return '';
    const rarity = getRarity(id);
    return `
      <div class="match-team-card match-team-card--${rarity}">
        <img src="${p.sprite.default}" alt="${p.name}" />
        <span>${p.name}</span>
      </div>`;
  }).join('');

  const enemyTeamHtml = match.enemyTeam.map(id => {
    const p = findPokemon(id);
    if (!p) return '';
    const rarity = getRarity(id);
    return `
      <div class="match-team-card match-team-card--${rarity}">
        <img src="${p.sprite.default}" alt="${p.name}" />
        <span>${p.name}</span>
      </div>`;
  }).join('');

  const resultIcon  = match.result === 'win' ? '🏆' : match.result === 'loss' ? '💀' : '⚖';
  const resultLabel = match.result === 'win' ? 'Vittoria' : match.result === 'loss' ? 'Sconfitta' : 'Pareggio';
  const modeBadge   = match.mode === 'pvp' ? '🌐 Online (PvP)' : match.mode === 'story' ? '🗺 Storia' : '🤖 Allenamento CPU';

  body.innerHTML = `
    <header class="match-modal__header match-modal__header--${match.result}">
      <span class="match-modal__icon">${resultIcon}</span>
      <div>
        <h3 class="match-modal__title">${resultLabel}</h3>
        <p class="match-modal__sub">${modeBadge} · vs ${escapeHtml(match.opponent)}</p>
      </div>
    </header>

    <div class="match-modal__numbers">
      <div><span class="match-modal__nlabel">Data</span><span>${formatRelativeDate(match.timestamp)}</span></div>
      <div><span class="match-modal__nlabel">Durata</span><span>${formatDuration(match.durationSec)}</span></div>
      <div><span class="match-modal__nlabel">Turni</span><span>${match.turns}</span></div>
      <div><span class="match-modal__nlabel">Danni inflitti</span><span>${match.damageDealt.toLocaleString('it-IT')}</span></div>
      <div><span class="match-modal__nlabel">Danni subiti</span><span>${match.damageTaken.toLocaleString('it-IT')}</span></div>
    </div>

    <section class="match-modal__teams">
      <h4>Il tuo team</h4>
      <div class="match-team-grid">${myTeamHtml || '<p class="stats-empty">—</p>'}</div>
      <h4>Team avversario</h4>
      <div class="match-team-grid">${enemyTeamHtml || '<p class="stats-empty">—</p>'}</div>
    </section>
  `;

  $('matchModal').classList.remove('hidden');
}

function bindModalClose() {
  const modal = $('matchModal');
  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', () => modal.classList.add('hidden'));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') modal.classList.add('hidden');
  });
}

/* ================================================================
   UTIL
   ================================================================ */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
