/* ============================================================
   scenes.js — definizione dichiarativa di scene + dialoghi storia
   ============================================================
   Una scena ha:
     - bgImage  (opzionale) → path di un PNG che fa da sfondo intero
     - tile     (fallback)  → pattern tileabile se bgImage non c'è
     - decorations (fallback) → sprite SVG mostrati se bgImage non c'è
     - hotspots → aree cliccabili posizionate in % sopra l'immagine
     - viewport: { mode: 'fit' | 'pan', zoom: N } → come renderizzare l'immagine
        'fit'  (default) → immagine riempie il viewport, aspect-ratio adattato
        'pan'            → viewport fisso, immagine a zoom N×, drag per scorrere
     - mapLocation: { id, label, x, y } → posizione sulla mappa regionale (minimap)

   Hotspot type:
     'door'    → entra in scena interna
     'exit'    → esce verso altra scena/route
     'stairs'  → scala (collega piani di una casa)
     'npc'     → triggera un dialogo
     'item'    → raccoglie un Pokémon/oggetto (one-shot)
     'trainer' → battaglia (M12c)
*/

/* ============================================================
   REGIONE — configurazione mappa globale (minimap)
   ============================================================ */

export const REGION = {
  id:    'kanto',
  name:  'Kanto',
  // Immagine della mappa globale visualizzata nella minimap
  overworldImage: 'assets/maps/kanto/region.png',
};

export const SCENES = {

  /* ============================================================
     BIANCAVILLA — esterno
     ============================================================ */
  'biancavilla': {
    name: 'Biancavilla',
    subtitle: 'Cittadina di partenza',
    bgImage: 'assets/maps/kanto/biancavilla.png',
    tile: 'grass',
    mapLocation: { id: 'biancavilla', label: 'Biancavilla', x: '43.2%', y: '66.6%' },
    decorations: [
      { sprite: 'casa-red',  pos: { left: '15%',  top: '24%' }, size: '180px' },
      { sprite: 'casa-blue', pos: { right: '15%', top: '24%' }, size: '180px' },
      { sprite: 'lab-oak',   pos: { left: '50%',  bottom: '14%', transform: 'translateX(-50%)' }, size: '280px' },
      { sprite: 'tree',      pos: { left: '4%',   bottom: '20%' }, size: '70px' },
      { sprite: 'tree',      pos: { right: '4%',  bottom: '20%' }, size: '70px' },
    ],
    hotspots: [
      {
        id: 'casa-rosso', type: 'door', label: 'Casa di Rosso',
        pos: { cx: '26.2%', cy: '30.1%' }, size: { w: '5%', h: '5%' },
        target: 'casa-rosso-p0',
      },
      {
        id: 'casa-blu', type: 'door', label: 'Casa di Blu',
        pos: { cx: '66.9%', cy: '29.7%' }, size: { w: '5%', h: '5%' },
        target: 'casa-blu-p0',
      },
      {
        id: 'lab-oak', type: 'door', label: 'Laboratorio del Prof. Oak',
        pos: { cx: '70.6%', cy: '66.9%' }, size: { w: '5%', h: '5%' },
        target: 'lab-oak',
      },
      {
        id: 'route-1-exit', type: 'exit', label: 'Route 1 ↑',
        pos: { left: '42%', top: '0%' }, size: { w: '16%', h: '8%' },
        target: 'route-1',
        requires: { flag: 'starter-chosen', errorMsg: 'Vai prima dal Prof. Oak a scegliere il tuo primo Pokémon!' },
      },
    ],
  },

  /* ============================================================
     CASA ROSSO — piano terra (p0) e primo piano (p1)
     ============================================================ */
  'casa-rosso-p0': {
    name: 'Casa di Rosso',
    subtitle: 'Piano terra',
    bgImage: 'assets/maps/kanto/casa-rosso-p0.png',
    tile: 'wood-floor',
    viewport: { maxWidth: '480px' },
    decorations: [],
    hotspots: [
      {
        id: 'casa-rosso-stairs-up', type: 'stairs', label: '↑ Sali al piano superiore',
        pos: { left: '78%', top: '15%' }, size: { w: '15%', h: '25%' },
        target: 'casa-rosso-p1',
      },
      {
        id: 'casa-rosso-exit', type: 'exit', label: '← Esci',
        pos: { cx: '46.15%', cy: '91%' }, size: { w: '12%', h: '8%' },
        target: 'biancavilla',
      },
    ],
  },

  'casa-rosso-p1': {
    name: 'Casa di Rosso',
    subtitle: 'Primo piano',
    bgImage: 'assets/maps/kanto/casa-rosso-p1.png',
    tile: 'wood-floor',
    viewport: { maxWidth: '480px' },
    decorations: [],
    hotspots: [
      {
        id: 'casa-rosso-stairs-down', type: 'stairs', label: '↓ Scendi al piano terra',
        pos: { left: '78%', top: '50%' }, size: { w: '15%', h: '25%' },
        target: 'casa-rosso-p0',
      },
    ],
  },

  /* ============================================================
     CASA BLU — piano terra (p0) e primo piano (p1)
     ============================================================ */
  'casa-blu-p0': {
    name: 'Casa di Blu',
    subtitle: 'Piano terra',
    bgImage: 'assets/maps/kanto/casa-blu-p0.png',
    tile: 'wood-floor',
    viewport: { maxWidth: '480px' },
    decorations: [],
    hotspots: [
      {
        id: 'casa-blu-stairs-up', type: 'stairs', label: '↑ Sali al piano superiore',
        pos: { left: '78%', top: '15%' }, size: { w: '15%', h: '25%' },
        target: 'casa-blu-p1',
      },
      {
        id: 'casa-blu-exit', type: 'exit', label: '← Esci',
        pos: { cx: '46.15%', cy: '91%' }, size: { w: '12%', h: '8%' },
        target: 'biancavilla',
      },
    ],
  },

  'casa-blu-p1': {
    name: 'Casa di Blu',
    subtitle: 'Primo piano',
    bgImage: 'assets/maps/kanto/casa-blu-p1.png',
    tile: 'wood-floor',
    viewport: { maxWidth: '480px' },
    decorations: [],
    hotspots: [
      {
        id: 'casa-blu-stairs-down', type: 'stairs', label: '↓ Scendi al piano terra',
        pos: { left: '78%', top: '50%' }, size: { w: '15%', h: '25%' },
        target: 'casa-blu-p0',
      },
    ],
  },

  /* ============================================================
     LAB OAK
     ============================================================ */
  'lab-oak': {
    name: 'Laboratorio del Prof. Oak',
    subtitle: 'Biancavilla',
    bgImage: 'assets/maps/kanto/lab-oak.png',
    viewport: { maxWidth: '480px' },
    tile: 'wood-floor',
    onEnter: { dialog: 'oak-intro', once: true },
    decorations: [
      { sprite: 'oak-npc', pos: { left: '50%', top: '22%', transform: 'translateX(-50%)' }, size: '100px' },
    ],
    hotspots: [
      {
        id: 'oak-npc', type: 'npc', label: 'Prof. Oak',
        pos: { left: '15%', top: '30%' }, size: { w: '12%', h: '30%' },
        dialog: 'oak-talk',
      },
      {
        id: 'pokeball-bulbasaur', type: 'item', label: 'Bulbasaur',
        pos: { left: '40%', top: '60%' }, size: { w: '7%', h: '10%' },
        sprite: 'pokeball',
        give: { pokemon: 1 },
        requires: { allOf: [
          { flag: 'oak-introduced', errorMsg: 'Prima parla con il Prof. Oak!' },
          { notFlag: 'starter-chosen' },
        ]},
        onPick: {
          setFlags: ['starter-chosen'],
          consumeHotspots: ['pokeball-bulbasaur', 'pokeball-charmander', 'pokeball-squirtle'],
          dialog: 'oak-after-choice-bulbasaur',
        },
      },
      {
        id: 'pokeball-charmander', type: 'item', label: 'Charmander',
        pos: { left: '50%', top: '60%', transform: 'translateX(-50%)' }, size: { w: '7%', h: '10%' },
        sprite: 'pokeball',
        give: { pokemon: 4 },
        requires: { allOf: [
          { flag: 'oak-introduced', errorMsg: 'Prima parla con il Prof. Oak!' },
          { notFlag: 'starter-chosen' },
        ]},
        onPick: {
          setFlags: ['starter-chosen'],
          consumeHotspots: ['pokeball-bulbasaur', 'pokeball-charmander', 'pokeball-squirtle'],
          dialog: 'oak-after-choice-charmander',
        },
      },
      {
        id: 'pokeball-squirtle', type: 'item', label: 'Squirtle',
        pos: { left: '60%', top: '60%' }, size: { w: '7%', h: '10%' },
        sprite: 'pokeball',
        give: { pokemon: 7 },
        requires: { allOf: [
          { flag: 'oak-introduced', errorMsg: 'Prima parla con il Prof. Oak!' },
          { notFlag: 'starter-chosen' },
        ]},
        onPick: {
          setFlags: ['starter-chosen'],
          consumeHotspots: ['pokeball-bulbasaur', 'pokeball-charmander', 'pokeball-squirtle'],
          dialog: 'oak-after-choice-squirtle',
        },
      },
      {
        id: 'lab-exit', type: 'exit', label: '← Esci',
        pos: { left: '44%', bottom: '0%' }, size: { w: '12%', h: '8%' },
        target: 'biancavilla',
      },
    ],
  },

  /* ============================================================
     ROUTE 1 — placeholder fino a M12f
     ============================================================ */
  'route-1': {
    name: 'Route 1',
    subtitle: 'Tra Biancavilla e Smeraldopoli',
    bgImage: 'assets/maps/kanto/route-1.png',
    tile: 'grass',
    // Route 1 è verticale e grande: usa modalità pan (drag per scorrere)
    viewport: { mode: 'pan', zoom: 2 },
    // Le route NON sono punti di Volo — solo le città appaiono sulla minimap
    decorations: [
      { sprite: 'tree', pos: { left: '8%',  top: '20%' }, size: '64px' },
      { sprite: 'tree', pos: { left: '18%', top: '12%' }, size: '64px' },
      { sprite: 'tree', pos: { right: '12%',top: '24%' }, size: '64px' },
      { sprite: 'tree', pos: { right: '6%', top: '14%' }, size: '64px' },
      { type: 'note', pos: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
        label: '— Prossimamente —\nQui troverai allenatori, pokéball e l\'uscita verso Smeraldopoli.' },
    ],
    hotspots: [
      { id: 'route-1-back', type: 'exit', label: '↓ Biancavilla',
        pos: { left: '44%', bottom: '0%' }, size: { w: '12%', h: '8%' },
        target: 'biancavilla' },
    ],
  },

};


/* ============================================================
   DIALOGHI
   ============================================================ */

export const DIALOGS = {

  'oak-intro': [
    { speaker: 'Prof. Oak', text: 'Ah! Sei finalmente arrivato!' },
    { speaker: 'Prof. Oak', text: 'Hai mantenuto la parola e sei venuto a trovarmi.' },
    { speaker: 'Prof. Oak', text: 'Sai, ho deciso di affidarti il tuo primo Pokémon!' },
    { speaker: 'Prof. Oak', text: 'Ne ho preparati tre, vieni a vedere — sono sul tavolo qui dietro.' },
    { speaker: 'Prof. Oak', text: 'Scegli quello che senti più affine a te.' },
    { type: 'setFlag', flag: 'oak-introduced' },
  ],

  'oak-talk': [
    { speaker: 'Prof. Oak', text: 'Su, scegli pure! I tre Pokémon ti aspettano sul tavolo.' },
  ],

  'oak-after-choice-bulbasaur': [
    { speaker: 'Prof. Oak', text: 'Hai scelto Bulbasaur! Eccellente compagno per chi inizia.' },
    { speaker: 'Prof. Oak', text: 'Bulbasaur è calmo e leale. Ti accompagnerà fedelmente nel tuo viaggio.' },
    { speaker: 'Prof. Oak', text: 'Ora puoi esplorare le route fuori da Biancavilla.' },
    { speaker: 'Prof. Oak', text: 'In bocca al lupo, allenatore!' },
  ],

  'oak-after-choice-charmander': [
    { speaker: 'Prof. Oak', text: 'Hai scelto Charmander! Una scelta coraggiosa.' },
    { speaker: 'Prof. Oak', text: 'Charmander ha un temperamento focoso, ma se lo tratti bene ti seguirà ovunque.' },
    { speaker: 'Prof. Oak', text: 'Ora puoi esplorare le route fuori da Biancavilla.' },
    { speaker: 'Prof. Oak', text: 'In bocca al lupo, allenatore!' },
  ],

  'oak-after-choice-squirtle': [
    { speaker: 'Prof. Oak', text: 'Hai scelto Squirtle! Una scelta saggia.' },
    { speaker: 'Prof. Oak', text: 'Squirtle è prudente e tenace. Eccellente per i lunghi viaggi.' },
    { speaker: 'Prof. Oak', text: 'Ora puoi esplorare le route fuori da Biancavilla.' },
    { speaker: 'Prof. Oak', text: 'In bocca al lupo, allenatore!' },
  ],

};
