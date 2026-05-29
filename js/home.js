/* ============================================================
   home.js — logica home page
   ============================================================ */

// Cloud sync (Supabase) caricato dinamicamente per non bloccare la pagina
// se l'utente ha un ad-blocker che impedisce l'accesso alla CDN.
import('./data/cloud-sync.js?v=8').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { getState, saveState, getTeamSlot, setActiveTeam, getEquipped, onSave } from './data/state.js?v=7';
import { findItem }                    from './data/items.js?v=3';
import { openCardModal }                from './data/card-modal.js?v=11';
import { initTutorial, isTutorialDone } from './data/tutorial.js?v=3';
import { playBGM }                      from './data/bgm.js?v=9';
import { SFX }                          from './data/sfx.js?v=3';

// Avvia subito la BGM della home (parte dopo il primo gesto utente per via
// delle restrizioni browser sull'autoplay audio)
playBGM('home');

/* ================================================================
   SFX HOOKS — click sound delegation
   ================================================================
   Invece di legare un handler per ogni bottone, usiamo event
   delegation sul document: ad ogni click viene cercato il selector
   più "interessante" e si gioca il SFX corrispondente.
   pointerdown (non click) → suono immediato, prima che lo span
   eventualmente intercetti. */
document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (!t || !t.closest) return;
  // Modal close / cancel → cancel
  if (t.closest('[data-close-modal], [data-account-close], #newsModalClose, #newsBackdrop, #accountBannerClose')) {
    SFX.cancel?.();
    return;
  }
  // Play options (modal Gioca) → confirm
  if (t.closest('.play-option')) {
    SFX.confirm?.();
    return;
  }
  // Welcome / locked overlay → confirm
  if (t.closest('#btnWelcomeLogin, #btnLockedFollow, #btnLockedRecheck, #btnAccountLogin, #accountBannerCta')) {
    SFX.confirm?.();
    return;
  }
  if (t.closest('#btnLockedLogout, #btnAccountLogout')) {
    SFX.cancel?.();
    return;
  }
  // News card → soft click
  if (t.closest('.news-card')) {
    SFX.cardPick?.();
    return;
  }
  // Team tab → click
  if (t.closest('.team-tab')) {
    SFX.click?.();
    return;
  }
  // Menu bottoni principali → click
  if (t.closest('.menu-btn')) {
    SFX.click?.();
    return;
  }
  // Account button (avatar header)
  if (t.closest('#btnAccount')) {
    SFX.click?.();
    return;
  }
});

const $ = sel => document.querySelector(sel);
const $id = id => document.getElementById(id);

/* ================================================================
   NOTIZIE — dati statici (in futuro da API/config)
   ================================================================ */

const NEWS_ITEMS = [
  {
    id: 'twitch-sub',
    icon: '💜',
    type: 'banner',
    badge: 'Supportami',
    title: 'Abbonati su Twitch — bonus speciali!',
    preview: 'Sostieni il canale e ricevi vantaggi cosmetici + economici dentro il gioco. Non rompe il bilanciamento.',
    modal: {
      subtitle: 'Cosa ottieni se ti abboni',
      sections: [
        {
          title: '✨ Badge stellina',
          text: 'Una stellina dorata animata accanto al tuo nome in home — visibile a te e (in PvP) all\'avversario.',
        },
        {
          title: '🪙 +10% pokeuro su ogni reward',
          text: 'Ogni vittoria contro AI / trainer / PvP ti dà il 10% extra in monete. Le gemme restano invariate per non rompere l\'economia summon.',
        },
        {
          title: '🎁 Bonus futuri',
          text: 'Sto lavorando a una cornice avatar dorata in battaglia e a un summon ×1 gratis giornaliero per abbonati. Stay tuned!',
        },
        {
          title: 'Perché farlo?',
          text: 'Se ti diverte il gioco e vuoi vedermi sviluppare di più, l\'abbonamento è il modo più diretto di supportarmi. Anche solo seguire il canale aiuta tantissimo!',
        },
      ],
      cta: { label: '💜 Vai al canale Twitch', href: 'https://www.twitch.tv/samuel_04_', external: true },
    },
  },
  {
    id: 'kanto-banner',
    icon: '✨',
    type: 'banner',
    badge: 'Banner attivo',
    title: 'Kanto Standard',
    preview: 'Dragonite ★★★★★ · Charizard ★★★★ · 145 Pokémon nel pool · ★★★ garantito al ×10',
    modal: {
      subtitle: 'Attivo fino al prossimo aggiornamento',
      sections: [
        {
          title: 'Pokémon in evidenza',
          text: 'Dragonite (#149) · Gengar (#94) · Gyarados (#130) · Lapras (#131) — i Pokémon più iconici del pool.',
        },
        {
          title: 'Probabilità',
          text: '★★★★★ Pseudo Leggendario: 0.5% — ★★★★ Epico: 3% — ★★★ Raro: 14% — ★★ Non Comune: 30% — ★ Comune: 52.5%',
        },
        {
          title: 'Garanzie',
          text: 'Summon ×10: almeno 1 Pokémon ★★★ (Raro o superiore) garantito. Prime 6 summon ×1 GRATIS per i nuovi account.',
        },
        {
          title: 'Pokémon non presenti',
          text: 'I 5 leggendari (Articuno, Zapdos, Moltres, Mewtwo, Mew) sono esclusivi della Modalità Storia e non compaiono nel banner.',
        },
      ],
      cta: { label: '✨ Vai al Summon', href: 'summon.html' },
    },
  },
  {
    id: 'allenatori',
    icon: '👑',
    type: 'banner',
    badge: 'Nuovo!',
    title: 'Allenatori della Lega Kanto',
    preview: '16 trainer da sfidare · Capipalestra, Elite Four, Champion + easter egg Prof. Oak',
    modal: {
      subtitle: 'Sostituto temporaneo della Modalità Storia',
      sections: [
        {
          title: 'Chi sono',
          text: '8 Capipalestra (Brock → Giovanni) + Boss Team Rocket + Rivale + 4 Elite Four (Lorelei, Bruno, Agatha, Lance) + Blue Campione + un easter egg segreto post-game.',
        },
        {
          title: 'Sblocco progressivo',
          text: 'Ogni allenatore richiede di aver battuto il precedente. Le team avversarie e la difficoltà crescono progressivamente (curva 2★→23★).',
        },
        {
          title: 'Ricompense',
          text: 'Da 100💎 + 100🪙 (Brock) a 5000💎 + 5000🪙 (easter egg). Totale Lega completa: 22.500💎 e 22.500🪙. Solo alla PRIMA vittoria di ogni trainer.',
        },
        {
          title: 'Modalità',
          text: 'Battaglie senza timer drastico, AI bilanciata per posizionamento e selezione mosse, sprite trainer originali, end-game screen dedicata.',
        },
      ],
      cta: { label: '👑 Sfida gli Allenatori', href: 'trainers.html' },
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
      // Fallback a 2 livelli: webp custom → official artwork → sprite
      const officialArt = pkmn.sprite?.official
          || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkmn.id}.png`;
      const img = div.querySelector('.team-slot__img');
      img.onerror = () => {
        img.onerror = () => {
          img.onerror = null;
          img.classList.add('is-fallback');
          img.src = pkmn.sprite.default;
        };
        img.src = officialArt;
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
    card.className = `news-card news-card--${item.type} news-card--${item.id}`;
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
      const extAttrs = item.modal.cta.external ? ' target="_blank" rel="noopener"' : '';
      footer.innerHTML = `
        <a class="news-modal__cta" href="${item.modal.cta.href}"${extAttrs}>${item.modal.cta.label}</a>
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
// Le opzioni del modal "Gioca":
//   - Allenatori → trainers.html (sostituto temporaneo della Storia)
//   - AI random  → battle.html?mode=ai (team avversario casuale)
//   - Online     → online.html (matchmaking PvP)
// (btnPlayTutorial rimosso: il tutorial battaglia è ora un menu-btn dedicato
// nella home — vedi #btnHomeTutorial in index.html, gestito via onclick inline)
$id('btnPlayTrainers')?.addEventListener('click', () => { window.location.href = 'trainers.html'; });
$id('btnPlayAI')?.addEventListener('click',       () => { window.location.href = 'battle.html?mode=ai'; });
$id('btnPlayOnline')?.addEventListener('click',   () => { window.location.href = 'online.html'; });
// (Storia "btnPlayStory" rimosso dal modal — verrà ripristinato quando la modalità sarà pronta)

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

    // Refresh reattivo: quando cloud-sync (o un altro modulo) modifica lo
    // state, rebuilda wallet + team così l'utente vede sempre i valori freschi
    // senza dover ricaricare la pagina.
    onSave(newState => {
      buildWallet(newState);
      buildTeam(newState);
    });

    // (Bottone debug "Refill gemme" rimosso per il rilascio)

    // Account: avatar + modal + banner ospite
    initAccountUI(gs);

    // Welcome overlay (prima apertura del gioco)
    initWelcomeOverlay(gs);

    // Force tutorial via ?tutorial=1 (es. dal bottone "Avvia tutorial" in Settings).
    // Parte indipendentemente dal flag isTutorialDone.
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('tutorial') === '1') {
      // Aspetta che la home sia interamente renderizzata (le spotlight
      // hanno bisogno che #btnSummon, #btnCollection, ecc. esistano nel DOM)
      setTimeout(() => initTutorial({ force: true }), 500);
      // Pulisci il param così non si riavvia al prossimo reload
      history.replaceState(null, '', location.pathname);
    }

    // (Tutorial onboarding spostato dentro initWelcomeOverlay → branch
    // "access OK": parte solo dopo che il gate Twitch ha autorizzato)

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
    // Twitch display name preferito (preferred_username/nickname dal metadata)
    const meta = session.user?.user_metadata ?? {};
    const handle = meta.preferred_username ?? meta.nickname ?? meta.name ?? fresh.userName ?? 'Allenatore';
    $id('accountModalName').textContent  = handle;
    $id('accountModalEmail').textContent = session.user?.email ?? '—';
    // Mostra badge sub se applicabile
    try {
      const tw = await import('./data/twitch-access.js');
      const access = tw.getCachedAccess() ?? await tw.checkAccess();
      const badgeEl = document.querySelector('.account-modal__badge');
      if (badgeEl) {
        if (access.isSubscriber)      badgeEl.textContent = '✨ Abbonato Twitch · Bonus attivi';
        else if (access.isFollower)   badgeEl.textContent = '🟣 Follower Twitch';
        else                          badgeEl.textContent = '🟣 Account Twitch';
      }
    } catch {}
  } else {
    guestPane.classList.remove('hidden');
  }

  modal.classList.remove('hidden');

  // Bottoni interni (associati ogni volta che apriamo il modal)
  $id('btnAccountLogin').onclick = async () => {
    try {
      await supabaseModule.signInWithTwitch();
    } catch (e) {
      alert('Errore login Twitch: ' + e.message);
    }
  };
  $id('btnAccountLogout').onclick = async () => {
    const ok = confirm(
      'Sicuro di voler uscire?\n\n' +
      '✓ I tuoi progressi restano salvati sul cloud — al prossimo login li ritroverai tutti.\n\n' +
      '⚠ Per rientrare dovrai fare di nuovo login con Twitch.'
    );
    if (!ok) return;

    try {
      // Flush dello stato pendente prima del logout (best effort)
      try {
        const cs = await import('./data/cloud-sync.js?v=8');
        await cs.flushSync();
      } catch {}
      // Pulisci cache access
      try {
        const tw = await import('./data/twitch-access.js');
        tw.clearAccessCache();
      } catch {}
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
  // Banner non più necessario col gate Twitch (chi entra è sempre loggato).
  // Lo lascio nascosto sempre.
  const banner = $id('accountBanner');
  if (banner) banner.classList.add('hidden');
}

/* ================================================================
   TWITCH GATE — solo follower/sub possono giocare
   ================================================================
   Flusso:
     1. No sessione → mostra welcomeOverlay (login Twitch)
     2. Sessione + follower OR sub → entra normale
     3. Sessione ma né follower né sub → lockedOverlay
*/

/** True se stiamo girando in locale (dev): localhost / 127.0.0.1 / file://.
 *  Su localhost l'OAuth Twitch NON funziona perché il redirect URL è
 *  registrato solo per il dominio di produzione (GitHub Pages). */
function isLocalDev() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '' || location.protocol === 'file:';
}

async function initWelcomeOverlay(gs) {
  // DEV BYPASS: in locale salta del tutto il gate Twitch così puoi testare
  // tutte le pagine come guest (lo stato vive in localStorage). In produzione
  // (dominio GitHub Pages) il gate resta attivo come sempre.
  if (isLocalDev()) {
    console.info('%c[gate] localhost dev → gate Twitch bypassato (guest mode di test)', 'color:#5ee8d8');
    if (!isTutorialDone()) setTimeout(() => initTutorial(), 350);
    return;
  }

  // Aspetta che supabaseModule sia caricato (da initAccountUI)
  // Poll breve, max ~1s
  for (let i = 0; i < 20 && !supabaseModule; i++) {
    await new Promise(r => setTimeout(r, 50));
  }

  const session = supabaseModule ? await supabaseModule.getSession() : null;

  // Branch 1: nessuna sessione → welcome
  if (!session) {
    showWelcomeOverlay();
    return;
  }

  // Branch 2-3: c'è una sessione → verifica gate
  const tw = await import('./data/twitch-access.js');
  // Ricontrolla sempre il follower al primo load: il check è veloce
  let access;
  try {
    access = await tw.checkAccess();
  } catch (e) {
    console.warn('[gate] check failed:', e);
    access = { loggedIn: true, isFollower: false, isSubscriber: false };
  }

  // Il broadcaster (dev) NON può seguire/abbonarsi al proprio canale, quindi
  // fallirebbe il gate sul suo stesso gioco. Lo lasciamo sempre entrare.
  const isBroadcaster = (access?.twitchLogin ?? '').toLowerCase() === 'samuel_04_';

  if (!isBroadcaster && !tw.canPlay(access)) {
    showLockedOverlay(access);
    return;
  }

  // Accesso OK — applica UI sub (badge, frame)
  applySubscriberUI(access);

  // Tutorial onboarding al primo accesso
  if (!isTutorialDone()) {
    setTimeout(() => initTutorial(), 350);
  }
}

function showWelcomeOverlay() {
  const overlay = $id('welcomeOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  $id('btnWelcomeLogin').onclick = async () => {
    if (!supabaseModule) {
      alert('Cloud non disponibile (forse un ad-blocker). Disabilitalo e ricarica.');
      return;
    }
    try {
      await supabaseModule.signInWithTwitch();
      // Il redirect porta su Twitch → torno qui dopo
    } catch (e) {
      alert('Errore login Twitch: ' + e.message);
    }
  };
}

function showLockedOverlay(access) {
  const overlay = $id('lockedOverlay');
  if (!overlay) return;
  $id('lockedUserName').textContent = access?.twitchLogin ?? 'allenatore';
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Recheck: forza un refresh del check (utile dopo che l'utente segue)
  $id('btnLockedRecheck').onclick = async () => {
    const btn = $id('btnLockedRecheck');
    btn.disabled = true;
    btn.querySelector('.welcome-btn__title').textContent = 'Controllo in corso…';
    const tw = await import('./data/twitch-access.js');
    tw.clearAccessCache();
    const fresh = await tw.checkAccess({ force: true });

    // Supabase ha droppato il provider_token al refresh sessione → serve
    // un fresh OAuth login per ottenere un token nuovo e poter chiamare
    // le API Twitch. Riavvio il flusso di login (l'utente vedrà di nuovo
    // Twitch ma senza dover digitare credenziali, è già autenticato lì).
    if (fresh.error === 'session_no_token' && supabaseModule) {
      btn.querySelector('.welcome-btn__title').textContent = 'Riautentico su Twitch…';
      try { await supabaseModule.signInWithTwitch(); }
      catch (e) { alert('Errore riautenticazione: ' + e.message); btn.disabled = false; }
      return;
    }

    if (tw.canPlay(fresh)) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
      location.reload();
    } else {
      btn.disabled = false;
      btn.querySelector('.welcome-btn__title').textContent = 'Ancora non risulti follower — riprova';
    }
  };

  $id('btnLockedLogout').onclick = async () => {
    try {
      const tw = await import('./data/twitch-access.js');
      tw.clearAccessCache();
      if (supabaseModule) await supabaseModule.signOut();
      location.reload();
    } catch (e) {
      alert('Errore logout: ' + e.message);
    }
  };
}

function applySubscriberUI(access) {
  if (!access?.isSubscriber) return;
  // Badge sub vicino all'avatar header
  const avatar = $id('accountAvatar');
  if (avatar && !avatar.dataset.subApplied) {
    avatar.dataset.subApplied = '1';
    const star = document.createElement('span');
    star.className = 'sub-badge';
    star.textContent = '✨';
    star.title = 'Abbonato Twitch';
    avatar.parentElement?.appendChild(star);
  }
}
