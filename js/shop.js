/* ============================================================
   shop.js — Negozio oggetti tenuti
   ============================================================ */

// Cloud sync dinamico
import('./data/cloud-sync.js?v=5').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { getState, saveState, ownsItem, addItem } from './data/state.js?v=6';
import { ITEMS, ITEM_CATEGORIES, findItem } from './data/items.js?v=3';
import { playBGM }                          from './data/bgm.js?v=9';

playBGM('shop');

const $ = id => document.getElementById(id);

let gs;
let currentCategory = 'all';     // 'all' o id categoria
let searchQuery     = '';
let pendingBuyId    = null;

/* ================================================================
   WALLET
   ================================================================ */
function updateWallet() {
  $('walletEuro').textContent = gs.pokeuro ?? 0;
  $('walletGems').textContent = gs.gems    ?? 0;
}

// Inventory: 1 copia max per oggetto. Helper centrali in state.js

/* ================================================================
   TABS CATEGORIE
   ================================================================ */
function renderTabs() {
  const root = $('shopTabs');
  root.innerHTML = '';

  // Tab "Tutti"
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'shop-tab' + (currentCategory === 'all' ? ' is-active' : '');
  all.innerHTML = `📦 Tutti <span class="shop-tab__count">${ITEMS.length}</span>`;
  all.style.setProperty('--cat-color', '#5ee8d8');
  all.addEventListener('click', () => { currentCategory = 'all'; renderTabs(); renderItems(); });
  root.appendChild(all);

  // Tab per categoria
  for (const cat of Object.values(ITEM_CATEGORIES)) {
    const count = ITEMS.filter(it => it.category === cat.id).length;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'shop-tab' + (currentCategory === cat.id ? ' is-active' : '');
    tab.innerHTML = `${cat.icon} ${cat.label} <span class="shop-tab__count">${count}</span>`;
    tab.style.setProperty('--cat-color', cat.color);
    tab.addEventListener('click', () => { currentCategory = cat.id; renderTabs(); renderItems(); });
    root.appendChild(tab);
  }
}

/* ================================================================
   GRID OGGETTI
   ================================================================ */
function renderItems() {
  const grid = $('shopGrid');
  const empty = $('shopEmpty');
  grid.innerHTML = '';

  const q = searchQuery.trim().toLowerCase();
  const filtered = ITEMS.filter(it => {
    if (currentCategory !== 'all' && it.category !== currentCategory) return false;
    if (q && !it.name.toLowerCase().includes(q) && !it.description.toLowerCase().includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  for (const it of filtered) {
    grid.appendChild(makeItemCard(it));
  }
}

function makeItemCard(item) {
  const cat       = ITEM_CATEGORIES[item.category];
  const owned     = ownsItem(item.id);
  const canAfford = (gs.pokeuro ?? 0) >= item.price;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'shop-item';
  card.dataset.rarity = item.rarity;
  card.dataset.itemId = item.id;
  if (owned) card.dataset.owned = 'true';
  card.style.setProperty('--cat-color', cat.color);

  // Stato visivo: Posseduto > Insufficienti > Acquista
  let footerLabel = 'Acquista';
  let footerClass = '';
  if (owned) { footerLabel = '✓ Posseduto'; footerClass = 'shop-item__buy-label--owned'; }
  else if (!canAfford) { footerLabel = 'Insufficienti'; footerClass = 'shop-item__buy-label--locked'; }

  // Icona: <img> se asset disponibile, altrimenti emoji fallback
  const iconHTML = item.image
    ? `<img class="shop-item__icon shop-item__icon--img" src="${item.image}" alt="${item.name}"
         onerror="this.outerHTML='<div class=\\'shop-item__icon\\'>${item.icon}</div>'" />`
    : `<div class="shop-item__icon">${item.icon}</div>`;

  card.innerHTML = `
    <div class="shop-item__head">
      ${iconHTML}
      <span class="shop-item__category-badge">${cat.icon} ${cat.label}</span>
    </div>
    <h3 class="shop-item__name">${item.name}</h3>
    <p class="shop-item__desc">${item.description}</p>
    ${Array.isArray(item.restrictedTo) && item.restrictedTo.length > 0
      ? `<p class="shop-item__restricted">⭐ Esclusivo per Pokémon specifici</p>`
      : ''}
    <div class="shop-item__footer">
      <span class="shop-item__price ${canAfford || owned ? '' : 'shop-item__price--cant-afford'}">
        ${item.price} 🪙
      </span>
      <span class="shop-item__buy-label ${footerClass}">${footerLabel}</span>
    </div>
  `;

  // Click sull'intera card → conferma acquisto. Se già posseduto, mostra il modal in modalità "informativa".
  card.addEventListener('click', () => openBuyModal(item.id));

  return card;
}

/* ================================================================
   MODAL CONFERMA ACQUISTO
   ================================================================ */
function openBuyModal(itemId) {
  const item = findItem(itemId);
  if (!item) return;
  pendingBuyId = itemId;

  // Icona: immagine se disponibile, altrimenti emoji
  const iconEl = $('buyIcon');
  if (item.image) {
    iconEl.innerHTML = `<img src="${item.image}" alt="${item.name}"
         onerror="this.parentNode.textContent='${item.icon}'" />`;
  } else {
    iconEl.textContent = item.icon;
  }
  $('buyName').textContent  = item.name;
  $('buyDesc').textContent  = item.description;
  $('buyPrice').innerHTML   = `${item.price} 🪙`;

  const owned     = ownsItem(itemId);
  const canAfford = (gs.pokeuro ?? 0) >= item.price;
  const ok        = $('buyConfirm');
  const after     = $('buyAfter');

  if (owned) {
    after.textContent = 'Già nel tuo inventario — puoi equipaggiarlo dalla Collezione.';
    ok.disabled       = true;
    ok.textContent    = '✓ Già posseduto';
  } else if (!canAfford) {
    after.textContent = `Ti mancano ${item.price - (gs.pokeuro ?? 0)} 🪙`;
    ok.disabled       = true;
    ok.textContent    = 'Pokéuro insufficienti';
  } else {
    after.textContent = `Dopo l'acquisto: ${Math.max(0, (gs.pokeuro ?? 0) - item.price)} 🪙`;
    ok.disabled       = false;
    ok.textContent    = '✓ Acquista';
  }

  $('buyModal').classList.remove('hidden');
}

function closeBuyModal() {
  $('buyModal').classList.add('hidden');
  pendingBuyId = null;
}

document.querySelectorAll('[data-buy-close]').forEach(el => el.addEventListener('click', closeBuyModal));

$('buyConfirm').addEventListener('click', () => {
  if (!pendingBuyId) return;
  const item = findItem(pendingBuyId);
  if (!item) return;
  if (ownsItem(item.id)) {
    toast('Già nel tuo inventario', true);
    closeBuyModal();
    return;
  }
  if ((gs.pokeuro ?? 0) < item.price) {
    toast(`Servono ${item.price} 🪙`, true);
    closeBuyModal();
    return;
  }
  gs.pokeuro -= item.price;
  saveState();          // salva spesa
  addItem(item.id);     // aggiunge a inventory (salva di nuovo internamente)
  toast(`Acquistato: ${item.icon} ${item.name}`);
  closeBuyModal();
  updateWallet();
  renderItems();
});

/* ================================================================
   TOAST
   ================================================================ */
let toastTimer = null;
function toast(msg, isError = false) {
  const el = $('shopToast');
  $('shopToastMsg').textContent = msg;
  el.classList.toggle('is-error', !!isError);
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
}

/* ================================================================
   SEARCH
   ================================================================ */
$('shopSearch').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderItems();
});

/* ================================================================
   KEYBOARD
   ================================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBuyModal();
});

/* ================================================================
   INIT
   ================================================================ */
(function init() {
  gs = getState();

  // (Debug auto-refill 9999 pokeuro rimosso per il rilascio)

  updateWallet();
  renderTabs();
  renderItems();
})();
