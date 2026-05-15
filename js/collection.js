/* ============================================================
   collection.js — Team / Pokémon / Oggetti
   ============================================================ */

// Cloud sync dinamico: se la CDN Supabase è bloccata, la pagina funziona lo stesso
import('./data/cloud-sync.js?v=3').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import {
  getState,
  isOwned,
  getTeamSlot,
  setTeamSlot,
  addToTeamSlot,
  removeFromTeamSlot,
  setActiveTeam,
  getOwnedItems,
  getEquipped,
  getPokemonHoldingItem,
  getItemUsages,
  equipItem,
  unequipItem,
  removeItem,
} from './data/state.js?v=3';
import { openCardModal }                       from './data/card-modal.js';
import { findItem, ITEM_CATEGORIES, isItemAllowedForPokemon } from './data/items.js?v=3';
import { typeLabel }                            from './data/types.js';

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

const SLOT_LETTERS = ['1', '2', '3', '4'];   // ora numeri (per coerenza con UI)

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
  if (name === 'items') renderInventory();
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
        const cardEl = makeCard(pkmn);
        cardEl.style.cursor = 'pointer';
        cardEl.title = 'Apri carta';
        cardEl.addEventListener('click', e => {
          e.stopPropagation();
          openCardModal(id, { teamSlot: currentSlot });
        });
        // Badge oggetto tenuto (per-team: usa currentSlot, NON activeTeam)
        const heldId   = getEquipped(id, currentSlot);
        const heldItem = heldId ? findItem(heldId) : null;
        const itemBtn  = document.createElement('button');
        itemBtn.type   = 'button';
        itemBtn.className = heldItem ? 'team-slot__item' : 'team-slot__item team-slot__item--empty';
        itemBtn.title  = heldItem
          ? `${heldItem.name} — clicca per cambiare`
          : 'Equipaggia un oggetto';
        itemBtn.setAttribute('aria-label', heldItem ? `Oggetto: ${heldItem.name}` : 'Equipaggia oggetto');
        if (heldItem) {
          // Usa immagine se disponibile, altrimenti emoji fallback
          if (heldItem.image) {
            itemBtn.innerHTML = `<img src="${heldItem.image}" alt="${heldItem.name}"
              onerror="this.outerHTML='${heldItem.icon}'" />`;
          } else {
            itemBtn.textContent = heldItem.icon;
          }
        } else {
          itemBtn.textContent = '+';
        }
        itemBtn.addEventListener('click', e => {
          e.stopPropagation();   // non aprire la card modal
          openItemPicker(id);
        });
        cardEl.appendChild(itemBtn);

        slot.appendChild(cardEl);

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
    `<span class="type-badge" data-type="${t}">${typeLabel(t)}</span>`
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
    chip.textContent = typeLabel(t);
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
    if (!isOwned(p.id)) {
      c.classList.add('is-locked');
    } else {
      // Posseduto → click apre la carta completa
      c.style.cursor = 'pointer';
      c.title = 'Apri carta';
      c.addEventListener('click', () => openCardModal(p.id));
    }
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
  el.className = 'card card--fullart';
  el.dataset.pokemonId = pkmn.id;
  const artUrl = `assets/cards/${String(pkmn.id).padStart(3, '0')}.png`;
  el.innerHTML = `
    <span class="card__hp">${pkmn.stats.hp}</span>
    <div class="card__sprite">
      <img class="card__img" src="${artUrl}" alt="${pkmn.name}" loading="lazy" />
    </div>
    <div class="card__name">${pkmn.name}</div>
    <div class="card__types">
      ${pkmn.types.map(t => `<span class="type-badge" data-type="${t}">${typeLabel(t)}</span>`).join('')}
    </div>
  `;
  // Fallback automatico: se l'artwork non c'è, torna allo sprite pixelato
  const img = el.querySelector('.card__img');
  img.onerror = () => {
    img.onerror = null;
    img.classList.add('is-fallback');
    img.src = pkmn.sprite.default;
  };
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

/* ================================================================
   TAB OGGETTI — INVENTARIO (read-only)
   ================================================================ */

function renderInventory() {
  const grid  = $('#invGrid');
  const empty = $('#invEmpty');
  const count = $('#invCount');
  if (!grid) return;
  grid.innerHTML = '';

  const owned = getOwnedItems();
  count.textContent = `${owned.length} ${owned.length === 1 ? 'oggetto' : 'oggetti'}`;

  if (owned.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  for (const itemId of owned) {
    const item = findItem(itemId);
    if (!item) continue;
    const usages = getItemUsages(itemId);     // [{teamSlot, pokemonId}, ...] cross-team
    const cat    = ITEM_CATEGORIES[item.category];

    const card = document.createElement('div');
    card.className = 'inv-item inv-item--readonly';
    card.dataset.rarity = item.rarity;
    card.style.setProperty('--cat-color', cat.color);

    // Costruisco la sezione "dove è in uso"
    let holderHTML;
    if (usages.length === 0) {
      holderHTML = `<div class="inv-item__holder inv-item__holder--free">
                      <span>● Libero in tutti i team</span>
                    </div>`;
    } else {
      const rows = usages.map(u => {
        const pk = findPokemon(u.pokemonId);
        if (!pk) return '';
        return `<div class="inv-item__use">
                  <span class="inv-item__use-team">Team ${u.teamSlot + 1}</span>
                  <img src="${pk.sprite.default}" alt="${pk.name}" />
                  <span class="inv-item__use-name">${pk.name}</span>
                </div>`;
      }).join('');
      holderHTML = `<div class="inv-item__uses">${rows}</div>`;
    }

    // Icona: <img> se asset, altrimenti emoji
    const iconHTML = item.image
      ? `<div class="inv-item__icon"><img src="${item.image}" alt="${item.name}"
           onerror="this.parentNode.textContent='${item.icon}'" /></div>`
      : `<div class="inv-item__icon">${item.icon}</div>`;

    card.innerHTML = `
      ${iconHTML}
      <div class="inv-item__body">
        <div class="inv-item__head">
          <h3 class="inv-item__name">${item.name}</h3>
          <span class="inv-item__cat" style="background:${cat.color}">${cat.label}</span>
        </div>
        <p class="inv-item__desc">${item.description}</p>
        ${holderHTML}
      </div>
    `;
    grid.appendChild(card);
  }
}

/* ================================================================
   ITEM PICKER MODAL — 2 step
   ================================================================
   Modalità:
     A) openItemPicker(pokemonId)  → mostra solo lo step 1 (lista oggetti).
                                      Click su un oggetto → equipaggia direttamente.
     B) openItemPicker(null)       → step 1 + step 2. Dopo aver scelto l'oggetto,
                                      si passa allo step 2 per scegliere il Pokémon.
*/

let pickerState = { targetPokemonId: null, pickedItemId: null };

function openItemPicker(targetPokemonId = null) {
  pickerState = { targetPokemonId, pickedItemId: null };

  const modal = $('#itemPicker');
  $('#pickerPokemons').classList.add('hidden');
  $('#pickerBack').classList.add('hidden');
  $('#pickerItems').classList.remove('hidden');

  // Titolo + sottotitolo dinamici
  if (targetPokemonId != null) {
    const pk = findPokemon(targetPokemonId);
    const held = getEquipped(targetPokemonId, currentSlot);
    $('#pickerTitle').textContent = `Equipaggia su ${pk?.name ?? 'Pokémon'} (Team ${currentSlot + 1})`;
    $('#pickerSub').textContent = held
      ? `Attualmente tiene ${findItem(held)?.icon ?? ''} ${findItem(held)?.name ?? ''}. Scegli un nuovo oggetto.`
      : 'Scegli un oggetto dall\'inventario.';
  } else {
    $('#pickerTitle').textContent = 'Equipaggia oggetto';
    $('#pickerSub').textContent = `Step 1/2 — Scegli un oggetto. Poi sceglierai a quale Pokémon del team ${currentSlot + 1} darlo.`;
  }

  renderPickerItems();
  modal.classList.remove('hidden');
}

function closeItemPicker() {
  $('#itemPicker').classList.add('hidden');
  pickerState = { targetPokemonId: null, pickedItemId: null };
}

function renderPickerItems() {
  const grid  = $('#pickerItems');
  const empty = $('#pickerEmpty');
  grid.innerHTML = '';

  const owned = getOwnedItems();
  if (owned.length === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  for (const itemId of owned) {
    const item = findItem(itemId);
    if (!item) continue;
    const cat = ITEM_CATEGORIES[item.category];
    // Stato: dov'è già equipaggiato? Distinguo team corrente vs altri team.
    const inThisTeamId   = getPokemonHoldingItem(itemId, currentSlot);
    const inThisTeam     = inThisTeamId != null ? findPokemon(inThisTeamId) : null;
    const otherUsages    = getItemUsages(itemId).filter(u => u.teamSlot !== currentSlot);
    const isCurrentTarget = pickerState.targetPokemonId != null
                             && inThisTeamId === pickerState.targetPokemonId;

    // Restrizione: se c'è un Pokémon target e l'oggetto è esclusivo di altri,
    // mostriamo la card disabilitata
    const targetPk = pickerState.targetPokemonId != null ? findPokemon(pickerState.targetPokemonId) : null;
    const isLocked = !!targetPk && !isItemAllowedForPokemon(itemId, targetPk.id);

    // Icona: <img> se asset, altrimenti emoji
    const iconHTML = item.image
      ? `<img class="picker-item__icon picker-item__icon--img" src="${item.image}" alt="${item.name}"
           onerror="this.outerHTML='<div class=\\'picker-item__icon\\'>${item.icon}</div>'" />`
      : `<div class="picker-item__icon">${item.icon}</div>`;

    const card = document.createElement('button');
    card.type  = 'button';
    card.className = 'picker-item';
    card.dataset.rarity = item.rarity;
    if (isCurrentTarget) card.classList.add('is-current');
    if (isLocked)        card.classList.add('is-locked');
    card.style.setProperty('--cat-color', cat.color);
    card.disabled = isLocked;

    let statusHTML;
    if (isLocked) {
      // Lista i Pokémon a cui è esclusivo
      const allowedNames = (item.restrictedTo || []).map(id => findPokemon(id)?.name ?? '?').join(', ');
      statusHTML = `<span class="picker-item__status picker-item__status--locked">🔒 Esclusivo: ${allowedNames}</span>`;
    } else if (inThisTeam) {
      statusHTML = `<span class="picker-item__status">📌 Su ${inThisTeam.name} in questo team</span>`;
    } else if (otherUsages.length > 0) {
      const others = otherUsages.map(u => {
        const pk = findPokemon(u.pokemonId);
        return `Team ${u.teamSlot + 1} (${pk?.name ?? '?'})`;
      }).join(' · ');
      statusHTML = `<span class="picker-item__status picker-item__status--other">⤷ Anche in: ${others}</span>`;
    } else {
      statusHTML = `<span class="picker-item__status picker-item__status--free">● Libero</span>`;
    }

    card.innerHTML = `
      ${iconHTML}
      <div class="picker-item__body">
        <span class="picker-item__name">${item.name}</span>
        <span class="picker-item__desc">${item.description}</span>
        ${statusHTML}
      </div>
      ${isCurrentTarget ? '<span class="picker-item__check">✓</span>' : ''}
    `;

    if (!isLocked) card.addEventListener('click', () => onPickerItemClick(itemId));
    grid.appendChild(card);
  }
}

function onPickerItemClick(itemId) {
  const item = findItem(itemId);
  if (!item) return;

  if (pickerState.targetPokemonId != null) {
    // Modalità A: equipaggia direttamente NEL TEAM CORRENTE
    const pkId = pickerState.targetPokemonId;
    const pk   = findPokemon(pkId);
    if (getEquipped(pkId, currentSlot) === itemId) { closeItemPicker(); return; }
    equipItem(pkId, itemId, currentSlot);
    closeItemPicker();
    renderTeamSlots();
    if ($('#invGrid')) renderInventory();
    toast(`${item.icon} ${item.name} → ${pk?.name ?? ''} (Team ${currentSlot + 1})`, 'success');
  } else {
    // Modalità B: passa allo step 2 — scelta Pokémon
    pickerState.pickedItemId = itemId;
    renderPickerPokemons();
  }
}

function renderPickerPokemons() {
  const item = findItem(pickerState.pickedItemId);
  if (!item) return;

  $('#pickerTitle').textContent = `Scegli un Pokémon`;
  $('#pickerSub').textContent = `Step 2/2 — A quale Pokémon del team ${currentSlot + 1} dare ${item.icon} ${item.name}?`;
  $('#pickerItems').classList.add('hidden');
  $('#pickerPokemons').classList.remove('hidden');
  $('#pickerBack').classList.remove('hidden');

  const list = $('#pickerPokemons');
  list.innerHTML = '';

  const team = getTeamSlot(currentSlot);
  if (team.length === 0) {
    list.innerHTML = `<p class="picker-empty">Il team ${currentSlot + 1} è vuoto. Aggiungi prima dei Pokémon dal tab "Team".</p>`;
    return;
  }

  for (const pkId of team) {
    const pk = findPokemon(pkId);
    if (!pk) continue;
    const heldId = getEquipped(pkId, currentSlot);
    const heldObj = heldId ? findItem(heldId) : null;
    const isCurrent = heldId === pickerState.pickedItemId;
    const isAllowed = isItemAllowedForPokemon(pickerState.pickedItemId, pkId);

    const row = document.createElement('button');
    row.type  = 'button';
    row.className = 'equip-row';
    if (isCurrent) row.classList.add('is-current');
    if (!isAllowed) row.classList.add('is-locked');
    row.disabled = !isAllowed;

    const heldHTML = isAllowed
      ? (heldObj
          ? `Tiene: ${heldObj.icon} ${heldObj.name}`
          : `<em>Nessun oggetto</em>`)
      : `<span class="equip-row__locked">🔒 Non può equipaggiare questo oggetto</span>`;
    const ctaText = !isAllowed ? 'Non consentito' : (isCurrent ? '✓ In uso' : 'Equipaggia');

    row.innerHTML = `
      <img class="equip-row__sprite" src="${pk.sprite.default}" alt="${pk.name}" />
      <div class="equip-row__info">
        <span class="equip-row__name">${pk.name}</span>
        <span class="equip-row__held">${heldHTML}</span>
      </div>
      <span class="equip-row__cta">${ctaText}</span>
    `;
    if (isAllowed) {
      row.addEventListener('click', () => {
        if (isCurrent) { closeItemPicker(); return; }
        equipItem(pkId, pickerState.pickedItemId, currentSlot);
        closeItemPicker();
        renderTeamSlots();
        if ($('#invGrid')) renderInventory();
        toast(`${item.icon} ${item.name} → ${pk.name} (Team ${currentSlot + 1})`, 'success');
      });
    }
    list.appendChild(row);
  }
}

// Wiring picker
document.querySelectorAll('[data-picker-close]').forEach(el => el.addEventListener('click', closeItemPicker));
$('#pickerBack').addEventListener('click', () => {
  pickerState.pickedItemId = null;
  $('#pickerPokemons').classList.add('hidden');
  $('#pickerBack').classList.add('hidden');
  $('#pickerItems').classList.remove('hidden');
  $('#pickerTitle').textContent = 'Equipaggia oggetto';
  $('#pickerSub').textContent = `Step 1/2 — Scegli un oggetto. Poi sceglierai a quale Pokémon del team ${currentSlot + 1} darlo.`;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeItemPicker();
});

// Bottone "Equipaggia oggetto" nel team-switcher
$('#btnQuickEquip')?.addEventListener('click', () => openItemPicker(null));
