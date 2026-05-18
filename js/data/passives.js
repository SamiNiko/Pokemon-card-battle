/* ============================================================
   passives.js — Passive per ogni Pokémon Gen 1
   
   Ogni Pokémon ha una passiva tra ~18 archetipi competitive
   adattati. Le SLOT di attivazione sono PER-POKEMON (non per
   archetipo): cosi' Pokemon dello stesso archetipo possono
   avere combinazioni di slot diverse e in un team da 3 ognuno
   puo' attivare la propria passiva (varieta' a la Hero Colosseum).
   
   Strutture:
     - PASSIVE_LIBRARY[key] = { name, effect, meta, slotPool }
         slotPool: slot dove la passiva HA SENSO per la sua natura
     - POKEMON_PASSIVE[id] = { key, activeSlots: [...1-2 slot] }
         activeSlots: scelti DAL slotPool dell'archetipo,
         determinisitcamente per dare varieta'
   
   Generato da scripts/gen_movesets_passives.py
   ============================================================ */

export const PASSIVE_LIBRARY = {
  'siccita': {
    name:     'Siccità',
    effect:   "Le tue mosse Fuoco infliggono +25% di danno.",
    slotPool: ['back-center', 'back-left', 'back-right', 'front-center'],
    meta:     {"kind": "type_boost", "type": "fire", "mult": 1.25},
  },
  'pioggerellina': {
    name:     'Pioggerellina',
    effect:   "Le tue mosse Acqua infliggono +25% di danno.",
    slotPool: ['back-center', 'back-left', 'back-right', 'front-center'],
    meta:     {"kind": "type_boost", "type": "water", "mult": 1.25},
  },
  'sabbiainfinita': {
    name:     'Sabbiainfinita',
    effect:   "Le tue mosse Roccia/Terra infliggono +20% di danno.",
    slotPool: ['back-center', 'back-left', 'back-right', 'front-center'],
    meta:     {"kind": "type_boost_multi", "types": ["rock", "ground"], "mult": 1.2},
  },
  'snownevicata': {
    name:     'Scendineve',
    effect:   "Le tue mosse Ghiaccio infliggono +25% di danno.",
    slotPool: ['back-center', 'back-left', 'back-right', 'front-center'],
    meta:     {"kind": "type_boost", "type": "ice", "mult": 1.25},
  },
  'levitazione': {
    name:     'Levitazione',
    effect:   "Immune al danno diretto da colonna vuota e mosse Terra.",
    slotPool: ['front-left', 'front-right', 'back-left', 'back-right'],
    meta:     {"kind": "immune", "mods": ["direct_damage"], "types": ["ground"]},
  },
  'multiscala': {
    name:     'Multiscaglia',
    effect:   "A HP pieno, subisci -50% di danno dal primo colpo ricevuto.",
    slotPool: ['front-center', 'front-left', 'front-right'],
    meta:     {"kind": "first_hit_resist", "amount": 0.5, "condition": "full_hp"},
  },
  'vigore': {
    name:     'Vigore',
    effect:   "Sopravvivi con 1 HP a un colpo che ti ucciderebbe (1 volta a battaglia).",
    slotPool: ['front-center', 'front-left', 'front-right'],
    meta:     {"kind": "endure_once", "once": true},
  },
  'rigenerazione': {
    name:     'Rigenerazione',
    effect:   "A fine turno, recuperi il 15% degli HP massimi.",
    slotPool: ['back-center', 'back-left', 'back-right'],
    meta:     {"kind": "regen", "percent": 0.15, "when": "turn_end"},
  },
  'pressione': {
    name:     'Pressione',
    effect:   "Il Pokémon che ti attacca consuma 1 PP extra.",
    slotPool: ['front-center', 'front-left', 'front-right'],
    meta:     {"kind": "extra_pp_cost", "amount": 1},
  },
  'tecnico': {
    name:     'Tecnico',
    effect:   "Le tue mosse Base infliggono +30% di danno.",
    slotPool: ['front-center', 'front-left', 'front-right', 'back-center'],
    meta:     {"kind": "base_move_boost", "mult": 1.3},
  },
  'fortunone': {
    name:     'Fortunone',
    effect:   "Le tue mosse Finisher infliggono +20% di danno.",
    slotPool: ['back-center', 'back-left', 'back-right'],
    meta:     {"kind": "finisher_boost", "mult": 1.2},
  },
  'adattabilita': {
    name:     'Adattabilità',
    effect:   "Il bonus STAB delle tue mosse è raddoppiato (×2 anziché ×1.5).",
    slotPool: ['front-center', 'back-center', 'front-left', 'front-right', 'back-left', 'back-right'],
    meta:     {"kind": "stab_boost", "mult": 2.0},
  },
  'pancialarda': {
    name:     'Pancialarda',
    effect:   "Subisci -30% di danno dalle mosse Fuoco e Ghiaccio.",
    slotPool: ['front-center', 'front-left', 'front-right'],
    meta:     {"kind": "type_resist", "types": ["fire", "ice"], "mult": 0.7},
  },
  'specchiomagico': {
    name:     'Specchiomagico',
    effect:   "Le mosse Speciali subite infliggono -25% di danno.",
    slotPool: ['back-center', 'back-left', 'back-right', 'front-center'],
    meta:     {"kind": "cat_resist", "cat": "special", "mult": 0.75},
  },
  'statico': {
    name:     'Statico',
    effect:   "Il Pokémon che ti attacca ha 30% di non guadagnare PP quel turno.",
    slotPool: ['front-center', 'front-left', 'front-right'],
    meta:     {"kind": "pp_block_chance", "chance": 0.3},
  },
  'velenpunta': {
    name:     'Velenpunta',
    effect:   "Le tue mosse Veleno infliggono +25% di danno.",
    slotPool: ['back-center', 'back-left', 'back-right', 'front-center'],
    meta:     {"kind": "type_boost", "type": "poison", "mult": 1.25},
  },
  'corazza': {
    name:     'Corazza',
    effect:   "Subisci -20% di danno dalle mosse Fisiche.",
    slotPool: ['front-center', 'front-left', 'front-right'],
    meta:     {"kind": "cat_resist", "cat": "physical", "mult": 0.8},
  },
  'velocitascatto': {
    name:     'Velocitàscatto',
    effect:   "A ogni turno la tua Velocità aumenta del 15% (cumulativo, max +60%).",
    slotPool: ['back-left', 'back-right', 'back-center', 'front-left', 'front-right'],
    meta:     {"kind": "speed_stack", "percent": 0.15, "max_stacks": 4},
  },
  'ultrapotenza': {
    name:     'Ultrapotenza',
    effect:   "Il tuo Attacco è raddoppiato. La tua Difesa è dimezzata.",
    slotPool: ['front-center', 'front-left', 'front-right'],
    meta:     {"kind": "atk_boost_def_drop", "atk_mult": 2.0, "def_mult": 0.5},
  },
};

/** Mappa Pokémon → { key, activeSlots }. */
export const POKEMON_PASSIVE = {
  1: { key: 'velenpunta', activeSlots: ['back-center', 'back-left'] },   // Bulbasaur
  2: { key: 'velenpunta', activeSlots: ['back-center', 'back-right'] },   // Ivysaur
  3: { key: 'velenpunta', activeSlots: ['back-center', 'front-center'] },   // Venusaur
  4: { key: 'siccita', activeSlots: ['back-center', 'back-left'] },   // Charmander
  5: { key: 'siccita', activeSlots: ['back-center', 'back-right'] },   // Charmeleon
  6: { key: 'siccita', activeSlots: ['back-center', 'front-center'] },   // Charizard
  7: { key: 'pioggerellina', activeSlots: ['back-center', 'back-left'] },   // Squirtle
  8: { key: 'pioggerellina', activeSlots: ['back-center', 'back-right'] },   // Wartortle
  9: { key: 'pioggerellina', activeSlots: ['back-center', 'front-center'] },   // Blastoise
  10: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Caterpie
  11: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Metapod
  12: { key: 'fortunone', activeSlots: ['back-center', 'back-left'] },   // Butterfree
  13: { key: 'velenpunta', activeSlots: ['back-left', 'back-right'] },   // Weedle
  14: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Kakuna
  15: { key: 'velenpunta', activeSlots: ['back-left', 'front-center'] },   // Beedrill
  16: { key: 'velocitascatto', activeSlots: ['back-left', 'back-right'] },   // Pidgey
  17: { key: 'velocitascatto', activeSlots: ['back-center', 'back-left'] },   // Pidgeotto
  18: { key: 'velocitascatto', activeSlots: ['back-left', 'front-left'] },   // Pidgeot
  19: { key: 'tecnico', activeSlots: ['front-center', 'front-left'] },   // Rattata
  20: { key: 'tecnico', activeSlots: ['front-center', 'front-right'] },   // Raticate
  21: { key: 'tecnico', activeSlots: ['back-center', 'front-center'] },   // Spearow
  22: { key: 'velocitascatto', activeSlots: ['back-left', 'front-right'] },   // Fearow
  23: { key: 'velenpunta', activeSlots: ['back-right', 'front-center'] },   // Ekans
  24: { key: 'pressione', activeSlots: ['front-center'] },   // Arbok
  25: { key: 'statico', activeSlots: ['front-center', 'front-left'] },   // Pikachu
  26: { key: 'statico', activeSlots: ['front-center', 'front-right'] },   // Raichu
  27: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Sandshrew
  28: { key: 'sabbiainfinita', activeSlots: ['back-center', 'back-left'] },   // Sandslash
  29: { key: 'velenpunta', activeSlots: ['back-center', 'back-left'] },   // Nidoran♀
  30: { key: 'velenpunta', activeSlots: ['back-center', 'back-right'] },   // Nidorina
  31: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Nidoqueen
  32: { key: 'velenpunta', activeSlots: ['back-center', 'front-center'] },   // Nidoran♂
  33: { key: 'velenpunta', activeSlots: ['back-left', 'back-right'] },   // Nidorino
  34: { key: 'ultrapotenza', activeSlots: ['front-center'] },   // Nidoking
  35: { key: 'specchiomagico', activeSlots: ['back-center', 'back-left'] },   // Clefairy
  36: { key: 'specchiomagico', activeSlots: ['back-center', 'back-right'] },   // Clefable
  37: { key: 'siccita', activeSlots: ['back-left', 'back-right'] },   // Vulpix
  38: { key: 'siccita', activeSlots: ['back-left', 'front-center'] },   // Ninetales
  39: { key: 'specchiomagico', activeSlots: ['back-center', 'front-center'] },   // Jigglypuff
  40: { key: 'specchiomagico', activeSlots: ['back-left', 'back-right'] },   // Wigglytuff
  41: { key: 'levitazione', activeSlots: ['front-left', 'front-right'] },   // Zubat
  42: { key: 'levitazione', activeSlots: ['back-left', 'front-left'] },   // Golbat
  43: { key: 'velenpunta', activeSlots: ['back-left', 'front-center'] },   // Oddish
  44: { key: 'velenpunta', activeSlots: ['back-right', 'front-center'] },   // Gloom
  45: { key: 'velenpunta', activeSlots: ['back-center', 'back-left'] },   // Vileplume
  46: { key: 'tecnico', activeSlots: ['front-left', 'front-right'] },   // Paras
  47: { key: 'pressione', activeSlots: ['front-left'] },   // Parasect
  48: { key: 'velenpunta', activeSlots: ['back-center', 'back-right'] },   // Venonat
  49: { key: 'velenpunta', activeSlots: ['back-center', 'front-center'] },   // Venomoth
  50: { key: 'velocitascatto', activeSlots: ['back-center', 'back-right'] },   // Diglett
  51: { key: 'velocitascatto', activeSlots: ['back-right', 'front-left'] },   // Dugtrio
  52: { key: 'fortunone', activeSlots: ['back-center', 'back-right'] },   // Meowth
  53: { key: 'tecnico', activeSlots: ['back-center', 'front-left'] },   // Persian
  54: { key: 'pressione', activeSlots: ['front-right'] },   // Psyduck
  55: { key: 'pressione', activeSlots: ['front-center'] },   // Golduck
  56: { key: 'ultrapotenza', activeSlots: ['front-left'] },   // Mankey
  57: { key: 'ultrapotenza', activeSlots: ['front-right'] },   // Primeape
  58: { key: 'siccita', activeSlots: ['back-right', 'front-center'] },   // Growlithe
  59: { key: 'siccita', activeSlots: ['back-center', 'back-left'] },   // Arcanine
  60: { key: 'pioggerellina', activeSlots: ['back-left', 'back-right'] },   // Poliwag
  61: { key: 'pioggerellina', activeSlots: ['back-left', 'front-center'] },   // Poliwhirl
  62: { key: 'ultrapotenza', activeSlots: ['front-center'] },   // Poliwrath
  63: { key: 'pressione', activeSlots: ['front-left'] },   // Abra
  64: { key: 'specchiomagico', activeSlots: ['back-left', 'front-center'] },   // Kadabra
  65: { key: 'specchiomagico', activeSlots: ['back-right', 'front-center'] },   // Alakazam
  66: { key: 'ultrapotenza', activeSlots: ['front-left'] },   // Machop
  67: { key: 'ultrapotenza', activeSlots: ['front-right'] },   // Machoke
  68: { key: 'ultrapotenza', activeSlots: ['front-center'] },   // Machamp
  69: { key: 'velenpunta', activeSlots: ['back-left', 'back-right'] },   // Bellsprout
  70: { key: 'velenpunta', activeSlots: ['back-left', 'front-center'] },   // Weepinbell
  71: { key: 'velenpunta', activeSlots: ['back-right', 'front-center'] },   // Victreebel
  72: { key: 'velenpunta', activeSlots: ['back-center', 'back-left'] },   // Tentacool
  73: { key: 'velenpunta', activeSlots: ['back-center', 'back-right'] },   // Tentacruel
  74: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Geodude
  75: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Graveler
  76: { key: 'sabbiainfinita', activeSlots: ['back-center', 'back-right'] },   // Golem
  77: { key: 'siccita', activeSlots: ['back-center', 'back-right'] },   // Ponyta
  78: { key: 'velocitascatto', activeSlots: ['back-right', 'front-right'] },   // Rapidash
  79: { key: 'rigenerazione', activeSlots: ['back-center', 'back-left'] },   // Slowpoke
  80: { key: 'rigenerazione', activeSlots: ['back-center', 'back-right'] },   // Slowbro
  81: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Magnemite
  82: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Magneton
  83: { key: 'tecnico', activeSlots: ['back-center', 'front-right'] },   // Farfetch’d
  84: { key: 'velocitascatto', activeSlots: ['back-center', 'front-left'] },   // Doduo
  85: { key: 'velocitascatto', activeSlots: ['back-center', 'front-right'] },   // Dodrio
  86: { key: 'snownevicata', activeSlots: ['back-center', 'back-left'] },   // Seel
  87: { key: 'snownevicata', activeSlots: ['back-center', 'back-right'] },   // Dewgong
  88: { key: 'velenpunta', activeSlots: ['back-center', 'front-center'] },   // Grimer
  89: { key: 'velenpunta', activeSlots: ['back-left', 'back-right'] },   // Muk
  90: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Shellder
  91: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Cloyster
  92: { key: 'levitazione', activeSlots: ['back-right', 'front-left'] },   // Gastly
  93: { key: 'levitazione', activeSlots: ['back-left', 'front-right'] },   // Haunter
  94: { key: 'levitazione', activeSlots: ['back-right', 'front-right'] },   // Gengar
  95: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Onix
  96: { key: 'pressione', activeSlots: ['front-right'] },   // Drowzee
  97: { key: 'pressione', activeSlots: ['front-center'] },   // Hypno
  98: { key: 'ultrapotenza', activeSlots: ['front-left'] },   // Krabby
  99: { key: 'ultrapotenza', activeSlots: ['front-right'] },   // Kingler
  100: { key: 'statico', activeSlots: ['front-left', 'front-right'] },   // Voltorb
  101: { key: 'velocitascatto', activeSlots: ['front-left', 'front-right'] },   // Electrode
  102: { key: 'rigenerazione', activeSlots: ['back-left', 'back-right'] },   // Exeggcute
  103: { key: 'rigenerazione', activeSlots: ['back-center', 'back-left'] },   // Exeggutor
  104: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Cubone
  105: { key: 'ultrapotenza', activeSlots: ['front-center'] },   // Marowak
  106: { key: 'tecnico', activeSlots: ['front-center', 'front-left'] },   // Hitmonlee
  107: { key: 'tecnico', activeSlots: ['front-center', 'front-right'] },   // Hitmonchan
  108: { key: 'rigenerazione', activeSlots: ['back-center', 'back-right'] },   // Lickitung
  109: { key: 'levitazione', activeSlots: ['back-left', 'back-right'] },   // Koffing
  110: { key: 'levitazione', activeSlots: ['front-left', 'front-right'] },   // Weezing
  111: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Rhyhorn
  112: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Rhydon
  113: { key: 'specchiomagico', activeSlots: ['back-center', 'back-left'] },   // Chansey
  114: { key: 'rigenerazione', activeSlots: ['back-left', 'back-right'] },   // Tangela
  115: { key: 'tecnico', activeSlots: ['back-center', 'front-center'] },   // Kangaskhan
  116: { key: 'pioggerellina', activeSlots: ['back-right', 'front-center'] },   // Horsea
  117: { key: 'pioggerellina', activeSlots: ['back-center', 'back-left'] },   // Seadra
  118: { key: 'pioggerellina', activeSlots: ['back-center', 'back-right'] },   // Goldeen
  119: { key: 'pioggerellina', activeSlots: ['back-center', 'front-center'] },   // Seaking
  120: { key: 'pioggerellina', activeSlots: ['back-left', 'back-right'] },   // Staryu
  121: { key: 'specchiomagico', activeSlots: ['back-center', 'back-right'] },   // Starmie
  122: { key: 'specchiomagico', activeSlots: ['back-center', 'front-center'] },   // Mr. Mime
  123: { key: 'tecnico', activeSlots: ['front-left', 'front-right'] },   // Scyther
  124: { key: 'snownevicata', activeSlots: ['back-center', 'front-center'] },   // Jynx
  125: { key: 'statico', activeSlots: ['front-center', 'front-left'] },   // Electabuzz
  126: { key: 'siccita', activeSlots: ['back-center', 'front-center'] },   // Magmar
  127: { key: 'ultrapotenza', activeSlots: ['front-left'] },   // Pinsir
  128: { key: 'tecnico', activeSlots: ['back-center', 'front-left'] },   // Tauros
  129: { key: 'vigore', activeSlots: ['front-center'] },   // Magikarp
  130: { key: 'ultrapotenza', activeSlots: ['front-right'] },   // Gyarados
  131: { key: 'snownevicata', activeSlots: ['back-left', 'back-right'] },   // Lapras
  132: { key: 'adattabilita', activeSlots: ['front-center'] },   // Ditto
  133: { key: 'adattabilita', activeSlots: ['back-center'] },   // Eevee
  134: { key: 'pioggerellina', activeSlots: ['back-left', 'front-center'] },   // Vaporeon
  135: { key: 'statico', activeSlots: ['front-center', 'front-right'] },   // Jolteon
  136: { key: 'siccita', activeSlots: ['back-left', 'back-right'] },   // Flareon
  137: { key: 'adattabilita', activeSlots: ['front-left'] },   // Porygon
  138: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Omanyte
  139: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Omastar
  140: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Kabuto
  141: { key: 'tecnico', activeSlots: ['back-center', 'front-right'] },   // Kabutops
  142: { key: 'velocitascatto', activeSlots: ['back-left', 'back-right'] },   // Aerodactyl
  143: { key: 'pancialarda', activeSlots: ['front-center'] },   // Snorlax
  144: { key: 'snownevicata', activeSlots: ['back-left', 'front-center'] },   // Articuno
  145: { key: 'statico', activeSlots: ['front-left', 'front-right'] },   // Zapdos
  146: { key: 'siccita', activeSlots: ['back-left', 'front-center'] },   // Moltres
  147: { key: 'multiscala', activeSlots: ['front-center'] },   // Dratini
  148: { key: 'multiscala', activeSlots: ['front-left'] },   // Dragonair
  149: { key: 'multiscala', activeSlots: ['front-right'] },   // Dragonite
  150: { key: 'pressione', activeSlots: ['front-left'] },   // Mewtwo
  151: { key: 'adattabilita', activeSlots: ['front-right'] },   // Mew
};

/** Helper: restituisce la passiva di un Pokémon o null.
    Forma compatibile: { key, name, effect, activeSlots, meta }. */
export function getPassive(pokemonId) {
  const entry = POKEMON_PASSIVE[pokemonId];
  if (!entry) return null;
  const lib = PASSIVE_LIBRARY[entry.key];
  if (!lib) return null;
  return {
    key:         entry.key,
    name:        lib.name,
    effect:      lib.effect,
    meta:        lib.meta,
    activeSlots: entry.activeSlots,
  };
}

/** Helper: true se la passiva si attiva nella slot indicata. */
export function passiveActiveInSlot(pokemonId, slotKey) {
  const p = getPassive(pokemonId);
  return p ? p.activeSlots.includes(slotKey) : false;
}
