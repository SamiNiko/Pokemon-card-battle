/* ============================================================
   home.js — logica home page
   ============================================================ */

// Cloud sync (Supabase) caricato dinamicamente per non bloccare la pagina
// se l'utente ha un ad-blocker che impedisce l'accesso alla CDN.
import('./data/cloud-sync.js?v=3').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState, saveState, getTeamSlot, setActiveTeam, getEquipped } from './data/state.js?v=4';
import { findItem }                    from './data/items.js?v=3';
import { openCardModal }                from './data/card-modal.js?v=8';
import { initTutorial, isTutorialDone } from './data/tutorial.js';

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

  const activeSlot = gs.activeTeam ?? 0;
  const ids = getTeamSlot(activeSlot);

  for (let i = 0; i < 6; i++) {
    const id   = ids[i];
    const pkmn = id ? findPokemon(id) : null;
    const div  = document.createElement('div');

    if (pkmn) {
      // Card full-art (read-only: click apre solo il modal, niente modifiche qui)
      div.className = 'team-slot team-slot--filled';
      const artUrl = `assets/cards/${String(pkmn.id).padStart(3, '0')}.webp`;
      const heldId = getEquipped(pkmn.id, activeSlot);
      const heldItem = heldId ? findItem(heldId) : null;
      const heldBadgeHTML = heldItem
        ? `<span class="team-slot__item" title="${heldItem.name}">${
            heldItem.image
              ? `<img src="${heldItem.image}" alt="${heldItem.name}" onerror="this.outerHTML='${heldItem.icon}'" />`
              : heldItem.icon
          }</span>`
        : '';
      div.innerHTML = `
        <div class="team-slot__art">
          <img class="team-slot__img" src="${artUrl}" alt="${pkmn.name}" loading="lazy" />
        </div>
        <span class="team-slot__name">${pkmn.name}</span>
        ${heldBadgeHTML}
      `;
      // Fallback artwork → sprite
      const img = div.querySelector('.team-slot__img');
      img.onerror = () => {
        img.onerror = null;
        img.classList.add('is-fallback');
        img.src = pkmn.sprite.default;
      };
      // Click → apre il card modal (read-only, per modifiche → Collezione)
      div.style.cursor = 'pointer';
      div.title = 'Apri carta (modifiche dal tab Collezione)';
      div.addEventListener('click', () => openCardModal(pkmn.id, { teamSlot: activeSlot }));
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

    // Account: avatar + modal + banner ospite
    initAccountUI(gs);

    // Welcome overlay (prima apertura del gioco)
    initWelcomeOverlay(gs);

    // Tutorial onboarding: parte SOLO se welcome è già stato fatto
    // e il tutorial non è mai stato visto. Se siamo nel welcome, il
    // tutorial parte invece quando l'utente sceglie Login/Ospite
    // (vedi hideWelcome → maybeStartTutorial).
    if (localStorage.getItem(ONBOARDING_FLAG) === '1' && !isTutorialDone()) {
      // Aspetto un attimo dopo il render così la home è già visibile dietro
      setTimeout(() => initTutorial(), 350);
    }

  } catch (e) {
    console.error(e);
    setStatus('Errore di rete. Riprova.', false);
  }
})();

/* ================================================================
   ACCOUNT UI — avatar, modal, banner persuasivo
   ================================================================
   Il client Supabase si carica dinamicamente: se l'ad-blocker
   blocca la CDN, il bottone account funziona ancora ma mostra
   il messaggio "Cloud non disponibile" nel modal. */

let supabaseModule = null;

async function initAccountUI(gs) {
  // Avatar header
  refreshAccountAvatar(gs);

  // Click avatar → apre modal
  const btnAccount = $id('btnAccount');
  btnAccount?.addEventListener('click', async () => {
    await openAccountModal(gs);
  });

  // Banner: chiudi con X (memorizza dismiss in localStorage)
  $id('accountBannerClose')?.addEventListener('click', () => {
    localStorage.setItem('pkmn_account_banner_dismissed', '1');
    $id('accountBanner')?.classList.add('hidden');
  });
  // Banner CTA → apre direttamente il modal in stato guest
  $id('accountBannerCta')?.addEventListener('click', () => openAccountModal(gs));

  // Backdrop / X chiudono il modal
  document.querySelectorAll('[data-account-close]').forEach(el => {
    el.addEventListener('click', closeAccountModal);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAccountModal();
  });

  // Tenta di caricare la SDK Supabase (può fallire per ad-blocker)
  try {
    supabaseModule = await import('./data/supabase.js');
    // Listener auth: quando login/logout cambia, refresh UI
    supabaseModule.onAuthChange(async () => {
      // Aspetta che cloud-sync abbia tempo di fare il pull
      await new Promise(r => setTimeout(r, 350));
      const fresh = getState();
      refreshAccountAvatar(fresh);
      maybeShowGuestBanner(fresh);
    });
  } catch (e) {
    console.warn('[home] Supabase SDK non disponibile:', e.message);
  }

  // Banner ospite (se ha già un po' di progressi)
  maybeShowGuestBanner(gs);
}

function refreshAccountAvatar(gs) {
  const avatar = $id('accountAvatar');
  const dot    = $id('accountDot');
  if (!avatar) return;
  const name = gs.userName ?? 'Ospite';
  avatar.textContent = (name[0] ?? '?').toUpperCase();
  if (gs.accountType === 'supabase') {
    dot?.classList.remove('account-btn__dot--guest');
    dot?.classList.add('account-btn__dot--cloud');
  } else {
    dot?.classList.add('account-btn__dot--guest');
    dot?.classList.remove('account-btn__dot--cloud');
  }
}

async function openAccountModal(gs) {
  const modal      = $id('accountModal');
  const big        = $id('accountModalAvatar');
  const guestPane  = $id('accountModalGuest');
  const userPane   = $id('accountModalUser');
  const errorPane  = $id('accountModalError');

  guestPane.classList.add('hidden');
  userPane.classList.add('hidden');
  errorPane.classList.add('hidden');

  // Avatar grande (iniziale)
  const fresh = getState();
  big.textContent = (fresh.userName?.[0] ?? '?').toUpperCase();

  // 1) Se Supabase non è caricato → errore "cloud non disponibile"
  if (!supabaseModule) {
    errorPane.classList.remove('hidden');
    modal.classList.remove('hidden');
    return;
  }

  // 2) Verifica se l'utente è loggato
  const session = await supabaseModule.getSession();
  if (session) {
    userPane.classList.remove('hidden');
    $id('accountModalName').textContent  = fresh.userName ?? 'Allenatore';
    $id('accountModalEmail').textContent = session.user?.email ?? '—';
  } else {
    guestPane.classList.remove('hidden');
  }

  modal.classList.remove('hidden');

  // Bottoni interni (associati ogni volta che apriamo il modal)
  $id('btnAccountLogin').onclick = async () => {
    try {
      await supabaseModule.signInWithGoogle();
    } catch (e) {
      alert('Errore login: ' + e.message);
    }
  };
  $id('btnAccountLogout').onclick = async () => {
    const ok = confirm(
      'Sicuro di voler uscire?\n\n' +
      '✓ I tuoi progressi restano salvati sul cloud — al prossimo login li ritroverai tutti.\n\n' +
      '⚠ Su questo dispositivo verrà avviato un nuovo profilo Ospite vuoto.'
    );
    if (!ok) return;

    try {
      // Flush dello stato pendente prima del logout (best effort)
      try {
        const cs = await import('./data/cloud-sync.js?v=3');
        await cs.flushSync();
      } catch {}
      // signOut → triggera SIGNED_OUT in cloud-sync che fa resetState + reload
      await supabaseModule.signOut();
      closeAccountModal();
    } catch (e) {
      alert('Errore logout: ' + e.message);
    }
  };
}

function closeAccountModal() {
  $id('accountModal')?.classList.add('hidden');
}

function maybeShowGuestBanner(gs) {
  const banner = $id('accountBanner');
  if (!banner) return;
  // Se loggato: niente banner
  if (gs.accountType === 'supabase') {
    banner.classList.add('hidden');
    return;
  }
  // Se l'utente l'ha già dismisso: niente banner
  if (localStorage.getItem('pkmn_account_banner_dismissed') === '1') {
    banner.classList.add('hidden');
    return;
  }
  // Soglia: ha già un po' di progressi (5+ Pokémon o gemme spese)
  const owned = (gs.owned ?? []).length;
  const hasProgress = owned >= 5 || (gs.lifetimeStats?.totalMatches ?? 0) >= 3;
  banner.classList.toggle('hidden', !hasProgress);
}

/* ================================================================
   WELCOME OVERLAY — prima apertura del gioco
   ================================================================
   Mostrato solo se:
   - localStorage 'pkmn_onboarding_done' non è '1'
   - E non c'è una sessione Supabase già attiva (es. ritorno da OAuth)
   Dopo la scelta (Login o Ospite), set del flag → la prossima volta
   l'utente va diretto in home.
*/
const ONBOARDING_FLAG = 'pkmn_onboarding_done';

async function initWelcomeOverlay(gs) {
  const overlay = $id('welcomeOverlay');
  if (!overlay) return;

  // Già onboardato → niente welcome
  if (localStorage.getItem(ONBOARDING_FLAG) === '1') return;

  // Se c'è già una sessione Supabase attiva, l'utente è loggato → marca
  // onboarding fatto e non mostrare nulla
  if (supabaseModule) {
    try {
      const session = await supabaseModule.getSession();
      if (session) {
        localStorage.setItem(ONBOARDING_FLAG, '1');
        return;
      }
    } catch {}
  }

  // Mostra il welcome
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Bottone "Accedi con Google"
  $id('btnWelcomeLogin').onclick = async () => {
    // Marca onboarding subito così se il redirect torna qui non rivede l'overlay
    localStorage.setItem(ONBOARDING_FLAG, '1');
    if (!supabaseModule) {
      alert('Login non disponibile (controlla l\'ad-blocker)');
      // Comunque proceed come ospite
      hideWelcome();
      return;
    }
    try {
      await supabaseModule.signInWithGoogle();
      // Il redirect porta su Google → torno qui dopo
    } catch (e) {
      alert('Errore login: ' + e.message);
      hideWelcome();   // proseguo come ospite se login fallisce
    }
  };

  // Bottone "Gioca come Ospite"
  $id('btnWelcomeGuest').onclick = () => {
    localStorage.setItem(ONBOARDING_FLAG, '1');
    hideWelcome();
  };
}

function hideWelcome() {
  const overlay = $id('welcomeOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
  // Subito dopo il welcome, lancia il tutorial onboarding (se mai visto)
  if (!isTutorialDone()) {
    setTimeout(() => initTutorial(), 300);
  }
}
