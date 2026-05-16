/* ============================================================
   sfx.js — Sound effects procedurali via Web Audio API
   ------------------------------------------------------------
   Zero file binari: ogni suono è sintetizzato in tempo reale con
   oscillatori e envelope. Stile retro/chiptune che matcha il
   tema Pokemon Gen I.

   API:
     SFX.<name>()    riproduce un effetto (no-op se audio disabilitato)
     setVolume(master, sfxLevel)   volume globale (0-1)
     getVolume()                    { master, sfx }
     unlockAudio()                  abilita audio dopo gesto utente

   Volumi persistiti in localStorage:
     pkmn_audio_master  (0-100, default 80)
     pkmn_audio_sfx     (0-100, default 80)
     pkmn_audio_enabled (1/0, default 1)
   ============================================================ */

const KEY_MASTER  = 'pkmn_audio_master';
const KEY_SFX     = 'pkmn_audio_sfx';
const KEY_ENABLED = 'pkmn_audio_enabled';

let ctx = null;
let masterGain = null;
let sfxGain    = null;
let unlocked   = false;

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    sfxGain    = ctx.createGain();
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyVolumes();
  } catch (e) {
    console.warn('[sfx] Web Audio non disponibile:', e.message);
    ctx = null;
  }
  return ctx;
}

function readVol(key, def) {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : def;
  } catch { return def; }
}

function applyVolumes() {
  if (!masterGain || !sfxGain) return;
  const m = readVol(KEY_MASTER, 80) / 100;
  const s = readVol(KEY_SFX, 80) / 100;
  const enabled = (localStorage.getItem(KEY_ENABLED) ?? '1') === '1';
  masterGain.gain.value = enabled ? m : 0;
  sfxGain.gain.value    = s;
}

/** Imposta volumi (0-100) e persiste. Se passi null lascia invariato. */
export function setVolume({ master, sfx, enabled } = {}) {
  if (master   != null) localStorage.setItem(KEY_MASTER,  String(master));
  if (sfx      != null) localStorage.setItem(KEY_SFX,     String(sfx));
  if (enabled  != null) localStorage.setItem(KEY_ENABLED, enabled ? '1' : '0');
  applyVolumes();
}

export function getVolume() {
  return {
    master:  readVol(KEY_MASTER, 80),
    sfx:     readVol(KEY_SFX, 80),
    enabled: (localStorage.getItem(KEY_ENABLED) ?? '1') === '1',
  };
}

/** Richiama questa al primo gesto utente per sbloccare AudioContext.
 *  I browser bloccano l'audio finché non c'è interazione. */
export function unlockAudio() {
  if (unlocked) return;
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().then(() => { unlocked = true; }).catch(() => {});
  } else {
    unlocked = true;
  }
}

/* ============================================================
   PRIMITIVE: tone, sweep, noise burst, chord
   ============================================================ */

/** Tone semplice con envelope esponenziale (attack veloce, decay) */
function tone({ freq = 440, duration = 0.08, type = 'square', vol = 0.18, attack = 0.005, decay = null } = {}) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const dur = decay ?? duration;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Sweep: frequenza che cambia esponenzialmente nel tempo */
function sweep({ from = 800, to = 200, duration = 0.18, type = 'sawtooth', vol = 0.18, attack = 0.005 } = {}) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Burst di rumore filtrato (usato per percussioni / impatti) */
function noise({ duration = 0.1, vol = 0.2, filterFreq = 600, filterQ = 1 } = {}) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  // Buffer di rumore bianco (1 secondo, riusato)
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, sr * Math.max(0.05, duration), sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(g).connect(sfxGain);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

/** Arpeggio: sequenza di toni con piccolo intervallo temporale */
function arpeggio(freqs, { stepDur = 0.08, type = 'square', vol = 0.18 } = {}) {
  const c = ensureCtx();
  if (!c) return;
  freqs.forEach((f, i) => {
    setTimeout(() => tone({ freq: f, duration: stepDur * 1.4, type, vol }), i * stepDur * 1000);
  });
}

/* ============================================================
   PUBLIC SFX — collezione di effetti tematici
   ============================================================ */
export const SFX = {
  /* Battaglia */
  hit:        () => { tone({ freq: 320, duration: 0.09, type: 'square', vol: 0.2 }); noise({ duration: 0.06, vol: 0.12, filterFreq: 500 }); },
  superHit:   () => {
    sweep({ from: 900, to: 200, duration: 0.22, type: 'square', vol: 0.22 });
    setTimeout(() => { tone({ freq: 90, duration: 0.18, type: 'sawtooth', vol: 0.32 }); noise({ duration: 0.15, vol: 0.18, filterFreq: 200 }); }, 60);
  },
  weakHit:    () => tone({ freq: 180, duration: 0.06, type: 'sine', vol: 0.14 }),
  immune:     () => { tone({ freq: 140, duration: 0.08, type: 'triangle', vol: 0.12 }); setTimeout(() => tone({ freq: 110, duration: 0.08, type: 'triangle', vol: 0.10 }), 70); },
  ko:         () => arpeggio([440, 330, 220, 165], { stepDur: 0.09, type: 'square', vol: 0.20 }),

  finisherCharge: () => sweep({ from: 200, to: 900, duration: 0.45, type: 'sawtooth', vol: 0.18 }),
  finisherHit:    () => {
    sweep({ from: 1100, to: 250, duration: 0.20, type: 'square', vol: 0.22 });
    tone({ freq: 80, duration: 0.30, type: 'sawtooth', vol: 0.35 });
    noise({ duration: 0.20, vol: 0.22, filterFreq: 180 });
  },

  speedCheck: () => arpeggio([660, 880], { stepDur: 0.07, type: 'square', vol: 0.16 }),
  turnStart:  () => tone({ freq: 660, duration: 0.09, type: 'sine', vol: 0.16 }),
  directHit:  () => { tone({ freq: 110, duration: 0.18, type: 'sawtooth', vol: 0.25 }); noise({ duration: 0.12, vol: 0.18, filterFreq: 280 }); },

  victory:    () => arpeggio([523, 659, 784, 1047, 1319], { stepDur: 0.13, type: 'square', vol: 0.22 }),
  defeat:     () => arpeggio([523, 415, 311, 196], { stepDur: 0.18, type: 'square', vol: 0.20 }),

  /* UI */
  click:      () => tone({ freq: 880, duration: 0.04, type: 'square', vol: 0.12 }),
  cardPlace:  () => { tone({ freq: 520, duration: 0.06, type: 'sine', vol: 0.18 }); setTimeout(() => tone({ freq: 720, duration: 0.05, type: 'sine', vol: 0.14 }), 30); },
  cardPick:   () => tone({ freq: 440, duration: 0.05, type: 'square', vol: 0.14 }),
  confirm:    () => { tone({ freq: 660, duration: 0.07, type: 'square', vol: 0.18 }); setTimeout(() => tone({ freq: 880, duration: 0.09, type: 'square', vol: 0.18 }), 60); },
  cancel:     () => { tone({ freq: 440, duration: 0.06, type: 'square', vol: 0.15 }); setTimeout(() => tone({ freq: 330, duration: 0.08, type: 'square', vol: 0.15 }), 60); },

  /* Summon */
  summonPull: () => sweep({ from: 100, to: 1200, duration: 0.6, type: 'sawtooth', vol: 0.18 }),
  reveal:     () => arpeggio([523, 659, 784, 1047], { stepDur: 0.10, type: 'sine', vol: 0.20 }),
  rare:       () => { sweep({ from: 400, to: 1600, duration: 0.35, type: 'square', vol: 0.18 }); setTimeout(() => arpeggio([784, 1047, 1319, 1568], { stepDur: 0.08, type: 'sine', vol: 0.22 }), 200); },
  legendary:  () => {
    sweep({ from: 200, to: 2400, duration: 0.8, type: 'sawtooth', vol: 0.20 });
    setTimeout(() => arpeggio([523, 659, 784, 1047, 1319, 1568, 2093], { stepDur: 0.09, type: 'square', vol: 0.24 }), 400);
  },

  /* Shop */
  purchase:   () => arpeggio([659, 880, 1108], { stepDur: 0.08, type: 'square', vol: 0.20 }),
  insufficient: () => { tone({ freq: 220, duration: 0.10, type: 'square', vol: 0.18 }); setTimeout(() => tone({ freq: 165, duration: 0.14, type: 'square', vol: 0.16 }), 100); },
};

/* ============================================================
   AUTO-UNLOCK al primo click in pagina
   ============================================================ */
if (typeof window !== 'undefined') {
  const onFirstGesture = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
  };
  window.addEventListener('pointerdown', onFirstGesture, { once: false });
  window.addEventListener('keydown',     onFirstGesture, { once: false });
}
