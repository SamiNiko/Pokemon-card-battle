/* ============================================================
   collection.js — Team / Pokémon / Oggetti
   ============================================================ */

// Cloud sync dinamico: se la CDN Supabase è bloccata, la pagina funziona lo stesso
import('./data/cloud-sync.js').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import {
  getState,
  isOwned,
  getTeamSlot,
  setTeamSlot,
  addToTeamSlot,
  removeFromTeamSlot,
  setActiveTeam,
} from './data/state.js';

const $  = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const ALL_TYPES = [
  'normal','fire','water','grass','electric','ice','fighting','poison',
  'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy',
];

const TYPE_COLORS = {
  normal:'#a8a878', fire:'#f08030', water:'#6890f0', grass:'#78c850',
  electric:'#f8d030', ice:'#98d8d8', fighting:'#c03028', poison:'#a040a0',
  ground:'#e0c068', flying:'#a890f0', psychic:'#f85888', bug:'#a8b820',
  rock:'#b8a038', ghost:'#705898', dragon:'#7038f8', dark:'#705848',
  steel:'#b8b8d0', fairy:'#ee99ac',
};

const SLOT_LETTERS = ['A', 'B', 'C', 'D'];

let allPokemon  = [];
let currentSlot = 0;            // slot correntemente visualizzato/giocato (0=A..3=D)
let poolSearch  = '';
let poolType    = null;         // tipo filtrato (null = tutti)

let dexSearch    = '';
let dexOnlyOwned = false;

/* ================================================================
   INIT
   ================================================================ */

(async () => {
  // Tabs principali
  $$('.tab').forEach(t => {
    t.addEventListener('click', () => switchMainTab(t.dataset.tab));
  });

  // Carica dati
  allPokemon = await loadAllPokemon();

  // Inizializza currentSlot dal team attivo salvato
  currentSlot = getState().activeTeam ?? 0;

  // Slot tabs — cliccare un tab cambia il team correntemente selezionato (= quello giocato)
  $$('.slot-tab').forEach(t => {
    t.addEventListener('click', () => {
      currentSlot = parseInt(t.dataset.slot, 10);
      setActiveTeam(currentSlot);
      renderSlotTabs();
      renderTeamTab();
    });
  });

  // Toolbar pool
  $('#poolSearch').addEventListener('input', e => {
    poolSearch = e.target.value.toLowerCase().trim();
    renderTeamTab();
  });

  // Toolbar pokédex
  $('#dexSearch').addEventListener('input', e => {
    dexSearch = e.target.value.toLowerCase().trim();
    renderPokemonGrid();
  });
  $('#dexOnlyOwned').addEventListener('change', e => {
    dexOnlyOwned = e.target.checked;
    renderPokemonGrid();
  });

  // Build chip tipi
  buildTypeChips();

  // Render iniziale
  updateOwnedCount();
  renderSlotTabs();
  renderTeamTab();
  renderPokemonGrid();
  updateBattleBtn();
})();

/* ================================================================
   TAB SWITCHING
   ================================================================ */

function switchMainTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('is-active', p.dataset.tabPanel === name));
}

/* ================================================================
   SLOT TABS (A/B/C/D)
   ================================================================ */

function renderSlotTabs() {
  $$('.slot-tab').forEach(tab => {
    const slot = parseInt(tab.dataset.slot, 10);
    tab.classList.toggle('is-active', slot === currentSlot);
  });
}

/* ================================================================
   TAB TEAM
   ================================================================ */

function renderTeamTab() {
  renderTeamSlots();
  renderTeamSummary();
  renderPool();
  updateBattleBtn();
}

function renderTeamSlots() {
  const root = $('#teamSlots');
  if (!root) return;
  root.innerHTML = '';

  const team = getTeamSlot(currentSlot);

  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = 'team-slot';
    const id = team[i];

    if (id != null) {
      slot.classList.add('is-filled');
      const pkmn = findPokemon(id);
      if (pkmn) {
        slot.appendChild(makeCard(pkmn));
        const removeBtn = document.createElement('button');
        removeBtn.className = 'team-slot__remove';
        removeBtn.dataset.removeId = id;
        removeBtn.setAttribute('aria-label', 'Rimuovi');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', e => {
          e.stopPropagation();
          removeFromTeamSlot(currentSlot, id);
          renderTeamTab();
        });
        slot.appendChild(removeBtn);
      }
    } else {
      slot.textContent = `Slot ${i + 1}`;
    }
    root.appendChild(slot);
  }
}

function renderTeamSummary() {
  const el = $('#teamSummary');
  if (!el) return;

  const team = getTeamSlot(currentSlot);
  const pkmns = team.map(id => findPokemon(id)).filter(Boolean);

  if (pkmns.length === 0) {
    el.innerHTML = `
      <div class="team-summary__title">Riepilogo Team ${SLOT_LETTERS[currentSlot]}</div>
      <div class="team-summary__empty">Aggiungi Pokémon dal pool a destra</div>
    `;
    return;
  }

  const totalHP   = pkmns.reduce((s, p) => s + (p.stats.hp ?? 0), 0);
  const avgAtk    = Math.round(pkmns.reduce((s, p) => s + (p.stats.atk ?? 0), 0) / pkmns.length);
  const avgDef    = Math.round(pkmns.reduce((s, p) => s + (p.stats.def ?? 0), 0) / pkmns.length);
  const avgSpd    = Math.round(pkmns.reduce((s, p) => s + (p.stats.speed ?? 0), 0) / pkmns.length);

  // Tipi unici nel team
  const typeSet = new Set();
  pkmns.forEach(p => p.types.forEach(t => typeSet.add(t)));
  const typeChips = [...typeSet].map(t =>
    `<span class="type-badge" data-type="${t}">${t}</span>`
  ).join('');

  el.innerHTML = `
    <div class="team-summary__title">Riepilogo Team ${SLOT_LETTERS[currentSlot]}</div>
    <div class="team-summary__row"><span>Pokémon</span><strong>${pkmns.length} / 6</strong></div>
    <div class="team-summary__row"><span>HP totale</span><strong>${totalHP}</strong></div>
    <div class="team-summary__row"><span>ATK media</span><strong>${avgAtk}</strong></div>
    <div class="team-summary__row"><span>DEF media</span><strong>${avgDef}</strong></div>
    <div class="team-summary__row"><span>VEL media</span><strong>${avgSpd}</strong></div>
    <div class="team-summary__row"><span>Tipi coperti</span><strong>${typeSet.size}</strong></div>
    <div class="team-summary__types">${typeChips}</div>
  `;
}

function buildTypeChips() {
  const root = $('#poolTypes');
  if (!root) return;
  root.innerHTML = '';
  ALL_TYPES.forEach(t => {
    const chip = document.createElement('button');
    chip.className = 'type-chip';
    chip.style.borderColor = TYPE_COLORS[t];
    chip.style.background  = poolType === t ? TYPE_COLORS[t] : 'transparent';
    chip.textContent = t;
    chip.dataset.type = t;
    chip.addEventListener('click', () => {
      poolType = poolType === t ? null : t;
      // Aggiorna stato visivo dei chip
      $$('.type-chip').forEach(c => {
        const isActive = c.dataset.type === poolType;
        c.classList.toggle('is-active', isActive);
        c.style.background = isActive ? TYPE_COLORS[c.dataset.type] : 'transparent';
      });
      renderPool();
    });
    root.appendChild(chip);
  });
}

function renderPool() {
  const root      = $('#teamPool');
  const emptyMsg  = $('#poolEmpty');
  if (!root) return;
  root.innerHTML = '';

  const team    = getTeamSlot(currentSlot);
  const owned   = allPokemon.filter(p => isOwned(p.id));
  const filtered = owned.filter(p => {
    if (team.includes(p.id)) return false;
    if (poolSearch && !p.name.toLowerCase().includes(poolSearch)) return false;
    if (poolType && !p.types.includes(poolType)) return false;
    return true;
  });

  // Stato vuoto: nessun Pokémon posseduto
  if (owned.length === 0) {
    root.style.display = 'none';
    emptyMsg.classList.remove('hidden');
    return;
  }
  root.style.display = '';
  emptyMsg.classList.add('hidden');

  for (const p of filtered) {
    const card = makeCard(p);
    card.addEventListener('click', () => {
      if (addToTeamSlot(currentSlot, p.id)) {
        renderTeamTab();
      } else {
        toast('Team pieno (max 6)', 'error');
      }
    });
    root.appendChild(card);
  }

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column: 1/-1; color: var(--text-muted); text-align: center; padding: var(--sp-4); font-size: 0.85rem;';
    empty.textContent = 'Nessun Pokémon corrisponde al filtro.';
    root.appendChild(empty);
  }
}

/* ================================================================
   TAB POKÉDEX
   ================================================================ */

function renderPokemonGrid() {
  const root = $('#pokemonGrid');
  if (!root) return;
  root.innerHTML = '';

  const filtered = allPokemon.filter(p => {
    if (dexOnlyOwned && !isOwned(p.id)) return false;
    if (dexSearch && !p.name.toLowerCase().includes(dexSearch)) return false;
    return true;
  });

  for (const p of filtered) {
    const c = makeCard(p);
    if (!isOwned(p.id)) c.classList.add('is-locked');
    root.appendChild(c);
  }

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column: 1/-1; color: var(--text-muted); text-align: center; padding: var(--sp-5); font-size: 0.9rem;';
    empty.textContent = 'Nessun Pokémon trovato.';
    root.appendChild(empty);
  }
}

/* ================================================================
   UTILITIES
   ================================================================ */

function makeCard(pkmn) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.pokemonId = pkmn.id;
  el.innerHTML = `
    <span class="card__hp">${pkmn.stats.hp}</span>
    <div class="card__sprite">
      <img src="${pkmn.sprite.default}" alt="${pkmn.name}" loading="lazy" />
    </div>
    <div class="card__name">${pkmn.name}</div>
    <div class="card__types">
      ${pkmn.types.map(t => `<span class="type-badge" data-type="${t}">${t}</span>`).join('')}
    </div>
  `;
  return el;
}

function updateOwnedCount() {
  const count = getState().owned.length;
  $('#ownedCount').textContent = `${count} / 151`;
}

function updateBattleBtn() {
  const btn = $('#btnBattle');
  if (!btn) return;
  const team = getTeamSlot(currentSlot);
  btn.classList.toggle('hidden', team.length === 0);
  btn.textContent = `⚔ Vai in Battaglia con Team ${SLOT_LETTERS[currentSlot]} (${team.length}/6)`;
}

/* ---- Toast ---- */
let _toastTimer = null;
function toast(msg, type = 'success') {
  const el  = $('#toast');
  const txt = $('#toastMsg');
  if (!el) return;
  txt.textContent = msg;
  el.className = `toast toast--${type}`;
  el.classList.remove('hidden');
  void el.offsetWidth;
  el.classList.add('is-shown');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('is-shown');
    setTimeout(() => el.classList.add('hidden'), 250);
  }, 2200);
}
