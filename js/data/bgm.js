/* ============================================================
   bgm.js — Background music procedurale via Web Audio API
   ------------------------------------------------------------
   Genera loop chiptune ORIGINALI in tempo reale. Nessun file audio
   binario, nessuna composizione copyrighted. Le melodie sono
   sequenze armoniche standard (progressioni comuni come I-V-vi-IV,
   ostinati minori, ecc.) composte da zero per questo progetto.

   API:
     playBGM(name)      avvia (o crossfade verso) un loop
     stopBGM()          ferma con fade out
     pauseBGM()/resume  pausa/ripristina
     isBGMPlaying()     stato

   Loop disponibili:
     'home'      — accogliente, maggiore (Home)
     'summon'    — mistico, pad + arpeggio (Summon page)
     'collection'— calmo, esplorativo (Collezione)
     'trainers'  — marziale, esplorativo (lista Allenatori)
     'battle'    — energico, minore (battaglie AI/PvP)
     'boss'      — drammatico (Trainer/Champion/Oak)
     'shop'      — leggero, allegro (Negozio)
     'victory'   — short jingle one-shot

   I file in assets/music/*.ogg se presenti hanno priorità sui loop
   procedurali (drop-in replacement quando avrai brani CC0).
   ============================================================ */

import { getAudioContext, getBgmGain } from './sfx.js';

/* ============================================================
   FILE TRACKS — priorità sui loop procedurali
   ------------------------------------------------------------
   Se la chiave è qui, viene caricato il file MP3/OGG come
   HTMLAudioElement (loop nativo). Se manca, fallback al loop
   procedurale definito in TRACKS più sotto.
   ============================================================ */
const FILE_TRACKS = {
  // Music di menu generica per tutte le pagine non-battaglia + settings/credits
  menu:       'assets/audio/menu.mp3',
  home:       'assets/audio/menu.mp3',
  collection: 'assets/audio/menu.mp3',
  summon:     'assets/audio/menu.mp3',
  trainers:   'assets/audio/menu.mp3',
  shop:       'assets/audio/menu.mp3',
  settings:   'assets/audio/menu.mp3',
  credits:    'assets/audio/menu.mp3',
  stats:      'assets/audio/menu.mp3',

  // Battaglie differenziate per tipo trainer
  //   'battle-gym'      → capipalestra (Brock, Misty, ..., Giovanni)
  //   'battle-trainer'  → Boss Rocket + Rivale (battaglie intermedie)
  //   'battle-champion' → Elite Four + Blue Champion
  //   'boss-oak'        → Prof. Oak (easter egg)
  // Se uno dei file manca, il sistema fa fallback al loop procedurale
  // 'boss' o 'battle' definito sotto in TRACKS.
  'battle-gym':      'assets/audio/gym-battle.mp3',
  'battle-trainer':  'assets/audio/trainer-battle.mp3',
  'battle-champion': 'assets/audio/champion-battle.mp3',
  'boss-oak':        'assets/audio/oak-battle.mp3',
};

/* ============================================================
   COSTANTI MUSICALI
   ============================================================ */
// Note → frequenze (A4 = 440 Hz, tuning equal temperament)
const NOTE = {};
(() => {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  for (let oct = 1; oct <= 7; oct++) {
    for (let i = 0; i < 12; i++) {
      const f = 440 * Math.pow(2, ((oct * 12 + i) - 57) / 12);
      NOTE[`${names[i]}${oct}`] = f;
    }
  }
})();

/* ============================================================
   TRACCE PROCEDURALI
   ------------------------------------------------------------
   Ogni traccia è un oggetto { bpm, bars, voices[] }.
   Una voce è { name, notes[], oct?, type?, vol?, attack?, release? }.
   Le notes sono array [step, duration_in_steps, noteName, velocity?]
   Step = 16th notes (4 step = 1 quarto).
   ============================================================ */

/* Helper per scrivere accordi → arpeggio rapido */
function arpeggio(rootStep, chordNotes, octave, stepDur = 1, length = 8) {
  const out = [];
  for (let i = 0; i < length; i++) {
    const note = chordNotes[i % chordNotes.length] + octave;
    out.push([rootStep + i * stepDur, stepDur, note]);
  }
  return out;
}

/* HOME — Maggiore felice (progressione I-V-vi-IV in C maj)
   - Bass: C - G - A - F (root della progressione)
   - Lead: arpeggi ascendenti */
const TRACK_HOME = {
  bpm: 116,
  bars: 4,                                    // 4 misure * 16 step = 64 step
  voices: [
    {
      name: 'bass',
      type: 'triangle',
      vol:  0.18,
      attack: 0.01,
      notes: [
        [0,  4, 'C3'], [4,  4, 'C3'], [8,  4, 'G3'], [12, 4, 'G3'],
        [16, 4, 'A2'], [20, 4, 'A2'], [24, 4, 'F3'], [28, 4, 'F3'],
        [32, 4, 'C3'], [36, 4, 'C3'], [40, 4, 'G3'], [44, 4, 'G3'],
        [48, 4, 'A2'], [52, 4, 'A2'], [56, 4, 'F3'], [60, 4, 'F3'],
      ],
    },
    {
      name: 'lead',
      type: 'square',
      vol:  0.10,
      attack: 0.005,
      notes: [
        // Bar 1: C maj arpeggio (C E G C)
        [0, 2, 'C5'], [2, 2, 'E5'], [4, 2, 'G5'], [6, 2, 'C6'],
        [8, 2, 'G5'], [10, 2, 'E5'], [12, 2, 'D5'], [14, 2, 'C5'],
        // Bar 2: A min arpeggio (A C E A)
        [16, 2, 'A4'], [18, 2, 'C5'], [20, 2, 'E5'], [22, 2, 'A5'],
        [24, 2, 'F5'], [26, 2, 'E5'], [28, 2, 'D5'], [30, 2, 'C5'],
        // Bar 3: ripetizione variata
        [32, 2, 'C5'], [34, 2, 'E5'], [36, 2, 'G5'], [38, 2, 'B5'],
        [40, 2, 'G5'], [42, 2, 'E5'], [44, 2, 'F5'], [46, 2, 'G5'],
        // Bar 4: cadenza
        [48, 4, 'A5'], [52, 4, 'G5'], [56, 4, 'F5'], [60, 4, 'C5'],
      ],
    },
  ],
};

/* COLLECTION — Calmo, esplorativo (D dorian, arpeggio lento) */
const TRACK_COLLECTION = {
  bpm: 90,
  bars: 4,
  voices: [
    {
      name: 'bass',
      type: 'sine',
      vol:  0.15,
      attack: 0.04,
      notes: [
        [0,  8, 'D3'],  [8,  8, 'D3'],
        [16, 8, 'F3'],  [24, 8, 'A3'],
        [32, 8, 'G3'],  [40, 8, 'G3'],
        [48, 8, 'A3'],  [56, 8, 'D3'],
      ],
    },
    {
      name: 'pad',
      type: 'triangle',
      vol:  0.07,
      attack: 0.10,
      notes: [
        [0, 16, 'A4'],  [16, 16, 'F5'],
        [32, 16, 'G4'], [48, 16, 'A4'],
      ],
    },
  ],
};

/* SUMMON — Mistico, pad sognante (E phrygian) */
const TRACK_SUMMON = {
  bpm: 80,
  bars: 4,
  voices: [
    {
      name: 'pad',
      type: 'sine',
      vol:  0.12,
      attack: 0.20,
      notes: [
        [0,  16, 'E3'],  [16, 16, 'F3'],
        [32, 16, 'G3'],  [48, 16, 'E3'],
      ],
    },
    {
      name: 'arp',
      type: 'triangle',
      vol:  0.08,
      attack: 0.01,
      notes: [
        ...arpeggio(0,  ['E', 'G', 'B'], 5, 2, 8),
        ...arpeggio(16, ['F', 'A', 'C'], 5, 2, 8),
        ...arpeggio(32, ['G', 'B', 'D'], 5, 2, 8),
        ...arpeggio(48, ['E', 'G', 'B'], 5, 2, 8),
      ],
    },
  ],
};

/* TRAINERS — Marziale, esplorativo (G major con ostinato) */
const TRACK_TRAINERS = {
  bpm: 110,
  bars: 4,
  voices: [
    {
      name: 'bass',
      type: 'sawtooth',
      vol:  0.13,
      attack: 0.01,
      notes: [
        [0, 2, 'G3'], [2, 2, 'D3'], [4, 2, 'G3'], [6, 2, 'B3'],
        [8, 2, 'G3'], [10, 2, 'D3'], [12, 2, 'G3'], [14, 2, 'B3'],
        [16, 2, 'C3'], [18, 2, 'G3'], [20, 2, 'C4'], [22, 2, 'E4'],
        [24, 2, 'C3'], [26, 2, 'G3'], [28, 2, 'C4'], [30, 2, 'E4'],
        [32, 2, 'A3'], [34, 2, 'E3'], [36, 2, 'A3'], [38, 2, 'C4'],
        [40, 2, 'A3'], [42, 2, 'E3'], [44, 2, 'A3'], [46, 2, 'C4'],
        [48, 2, 'D3'], [50, 2, 'A3'], [52, 2, 'D4'], [54, 2, 'F#4'],
        [56, 2, 'D3'], [58, 2, 'A3'], [60, 2, 'G3'], [62, 2, 'D4'],
      ],
    },
    {
      name: 'lead',
      type: 'square',
      vol:  0.09,
      attack: 0.005,
      notes: [
        [0,  4, 'D5'],  [4,  4, 'B4'], [8,  4, 'G5'],  [12, 4, 'D5'],
        [16, 4, 'E5'],  [20, 4, 'C5'], [24, 4, 'G5'],  [28, 4, 'E5'],
        [32, 4, 'A4'],  [36, 4, 'C5'], [40, 4, 'E5'],  [44, 4, 'A5'],
        [48, 4, 'F#5'], [52, 4, 'A5'], [56, 4, 'D5'],  [60, 4, 'G4'],
      ],
    },
  ],
};

/* BATTLE — Energico, minore (A min progressione i-VII-VI-V) */
const TRACK_BATTLE = {
  bpm: 138,
  bars: 4,
  voices: [
    {
      name: 'bass',
      type: 'sawtooth',
      vol:  0.18,
      attack: 0.005,
      notes: [
        // Pattern bass dritto, una nota per ogni quarto
        [0, 2, 'A2'], [2, 2, 'A2'], [4, 2, 'A2'], [6, 2, 'A2'],
        [8, 2, 'A2'], [10, 2, 'A2'], [12, 2, 'A2'], [14, 2, 'E3'],
        [16, 2, 'G2'], [18, 2, 'G2'], [20, 2, 'G2'], [22, 2, 'G2'],
        [24, 2, 'G2'], [26, 2, 'G2'], [28, 2, 'D3'], [30, 2, 'D3'],
        [32, 2, 'F2'], [34, 2, 'F2'], [36, 2, 'F2'], [38, 2, 'F2'],
        [40, 2, 'F2'], [42, 2, 'F2'], [44, 2, 'C3'], [46, 2, 'C3'],
        [48, 2, 'E3'], [50, 2, 'E3'], [52, 2, 'E3'], [54, 2, 'E3'],
        [56, 2, 'E3'], [58, 2, 'E3'], [60, 2, 'B3'], [62, 2, 'B3'],
      ],
    },
    {
      name: 'lead',
      type: 'square',
      vol:  0.10,
      attack: 0.003,
      notes: [
        [0, 2, 'A4'], [2, 2, 'C5'], [4, 2, 'E5'], [6, 2, 'A5'],
        [8, 2, 'G5'], [10, 2, 'E5'], [12, 2, 'C5'], [14, 2, 'A4'],
        [16, 2, 'G4'], [18, 2, 'B4'], [20, 2, 'D5'], [22, 2, 'G5'],
        [24, 2, 'F5'], [26, 2, 'D5'], [28, 2, 'B4'], [30, 2, 'G4'],
        [32, 2, 'F4'], [34, 2, 'A4'], [36, 2, 'C5'], [38, 2, 'F5'],
        [40, 2, 'E5'], [42, 2, 'C5'], [44, 2, 'A4'], [46, 2, 'F4'],
        [48, 2, 'E4'], [50, 2, 'G4'], [52, 2, 'B4'], [54, 2, 'E5'],
        [56, 2, 'D5'], [58, 2, 'B4'], [60, 2, 'E5'], [62, 2, 'A4'],
      ],
    },
  ],
};

/* BOSS — Drammatico (D minor con cromatismi) */
const TRACK_BOSS = {
  bpm: 128,
  bars: 4,
  voices: [
    {
      name: 'bass',
      type: 'sawtooth',
      vol:  0.20,
      attack: 0.005,
      notes: [
        [0, 1, 'D2'], [1, 1, 'D2'], [2, 1, 'D2'], [3, 1, 'A2'],
        [4, 1, 'D2'], [5, 1, 'D2'], [6, 1, 'D2'], [7, 1, 'F2'],
        [8, 1, 'D2'], [9, 1, 'D2'], [10, 1, 'D2'], [11, 1, 'A2'],
        [12, 1, 'D2'], [13, 1, 'D2'], [14, 1, 'D#2'], [15, 1, 'F2'],
        [16, 1, 'C2'], [17, 1, 'C2'], [18, 1, 'C2'], [19, 1, 'G2'],
        [20, 1, 'C2'], [21, 1, 'C2'], [22, 1, 'C2'], [23, 1, 'E2'],
        [24, 1, 'C2'], [25, 1, 'C2'], [26, 1, 'C#2'], [27, 1, 'D2'],
        [28, 1, 'A1'], [29, 1, 'A1'], [30, 1, 'A1'], [31, 1, 'A1'],
        [32, 1, 'B1'], [33, 1, 'B1'], [34, 1, 'B1'], [35, 1, 'F#2'],
        [36, 1, 'B1'], [37, 1, 'B1'], [38, 1, 'B1'], [39, 1, 'D2'],
        [40, 1, 'B1'], [41, 1, 'B1'], [42, 1, 'C2'], [43, 1, 'D2'],
        [44, 1, 'F2'], [45, 1, 'F2'], [46, 1, 'F2'], [47, 1, 'A2'],
        [48, 1, 'A2'], [49, 1, 'A2'], [50, 1, 'A2'], [51, 1, 'E3'],
        [52, 1, 'A2'], [53, 1, 'A2'], [54, 1, 'A#2'], [55, 1, 'C3'],
        [56, 1, 'D3'], [57, 1, 'D3'], [58, 1, 'C#3'], [59, 1, 'C3'],
        [60, 1, 'B2'], [61, 1, 'A2'], [62, 1, 'G2'], [63, 1, 'F2'],
      ],
    },
    {
      name: 'lead',
      type: 'square',
      vol:  0.11,
      attack: 0.003,
      notes: [
        [0, 4, 'D5'], [4, 4, 'F5'], [8, 4, 'A5'], [12, 4, 'F5'],
        [16, 4, 'C5'], [20, 4, 'E5'], [24, 4, 'G5'], [28, 4, 'F5'],
        [32, 4, 'B4'], [36, 4, 'D5'], [40, 4, 'F5'], [44, 4, 'D5'],
        [48, 4, 'C5'], [52, 4, 'E5'], [56, 4, 'D5'], [60, 4, 'A4'],
      ],
    },
  ],
};

/* SHOP — Leggero, allegro (F maj swing) */
const TRACK_SHOP = {
  bpm: 108,
  bars: 4,
  voices: [
    {
      name: 'bass',
      type: 'triangle',
      vol:  0.14,
      attack: 0.01,
      notes: [
        [0, 4, 'F3'], [4, 4, 'C3'], [8, 4, 'F3'], [12, 4, 'A3'],
        [16, 4, 'D3'], [20, 4, 'A3'], [24, 4, 'D3'], [28, 4, 'F3'],
        [32, 4, 'G3'], [36, 4, 'D3'], [40, 4, 'G3'], [44, 4, 'B3'],
        [48, 4, 'C3'], [52, 4, 'G3'], [56, 4, 'C3'], [60, 4, 'E3'],
      ],
    },
    {
      name: 'lead',
      type: 'square',
      vol:  0.09,
      attack: 0.005,
      notes: [
        [0, 2, 'F5'], [2, 2, 'A5'], [4, 2, 'C6'], [6, 2, 'A5'],
        [8, 2, 'F5'], [10, 2, 'A5'], [12, 2, 'F5'], [14, 2, 'C5'],
        [16, 2, 'D5'], [18, 2, 'F5'], [20, 2, 'A5'], [22, 2, 'F5'],
        [24, 2, 'D5'], [26, 2, 'F5'], [28, 2, 'D5'], [30, 2, 'A4'],
        [32, 2, 'G5'], [34, 2, 'B5'], [36, 2, 'D6'], [38, 2, 'B5'],
        [40, 2, 'G5'], [42, 2, 'B5'], [44, 2, 'G5'], [46, 2, 'D5'],
        [48, 2, 'E5'], [50, 2, 'G5'], [52, 2, 'C6'], [54, 2, 'G5'],
        [56, 2, 'E5'], [58, 2, 'G5'], [60, 2, 'F5'], [62, 2, 'C5'],
      ],
    },
  ],
};

const TRACKS = {
  home:       TRACK_HOME,
  collection: TRACK_COLLECTION,
  summon:     TRACK_SUMMON,
  trainers:   TRACK_TRAINERS,
  battle:     TRACK_BATTLE,
  boss:       TRACK_BOSS,
  shop:       TRACK_SHOP,
};

/* ============================================================
   PLAYER — engine di scheduling Web Audio
   ============================================================ */

const CROSSFADE_S  = 1.2;     // secondi di crossfade tra brani
const LOOK_AHEAD_S = 0.5;     // quanto in anticipo schedula le note
const TICK_MS      = 100;     // intervallo dello scheduler
const FILE_TARGET_VOL = 0.55; // volume target per i file MP3 (rispetto al bgmGain)

let currentName = null;
let currentVoiceNodes = [];   // gain nodes attivi (per fade out) - procedural
let currentFilePlayer = null; // { audio, srcNode, gainNode } - file-based
let schedulerHandle = null;
let nextStepTime = 0;
let currentStep = 0;
let isPlayingFlag = false;
let pendingPlay = null;        // se tenta di partire prima dell'unlock

/** True se il browser è stato sbloccato (gesto utente) e c'è audio. */
function audioReady() {
  const c = getAudioContext();
  return !!c && c.state === 'running';
}

/** Avvia o crossfade verso un loop. Cerca prima un file in FILE_TRACKS,
 *  altrimenti usa il loop procedurale in TRACKS. */
export function playBGM(name) {
  if (!FILE_TRACKS[name] && !TRACKS[name]) {
    console.warn('[bgm] traccia sconosciuta:', name);
    return;
  }
  if (currentName === name && isPlayingFlag) return;  // già in riproduzione

  // Se l'audio non è ancora unlocked, ricorda la richiesta e riprova
  // dopo il primo gesto utente.
  if (!audioReady()) {
    pendingPlay = name;
    return;
  }

  // Crossfade-out di QUALSIASI traccia precedente (procedurale o file)
  if (currentVoiceNodes.length) fadeOutVoices(currentVoiceNodes, CROSSFADE_S);
  if (currentFilePlayer)        fadeOutFile(currentFilePlayer, CROSSFADE_S);
  currentVoiceNodes  = [];
  currentFilePlayer  = null;
  if (schedulerHandle) { clearTimeout(schedulerHandle); schedulerHandle = null; }

  currentName    = name;
  isPlayingFlag  = true;

  // Priorità: file MP3/OGG se mappato in FILE_TRACKS
  if (FILE_TRACKS[name]) {
    playFileTrack(FILE_TRACKS[name], name);
  } else {
    playProceduralTrack(TRACKS[name], name);
  }
}

/* Resume state: salviamo la posizione del player in localStorage prima di
   navigare via, così la nuova pagina può riprendere DALLO STESSO punto.
   Il gap percepito è ~200-400ms (page reload + audio decode).

   CHIAVE: l'URL del file (non il nome della traccia) — perché 'home',
   'collection', 'settings', ecc. risolvono tutti a 'menu.mp3', quindi
   navigando tra menu deve continuare lo STESSO file. */
const RESUME_KEY = 'pkmn_bgm_resume';
const RESUME_MAX_AGE_MS = 60_000;   // resume valido entro 60 secondi (copre
                                    // il caso "utente apre pagina ma non
                                    // interagisce subito = audio context locked")

function readResumeState(url) {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.url !== url) return null;
    if (Date.now() - s.savedAt > RESUME_MAX_AGE_MS) return null;
    return s;
  } catch { return null; }
}
function saveResumeState() {
  try {
    if (currentFilePlayer?.audio && currentName) {
      const url = FILE_TRACKS[currentName];
      if (!url) return;
      const s = {
        url,
        name: currentName,
        currentTime: currentFilePlayer.audio.currentTime,
        savedAt: Date.now(),
      };
      localStorage.setItem(RESUME_KEY, JSON.stringify(s));
    }
  } catch {}
}
function clearResumeState() {
  try { localStorage.removeItem(RESUME_KEY); } catch {}
}

/* Salva la posizione prima di lasciare la pagina. pagehide è più affidabile
   di unload su mobile e Safari, ma per sicurezza salviamo anche periodicamente
   ogni secondo durante la riproduzione → anche se nessun evento di unload
   scattasse, abbiamo sempre uno snapshot recente in localStorage. */
let periodicSaveHandle = null;
function startPeriodicSave() {
  if (periodicSaveHandle) return;
  periodicSaveHandle = setInterval(saveResumeState, 1000);
}
function stopPeriodicSave() {
  if (periodicSaveHandle) {
    clearInterval(periodicSaveHandle);
    periodicSaveHandle = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide',       saveResumeState);
  window.addEventListener('beforeunload',   saveResumeState);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveResumeState();
  });
}

/** Avvia un file audio (MP3/OGG) come BGM con loop nativo + crossfade.
 *  Se è la stessa traccia di un saveResumeState recente (cambio pagina),
 *  riprende esattamente da quella posizione → continuità tra pagine. */
function playFileTrack(url, trackName) {
  const ctx = getAudioContext();
  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';   // carica il file completo, no solo metadata
  audio.crossOrigin = 'anonymous';

  // RESUME: se lo STESSO FILE era in riproduzione su pagina precedente,
  // riprendi dal punto esatto. Il match è sull'URL (non sul nome traccia)
  // così navigando tra menu (home/collection/settings/ecc → tutti menu.mp3)
  // l'audio continua senza saltare.
  //
  // IMPORTANTE: settare audio.currentTime PRIMA che l'audio abbia caricato
  // i metadati viene SILENZIOSAMENTE IGNORATO dai browser → il fix è
  // applicare il seek dentro l'evento 'loadedmetadata'. Se i metadati
  // erano già pronti (caso SW cache hit), readyState >= 1 e applichiamo subito.
  const resumed = readResumeState(url);
  if (resumed) {
    const applySeek = () => {
      try { audio.currentTime = resumed.currentTime; } catch (e) {}
    };
    if (audio.readyState >= 1 /* HAVE_METADATA */) {
      applySeek();
    } else {
      audio.addEventListener('loadedmetadata', applySeek, { once: true });
    }
    clearResumeState();   // consuma lo state (one-shot)
  }

  // Routing via Web Audio per usare bgmGain (volume controllabile da Settings)
  let srcNode;
  try {
    srcNode = ctx.createMediaElementSource(audio);
  } catch (e) {
    // Alcuni browser non permettono di creare due source dallo stesso audio.
    // Fallback: regola direttamente audio.volume (perderemo il crossfade gain).
    console.warn('[bgm] createMediaElementSource fallito, fallback HTMLAudio:', e);
    audio.volume = FILE_TARGET_VOL;
    audio.play().catch(err => console.warn('[bgm] play fallito:', err));
    currentFilePlayer = { audio, srcNode: null, gainNode: null };
    return;
  }

  const gainNode = ctx.createGain();
  if (resumed) {
    // GAP-FREE: per il resume settiamo il volume target direttamente,
    // senza alcun ramp. Combinato col SW pre-cache, il cambio di pagina
    // è quasi impercettibile.
    gainNode.gain.value = FILE_TARGET_VOL;
  } else {
    // Prima volta che parte questa traccia → crossfade normale
    gainNode.gain.value = 0;
    gainNode.gain.linearRampToValueAtTime(FILE_TARGET_VOL, ctx.currentTime + CROSSFADE_S);
  }
  srcNode.connect(gainNode).connect(getBgmGain());

  audio.play().catch(err => {
    // Fallisce se l'utente non ha ancora interagito — riprova al prossimo gesto
    console.warn('[bgm] audio.play() bloccato:', err.message);
  });

  currentFilePlayer = { audio, srcNode, gainNode };
  startPeriodicSave();   // salva snapshot ogni 1s per il resume tra pagine
}

/** Fade out + stop di un file player. */
function fadeOutFile(player, durSec) {
  const ctx = getAudioContext();
  const t0 = ctx.currentTime;
  if (player.gainNode) {
    player.gainNode.gain.cancelScheduledValues(t0);
    player.gainNode.gain.setValueAtTime(player.gainNode.gain.value, t0);
    player.gainNode.gain.linearRampToValueAtTime(0, t0 + durSec);
  } else if (player.audio) {
    // Fallback senza Web Audio: fade JS-based
    const start = player.audio.volume;
    const steps = 20;
    let i = 0;
    const handle = setInterval(() => {
      i++;
      player.audio.volume = Math.max(0, start * (1 - i / steps));
      if (i >= steps) { clearInterval(handle); player.audio.pause(); }
    }, (durSec * 1000) / steps);
    return;
  }
  setTimeout(() => {
    try { player.audio.pause(); } catch {}
    try { player.srcNode && player.srcNode.disconnect(); } catch {}
    try { player.gainNode && player.gainNode.disconnect(); } catch {}
  }, durSec * 1000 + 200);
}

/** Avvia un loop procedurale Web Audio (note schedulate ad anticipo). */
function playProceduralTrack(track, name) {
  const ctx = getAudioContext();
  const stepDur = 60 / track.bpm / 4;
  const totalSteps = track.bars * 16;

  const voiceGains = track.voices.map(v => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(v.vol ?? 0.1, ctx.currentTime + CROSSFADE_S);
    g.connect(getBgmGain());
    return { voice: v, gain: g };
  });
  currentVoiceNodes = voiceGains.map(x => x.gain);

  nextStepTime = ctx.currentTime + 0.05;
  currentStep  = 0;

  function scheduler() {
    if (!isPlayingFlag || currentName !== name) return;
    const horizon = ctx.currentTime + LOOK_AHEAD_S;
    while (nextStepTime < horizon) {
      for (const { voice, gain } of voiceGains) {
        for (const [step, dur, noteName, vel] of voice.notes) {
          if (step !== currentStep) continue;
          const freq = NOTE[noteName];
          if (!freq) continue;
          scheduleNote({
            freq,
            startTime: nextStepTime,
            duration:  dur * stepDur,
            type:      voice.type ?? 'square',
            attack:    voice.attack ?? 0.005,
            destination: gain,
            velocity:  vel ?? 1,
          });
        }
      }
      currentStep = (currentStep + 1) % totalSteps;
      nextStepTime += stepDur;
    }
    schedulerHandle = setTimeout(scheduler, TICK_MS);
  }
  scheduler();
}

function scheduleNote({ freq, startTime, duration, type, attack, destination, velocity }) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  const peak = 1 * velocity;
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(peak, startTime + attack);
  // Sustain breve seguito da release esponenziale
  const releaseStart = startTime + duration * 0.85;
  g.gain.setValueAtTime(peak, releaseStart);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(g).connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function fadeOutVoices(gains, durSec) {
  const ctx = getAudioContext();
  const t0 = ctx.currentTime;
  for (const g of gains) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(g.gain.value, t0);
    g.gain.linearRampToValueAtTime(0, t0 + durSec);
  }
  // Dopo il fade, scollega per non sprecare cicli CPU
  setTimeout(() => {
    for (const g of gains) {
      try { g.disconnect(); } catch {}
    }
  }, durSec * 1000 + 200);
}

/** Stop totale (fade out). */
export function stopBGM() {
  if (!isPlayingFlag) return;
  isPlayingFlag = false;
  if (schedulerHandle) clearTimeout(schedulerHandle);
  schedulerHandle = null;
  if (currentVoiceNodes.length) {
    fadeOutVoices(currentVoiceNodes, CROSSFADE_S);
    currentVoiceNodes = [];
  }
  if (currentFilePlayer) {
    fadeOutFile(currentFilePlayer, CROSSFADE_S);
    currentFilePlayer = null;
  }
  stopPeriodicSave();
  currentName = null;
  pendingPlay = null;
}

/** Pausa: il context entra in stato 'suspended' (silenzio totale). */
export function pauseBGM() {
  const c = getAudioContext();
  if (c && c.state === 'running') c.suspend();
}
export function resumeBGM() {
  const c = getAudioContext();
  if (c && c.state === 'suspended') c.resume();
}

export function isBGMPlaying() {
  return isPlayingFlag;
}

/* Auto-pause quando la tab perde il focus (non sprecare audio) */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseBGM();
    else if (isPlayingFlag) resumeBGM();
  });
}

/* Auto-play della pending track quando l'audio si sblocca */
if (typeof window !== 'undefined') {
  const tryResume = () => {
    if (pendingPlay) {
      const name = pendingPlay;
      pendingPlay = null;
      // Aspetta un attimo che ensureCtx abbia fatto il resume
      setTimeout(() => playBGM(name), 100);
    }
  };
  window.addEventListener('pointerdown', tryResume);
  window.addEventListener('keydown',     tryResume);
}
