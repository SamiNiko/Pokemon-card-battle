/* ============================================================
   home.js — logica home page
   ============================================================ */

// Cloud sync (Supabase) caricato dinamicamente per non bloccare la pagina
// se l'utente ha un ad-blocker che impedisce l'accesso alla CDN.
import('./data/cloud-sync.js').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState, saveState, getTeamSlot, setActiveTeam } from './data/state.js';

const $ = sel => document.querySelector(sel);
const $id = id => document.getElementById(id);

/* ================================================================
   NOTIZIE — dati statici (in futuro da API/config)
   ================================================================ */

const NEWS_ITEMS = [
  {
    id: 'kanto-banner',
    icon: '✨',
    type: 'banner',
    badge: 'Banner attivo',
    title: 'Kanto Standard',
    preview: 'Dragonite ★★★★ disponibile · 124 Pokémon nel pool · Garanzia al ×10',
    modal: {
      subtitle: 'Attivo fino al prossimo aggiornamento',
      sections: [
        {
          title: 'Pokémon in evidenza',
          text: 'Dragonite (#149) · Gengar (#94) · Gyarados (#130) · Lapras (#131) — i quattro Pokémon più iconici del pool.',
        },
        {
          title: 'Probabilità',
          text: '★★★★ Epico: 0.5% — ★★★ Raro: 5.5% — ★★ Non comune: 24% — ★ Comune: 70%',
        },
        {
          title: 'Garanzie',
          text: 'Summon ×10: almeno 1 Pokémon ★★ (non comune) garantito se nessuna rarità superiore esce naturalmente.',
        },
        {
          title: 'Pokémon non presenti',
          text: '26 Pokémon sono esclusivi della Modalità Storia (starter, leggendari, fossili ecc.) e non compaiono nel banner.',
        },
      ],
      cta: { label: '✨ Vai al Summon', href: 'summon.html' },
    },
  },
  {
    id: 'storia',
    icon: '🗺',
    type: 'coming',
    badge: 'In arrivo',
    title: 'Modalità Storia',
    preview: 'Esplora Kanto · Sconfiggi i capipalestra · Ottieni Pokémon esclusivi e ricompense',
    modal: {
      subtitle: 'Prossimamente nel gioco',
      sections: [
        {
          title: 'Esplorazione',
          text: 'Una mappa interattiva della regione di Kanto con capipalestra, allenatori NPC ed eventi speciali da sbloccare progressivamente.',
        },
        {
          title: 'Pokémon esclusivi storia',
          text: 'Bulbasaur, Charmander, Squirtle e le loro evoluzioni · Articuno, Zapdos, Moltres, Mewtwo, Mew · Pokémon fossili e altri.',
        },
        {
          title: 'Ricompense',
          text: 'Sconfiggere i capipalestra premia con 💎 Gemme, 🪙 Pokéuro e Pokémon rari ottenibili solo tramite la storia.',
        },
      ],
      cta: null,
    },
  },
  {
    id: 'mechanics',
    icon: '⚔',
    type: 'info',
    badge: 'Guida gameplay',
    title: 'Come funziona il combattimento',
    preview: 'Team da 6 · Mosse Base e Finale · Sistema PP · Oggetti equipaggiabili',
    modal: {
      subtitle: 'Meccaniche di gioco — versione v0.1',
      sections: [
        {
          title: 'Costruzione del team',
          text: 'Scegli fino a 6 Pokémon dalla tua collezione. Puoi salvare fino a 4 preset (A, B, C, D) nella home per switchare rapidamente.',
        },
        {
          title: 'Mosse',
          text: 'Ogni Pokémon ha 2 mosse: una Mossa Base (sempre disponibile, gratuita) e una Mossa Finale (più potente, costa 3 PP).',
        },
        {
          title: 'PP — Punti Potere',
          text: 'I PP aumentano ogni turno. Quando raggiungi 3 PP puoi usare la Mossa Finale. Usarla consuma tutti i PP accumulati.',
        },
        {
          title: 'Oggetti',
          text: 'Ogni Pokémon può equipaggiare 1 oggetto che conferisce bonus passivi (es. aumento ATK, rigenerazione HP, ecc.).',
        },
        {
          title: 'Danni e tipi',
          text: 'Il sistema usa la divisione fisica/speciale di Gen 4. I tipi influenzano l\'efficacia (super efficace, non molto efficace, immune).',
        },
      ],
      cta: { label: '⚔ Inizia a giocare', href: '#gioca' },
    },
  },
];

/* ================================================================
   WALLET
   ================================================================ */

function buildWallet(gs) {
  const el = $id('homeWallet');
  if (!el) return;

  // Collezione: quanti Pokémon Gen 1 distinti possiedo / 151
  const ownedCount = (gs.owned ?? []).filter(id => id >= 1 && id <= 151).length;

  el.innerHTML = `
    <div class="wallet-row wallet-row--gems">
      <span class="wallet-row__icon">💎</span>
      <span class="wallet-row__amount">${gs.gems ?? 0}</span>
    </div>
    <div class="wallet-row wallet-row--euro">
      <span class="wallet-row__icon">🪙</span>
      <span class="wallet-row__amount">${gs.pokeuro ?? 0}</span>
    </div>
    <a class="wallet-row wallet-row--collection" href="stats.html" title="Vai alle statistiche">
      <span class="wallet-row__icon">📦</span>
      <span class="wallet-row__amount">${ownedCount} / 151</span>
    </a>
  `;
}

/* ================================================================
   TEAM SWITCHER
   ================================================================
   Il team correntemente selezionato (gs.activeTeam) È quello usato
   in battaglia. Cliccare un tab cambia activeTeam → cambia ciò che
   viene giocato. */

function buildTeam(gs) {
  const container = $id('teamSlots');
  if (!container) return;
  container.innerHTML = '';

  const ids = getTeamSlot(gs.activeTeam ?? 0);

  for (let i = 0; i < 6; i++) {
    const id   = ids[i];
    const pkmn = id ? findPokemon(id) : null;
    const div  = document.createElement('div');

    if (pkmn) {
      div.className = 'team-slot team-slot--filled';
      div.innerHTML = `
        <img src="${pkmn.sprite.default}" alt="${pkmn.name}" loading="lazy" />
        <span class="team-slot__name">${pkmn.name}</span>
      `;
    } else {
      div.className = 'team-slot team-slot--empty';
      div.innerHTML = `<span style="font-size:1.1rem;color:var(--border-strong)">+</span>`;
    }
    container.appendChild(div);
  }
}

function initTeamTabs(gs) {
  const tabs = document.querySelectorAll('.team-tab');

  // Stato iniziale: evidenzia il tab corrispondente a gs.activeTeam
  const initial = gs.activeTeam ?? 0;
  tabs.forEach(t => t.classList.toggle('is-active', parseInt(t.dataset.slot, 10) === initial));

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const slot = parseInt(tab.dataset.slot, 10);
      setActiveTeam(slot);

      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      buildTeam(gs);
    });
  });
}

/* ================================================================
   NOTIZIE
   ================================================================ */

function buildNews() {
  const list = $id('newsList');
  if (!list) return;
  list.innerHTML = '';

  NEWS_ITEMS.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = `news-card news-card--${item.type}`;
    card.style.animationDelay = `${0.21 + i * 0.07}s`;
    card.innerHTML = `
      <span class="news-card__icon">${item.icon}</span>
      <div class="news-card__content">
        <span class="news-card__badge">${item.badge}</span>
        <span class="news-card__title">${item.title}</span>
        <span class="news-card__preview">${item.preview}</span>
      </div>
      <span class="news-card__arrow">›</span>
    `;
    card.addEventListener('click', () => openNewsModal(item));
    list.appendChild(card);
  });
}

function openNewsModal(item) {
  const header = $id('newsModalHeader');
  const body   = $id('newsModalBody');
  const footer = $id('newsModalFooter');

  // Header
  header.innerHTML = `
    <div class="news-modal__badge">${item.icon} ${item.badge}</div>
    <div class="news-modal__title">${item.title}</div>
    <div class="news-modal__subtitle">${item.modal.subtitle}</div>
  `;

  // Body
  body.innerHTML = item.modal.sections.map(s => `
    <div class="news-section">
      <span class="news-section__title">${s.title}</span>
      <p class="news-section__text">${s.text}</p>
    </div>
  `).join('');

  // Footer con CTA opzionale
  if (item.modal.cta) {
    const isAnchor = item.modal.cta.href.startsWith('#');
    if (isAnchor && item.modal.cta.href === '#gioca') {
      footer.innerHTML = `
        <button class="news-modal__cta" id="newsCTAPlay">${item.modal.cta.label}</button>
      `;
      footer.querySelector('#newsCTAPlay').addEventListener('click', () => {
        closeNewsModal();
        openModal('#playModal');
      });
    } else {
      footer.innerHTML = `
        <a class="news-modal__cta" href="${item.modal.cta.href}">${item.modal.cta.label}</a>
      `;
    }
    footer.classList.remove('hidden');
  } else {
    footer.innerHTML = '';
    footer.classList.add('hidden');
  }

  $id('newsModal').classList.remove('hidden');
}

function closeNewsModal() {
  $id('newsModal').classList.add('hidden');
}

/* ================================================================
   SPRITE DI SFONDO
   ================================================================ */

function buildBgSprites() {
  const container = $id('bgSprites');
  if (!container) return;

  const ids = [25, 6, 9, 3, 94, 65, 130, 149, 143, 131, 59, 76];
  const positions = [
    { top:'8%',  right:'3%',  size:'90px',  dur:'7s',    delay:'0s',    dx:'10px',  dy:'-14px' },
    { top:'22%', right:'14%', size:'70px',  dur:'9s',    delay:'-2s',   dx:'-8px',  dy:'10px'  },
    { top:'55%', right:'2%',  size:'110px', dur:'11s',   delay:'-5s',   dx:'12px',  dy:'-8px'  },
    { top:'70%', right:'18%', size:'75px',  dur:'8s',    delay:'-1s',   dx:'-10px', dy:'12px'  },
    { top:'5%',  left:'2%',   size:'65px',  dur:'10s',   delay:'-3.5s', dx:'8px',   dy:'-10px' },
    { top:'40%', left:'3%',   size:'85px',  dur:'6s',    delay:'-1.5s', dx:'-6px',  dy:'8px'   },
    { top:'75%', left:'5%',   size:'60px',  dur:'13s',   delay:'-4s',   dx:'10px',  dy:'-6px'  },
    { top:'85%', right:'8%',  size:'68px',  dur:'8.5s',  delay:'-6s',   dx:'-12px', dy:'8px'   },
  ];

  ids.slice(0, positions.length).forEach((id, i) => {
    const pkmn = findPokemon(id);
    if (!pkmn) return;
    const pos = positions[i];
    const img = document.createElement('img');
    img.src = pkmn.sprite.default;
    img.alt = '';
    img.className = 'bg-sprite';
    img.style.cssText = [
      pos.top    ? `top:${pos.top}`       : '',
      pos.bottom ? `bottom:${pos.bottom}` : '',
      pos.left   ? `left:${pos.left}`     : '',
      pos.right  ? `right:${pos.right}`   : '',
      `width:${pos.size}`,
      `--dur:${pos.dur}`, `--delay:${pos.delay}`,
      `--dx:${pos.dx}`,   `--dy:${pos.dy}`,
    ].filter(Boolean).join(';');
    container.appendChild(img);
  });
}

/* ================================================================
   MODAL HELPERS
   ================================================================ */

function openModal(sel)   { document.querySelector(sel)?.classList.remove('hidden'); }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

/* ================================================================
   STATUS
   ================================================================ */

const statusEl = $id('dataStatus');
function setStatus(text, loading) {
  if (!statusEl) return;
  statusEl.innerHTML = (loading ? '<span class="loader"></span>' : '') + ' ' + text;
}

/* ================================================================
   NAVIGAZIONE
   ================================================================ */

/* Rifornimento gemme (debug) — viene collegato nell'init dopo che gs è disponibile */

$('#btnPlay').addEventListener('click',       () => openModal('#playModal'));
$('#btnCollection').addEventListener('click', () => { window.location.href = 'collection.html'; });
$('#btnSummon').addEventListener('click',     () => { window.location.href = 'summon.html'; });
$('#btnSettings').addEventListener('click',   () => { window.location.href = 'settings.html'; });
$('#btnPlayStory').addEventListener('click',  () => { window.location.href = 'story.html'; });
$('#btnPlayOnline').addEventListener('click', () => { window.location.href = 'online.html'; });

// Chiudi modali
document.querySelectorAll('[data-close-modal]').forEach(el =>
  el.addEventListener('click', closeAllModals)
);
$id('newsBackdrop').addEventListener('click', closeNewsModal);
$id('newsModalClose').addEventListener('click', closeNewsModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

/* ================================================================
   INIT
   ================================================================ */

(async () => {
  try {
    setStatus('Caricamento…', true);
    await loadAllPokemon((done, total) => {
      setStatus(`Caricamento: ${done} / ${total}`, true);
    });
    setStatus('Pronto.', false);

    const gs = getState();

    // teams[] e activeTeam sono garantiti dalla migrazione in readAndMigrate()

    buildWallet(gs);
    buildNews();
    buildTeam(gs);
    initTeamTabs(gs);
    buildBgSprites();

    // Rifornimento gemme — collegato qui così gs è sicuramente disponibile
    const refillBtn = $id('btnRefill');
    if (refillBtn) {
      refillBtn.addEventListener('click', () => {
        gs.gems = (gs.gems ?? 0) + 9999;
        saveState();
        buildWallet(gs);
        refillBtn.textContent = '✓ +9999';
        refillBtn.classList.add('is-flash');
        setTimeout(() => {
          refillBtn.textContent = '+ 💎';
          refillBtn.classList.remove('is-flash');
        }, 1000);
      });
    }

  } catch (e) {
    console.error(e);
    setStatus('Errore di rete. Riprova.', false);
  }
})();
