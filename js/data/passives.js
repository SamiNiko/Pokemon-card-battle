/* ============================================================
   passives.js — Passive per ogni Pokémon Gen 1
   
   Ogni Pokémon ha una passiva tra ~18 archetipi competitive
   adattati. La passiva si attiva SOLO se la carta è in una
   delle slot indicate in `activeSlots` (1-2 slot, Hero
   Colosseum style — la posizione deriva dalla NATURA della
   passiva, non dal ruolo del Pokémon).
   
   Le costanti `PASSIVE_LIBRARY` e `POKEMON_PASSIVE` sono
   separate per chiarezza: la biblioteca contiene gli archetipi,
   la mappa lega ogni Pokémon a uno di essi.
   
   Generato da scripts/gen_movesets_passives.py
   ============================================================ */

export const PASSIVE_LIBRARY = {
  'siccita': {
    name:        'Siccità',
    effect:      "Le tue mosse Fuoco infliggono +25% di danno.",
    activeSlots: ['back-center'],
    meta:        {"kind": "type_boost", "type": "fire", "mult": 1.25},
  },
  'pioggerellina': {
    name:        'Pioggerellina',
    effect:      "Le tue mosse Acqua infliggono +25% di danno.",
    activeSlots: ['back-center'],
    meta:        {"kind": "type_boost", "type": "water", "mult": 1.25},
  },
  'sabbiainfinita': {
    name:        'Sabbiainfinita',
    effect:      "Le tue mosse Roccia/Terra infliggono +20% di danno.",
    activeSlots: ['back-center'],
    meta:        {"kind": "type_boost_multi", "types": ["rock", "ground"], "mult": 1.2},
  },
  'snownevicata': {
    name:        'Scendineve',
    effect:      "Le tue mosse Ghiaccio infliggono +25% di danno.",
    activeSlots: ['back-center'],
    meta:        {"kind": "type_boost", "type": "ice", "mult": 1.25},
  },
  'levitazione': {
    name:        'Levitazione',
    effect:      "Immune al danno diretto da colonna vuota e mosse Terra.",
    activeSlots: ['front-left', 'front-right'],
    meta:        {"kind": "immune", "mods": ["direct_damage"], "types": ["ground"]},
  },
  'multiscala': {
    name:        'Multiscaglia',
    effect:      "A HP pieno, subisci -50% di danno dal primo colpo ricevuto.",
    activeSlots: ['front-center'],
    meta:        {"kind": "first_hit_resist", "amount": 0.5, "condition": "full_hp"},
  },
  'vigore': {
    name:        'Vigore',
    effect:      "Sopravvivi con 1 HP a un colpo che ti ucciderebbe (1 volta a battaglia).",
    activeSlots: ['front-center'],
    meta:        {"kind": "endure_once", "once": true},
  },
  'rigenerazione': {
    name:        'Rigenerazione',
    effect:      "A fine turno, recuperi il 15% degli HP massimi.",
    activeSlots: ['back-center'],
    meta:        {"kind": "regen", "percent": 0.15, "when": "turn_end"},
  },
  'pressione': {
    name:        'Pressione',
    effect:      "Il Pokémon che ti attacca consuma 1 PP extra.",
    activeSlots: ['front-center'],
    meta:        {"kind": "extra_pp_cost", "amount": 1},
  },
  'tecnico': {
    name:        'Tecnico',
    effect:      "Le tue mosse Base infliggono +30% di danno.",
    activeSlots: ['front-center'],
    meta:        {"kind": "base_move_boost", "mult": 1.3},
  },
  'fortunone': {
    name:        'Fortunone',
    effect:      "Le tue mosse Finisher infliggono +20% di danno.",
    activeSlots: ['back-center'],
    meta:        {"kind": "finisher_boost", "mult": 1.2},
  },
  'adattabilita': {
    name:        'Adattabilità',
    effect:      "Il bonus STAB delle tue mosse è raddoppiato (×2 anziché ×1.5).",
    activeSlots: ['front-center'],
    meta:        {"kind": "stab_boost", "mult": 2.0},
  },
  'pancialarda': {
    name:        'Pancialarda',
    effect:      "Subisci -30% di danno dalle mosse Fuoco e Ghiaccio.",
    activeSlots: ['front-center'],
    meta:        {"kind": "type_resist", "types": ["fire", "ice"], "mult": 0.7},
  },
  'specchiomagico': {
    name:        'Specchiomagico',
    effect:      "Le mosse Speciali subite infliggono -25% di danno.",
    activeSlots: ['back-center'],
    meta:        {"kind": "cat_resist", "cat": "special", "mult": 0.75},
  },
  'statico': {
    name:        'Statico',
    effect:      "Il Pokémon che ti attacca ha 30% di non guadagnare PP quel turno.",
    activeSlots: ['front-center'],
    meta:        {"kind": "pp_block_chance", "chance": 0.3},
  },
  'velenpunta': {
    name:        'Velenpunta',
    effect:      "Le tue mosse Veleno infliggono +25% di danno.",
    activeSlots: ['back-center'],
    meta:        {"kind": "type_boost", "type": "poison", "mult": 1.25},
  },
  'corazza': {
    name:        'Corazza',
    effect:      "Subisci -20% di danno dalle mosse Fisiche.",
    activeSlots: ['front-center'],
    meta:        {"kind": "cat_resist", "cat": "physical", "mult": 0.8},
  },
  'velocitascatto': {
    name:        'Velocitàscatto',
    effect:      "A ogni turno la tua Velocità aumenta del 15% (cumulativo, max +60%).",
    activeSlots: ['back-left', 'back-right'],
    meta:        {"kind": "speed_stack", "percent": 0.15, "max_stacks": 4},
  },
  'ultrapotenza': {
    name:        'Ultrapotenza',
    effect:      "Il tuo Attacco è raddoppiato. La tua Difesa è dimezzata.",
    activeSlots: ['front-center'],
    meta:        {"kind": "atk_boost_def_drop", "atk_mult": 2.0, "def_mult": 0.5},
  },
};

/** Mappa Pokémon → chiave nell'archetipo. */
export const POKEMON_PASSIVE = {
  1: 'velenpunta',   // Bulbasaur
  2: 'velenpunta',   // Ivysaur
  3: 'velenpunta',   // Venusaur
  4: 'siccita',   // Charmander
  5: 'siccita',   // Charmeleon
  6: 'siccita',   // Charizard
  7: 'pioggerellina',   // Squirtle
  8: 'pioggerellina',   // Wartortle
  9: 'pioggerellina',   // Blastoise
  10: 'corazza',   // Caterpie
  11: 'corazza',   // Metapod
  12: 'fortunone',   // Butterfree
  13: 'velenpunta',   // Weedle
  14: 'corazza',   // Kakuna
  15: 'velenpunta',   // Beedrill
  16: 'velocitascatto',   // Pidgey
  17: 'velocitascatto',   // Pidgeotto
  18: 'velocitascatto',   // Pidgeot
  19: 'tecnico',   // Rattata
  20: 'tecnico',   // Raticate
  21: 'tecnico',   // Spearow
  22: 'velocitascatto',   // Fearow
  23: 'velenpunta',   // Ekans
  24: 'pressione',   // Arbok
  25: 'statico',   // Pikachu
  26: 'statico',   // Raichu
  27: 'corazza',   // Sandshrew
  28: 'sabbiainfinita',   // Sandslash
  29: 'velenpunta',   // Nidoran♀
  30: 'velenpunta',   // Nidorina
  31: 'corazza',   // Nidoqueen
  32: 'velenpunta',   // Nidoran♂
  33: 'velenpunta',   // Nidorino
  34: 'ultrapotenza',   // Nidoking
  35: 'specchiomagico',   // Clefairy
  36: 'specchiomagico',   // Clefable
  37: 'siccita',   // Vulpix
  38: 'siccita',   // Ninetales
  39: 'specchiomagico',   // Jigglypuff
  40: 'specchiomagico',   // Wigglytuff
  41: 'levitazione',   // Zubat
  42: 'levitazione',   // Golbat
  43: 'velenpunta',   // Oddish
  44: 'velenpunta',   // Gloom
  45: 'velenpunta',   // Vileplume
  46: 'tecnico',   // Paras
  47: 'pressione',   // Parasect
  48: 'velenpunta',   // Venonat
  49: 'velenpunta',   // Venomoth
  50: 'velocitascatto',   // Diglett
  51: 'velocitascatto',   // Dugtrio
  52: 'fortunone',   // Meowth
  53: 'tecnico',   // Persian
  54: 'pressione',   // Psyduck
  55: 'pressione',   // Golduck
  56: 'ultrapotenza',   // Mankey
  57: 'ultrapotenza',   // Primeape
  58: 'siccita',   // Growlithe
  59: 'siccita',   // Arcanine
  60: 'pioggerellina',   // Poliwag
  61: 'pioggerellina',   // Poliwhirl
  62: 'ultrapotenza',   // Poliwrath
  63: 'pressione',   // Abra
  64: 'specchiomagico',   // Kadabra
  65: 'specchiomagico',   // Alakazam
  66: 'ultrapotenza',   // Machop
  67: 'ultrapotenza',   // Machoke
  68: 'ultrapotenza',   // Machamp
  69: 'velenpunta',   // Bellsprout
  70: 'velenpunta',   // Weepinbell
  71: 'velenpunta',   // Victreebel
  72: 'velenpunta',   // Tentacool
  73: 'velenpunta',   // Tentacruel
  74: 'corazza',   // Geodude
  75: 'corazza',   // Graveler
  76: 'sabbiainfinita',   // Golem
  77: 'siccita',   // Ponyta
  78: 'velocitascatto',   // Rapidash
  79: 'rigenerazione',   // Slowpoke
  80: 'rigenerazione',   // Slowbro
  81: 'corazza',   // Magnemite
  82: 'corazza',   // Magneton
  83: 'tecnico',   // Farfetch’d
  84: 'velocitascatto',   // Doduo
  85: 'velocitascatto',   // Dodrio
  86: 'snownevicata',   // Seel
  87: 'snownevicata',   // Dewgong
  88: 'velenpunta',   // Grimer
  89: 'velenpunta',   // Muk
  90: 'corazza',   // Shellder
  91: 'corazza',   // Cloyster
  92: 'levitazione',   // Gastly
  93: 'levitazione',   // Haunter
  94: 'levitazione',   // Gengar
  95: 'corazza',   // Onix
  96: 'pressione',   // Drowzee
  97: 'pressione',   // Hypno
  98: 'ultrapotenza',   // Krabby
  99: 'ultrapotenza',   // Kingler
  100: 'statico',   // Voltorb
  101: 'velocitascatto',   // Electrode
  102: 'rigenerazione',   // Exeggcute
  103: 'rigenerazione',   // Exeggutor
  104: 'corazza',   // Cubone
  105: 'ultrapotenza',   // Marowak
  106: 'tecnico',   // Hitmonlee
  107: 'tecnico',   // Hitmonchan
  108: 'rigenerazione',   // Lickitung
  109: 'levitazione',   // Koffing
  110: 'levitazione',   // Weezing
  111: 'corazza',   // Rhyhorn
  112: 'corazza',   // Rhydon
  113: 'specchiomagico',   // Chansey
  114: 'rigenerazione',   // Tangela
  115: 'tecnico',   // Kangaskhan
  116: 'pioggerellina',   // Horsea
  117: 'pioggerellina',   // Seadra
  118: 'pioggerellina',   // Goldeen
  119: 'pioggerellina',   // Seaking
  120: 'pioggerellina',   // Staryu
  121: 'specchiomagico',   // Starmie
  122: 'specchiomagico',   // Mr. Mime
  123: 'tecnico',   // Scyther
  124: 'snownevicata',   // Jynx
  125: 'statico',   // Electabuzz
  126: 'siccita',   // Magmar
  127: 'ultrapotenza',   // Pinsir
  128: 'tecnico',   // Tauros
  129: 'vigore',   // Magikarp
  130: 'ultrapotenza',   // Gyarados
  131: 'snownevicata',   // Lapras
  132: 'adattabilita',   // Ditto
  133: 'adattabilita',   // Eevee
  134: 'pioggerellina',   // Vaporeon
  135: 'statico',   // Jolteon
  136: 'siccita',   // Flareon
  137: 'adattabilita',   // Porygon
  138: 'corazza',   // Omanyte
  139: 'corazza',   // Omastar
  140: 'corazza',   // Kabuto
  141: 'tecnico',   // Kabutops
  142: 'velocitascatto',   // Aerodactyl
  143: 'pancialarda',   // Snorlax
  144: 'snownevicata',   // Articuno
  145: 'statico',   // Zapdos
  146: 'siccita',   // Moltres
  147: 'multiscala',   // Dratini
  148: 'multiscala',   // Dragonair
  149: 'multiscala',   // Dragonite
  150: 'pressione',   // Mewtwo
  151: 'adattabilita',   // Mew
};

/** Helper: restituisce la passiva di un Pokémon o null. */
export function getPassive(pokemonId) {
  const key = POKEMON_PASSIVE[pokemonId];
  if (!key) return null;
  const p = PASSIVE_LIBRARY[key];
  if (!p) return null;
  return { key, ...p };
}

/** Helper: true se la passiva si attiva nella slot indicata. */
export function passiveActiveInSlot(pokemonId, slotKey) {
  const p = getPassive(pokemonId);
  return p ? p.activeSlots.includes(slotKey) : false;
}
