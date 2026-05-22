/* ============================================================
   story.js — motore della modalità storia
   ============================================================
   - Carica scena corrente da storyState
   - Renderizza decorations + hotspots
   - Gestisce click su hotspots (door/exit/npc/item/trainer)
   - Engine dialoghi sequenziali
   ============================================================ */

// Cloud sync dinamico: se la CDN Supabase è bloccata, la pagina funziona lo stesso
import('./data/cloud-sync.js?v=5').catch(err => console.warn('[cloud] non disponibile:', err.message));

import { loadAllPokemon, findPokemon } from './data/pokeapi.js';
import { SCENES, DIALOGS, REGION }      from './data/scenes.js';
import { isLegendary }                  from './data/rarity.js';
import { playLegendaryCinematic }       from './data/legendary-cinematic.js';
import { spriteUrl, tileUrl }           from './data/sprites.js';
import {
  getStoryState,
  getCurrentScene,
  setCurrentScene,
  hasFlag,
  setFlag,
  isHotspotConsumed,
  consumeHotspot,
  isDialogSeen,
  markDialogSeen,
  givePokemon,
  evalRequires,
  markLocationVisited,
  isLocationVisited,
} from './data/story-state.js';

const $ = id => document.getElementById(id);

/* ================================================================
   STATO RUNTIME
   ================================================================ */

let allPokemon       = [];
let currentSceneId   = null;
let dialogQueue      = [];     // linee del dialogo corrente
let dialogIndex      = 0;
let dialogActive     = false;
let pendingAfterDialog = null; // callback dopo che il dialogo finisce

/* ================================================================
   INIT
   ================================================================ */

(async () => {
  try {
    await loadAllPokemon();
    allPokemon = await loadAllPokemon(); // riusa cache
  } catch (e) {
    console.warn('Caricamento Pokémon fallito (non critico per la storia):', e);
  }

  // Inizializza la minimap regionale
  initMinimap();

  // Helper di debug per posizionare hotspot/marker (attivo solo se body.is-debug)
  setupDebugHelpers();

  // Avvia dalla scena salvata
  const startScene = getCurrentScene();
  renderScene(startScene);

  // Bottoni globali
  $('btnExitStory').addEventListener('click', e => {
    e.preventDefault();
    $('exitStoryModal').classList.remove('hidden');
  });
  document.querySelectorAll('[data-close-exit]').forEach(el => {
    el.addEventListener('click', () => $('exitStoryModal').classList.add('hidden'));
  });

  // Click sul dialog box → avanza
  $('dialogBox').addEventListener('click', advanceDialog);
  document.addEventListener('keydown', e => {
    if (dialogActive && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      advanceDialog();
    }
    if (e.key === 'Escape') {
      $('exitStoryModal').classList.toggle('hidden');
    }
  });
})();

/* ================================================================
   SCENE RENDERING
   ================================================================ */

function renderScene(sceneId) {
  const scene = SCENES[sceneId];
  if (!scene) {
    console.error('Scena non trovata:', sceneId);
    return;
  }

  currentSceneId = sceneId;
  setCurrentScene(sceneId);

  // Top bar
  $('sceneTitle').textContent    = scene.name ?? '—';
  $('sceneSubtitle').textContent = scene.subtitle ?? '';

  // Marca location come visitata (per fast-travel via minimap)
  if (scene.mapLocation) {
    markLocationVisited(scene.mapLocation.id);
  }

  // Reset
  const sceneEl = $('sceneRoot');
  sceneEl.innerHTML = '';
  sceneEl.style.cssText = '';
  sceneEl.classList.remove('scene--fallback', 'scene--pan');

  // maxWidth opzionale: per le scene interne con immagine a bassa risoluzione,
  // limita la larghezza così i pixel non sgranano scalati a tutto schermo.
  if (scene.viewport?.maxWidth) {
    sceneEl.style.maxWidth = scene.viewport.maxWidth;
  }

  // Determina il modo di visualizzazione
  const mode = scene.viewport?.mode ?? 'fit';
  const zoom = scene.viewport?.zoom ?? 1;

  // Costruisce il pan-container che conterrà sfondo + hotspot (cosi si traslano insieme)
  const pan = document.createElement('div');
  pan.className = 'scene__pan';
  sceneEl.appendChild(pan);

  // Sfondo
  if (scene.bgImage) {
    const bg = document.createElement('img');
    bg.className = 'scene__bg-image';
    bg.src = scene.bgImage;
    bg.alt = '';
    bg.draggable = false;
    bg.addEventListener('load', () => onBgLoaded(scene, sceneEl, pan, bg, mode, zoom));
    bg.addEventListener('error', () => {
      console.warn(`Immagine non trovata: ${scene.bgImage} — fallback a sprite.`);
      bg.remove();
      renderFallbackBackground(scene, sceneEl, pan);
    });
    pan.appendChild(bg);
  } else {
    renderFallbackBackground(scene, sceneEl, pan);
  }

  // Note testuali (placeholder scene "prossimamente") — sempre visibili
  (scene.decorations ?? []).filter(d => d.type === 'note').forEach(deco => {
    pan.appendChild(buildDecoration(deco));
  });

  // Hotspots — sempre inseriti nel pan-container
  (scene.hotspots ?? []).forEach(hs => {
    const el = buildHotspot(hs);
    if (el) pan.appendChild(el);
  });

  // Reanima fade-in
  sceneEl.style.animation = 'none';
  void sceneEl.offsetWidth;
  sceneEl.style.animation = '';

  // Aggiorna la minimap (marker corrente cambiato, eventuali nuove visited)
  renderMinimap();

  // onEnter: triggera dialogo se previsto
  if (scene.onEnter?.dialog) {
    const dialogId = scene.onEnter.dialog;
    const once = scene.onEnter.once;
    if (!once || !isDialogSeen(`scene-enter:${sceneId}:${dialogId}`)) {
      setTimeout(() => {
        startDialog(dialogId);
        if (once) markDialogSeen(`scene-enter:${sceneId}:${dialogId}`);
      }, 350);
    }
  }
}

/**
 * Chiamato quando l'immagine di sfondo è caricata.
 * Configura fit vs pan a seconda della modalità.
 */
function onBgLoaded(scene, sceneEl, pan, bg, mode, zoom) {
  const naturalW = bg.naturalWidth;
  const naturalH = bg.naturalHeight;

  if (mode === 'pan') {
    sceneEl.classList.add('scene--pan');
    // Il viewport della scena diventa fisso (ratio 16:10), il pan-container è dell'immagine scalata
    sceneEl.style.aspectRatio = '16 / 10';
    const scaledW = naturalW * zoom;
    const scaledH = naturalH * zoom;
    pan.style.width  = `${scaledW}px`;
    pan.style.height = `${scaledH}px`;
    // Centra l'immagine inizialmente
    centerPan(sceneEl, pan);
    enableDragPan(sceneEl, pan);
  } else {
    // Fit mode: aspect-ratio della scena segue l'immagine, pan-container riempie tutto
    sceneEl.style.aspectRatio = `${naturalW} / ${naturalH}`;
  }
}

/* ============================================================
   DRAG-TO-PAN (stile Google Maps)
   ============================================================ */

let _panState = null;     // null oppure { startX, startY, startTx, startTy }
let _panTx = 0, _panTy = 0;

function centerPan(sceneEl, pan) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const panW = pan.offsetWidth;
  const panH = pan.offsetHeight;
  _panTx = (sceneRect.width  - panW) / 2;
  _panTy = (sceneRect.height - panH) / 2;
  applyPanTransform(pan, sceneEl);
}

function applyPanTransform(pan, sceneEl) {
  // Clamp: il pan-container non può sbordare oltre i bordi del viewport
  const sceneRect = sceneEl.getBoundingClientRect();
  const panW = pan.offsetWidth;
  const panH = pan.offsetHeight;
  const minTx = Math.min(0, sceneRect.width  - panW);   // se panW > sceneW: minTx negativo
  const maxTx = Math.max(0, sceneRect.width  - panW);   // se panW < sceneW: maxTx positivo
  const minTy = Math.min(0, sceneRect.height - panH);
  const maxTy = Math.max(0, sceneRect.height - panH);
  _panTx = Math.max(minTx, Math.min(maxTx, _panTx));
  _panTy = Math.max(minTy, Math.min(maxTy, _panTy));
  pan.style.transform = `translate(${_panTx}px, ${_panTy}px)`;
}

function enableDragPan(sceneEl, pan) {
  function onDown(e) {
    // Non avviare drag se il click è su un hotspot o sul dialog
    if (e.target.closest('.hotspot') || dialogActive) return;
    e.preventDefault();
    const point = pointerXY(e);
    _panState = { startX: point.x, startY: point.y, startTx: _panTx, startTy: _panTy };
    sceneEl.classList.add('is-dragging');
  }
  function onMove(e) {
    if (!_panState) return;
    const point = pointerXY(e);
    _panTx = _panState.startTx + (point.x - _panState.startX);
    _panTy = _panState.startTy + (point.y - _panState.startY);
    applyPanTransform(pan, sceneEl);
  }
  function onUp() {
    if (!_panState) return;
    _panState = null;
    sceneEl.classList.remove('is-dragging');
  }

  sceneEl.addEventListener('mousedown',  onDown);
  sceneEl.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove',  onMove);
  window.addEventListener('touchmove',  onMove, { passive: false });
  window.addEventListener('mouseup',    onUp);
  window.addEventListener('touchend',   onUp);
  window.addEventListener('mouseleave', onUp);
}

function pointerXY(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

/**
 * Sfondo di fallback quando l'immagine PNG non è disponibile.
 * Tile pattern sul sceneEl + sprite decorativi nel pan-container.
 */
function renderFallbackBackground(scene, sceneEl, pan) {
  sceneEl.classList.add('scene--fallback');
  sceneEl.style.aspectRatio = '16 / 10';
  if (scene.style) Object.assign(sceneEl.style, scene.style);
  if (scene.tile) {
    sceneEl.style.backgroundImage  = `url("${tileUrl(scene.tile)}")`;
    sceneEl.style.backgroundRepeat = 'repeat';
    sceneEl.style.backgroundSize   = '64px 64px';
    sceneEl.style.imageRendering   = 'pixelated';
  }
  // Decorazioni sprite vanno nel pan-container (escluse le note testuali)
  (scene.decorations ?? []).filter(d => d.type !== 'note').forEach(deco => {
    const el = buildDecoration(deco);
    if (el) pan.appendChild(el);
  });
}

/* ============================================================
   MINIMAP — mappa regionale fissa lato schermo
   ============================================================ */

/* ============================================================
   DEBUG HELPERS — posizionamento hotspot/marker via click
   ============================================================
   Attivare aggiungendo class="is-debug" al <body> in story.html.
   Poi cliccando sulla scena (o sulla minimap espansa) le coordinate
   in % vengono stampate in console E copiate negli appunti.
*/

function setupDebugHelpers() {
  if (!document.body.classList.contains('is-debug')) return;

  // Click sulla scena → logga pos.cx/cy per hotspot (center-anchored)
  $('sceneRoot').addEventListener('click', e => {
    if (e.target.closest('.hotspot')) return;             // ignora click su hotspot esistenti
    if (e.target.closest('.dialog'))  return;
    const rect = $('sceneRoot').getBoundingClientRect();
    // Tieni conto anche del pan se in modalità pan
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = (x / rect.width)  * 100;
    const cy = (y / rect.height) * 100;
    const snippet = `pos: { cx: '${cx.toFixed(1)}%', cy: '${cy.toFixed(1)}%' }`;
    console.log(`📍 Scene click → ${snippet}`);
    copyToClipboard(snippet);
    showToast(`📋 ${snippet}`, 'success');
  });

  // Click sulla minimap (solo se espansa) → logga x/y per mapLocation
  $('minimapBody').addEventListener('click', e => {
    if (e.target.closest('.minimap-marker')) return;
    if (!$('minimap').classList.contains('is-expanded')) return;
    const rect = $('minimapBody').getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    const snippet = `x: '${x.toFixed(1)}%', y: '${y.toFixed(1)}%'`;
    console.log(`🗺️ Minimap click → ${snippet}`);
    copyToClipboard(snippet);
    showToast(`📋 ${snippet}`, 'success');
  });

  console.log('%c🔧 DEBUG MODE attivo — clicca per ottenere coordinate', 'background:#ffcb05;color:#000;padding:4px 10px;font-weight:bold;border-radius:3px;');
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function initMinimap() {
  const bgEl = $('minimapBg');
  if (REGION?.overworldImage) {
    bgEl.src = REGION.overworldImage;
    bgEl.addEventListener('error', () => {
      $('minimap').style.display = 'none';
    });
  }
  $('minimapTitle').textContent = (REGION?.name ?? '').toUpperCase();

  // Click sulla minimap (quando collassata) → espandi
  $('minimap').addEventListener('click', e => {
    // Se è già espansa, ignora (i marker e il close hanno i loro handler)
    if ($('minimap').classList.contains('is-expanded')) return;
    if (e.target.closest('.minimap-marker') || e.target.closest('.minimap__close')) return;
    expandMinimap();
  });

  // Close button e backdrop → collassa
  $('minimapClose').addEventListener('click', e => {
    e.stopPropagation();
    collapseMinimap();
  });
  $('minimapBackdrop').addEventListener('click', collapseMinimap);

  // ESC chiude la minimap se espansa
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('minimap').classList.contains('is-expanded')) {
      collapseMinimap();
    }
  });
}

function expandMinimap() {
  $('minimap').classList.add('is-expanded');
  $('minimapBackdrop').classList.remove('hidden');
  void $('minimapBackdrop').offsetWidth; // forza reflow per la transizione opacity
  $('minimapBackdrop').classList.add('is-shown');
}

function collapseMinimap() {
  $('minimap').classList.remove('is-expanded');
  $('minimapBackdrop').classList.remove('is-shown');
  setTimeout(() => $('minimapBackdrop').classList.add('hidden'), 280);
}

function renderMinimap() {
  const markersEl = $('minimapMarkers');
  if (!markersEl) return;
  markersEl.innerHTML = '';

  // Raccogli tutte le mapLocation definite nelle scene
  const locations = [];
  for (const [sceneId, scene] of Object.entries(SCENES)) {
    if (scene.mapLocation) {
      locations.push({ sceneId, ...scene.mapLocation });
    }
  }

  for (const loc of locations) {
    const visited = isLocationVisited(loc.id);
    const isCurrent = SCENES[currentSceneId]?.mapLocation?.id === loc.id;

    const marker = document.createElement('button');
    marker.className = 'minimap-marker';
    if (visited)   marker.classList.add('is-visited');
    if (isCurrent) marker.classList.add('is-current');
    marker.style.left = loc.x;
    marker.style.top  = loc.y;
    marker.setAttribute('aria-label', loc.label);
    marker.innerHTML = `<span class="minimap-marker__dot"></span><span class="minimap-marker__label">${loc.label}</span>`;

    if (visited && !isCurrent) {
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        // Fast-travel solo se la minimap è espansa
        if (!$('minimap').classList.contains('is-expanded')) {
          expandMinimap();
          return;
        }
        fastTravel(loc.sceneId);
      });
    } else if (!visited) {
      marker.disabled = true;
    }

    markersEl.appendChild(marker);
  }
}

function fastTravel(targetSceneId) {
  if (dialogActive) return;
  if (currentSceneId === targetSceneId) return;
  collapseMinimap();
  showToast(`✈ Volo verso ${SCENES[targetSceneId]?.name ?? targetSceneId}...`, 'success');
  setTimeout(() => transitionToScene(targetSceneId), 350);
}

/* ============================================================
   DECORAZIONI / HOTSPOT
   ============================================================ */

function buildDecoration(deco) {
  // Sprite pixel art (es. casa, lab, oak, albero)
  if (deco.sprite) {
    const img = document.createElement('img');
    img.className = 'deco deco--sprite';
    img.src = spriteUrl(deco.sprite);
    img.alt = '';
    img.draggable = false;
    applyPosition(img, deco.pos);
    if (deco.size) img.style.width = deco.size;
    return img;
  }

  // Box generico (rettangolo colorato — es. tavolo Lab)
  if (deco.box) {
    const el = document.createElement('div');
    el.className = 'deco deco--box';
    applyPosition(el, deco.pos);
    if (deco.size?.w) el.style.width  = deco.size.w;
    if (deco.size?.h) el.style.height = deco.size.h;
    if (deco.color)   el.style.background = deco.color;
    return el;
  }

  // Nota testuale (placeholder, scene "prossimamente")
  if (deco.type === 'note') {
    const el = document.createElement('div');
    el.className = 'deco deco--note';
    applyPosition(el, deco.pos);
    el.textContent = deco.label ?? '';
    return el;
  }

  // Fallback: div vuoto
  const el = document.createElement('div');
  applyPosition(el, deco.pos);
  return el;
}

function buildHotspot(hs) {
  // Se già consumato (per item, npc one-shot, ecc.) salta
  if (isHotspotConsumed(hs.id)) return null;

  const el = document.createElement('button');
  el.className = `hotspot hotspot--${hs.type}`;
  el.dataset.hotspotId = hs.id;
  applyPosition(el, hs.pos);
  if (hs.size) {
    if (hs.size.w) el.style.width  = hs.size.w;
    if (hs.size.h) el.style.height = hs.size.h;
  }

  // Sprite interno (es. pokéball pixel art)
  if (hs.sprite) {
    const img = document.createElement('img');
    img.className = 'hotspot__sprite';
    img.src = spriteUrl(hs.sprite);
    img.alt = '';
    img.draggable = false;
    el.appendChild(img);
  }

  // Label hover
  const label = document.createElement('span');
  label.className = 'hotspot__label';
  label.textContent = hs.label ?? '';
  el.appendChild(label);

  // Check requires per stato is-locked
  const req = hs.requires ? evalRequires(hs.requires) : { ok: true };
  if (!req.ok) el.classList.add('is-locked');

  // Click handler
  el.addEventListener('click', () => handleHotspotClick(hs));

  return el;
}

function applyPosition(el, pos = {}) {
  // Modalità "centered": cx/cy → posiziona l'elemento centrato su quel punto.
  // Comodo perché clicchi dove vuoi il centro e non devi sottrarre w/2 e h/2.
  if (pos.cx !== undefined || pos.cy !== undefined) {
    if (pos.cx !== undefined) el.style.left = pos.cx;
    if (pos.cy !== undefined) el.style.top  = pos.cy;
    el.style.transform = 'translate(-50%, -50%)';
    return;
  }
  // Modalità "corner" (legacy): left/right/top/bottom indicano l'angolo top-left.
  if (pos.left      !== undefined) el.style.left      = pos.left;
  if (pos.right     !== undefined) el.style.right     = pos.right;
  if (pos.top       !== undefined) el.style.top       = pos.top;
  if (pos.bottom    !== undefined) el.style.bottom    = pos.bottom;
  if (pos.transform !== undefined) el.style.transform = pos.transform;
}

/* ================================================================
   HOTSPOT CLICK HANDLING
   ================================================================ */

function handleHotspotClick(hs) {
  if (dialogActive) return;

  // Requires
  const req = hs.requires ? evalRequires(hs.requires) : { ok: true };
  if (!req.ok) {
    showToast(req.reason ?? 'Non posso ancora andare lì.', 'error');
    return;
  }

  switch (hs.type) {
    case 'door':
    case 'exit':
      transitionToScene(hs.target);
      break;

    case 'npc':
      if (hs.dialog) startDialog(hs.dialog);
      break;

    case 'item':
      collectItem(hs);
      break;

    case 'trainer':
      // M12c: collegamento col motore di battaglia (non in questa fase)
      showToast('Battaglia allenatore — prossimamente.', 'success');
      break;

    default:
      console.warn('Tipo hotspot sconosciuto:', hs.type);
  }
}

function transitionToScene(targetId) {
  if (!SCENES[targetId]) {
    showToast('Scena non disponibile.', 'error');
    return;
  }
  // Fade-out → cambio → fade-in fatto da animazione CSS
  const root = $('sceneRoot');
  root.style.transition = 'opacity 0.18s ease';
  root.style.opacity = '0';
  setTimeout(() => {
    root.style.opacity = '';
    root.style.transition = '';
    renderScene(targetId);
  }, 180);
}

async function collectItem(hs) {
  // Effetti onPick
  const onPick = hs.onPick ?? {};

  // Aggiungi Pokémon se give.pokemon
  let isLegendaryCapture = false;
  let capturedPokemon    = null;
  if (hs.give?.pokemon) {
    const id    = hs.give.pokemon;
    const added = givePokemon(id);
    const pkmn  = findPokemon(id);
    capturedPokemon    = pkmn;
    isLegendaryCapture = added && isLegendary(id);

    if (!isLegendaryCapture) {
      // Pokémon normale → toast classico
      const name = pkmn?.name ?? `Pokémon #${id}`;
      showToast(added ? `✨ Hai ottenuto ${name}!` : `Avevi già ${name}.`, 'success');
    }
    // Se leggendario: niente toast, la cinematica gestisce la presentazione
  }

  // Set flags
  if (Array.isArray(onPick.setFlags)) {
    onPick.setFlags.forEach(f => setFlag(f));
  }

  // Consume hotspots (l'attuale + eventuali altri)
  if (Array.isArray(onPick.consumeHotspots)) {
    onPick.consumeHotspots.forEach(id => consumeHotspot(id));
  } else {
    consumeHotspot(hs.id);
  }

  // Re-render per riflettere consumed/flags
  renderScene(currentSceneId);

  // Cinematica leggendario: blocca il flow finché l'utente non clicca "Continua"
  if (isLegendaryCapture && capturedPokemon) {
    await playLegendaryCinematic(capturedPokemon);
  }

  // Dialogo dopo la scelta (se previsto)
  if (onPick.dialog) {
    setTimeout(() => startDialog(onPick.dialog), 300);
  }
}

/* ================================================================
   DIALOG ENGINE
   ================================================================ */

function startDialog(dialogId) {
  const lines = DIALOGS[dialogId];
  if (!lines || lines.length === 0) {
    console.warn('Dialogo vuoto/inesistente:', dialogId);
    return;
  }
  dialogQueue  = [...lines];
  dialogIndex  = 0;
  dialogActive = true;
  $('dialogBox').classList.remove('hidden');
  renderDialogLine();
}

function renderDialogLine() {
  if (dialogIndex >= dialogQueue.length) {
    endDialog();
    return;
  }
  const line = dialogQueue[dialogIndex];

  // Linee "azione" (no UI, eseguite e si avanza subito)
  if (line.type) {
    executeDialogAction(line);
    dialogIndex++;
    renderDialogLine();
    return;
  }

  // Linea testo
  $('dialogSpeaker').textContent = line.speaker ?? '';
  $('dialogText').textContent    = line.text ?? '';
}

function executeDialogAction(line) {
  switch (line.type) {
    case 'setFlag':
      setFlag(line.flag);
      break;
    case 'givePokemon':
      givePokemon(line.id);
      break;
    case 'transition':
      // Chiudi dialogo e cambia scena
      pendingAfterDialog = () => transitionToScene(line.target);
      break;
    case 'consumeHotspot':
      consumeHotspot(line.id);
      break;
    default:
      console.warn('Azione dialogo sconosciuta:', line.type);
  }
}

function advanceDialog() {
  if (!dialogActive) return;
  dialogIndex++;
  renderDialogLine();
}

function endDialog() {
  dialogActive = false;
  $('dialogBox').classList.add('hidden');
  // Re-render per applicare eventuali flag impostati durante il dialogo
  renderScene(currentSceneId);

  if (pendingAfterDialog) {
    const fn = pendingAfterDialog;
    pendingAfterDialog = null;
    fn();
  }
}

/* ================================================================
   TOAST
   ================================================================ */

let _toastTimer = null;
function showToast(msg, type = 'success') {
  const el  = $('storyToast');
  const txt = $('storyToastMsg');
  if (!el) return;
  txt.textContent = msg;
  el.className = `story-toast story-toast--${type}`;
  el.classList.remove('hidden');
  void el.offsetWidth;
  el.classList.add('is-shown');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('is-shown');
    setTimeout(() => el.classList.add('hidden'), 250);
  }, 2200);
}
