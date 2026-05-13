/* ============================================================
   sprites.js — libreria sprite pixel art (stile Gen 1/2 Pokémon)
   ============================================================
   Ogni sprite è una griglia di caratteri dove 1 carattere = 1 pixel.
   La griglia viene compilata in un SVG con <rect> uno per pixel.
   Rendering crispEdges → niente antialiasing → pixel net.

   Per inserirne uno nuovo:
     1. Aggiungi una entry a SPRITES con grid + palette opzionale
     2. Riferiscila con il nome via spriteUrl('nome')
   ============================================================ */

// Palette globale: 1 carattere → 1 colore. Ispirata Gen 1/2.
// Caratteri ".", " ", "_" sono trasparenti.
const PALETTE = {
  // Linee / contorni
  'k': '#000000',   // nero contorno
  'D': '#2a1f10',   // marrone scuro contorno
  'd': '#3a2a18',   // marrone medio

  // Bianchi / grigi
  'w': '#f8f8f8',
  'W': '#e0e0e0',
  'g': '#a8a8a8',
  'G': '#707070',

  // Rosso pokéball / casa rossa
  'r': '#ee1515',   // rosso brillante
  'R': '#a01010',   // rosso scuro

  // Blu casa blu
  'b': '#3060d0',
  'B': '#1840a0',

  // Verde erba
  'l': '#80c860',   // verde chiaro
  'L': '#5ca048',   // verde medio
  'M': '#3a7838',   // verde scuro / ombra

  // Marrone legno / sentiero
  's': '#c08858',   // legno chiaro
  'S': '#8b5a2b',   // legno medio
  't': '#a06030',   // mattone / sentiero
  'T': '#604020',   // legno scuro

  // Pelle / volti
  'f': '#f0c890',
  'F': '#d09058',

  // Capelli / accenti
  'y': '#e8d050',   // giallo chiaro (capelli)
  'Y': '#a08020',   // giallo scuro (capelli ombra)

  // Tetti
  'h': '#d04040',   // tetto rosso
  'H': '#902020',   // tetto rosso scuro
  'j': '#3868d0',   // tetto blu
  'J': '#1840a0',   // tetto blu scuro
  'i': '#888888',   // tetto grigio
  'I': '#4a4a4a',   // tetto grigio scuro

  // Finestre / dettagli
  'c': '#88c8f0',   // vetro azzurro
  'C': '#3070a0',   // vetro ombra
  'x': '#404040',   // dettaglio scuro
};

/** Compila una griglia in un SVG data URL */
function compile(grid) {
  const rows = grid.split('\n').filter(r => r.length > 0);
  const h = rows.length;
  const w = rows[0].length;

  // Raggruppa pixel orizzontali contigui dello stesso colore in un singolo rect
  let rects = '';
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    let x = 0;
    while (x < w) {
      const c = row[x];
      if (c === '.' || c === ' ' || c === '_' || !PALETTE[c]) { x++; continue; }
      let runEnd = x + 1;
      while (runEnd < w && row[runEnd] === c) runEnd++;
      rects += `<rect x="${x}" y="${y}" width="${runEnd - x}" height="1" fill="${PALETTE[c]}"/>`;
      x = runEnd;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" preserveAspectRatio="xMidYMax meet">${rects}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ============================================================
   SPRITE DEFINITIONS
   ============================================================ */

const SPRITE_GRIDS = {

  // ────────────── POKÉBALL (16×16)
  pokeball: `
.....kkkkkk.....
...kkrrrrrrkk...
..krrrrrrrrrrk..
.krrRRRrrrrrrrk.
krrrrrrrrrrrrrrk
krrrrrrrrrrrrrrk
kkkkkkkkkkkkkkkk
kkwwwwkkkkwwwwkk
kwwwwwkkkkwwwwwk
kwwwwwkkkkwwwwwk
kkwwwwwwwwwwwwkk
.kwwwwwwwwwwwwk.
.kwwwwwwwwwwwwk.
..kwwwwwwwwwwk..
...kkwwwwwwkk...
.....kkkkkk.....`,

  // ────────────── CASA ROSSO (32×28) — tetto rosso, mattoncini, porta
  'casa-red': `
.........kkkkkkkkkkkkkk.........
........khhhhhhhhhhhhhhk........
.......khhhhhhhhhhhhhhhhk.......
......khhHhhhhhhhhhhhHhhhk......
.....khhHHhhhhhhhhhhhHHhhhk.....
....khhHhhhhhhhhhhhhhhhHhhhk....
...khhHhhhhhhhhhhhhhhhhhHhhhk...
..khhhhhhhhhhhhhhhhhhhhhhhhhhk..
.khhhhhhhhhhhhhhhhhhhhhhhhhhhhk.
kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
kssssssssssssssssssssssssssssssk
kssssssssssssssssssssssssssssssk
ksskccccskssssssssssssskccccsssk
ksskcCCCskssssssssssssskcCCCsssk
ksskccccskssssssssssssskccccsssk
kssssssssssssssssssssssssssssssk
ksssssssssssskkkkkkksssssssssssk
ksssssssssssksssssssksssssssssssk
ksssssssssssksssssssksssssssssssk
kssssssssssskSSSSSSSksssssssssssk
ksssssssssssksksksskssssssssssss
ksssssssssssksksksskssssssssssss
ksssssssssssksksksskssssssssssss
kssssssssssskkkkkkksssssssssssss
ksssssssssssssssssssssssssssssss
kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk`,

  // ────────────── CASA BLU (32×28) — tetto blu
  'casa-blue': `
.........kkkkkkkkkkkkkk.........
........kjjjjjjjjjjjjjjk........
.......kjjjjjjjjjjjjjjjjk.......
......kjjJjjjjjjjjjjjJjjjk......
.....kjjJJjjjjjjjjjjjJJjjjk.....
....kjjJjjjjjjjjjjjjjjjJjjjk....
...kjjJjjjjjjjjjjjjjjjjjJjjjk...
..kjjjjjjjjjjjjjjjjjjjjjjjjjjk..
.kjjjjjjjjjjjjjjjjjjjjjjjjjjjjk.
kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
kssssssssssssssssssssssssssssssk
kssssssssssssssssssssssssssssssk
ksskccccskssssssssssssskccccsssk
ksskcCCCskssssssssssssskcCCCsssk
ksskccccskssssssssssssskccccsssk
kssssssssssssssssssssssssssssssk
ksssssssssssskkkkkkksssssssssssk
ksssssssssssksssssssksssssssssssk
ksssssssssssksssssssksssssssssssk
kssssssssssskSSSSSSSksssssssssssk
ksssssssssssksksksskssssssssssss
ksssssssssssksksksskssssssssssss
ksssssssssssksksksskssssssssssss
kssssssssssskkkkkkksssssssssssss
ksssssssssssssssssssssssssssssss
kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk`,

  // ────────────── LAB OAK (48×32) — più grande, tetto grigio, due porte
  'lab-oak': `
......kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.....
.....kIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIk....
....kIIIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiIIIIIk....
....kIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiIIIIk...
...kIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiIIk...
..kIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiIIk..
.kIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiIIk.
kIiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiIIk
kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggkccccskgggggggggggggggggggggggggggkccccskggk
kggkcCCCskgggggggggggggggggggggggggggkcCCCskggk
kggkccccskgggggggggggggggggggggggggggkccccskggk
kggkkkkkkkggggggggggggggggggggggggggggkkkkkkggk
kgggggggggkkkkkkkkkkkkkkkkkkggggggggggggggggggk
kgggggggggkSSSSSSSSSSSSSSSSkggggggggggggggggggk
kgggggggggkSSSSSSSSSSSSSSSSkggggggggggggggggggk
kgggggggggkSSSSSSSSSSSSSSSSkggggggggggggggggggk
kgggggggggkSSSSkkSSSSSSkkSSkggggggggggggggggggk
kgggggggggkSSSSkkSSSSSSkkSSkggggggggggggggggggk
kgggggggggkSSSSkkSSSSSSkkSSkggggggggggggggggggk
kgggggggggkSSSSSSSSSSSSSSSSkggggggggggggggggggk
kgggggggggkkkkkkkkkkkkkkkkkkggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kggggggggggggggggggggggggggggggggggggggggggggggk
kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk`,

  // ────────────── OAK NPC (16×24) — camice bianco, capelli grigi, sguardo
  'oak-npc': `
.....kkkkkk.....
....kggggggk....
...kggggggggk...
...kfffffffwk...
..kfkfffffkfk...
..kfffkffkffk...
..kffffffffk....
..kkkfffffkk....
.kwwkkkkkkkwk...
kwwwwwwwwwwwwk..
kwwwwwwwwwwwwk..
kwwwwwwwwwwwwk..
kwwwwwwwwwwwwk..
kwwwwwwwwwwwwk..
kwwwwwwwwwwwwk..
kwwkwwwwwwkwwk..
kwwkwwwwwwkwwk..
.kkkwwwwwwkkk...
..kkwwwwwwkk....
...kkkkkkkk.....
...kTTkkkTTk....
...kTTkkkTTk....
...kTTk.kTTk....
...kkk..kkk.....`,

  // ────────────── CARTELLO ROUTE (16×20)
  sign: `
................
......kkkk......
.....kSSSSk.....
.....kSwwSk.....
....kSwwwwSk....
....kSwwwwSk....
....kSwwwwSk....
.....kSSSSk.....
.....kSSSSk.....
......kSSk......
......kSSk......
......kSSk......
......kSSk......
......kSSk......
......kSSk......
......kSSk......
......kSSk......
......kSSk......
.....kkkkkk.....
................`,

  // ────────────── ALBERO (24×24) — pixel art classico
  tree: `
........kkkkkkkk........
.....kkLLLLLLLLLLkk.....
....kLLLLLLLLLLLLLLk....
...kLLMLLLLLLLLLLLLLk...
..kLLLLLLLLMLLLLLLLLLk..
..kLLLMLLLLLLLLLMLLLLk..
.kLLLLLLLLLLLLLLLLLLLLk.
.kLLLLLLMLLLLLLLLMLLLLk.
.kLLLLLLLLLLLLLLLLLLLLk.
..kLLLLLLLLLLMLLLLLLLk..
..kLLLLMLLLLLLLLLLLLLk..
...kLLLLLLLLLLLLLLLLk...
....kLLLLLLLMLLLLLLk....
.....kkLLLLLLLLLLkk.....
........kLLLLLLk........
........kkTTTTkk........
.........kTTTTk.........
.........kTTTTk.........
.........kTTTTk.........
........kkTTTTkk........
........kTTTTTTk........
........kkkkkkkk........`,

  // ────────────── FRECCIA SU (per uscite verso route)
  'arrow-up': `
.......kkkk.......
......kyyyyk......
.....kyyyyyyk.....
....kyyyyyyyyk....
...kyyyyyyyyyyk...
..kyyyyyyyyyyyyk..
.kkkkkkyyyykkkkkk.
.....kyyyyk.....
.....kyyyyk.....
.....kyyyyk.....
.....kyyyyk.....
.....kkkkkk.....`,

};


/* ============================================================
   TILE PATTERNS (sfondi tileabili)
   ============================================================
   Pattern 16×16 che il browser ripete tramite background-repeat.
*/

const TILE_GRIDS = {

  grass: `
LLLLLLLLLLLLLLLL
LLlLLLLLLlLLLLLL
LLLLLLMLLLLLLLLM
LLLLLLLLLLLLLLLL
lLLLLLLLLLLlLLLL
LLLLLLLLLLLLLLLL
LLMLLLLLLLLLLLML
LLLLLLLLLLLLLLLL
LLLLLLLlLLLLLLLL
lLLLLLLLLLLLLLLL
LLLLMLLLLLLLLLLL
LLLLLLLLLLlLLLLL
LLLLLLLLLLLLLLLL
LLLLLlLLLLLLMLLL
LLLLLLLLLLLLLLLL
LLLLLLLLLLLLLLLL`,

  'wood-floor': `
SSSSsSSSSSSsSSSS
ssssssssssssssss
SSsSSSSsSSSSSSsS
SSSSSSSSSSSSSSSS
SsSSSSsSSSSSSSSs
ssssssssssssssss
SSSSsSSSSSsSSSSS
SSSSSSSSSSSSSSSS
sSSSsSSSSSsSSSSS
ssssssssssssssss
SSSSSSSSSSsSSSSS
SSSsSSSSSSSSSSSS
SSSSSSSSsSSSSsSS
ssssssssssssssss
SSSSSSsSSSSSSSSS
SSSSSSSSSSSSSSSS`,

  'sand-path': `
ttttttttttttttttt
tttttttttttttttt
tTttttttttttTttt
tttttttttttttttt
tttttTtttttttttt
tttttttttttttttt
tttttttTttttttTt
tttttttttttttttt
tTtttttttttTtttt
tttttttttttttttt
ttttTttttttttttt
tttttttttttttttt
tttttttttttTtttt
ttttttTttttttttt
tttttttttttttttt
tttttttttttttttt`,

};

/* ============================================================
   API PUBBLICA
   ============================================================ */

const _spriteCache = {};
const _tileCache   = {};

export function spriteUrl(name) {
  if (_spriteCache[name]) return _spriteCache[name];
  const grid = SPRITE_GRIDS[name];
  if (!grid) {
    console.warn('Sprite mancante:', name);
    return '';
  }
  return _spriteCache[name] = compile(grid);
}

export function tileUrl(name) {
  if (_tileCache[name]) return _tileCache[name];
  const grid = TILE_GRIDS[name];
  if (!grid) {
    console.warn('Tile mancante:', name);
    return '';
  }
  return _tileCache[name] = compile(grid);
}

export function listSprites() { return Object.keys(SPRITE_GRIDS); }
export function listTiles()   { return Object.keys(TILE_GRIDS); }
