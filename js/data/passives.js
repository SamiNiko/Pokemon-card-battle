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
  1: { key: 'velenpunta', activeSlots: ['back-center'] },   // Bulbasaur
  2: { key: 'velenpunta', activeSlots: ['back-left'] },   // Ivysaur
  3: { key: 'velenpunta', activeSlots: ['back-right'] },   // Venusaur
  4: { key: 'siccita', activeSlots: ['back-center'] },   // Charmander
  5: { key: 'siccita', activeSlots: ['back-left'] },   // Charmeleon
  6: { key: 'siccita', activeSlots: ['back-right'] },   // Charizard
  7: { key: 'pioggerellina', activeSlots: ['back-center'] },   // Squirtle
  8: { key: 'pioggerellina', activeSlots: ['back-left'] },   // Wartortle
  9: { key: 'pioggerellina', activeSlots: ['back-right'] },   // Blastoise
  10: { key: 'corazza', activeSlots: ['front-center'] },   // Caterpie
  11: { key: 'corazza', activeSlots: ['front-left'] },   // Metapod
  12: { key: 'fortunone', activeSlots: ['back-center'] },   // Butterfree
  13: { key: 'velenpunta', activeSlots: ['front-center'] },   // Weedle
  14: { key: 'corazza', activeSlots: ['front-right'] },   // Kakuna
  15: { key: 'velenpunta', activeSlots: ['back-center', 'back-left'] },   // Beedrill
  16: { key: 'velocitascatto', activeSlots: ['back-left'] },   // Pidgey
  17: { key: 'velocitascatto', activeSlots: ['back-right'] },   // Pidgeotto
  18: { key: 'velocitascatto', activeSlots: ['back-center'] },   // Pidgeot
  19: { key: 'tecnico', activeSlots: ['front-center'] },   // Rattata
  20: { key: 'tecnico', activeSlots: ['front-left'] },   // Raticate
  21: { key: 'tecnico', activeSlots: ['front-right'] },   // Spearow
  22: { key: 'velocitascatto', activeSlots: ['front-left'] },   // Fearow
  23: { key: 'velenpunta', activeSlots: ['back-center', 'back-right'] },   // Ekans
  24: { key: 'pressione', activeSlots: ['front-center'] },   // Arbok
  25: { key: 'statico', activeSlots: ['front-center'] },   // Pikachu
  26: { key: 'statico', activeSlots: ['front-left'] },   // Raichu
  27: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Sandshrew
  28: { key: 'sabbiainfinita', activeSlots: ['back-center'] },   // Sandslash
  29: { key: 'velenpunta', activeSlots: ['back-center', 'front-center'] },   // Nidoran♀
  30: { key: 'velenpunta', activeSlots: ['back-left', 'back-right'] },   // Nidorina
  31: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Nidoqueen
  32: { key: 'velenpunta', activeSlots: ['back-left', 'front-center'] },   // Nidoran♂
  33: { key: 'velenpunta', activeSlots: ['back-right', 'front-center'] },   // Nidorino
  34: { key: 'ultrapotenza', activeSlots: ['front-center'] },   // Nidoking
  35: { key: 'specchiomagico', activeSlots: ['back-center'] },   // Clefairy
  36: { key: 'specchiomagico', activeSlots: ['back-left'] },   // Clefable
  37: { key: 'siccita', activeSlots: ['front-center'] },   // Vulpix
  38: { key: 'siccita', activeSlots: ['back-center', 'back-left'] },   // Ninetales
  39: { key: 'specchiomagico', activeSlots: ['back-right'] },   // Jigglypuff
  40: { key: 'specchiomagico', activeSlots: ['front-center'] },   // Wigglytuff
  41: { key: 'levitazione', activeSlots: ['front-left'] },   // Zubat
  42: { key: 'levitazione', activeSlots: ['front-right'] },   // Golbat
  43: { key: 'velenpunta', activeSlots: ['back-center'] },   // Oddish
  44: { key: 'velenpunta', activeSlots: ['back-left'] },   // Gloom
  45: { key: 'velenpunta', activeSlots: ['back-right'] },   // Vileplume
  46: { key: 'tecnico', activeSlots: ['back-center'] },   // Paras
  47: { key: 'pressione', activeSlots: ['front-left'] },   // Parasect
  48: { key: 'velenpunta', activeSlots: ['front-center'] },   // Venonat
  49: { key: 'velenpunta', activeSlots: ['back-center', 'back-left'] },   // Venomoth
  50: { key: 'velocitascatto', activeSlots: ['front-right'] },   // Diglett
  51: { key: 'velocitascatto', activeSlots: ['back-left', 'back-right'] },   // Dugtrio
  52: { key: 'fortunone', activeSlots: ['back-left'] },   // Meowth
  53: { key: 'tecnico', activeSlots: ['front-center', 'front-left'] },   // Persian
  54: { key: 'pressione', activeSlots: ['front-right'] },   // Psyduck
  55: { key: 'pressione', activeSlots: ['front-center', 'front-left'] },   // Golduck
  56: { key: 'ultrapotenza', activeSlots: ['front-left'] },   // Mankey
  57: { key: 'ultrapotenza', activeSlots: ['front-right'] },   // Primeape
  58: { key: 'siccita', activeSlots: ['back-center', 'back-right'] },   // Growlithe
  59: { key: 'siccita', activeSlots: ['back-center', 'front-center'] },   // Arcanine
  60: { key: 'pioggerellina', activeSlots: ['front-center'] },   // Poliwag
  61: { key: 'pioggerellina', activeSlots: ['back-center', 'back-left'] },   // Poliwhirl
  62: { key: 'ultrapotenza', activeSlots: ['front-center', 'front-left'] },   // Poliwrath
  63: { key: 'pressione', activeSlots: ['front-center', 'front-right'] },   // Abra
  64: { key: 'specchiomagico', activeSlots: ['back-center', 'back-left'] },   // Kadabra
  65: { key: 'specchiomagico', activeSlots: ['back-center', 'back-right'] },   // Alakazam
  66: { key: 'ultrapotenza', activeSlots: ['front-center', 'front-right'] },   // Machop
  67: { key: 'ultrapotenza', activeSlots: ['front-left', 'front-right'] },   // Machoke
  68: { key: 'ultrapotenza', activeSlots: ['front-center'] },   // Machamp
  69: { key: 'velenpunta', activeSlots: ['back-center', 'back-right'] },   // Bellsprout
  70: { key: 'velenpunta', activeSlots: ['back-center', 'front-center'] },   // Weepinbell
  71: { key: 'velenpunta', activeSlots: ['back-left', 'back-right'] },   // Victreebel
  72: { key: 'velenpunta', activeSlots: ['back-left', 'front-center'] },   // Tentacool
  73: { key: 'velenpunta', activeSlots: ['back-right', 'front-center'] },   // Tentacruel
  74: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Geodude
  75: { key: 'corazza', activeSlots: ['front-center'] },   // Graveler
  76: { key: 'sabbiainfinita', activeSlots: ['back-left'] },   // Golem
  77: { key: 'siccita', activeSlots: ['back-left', 'back-right'] },   // Ponyta
  78: { key: 'velocitascatto', activeSlots: ['back-center', 'back-left'] },   // Rapidash
  79: { key: 'rigenerazione', activeSlots: ['back-center'] },   // Slowpoke
  80: { key: 'rigenerazione', activeSlots: ['back-left'] },   // Slowbro
  81: { key: 'corazza', activeSlots: ['front-left'] },   // Magnemite
  82: { key: 'corazza', activeSlots: ['front-right'] },   // Magneton
  83: { key: 'tecnico', activeSlots: ['front-center', 'front-right'] },   // Farfetch’d
  84: { key: 'velocitascatto', activeSlots: ['back-left', 'front-left'] },   // Doduo
  85: { key: 'velocitascatto', activeSlots: ['back-left', 'front-right'] },   // Dodrio
  86: { key: 'snownevicata', activeSlots: ['back-center'] },   // Seel
  87: { key: 'snownevicata', activeSlots: ['back-left'] },   // Dewgong
  88: { key: 'velenpunta', activeSlots: ['back-center'] },   // Grimer
  89: { key: 'velenpunta', activeSlots: ['back-left'] },   // Muk
  90: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Shellder
  91: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Cloyster
  92: { key: 'levitazione', activeSlots: ['back-left'] },   // Gastly
  93: { key: 'levitazione', activeSlots: ['back-right'] },   // Haunter
  94: { key: 'levitazione', activeSlots: ['front-left', 'front-right'] },   // Gengar
  95: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Onix
  96: { key: 'pressione', activeSlots: ['front-left', 'front-right'] },   // Drowzee
  97: { key: 'pressione', activeSlots: ['front-center'] },   // Hypno
  98: { key: 'ultrapotenza', activeSlots: ['front-left'] },   // Krabby
  99: { key: 'ultrapotenza', activeSlots: ['front-right'] },   // Kingler
  100: { key: 'statico', activeSlots: ['front-right'] },   // Voltorb
  101: { key: 'velocitascatto', activeSlots: ['back-center', 'back-right'] },   // Electrode
  102: { key: 'rigenerazione', activeSlots: ['back-right'] },   // Exeggcute
  103: { key: 'rigenerazione', activeSlots: ['back-center', 'back-left'] },   // Exeggutor
  104: { key: 'corazza', activeSlots: ['front-center'] },   // Cubone
  105: { key: 'ultrapotenza', activeSlots: ['front-center', 'front-left'] },   // Marowak
  106: { key: 'tecnico', activeSlots: ['back-center', 'front-center'] },   // Hitmonlee
  107: { key: 'tecnico', activeSlots: ['front-left', 'front-right'] },   // Hitmonchan
  108: { key: 'rigenerazione', activeSlots: ['back-center', 'back-right'] },   // Lickitung
  109: { key: 'levitazione', activeSlots: ['back-left', 'front-left'] },   // Koffing
  110: { key: 'levitazione', activeSlots: ['back-right', 'front-left'] },   // Weezing
  111: { key: 'corazza', activeSlots: ['front-left'] },   // Rhyhorn
  112: { key: 'corazza', activeSlots: ['front-right'] },   // Rhydon
  113: { key: 'specchiomagico', activeSlots: ['back-center', 'front-center'] },   // Chansey
  114: { key: 'rigenerazione', activeSlots: ['back-left', 'back-right'] },   // Tangela
  115: { key: 'tecnico', activeSlots: ['back-center', 'front-left'] },   // Kangaskhan
  116: { key: 'pioggerellina', activeSlots: ['back-center', 'back-right'] },   // Horsea
  117: { key: 'pioggerellina', activeSlots: ['back-center', 'front-center'] },   // Seadra
  118: { key: 'pioggerellina', activeSlots: ['back-left', 'back-right'] },   // Goldeen
  119: { key: 'pioggerellina', activeSlots: ['back-left', 'front-center'] },   // Seaking
  120: { key: 'pioggerellina', activeSlots: ['back-right', 'front-center'] },   // Staryu
  121: { key: 'specchiomagico', activeSlots: ['back-left', 'back-right'] },   // Starmie
  122: { key: 'specchiomagico', activeSlots: ['back-left', 'front-center'] },   // Mr. Mime
  123: { key: 'tecnico', activeSlots: ['back-center', 'front-right'] },   // Scyther
  124: { key: 'snownevicata', activeSlots: ['back-right'] },   // Jynx
  125: { key: 'statico', activeSlots: ['front-center', 'front-left'] },   // Electabuzz
  126: { key: 'siccita', activeSlots: ['back-left', 'front-center'] },   // Magmar
  127: { key: 'ultrapotenza', activeSlots: ['front-center', 'front-right'] },   // Pinsir
  128: { key: 'tecnico', activeSlots: ['front-center'] },   // Tauros
  129: { key: 'vigore', activeSlots: ['front-center'] },   // Magikarp
  130: { key: 'ultrapotenza', activeSlots: ['front-left', 'front-right'] },   // Gyarados
  131: { key: 'snownevicata', activeSlots: ['front-center'] },   // Lapras
  132: { key: 'adattabilita', activeSlots: ['front-center'] },   // Ditto
  133: { key: 'adattabilita', activeSlots: ['back-center'] },   // Eevee
  134: { key: 'pioggerellina', activeSlots: ['back-center'] },   // Vaporeon
  135: { key: 'statico', activeSlots: ['front-center', 'front-right'] },   // Jolteon
  136: { key: 'siccita', activeSlots: ['back-right', 'front-center'] },   // Flareon
  137: { key: 'adattabilita', activeSlots: ['front-left'] },   // Porygon
  138: { key: 'corazza', activeSlots: ['front-center', 'front-left'] },   // Omanyte
  139: { key: 'corazza', activeSlots: ['front-center', 'front-right'] },   // Omastar
  140: { key: 'corazza', activeSlots: ['front-left', 'front-right'] },   // Kabuto
  141: { key: 'tecnico', activeSlots: ['front-left'] },   // Kabutops
  142: { key: 'velocitascatto', activeSlots: ['back-right', 'front-left'] },   // Aerodactyl
  143: { key: 'pancialarda', activeSlots: ['front-center'] },   // Snorlax
  144: { key: 'snownevicata', activeSlots: ['back-center', 'back-left'] },   // Articuno
  145: { key: 'statico', activeSlots: ['front-left', 'front-right'] },   // Zapdos
  146: { key: 'siccita', activeSlots: ['back-center'] },   // Moltres
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
