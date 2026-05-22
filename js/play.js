/* ============================================================
   play.js — Shell esterno che ospita il gioco in un iframe.
   ------------------------------------------------------------
   L'obiettivo è che l'AUDIO persista tra le navigazioni interne:
   le pagine del gioco vivono dentro l'iframe e cambiano senza
   toccare questo documento. L'audio element qui sotto non viene
   mai distrutto → la musica suona senza alcun gap.

   Comunicazione iframe → shell via postMessage:
     { type: 'bgm:play',   track: 'menu' }
     { type: 'bgm:stop' }
     { type: 'bgm:volume' }   (lo shell rilegge da localStorage)
     { type: 'bgm:ready' }    (l'iframe è caricato → nascondi loader)
   ============================================================ */

/* Tutte le tracce file-based gestite dallo shell.
   Le tracce procedurali (battle/boss generici) restano dentro l'iframe
   tramite il vecchio sistema Web Audio. Non navighi durante una battaglia
   in corso quindi non si nota la differenza. */
/* Forma: { url, vol, loop }. Tieni allineato con js/data/bgm.js. */
const FILE_TRACKS = {
  menu:              { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  home:              { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  collection:        { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  summon:            { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  trainers:          { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  shop:               { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  settings:          { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  credits:           { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  stats:             { url: 'assets/audio/menu.mp3',            vol: 0.42 },
  'battle-gym':      { url: 'assets/audio/gym-battle.mp3',      vol: 0.45 },
  'battle-trainer':  { url: 'assets/audio/trainer-battle.mp3',  vol: 0.45 },
  'battle-champion': { url: 'assets/audio/champion-battle.mp3', vol: 0.42 },
  'boss-oak':        { url: 'assets/audio/oak-battle.mp3',      vol: 0.45 },
  victory:           { url: 'assets/audio/victory.mp3',         vol: 0.60, loop: false },
};

/* Volume corrente del brano (per applicare master/bgm dei slider) */
let BASE_VOL = 0.55;

const KEY_MASTER  = 'pkmn_audio_master';
const KEY_BGM     = 'pkmn_audio_bgm';
const KEY_ENABLED = 'pkmn_audio_enabled';

let audio = null;
let currentName = null;
let currentUrl  = null;

function readVol(key, def) {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : def;
  } catch { return def; }
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  // Loop perfetto: quando l'audio finisce in modalità loop, ripartilo
  // (per le tracce one-shot come 'victory', audio.loop sarà false e
  // ended scatta una sola volta → non riavviamo).
  audio.addEventListener('ended', () => {
    if (audio.loop === false) return;   // jingle one-shot: fine = stop
    try { audio.currentTime = 0; audio.play(); } catch {}
  });
  return audio;
}

function applyVolume() {
  if (!audio) return;
  const master  = readVol(KEY_MASTER, 80) / 100;
  const bgm     = readVol(KEY_BGM, 50) / 100;
  const enabled = (localStorage.getItem(KEY_ENABLED) ?? '1') === '1';
  audio.volume = enabled ? Math.max(0, Math.min(1, BASE_VOL * master * bgm)) : 0;
}

/** Avvia o cambia traccia. Se è già la stessa traccia in riproduzione,
 *  non fa nulla → audio NON si resetta tra pagine che usano lo stesso file. */
function playTrack(name) {
  const entry = FILE_TRACKS[name];
  if (!entry) {
    stopTrack();
    return;
  }
  const url   = entry.url;
  BASE_VOL    = entry.vol ?? 0.55;
  const shouldLoop = entry.loop !== false;

  ensureAudio();
  audio.loop = shouldLoop;
  applyVolume();

  // Stesso file già in riproduzione → no-op (zero gap tra pagine)
  if (currentUrl === url && !audio.paused) {
    currentName = name;
    return;
  }

  if (currentUrl && currentUrl !== url) {
    fadeAndSwap(url, name);
  } else {
    audio.src = url;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    currentName = name;
    currentUrl  = url;
  }
}

/** Crossfade morbido tra due tracce diverse (mantiene fluidità). */
function fadeAndSwap(newUrl, newName) {
  const startVol = audio.volume;
  const steps = 12;
  let i = 0;
  const fadeOut = setInterval(() => {
    i++;
    audio.volume = Math.max(0, startVol * (1 - i / steps));
    if (i >= steps) {
      clearInterval(fadeOut);
      audio.src = newUrl;
      audio.currentTime = 0;
      audio.volume = 0;
      audio.play().catch(() => {});
      currentName = newName;
      currentUrl  = newUrl;
      // Fade in
      let j = 0;
      const targetVol = startVol;
      const fadeIn = setInterval(() => {
        j++;
        audio.volume = Math.min(targetVol, targetVol * (j / steps));
        if (j >= steps) {
          clearInterval(fadeIn);
          applyVolume();   // riallinea al volume corrente dei slider
        }
      }, 30);
    }
  }, 30);
}

function stopTrack() {
  if (audio) {
    audio.pause();
    currentName = null;
    currentUrl  = null;
  }
}

/* ============================================================
   COMUNICAZIONE iframe → shell
   ============================================================ */

window.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || typeof data !== 'object') return;
  switch (data.type) {
    case 'bgm:play':
      playTrack(data.track);
      break;
    case 'bgm:stop':
      stopTrack();
      break;
    case 'bgm:volume':
      applyVolume();
      break;
    case 'bgm:ready':
      hideLoader();
      break;
    case 'shell:request-unlock':
      // L'iframe sta tentando di sbloccare l'audio, applichiamo anche qui
      if (audio?.paused && currentUrl) audio.play().catch(() => {});
      break;
  }
});

/* Quando il volume cambia in un'altra pagina (stesso origin), riceviamo
   un 'storage' event nello shell → riapplica il volume al nostro audio.
   NB: 'storage' scatta solo tra documenti DIVERSI dello stesso origin.
   Lo shell e l'iframe sono documenti diversi, quindi questo funziona. */
window.addEventListener('storage', (e) => {
  if (e.key === KEY_MASTER || e.key === KEY_BGM || e.key === KEY_ENABLED) {
    applyVolume();
  }
});

/* Sblocco audio al primo gesto utente sullo SHELL (raramente serve, ma
   per sicurezza se l'utente clicca fuori dall'iframe). */
function tryUnlock() {
  if (audio?.paused && currentUrl) {
    audio.play().catch(() => {});
  }
}
window.addEventListener('pointerdown', tryUnlock);
window.addEventListener('keydown',     tryUnlock);

/* Loader: nascondi quando l'iframe segnala bgm:ready (o dopo timeout) */
function hideLoader() {
  const el = document.getElementById('shell-loader');
  if (el) {
    el.classList.add('is-hidden');
    setTimeout(() => el.remove(), 500);
  }
}
setTimeout(hideLoader, 3000);   // safety net

/* Iframe load event: anche quando l'iframe cambia pagina, ri-applichiamo
   il volume (per assicurare che riflette le impostazioni correnti). */
document.getElementById('app')?.addEventListener('load', () => {
  applyVolume();
});

/* ============================================================
   AUTO-PAUSE quando l'app va in background (mobile)
   ============================================================
   Quando l'utente socchiude il browser o passa a un'altra app sul
   telefono, document.hidden diventa true e firea visibilitychange.
   Pausiamo l'audio shell per non sprecare batteria/dati. Resume al
   ritorno in foreground se eravamo in riproduzione.

   pagehide è una rete di sicurezza per casi dove visibilitychange
   non scatta (es. PWA standalone iOS in alcuni scenari). */
let wasPlayingBeforeHide = false;
function pauseForBackground() {
  if (audio && !audio.paused) {
    wasPlayingBeforeHide = true;
    audio.pause();
  }
}
function resumeFromBackground() {
  if (wasPlayingBeforeHide && audio && audio.paused) {
    wasPlayingBeforeHide = false;
    applyVolume();
    audio.play().catch(() => {});
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseForBackground();
  else                 resumeFromBackground();
});
// pagehide/pageshow servono su iOS Safari (PWA mode) dove visibilitychange
// non sempre scatta. Su desktop non causano falsi positivi perché firano
// solo quando la pagina è davvero unloaded (non solo blur di finestra).
window.addEventListener('pagehide',   pauseForBackground);
window.addEventListener('pageshow',   resumeFromBackground);
