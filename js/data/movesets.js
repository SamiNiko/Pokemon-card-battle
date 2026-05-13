/* ============================================================
   movesets.js — 1 mossa Basic + 1 Finisher per ogni Pokémon Gen 1
   Sistema Gen 4+: la categoria (physical/special) è proprietà della mossa,
   indipendente dal tipo.

   Struttura per entry: [basic, finisher]
   Ogni mossa: { name, type, cat: 'physical'|'special'|'status', power }
   ============================================================ */

export const MOVESETS = {
  // 1 Bulbasaur
  1:  [{ name:'Razor Leaf',    type:'grass',    cat:'physical', power:55  }, { name:'Solar Beam',     type:'grass',    cat:'special',  power:120 }],
  // 2 Ivysaur
  2:  [{ name:'Razor Leaf',    type:'grass',    cat:'physical', power:55  }, { name:'Solar Beam',     type:'grass',    cat:'special',  power:120 }],
  // 3 Venusaur
  3:  [{ name:'Petal Blizzard',type:'grass',    cat:'physical', power:90  }, { name:'Solar Beam',     type:'grass',    cat:'special',  power:120 }],
  // 4 Charmander
  4:  [{ name:'Flame Charge',  type:'fire',     cat:'physical', power:50  }, { name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }],
  // 5 Charmeleon
  5:  [{ name:'Flame Burst',   type:'fire',     cat:'special',  power:70  }, { name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }],
  // 6 Charizard
  6:  [{ name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }, { name:'Fire Blast',    type:'fire',     cat:'special',  power:110 }],
  // 7 Squirtle
  7:  [{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 8 Wartortle
  8:  [{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 9 Blastoise
  9:  [{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 10 Caterpie
  10: [{ name:'Bug Bite',      type:'bug',      cat:'physical', power:60  }, { name:'Bug Bite',      type:'bug',      cat:'physical', power:60  }],
  // 11 Metapod
  11: [{ name:'Tackle',        type:'normal',   cat:'physical', power:40  }, { name:'Bug Bite',      type:'bug',      cat:'physical', power:60  }],
  // 12 Butterfree
  12: [{ name:'Confusion',     type:'psychic',  cat:'special',  power:50  }, { name:'Bug Buzz',      type:'bug',      cat:'special',  power:90  }],
  // 13 Weedle
  13: [{ name:'Poison Sting',  type:'poison',   cat:'physical', power:40  }, { name:'Pin Missile',   type:'bug',      cat:'physical', power:75  }],
  // 14 Kakuna
  14: [{ name:'Poison Sting',  type:'poison',   cat:'physical', power:40  }, { name:'Bug Bite',      type:'bug',      cat:'physical', power:60  }],
  // 15 Beedrill
  15: [{ name:'Poison Jab',    type:'poison',   cat:'physical', power:80  }, { name:'X-Scissor',    type:'bug',      cat:'physical', power:80  }],
  // 16 Pidgey
  16: [{ name:'Wing Attack',   type:'flying',   cat:'physical', power:60  }, { name:'Air Slash',     type:'flying',   cat:'special',  power:75  }],
  // 17 Pidgeotto
  17: [{ name:'Air Slash',     type:'flying',   cat:'special',  power:75  }, { name:'Hurricane',     type:'flying',   cat:'special',  power:110 }],
  // 18 Pidgeot
  18: [{ name:'Air Slash',     type:'flying',   cat:'special',  power:75  }, { name:'Hurricane',     type:'flying',   cat:'special',  power:110 }],
  // 19 Rattata
  19: [{ name:'Quick Attack',  type:'normal',   cat:'physical', power:40  }, { name:'Hyper Fang',    type:'normal',   cat:'physical', power:80  }],
  // 20 Raticate
  20: [{ name:'Hyper Fang',    type:'normal',   cat:'physical', power:80  }, { name:'Hyper Beam',    type:'normal',   cat:'special',  power:150 }],
  // 21 Spearow
  21: [{ name:'Peck',          type:'flying',   cat:'physical', power:40  }, { name:'Drill Peck',    type:'flying',   cat:'physical', power:80  }],
  // 22 Fearow
  22: [{ name:'Drill Peck',    type:'flying',   cat:'physical', power:80  }, { name:'Brave Bird',    type:'flying',   cat:'physical', power:120 }],
  // 23 Ekans
  23: [{ name:'Acid',          type:'poison',   cat:'special',  power:40  }, { name:'Crunch',        type:'dark',     cat:'physical', power:80  }],
  // 24 Arbok
  24: [{ name:'Crunch',        type:'dark',     cat:'physical', power:80  }, { name:'Gunk Shot',     type:'poison',   cat:'physical', power:120 }],
  // 25 Pikachu
  25: [{ name:'Spark',         type:'electric', cat:'physical', power:65  }, { name:'Volt Tackle',   type:'electric', cat:'physical', power:120 }],
  // 26 Raichu
  26: [{ name:'Thunderbolt',   type:'electric', cat:'special',  power:90  }, { name:'Thunder',       type:'electric', cat:'special',  power:110 }],
  // 27 Sandshrew
  27: [{ name:'Slash',         type:'normal',   cat:'physical', power:70  }, { name:'Earthquake',    type:'ground',   cat:'physical', power:100 }],
  // 28 Sandslash
  28: [{ name:'Slash',         type:'normal',   cat:'physical', power:70  }, { name:'Earthquake',    type:'ground',   cat:'physical', power:100 }],
  // 29 Nidoran-F
  29: [{ name:'Poison Sting',  type:'poison',   cat:'physical', power:40  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 30 Nidorina
  30: [{ name:'Poison Fang',   type:'poison',   cat:'physical', power:50  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 31 Nidoqueen
  31: [{ name:'Poison Jab',    type:'poison',   cat:'physical', power:80  }, { name:'Earth Power',   type:'ground',   cat:'special',  power:90  }],
  // 32 Nidoran-M
  32: [{ name:'Poison Sting',  type:'poison',   cat:'physical', power:40  }, { name:'Horn Attack',   type:'normal',   cat:'physical', power:80  }],
  // 33 Nidorino
  33: [{ name:'Poison Jab',    type:'poison',   cat:'physical', power:80  }, { name:'Horn Drill',    type:'normal',   cat:'physical', power:90  }],
  // 34 Nidoking
  34: [{ name:'Earthquake',    type:'ground',   cat:'physical', power:100 }, { name:'Megahorn',      type:'bug',      cat:'physical', power:120 }],
  // 35 Clefairy
  35: [{ name:'Pound',         type:'normal',   cat:'physical', power:40  }, { name:'Moonblast',     type:'fairy',    cat:'special',  power:95  }],
  // 36 Clefable
  36: [{ name:'Moonblast',     type:'fairy',    cat:'special',  power:95  }, { name:'Hyper Voice',   type:'normal',   cat:'special',  power:90  }],
  // 37 Vulpix
  37: [{ name:'Ember',         type:'fire',     cat:'special',  power:40  }, { name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }],
  // 38 Ninetales
  38: [{ name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }, { name:'Fire Blast',    type:'fire',     cat:'special',  power:110 }],
  // 39 Jigglypuff
  39: [{ name:'Body Slam',     type:'normal',   cat:'physical', power:85  }, { name:'Hyper Voice',   type:'normal',   cat:'special',  power:90  }],
  // 40 Wigglytuff
  40: [{ name:'Body Slam',     type:'normal',   cat:'physical', power:85  }, { name:'Hyper Beam',    type:'normal',   cat:'special',  power:150 }],
  // 41 Zubat
  41: [{ name:'Bite',          type:'dark',     cat:'physical', power:60  }, { name:'Air Slash',     type:'flying',   cat:'special',  power:75  }],
  // 42 Golbat
  42: [{ name:'Air Slash',     type:'flying',   cat:'special',  power:75  }, { name:'Cross Poison',  type:'poison',   cat:'physical', power:70  }],
  // 43 Oddish
  43: [{ name:'Mega Drain',    type:'grass',    cat:'special',  power:40  }, { name:'Petal Blizzard',type:'grass',    cat:'physical', power:90  }],
  // 44 Gloom
  44: [{ name:'Acid',          type:'poison',   cat:'special',  power:40  }, { name:'Petal Blizzard',type:'grass',    cat:'physical', power:90  }],
  // 45 Vileplume
  45: [{ name:'Petal Blizzard',type:'grass',    cat:'physical', power:90  }, { name:'Solar Beam',    type:'grass',    cat:'special',  power:120 }],
  // 46 Paras
  46: [{ name:'Bug Bite',      type:'bug',      cat:'physical', power:60  }, { name:'X-Scissor',    type:'bug',      cat:'physical', power:80  }],
  // 47 Parasect
  47: [{ name:'X-Scissor',    type:'bug',      cat:'physical', power:80  }, { name:'Energy Ball',   type:'grass',    cat:'special',  power:90  }],
  // 48 Venonat
  48: [{ name:'Confusion',     type:'psychic',  cat:'special',  power:50  }, { name:'Psybeam',       type:'psychic',  cat:'special',  power:65  }],
  // 49 Venomoth
  49: [{ name:'Psybeam',       type:'psychic',  cat:'special',  power:65  }, { name:'Bug Buzz',      type:'bug',      cat:'special',  power:90  }],
  // 50 Diglett
  50: [{ name:'Dig',           type:'ground',   cat:'physical', power:80  }, { name:'Earthquake',    type:'ground',   cat:'physical', power:100 }],
  // 51 Dugtrio
  51: [{ name:'Earthquake',    type:'ground',   cat:'physical', power:100 }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 52 Meowth
  52: [{ name:'Slash',         type:'normal',   cat:'physical', power:70  }, { name:'Night Slash',   type:'dark',     cat:'physical', power:70  }],
  // 53 Persian
  53: [{ name:'Slash',         type:'normal',   cat:'physical', power:70  }, { name:'Play Rough',    type:'fairy',    cat:'physical', power:90  }],
  // 54 Psyduck
  54: [{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 55 Golduck
  55: [{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 56 Mankey
  56: [{ name:'Low Kick',      type:'fighting', cat:'physical', power:65  }, { name:'Cross Chop',    type:'fighting', cat:'physical', power:100 }],
  // 57 Primeape
  57: [{ name:'Cross Chop',    type:'fighting', cat:'physical', power:100 }, { name:'Close Combat',  type:'fighting', cat:'physical', power:120 }],
  // 58 Growlithe
  58: [{ name:'Ember',         type:'fire',     cat:'special',  power:40  }, { name:'Flare Blitz',   type:'fire',     cat:'physical', power:120 }],
  // 59 Arcanine
  59: [{ name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }, { name:'Flare Blitz',   type:'fire',     cat:'physical', power:120 }],
  // 60 Poliwag
  60: [{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Surf',          type:'water',    cat:'special',  power:90  }],
  // 61 Poliwhirl
  61: [{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 62 Poliwrath
  62: [{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Close Combat',  type:'fighting', cat:'physical', power:120 }],
  // 63 Abra
  63: [{ name:'Confusion',     type:'psychic',  cat:'special',  power:50  }, { name:'Psychic',       type:'psychic',  cat:'special',  power:90  }],
  // 64 Kadabra
  64: [{ name:'Psybeam',       type:'psychic',  cat:'special',  power:65  }, { name:'Psychic',       type:'psychic',  cat:'special',  power:90  }],
  // 65 Alakazam
  65: [{ name:'Psychic',       type:'psychic',  cat:'special',  power:90  }, { name:'Future Sight',  type:'psychic',  cat:'special',  power:120 }],
  // 66 Machop
  66: [{ name:'Karate Chop',   type:'fighting', cat:'physical', power:50  }, { name:'Cross Chop',    type:'fighting', cat:'physical', power:100 }],
  // 67 Machoke
  67: [{ name:'Cross Chop',    type:'fighting', cat:'physical', power:100 }, { name:'Dynamic Punch', type:'fighting', cat:'physical', power:100 }],
  // 68 Machamp
  68: [{ name:'Cross Chop',    type:'fighting', cat:'physical', power:100 }, { name:'Close Combat',  type:'fighting', cat:'physical', power:120 }],
  // 69 Bellsprout
  69: [{ name:'Vine Whip',     type:'grass',    cat:'physical', power:45  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 70 Weepinbell
  70: [{ name:'Razor Leaf',    type:'grass',    cat:'physical', power:55  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 71 Victreebel
  71: [{ name:'Leaf Blade',    type:'grass',    cat:'physical', power:90  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 72 Tentacool
  72: [{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 73 Tentacruel
  73: [{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 74 Geodude
  74: [{ name:'Rock Throw',    type:'rock',     cat:'physical', power:50  }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 75 Graveler
  75: [{ name:'Rock Slide',    type:'rock',     cat:'physical', power:75  }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 76 Golem
  76: [{ name:'Earthquake',    type:'ground',   cat:'physical', power:100 }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 77 Ponyta
  77: [{ name:'Flame Charge',  type:'fire',     cat:'physical', power:50  }, { name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }],
  // 78 Rapidash
  78: [{ name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }, { name:'Flare Blitz',   type:'fire',     cat:'physical', power:120 }],
  // 79 Slowpoke
  79: [{ name:'Confusion',     type:'psychic',  cat:'special',  power:50  }, { name:'Surf',          type:'water',    cat:'special',  power:90  }],
  // 80 Slowbro
  80: [{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Psychic',       type:'psychic',  cat:'special',  power:90  }],
  // 81 Magnemite
  81: [{ name:'Thundershock',  type:'electric', cat:'special',  power:40  }, { name:'Thunderbolt',   type:'electric', cat:'special',  power:90  }],
  // 82 Magneton
  82: [{ name:'Thunderbolt',   type:'electric', cat:'special',  power:90  }, { name:'Flash Cannon',  type:'steel',    cat:'special',  power:80  }],
  // 83 Farfetch'd
  83: [{ name:'Slash',         type:'normal',   cat:'physical', power:70  }, { name:'Leaf Blade',    type:'grass',    cat:'physical', power:90  }],
  // 84 Doduo
  84: [{ name:'Peck',          type:'flying',   cat:'physical', power:40  }, { name:'Drill Peck',    type:'flying',   cat:'physical', power:80  }],
  // 85 Dodrio
  85: [{ name:'Drill Peck',    type:'flying',   cat:'physical', power:80  }, { name:'Brave Bird',    type:'flying',   cat:'physical', power:120 }],
  // 86 Seel
  86: [{ name:'Aurora Beam',   type:'ice',      cat:'special',  power:65  }, { name:'Ice Beam',      type:'ice',      cat:'special',  power:90  }],
  // 87 Dewgong
  87: [{ name:'Ice Beam',      type:'ice',      cat:'special',  power:90  }, { name:'Blizzard',      type:'ice',      cat:'special',  power:110 }],
  // 88 Grimer
  88: [{ name:'Sludge',        type:'poison',   cat:'special',  power:65  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 89 Muk
  89: [{ name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }, { name:'Gunk Shot',     type:'poison',   cat:'physical', power:120 }],
  // 90 Shellder
  90: [{ name:'Icicle Spear',  type:'ice',      cat:'physical', power:75  }, { name:'Blizzard',      type:'ice',      cat:'special',  power:110 }],
  // 91 Cloyster
  91: [{ name:'Ice Beam',      type:'ice',      cat:'special',  power:90  }, { name:'Blizzard',      type:'ice',      cat:'special',  power:110 }],
  // 92 Gastly
  92: [{ name:'Shadow Ball',   type:'ghost',    cat:'special',  power:80  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 93 Haunter
  93: [{ name:'Shadow Ball',   type:'ghost',    cat:'special',  power:80  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 94 Gengar
  94: [{ name:'Shadow Ball',   type:'ghost',    cat:'special',  power:80  }, { name:'Sludge Wave',   type:'poison',   cat:'special',  power:95  }],
  // 95 Onix
  95: [{ name:'Rock Slide',    type:'rock',     cat:'physical', power:75  }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 96 Drowzee
  96: [{ name:'Confusion',     type:'psychic',  cat:'special',  power:50  }, { name:'Psychic',       type:'psychic',  cat:'special',  power:90  }],
  // 97 Hypno
  97: [{ name:'Psychic',       type:'psychic',  cat:'special',  power:90  }, { name:'Future Sight',  type:'psychic',  cat:'special',  power:120 }],
  // 98 Krabby
  98: [{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Crabhammer',    type:'water',    cat:'physical', power:100 }],
  // 99 Kingler
  99: [{ name:'Crabhammer',    type:'water',    cat:'physical', power:100 }, { name:'X-Scissor',    type:'bug',      cat:'physical', power:80  }],
  // 100 Voltorb
  100:[{ name:'Thunderbolt',   type:'electric', cat:'special',  power:90  }, { name:'Thunder',       type:'electric', cat:'special',  power:110 }],
  // 101 Electrode
  101:[{ name:'Thunderbolt',   type:'electric', cat:'special',  power:90  }, { name:'Thunder',       type:'electric', cat:'special',  power:110 }],
  // 102 Exeggcute
  102:[{ name:'Confusion',     type:'psychic',  cat:'special',  power:50  }, { name:'Solar Beam',    type:'grass',    cat:'special',  power:120 }],
  // 103 Exeggutor
  103:[{ name:'Psychic',       type:'psychic',  cat:'special',  power:90  }, { name:'Solar Beam',    type:'grass',    cat:'special',  power:120 }],
  // 104 Cubone
  104:[{ name:'Bone Club',     type:'ground',   cat:'physical', power:65  }, { name:'Earthquake',    type:'ground',   cat:'physical', power:100 }],
  // 105 Marowak
  105:[{ name:'Bone Club',     type:'ground',   cat:'physical', power:65  }, { name:'Bonemerang',    type:'ground',   cat:'physical', power:100 }],
  // 106 Hitmonlee
  106:[{ name:'Low Kick',      type:'fighting', cat:'physical', power:65  }, { name:'High Jump Kick',type:'fighting', cat:'physical', power:130 }],
  // 107 Hitmonchan
  107:[{ name:'Drain Punch',   type:'fighting', cat:'physical', power:75  }, { name:'Close Combat',  type:'fighting', cat:'physical', power:120 }],
  // 108 Lickitung
  108:[{ name:'Stomp',         type:'normal',   cat:'physical', power:65  }, { name:'Body Slam',     type:'normal',   cat:'physical', power:85  }],
  // 109 Koffing
  109:[{ name:'Sludge',        type:'poison',   cat:'special',  power:65  }, { name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }],
  // 110 Weezing
  110:[{ name:'Sludge Bomb',   type:'poison',   cat:'special',  power:90  }, { name:'Gunk Shot',     type:'poison',   cat:'physical', power:120 }],
  // 111 Rhyhorn
  111:[{ name:'Rock Slide',    type:'rock',     cat:'physical', power:75  }, { name:'Earthquake',    type:'ground',   cat:'physical', power:100 }],
  // 112 Rhydon
  112:[{ name:'Earthquake',    type:'ground',   cat:'physical', power:100 }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 113 Chansey
  113:[{ name:'Egg Bomb',      type:'normal',   cat:'physical', power:100 }, { name:'Hyper Voice',   type:'normal',   cat:'special',  power:90  }],
  // 114 Tangela
  114:[{ name:'Razor Leaf',    type:'grass',    cat:'physical', power:55  }, { name:'Power Whip',    type:'grass',    cat:'physical', power:120 }],
  // 115 Kangaskhan
  115:[{ name:'Stomp',         type:'normal',   cat:'physical', power:65  }, { name:'Double-Edge',   type:'normal',   cat:'physical', power:120 }],
  // 116 Horsea
  116:[{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 117 Seadra
  117:[{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Dragon Pulse',  type:'dragon',   cat:'special',  power:85  }],
  // 118 Goldeen
  118:[{ name:'Waterfall',     type:'water',    cat:'physical', power:80  }, { name:'Aqua Tail',     type:'water',    cat:'physical', power:90  }],
  // 119 Seaking
  119:[{ name:'Waterfall',     type:'water',    cat:'physical', power:80  }, { name:'Megahorn',      type:'bug',      cat:'physical', power:120 }],
  // 120 Staryu
  120:[{ name:'Bubble Beam',   type:'water',    cat:'special',  power:65  }, { name:'Surf',          type:'water',    cat:'special',  power:90  }],
  // 121 Starmie
  121:[{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 122 Mr. Mime
  122:[{ name:'Confusion',     type:'psychic',  cat:'special',  power:50  }, { name:'Psychic',       type:'psychic',  cat:'special',  power:90  }],
  // 123 Scyther
  123:[{ name:'X-Scissor',    type:'bug',      cat:'physical', power:80  }, { name:'Air Slash',     type:'flying',   cat:'special',  power:75  }],
  // 124 Jynx
  124:[{ name:'Ice Beam',      type:'ice',      cat:'special',  power:90  }, { name:'Blizzard',      type:'ice',      cat:'special',  power:110 }],
  // 125 Electabuzz
  125:[{ name:'Thunderpunch',  type:'electric', cat:'physical', power:75  }, { name:'Thunder',       type:'electric', cat:'special',  power:110 }],
  // 126 Magmar
  126:[{ name:'Fire Punch',    type:'fire',     cat:'physical', power:75  }, { name:'Fire Blast',    type:'fire',     cat:'special',  power:110 }],
  // 127 Pinsir
  127:[{ name:'X-Scissor',    type:'bug',      cat:'physical', power:80  }, { name:'Megahorn',      type:'bug',      cat:'physical', power:120 }],
  // 128 Tauros
  128:[{ name:'Body Slam',     type:'normal',   cat:'physical', power:85  }, { name:'Double-Edge',   type:'normal',   cat:'physical', power:120 }],
  // 129 Magikarp
  129:[{ name:'Tackle',        type:'normal',   cat:'physical', power:40  }, { name:'Bounce',        type:'flying',   cat:'physical', power:85  }],
  // 130 Gyarados
  130:[{ name:'Waterfall',     type:'water',    cat:'physical', power:80  }, { name:'Outrage',       type:'dragon',   cat:'physical', power:120 }],
  // 131 Lapras
  131:[{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Blizzard',      type:'ice',      cat:'special',  power:110 }],
  // 132 Ditto
  132:[{ name:'Transform',     type:'normal',   cat:'status',   power:0   }, { name:'Hyper Beam',    type:'normal',   cat:'special',  power:150 }],
  // 133 Eevee
  133:[{ name:'Quick Attack',  type:'normal',   cat:'physical', power:40  }, { name:'Double-Edge',   type:'normal',   cat:'physical', power:120 }],
  // 134 Vaporeon
  134:[{ name:'Surf',          type:'water',    cat:'special',  power:90  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 135 Jolteon
  135:[{ name:'Thunderbolt',   type:'electric', cat:'special',  power:90  }, { name:'Thunder',       type:'electric', cat:'special',  power:110 }],
  // 136 Flareon
  136:[{ name:'Fire Fang',     type:'fire',     cat:'physical', power:65  }, { name:'Flare Blitz',   type:'fire',     cat:'physical', power:120 }],
  // 137 Porygon
  137:[{ name:'Psybeam',       type:'psychic',  cat:'special',  power:65  }, { name:'Tri Attack',    type:'normal',   cat:'special',  power:80  }],
  // 138 Omanyte
  138:[{ name:'Ancient Power', type:'rock',     cat:'special',  power:60  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 139 Omastar
  139:[{ name:'Rock Blast',    type:'rock',     cat:'physical', power:75  }, { name:'Hydro Pump',    type:'water',    cat:'special',  power:110 }],
  // 140 Kabuto
  140:[{ name:'Rock Slide',    type:'rock',     cat:'physical', power:75  }, { name:'Aqua Tail',     type:'water',    cat:'physical', power:90  }],
  // 141 Kabutops
  141:[{ name:'Aqua Tail',     type:'water',    cat:'physical', power:90  }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 142 Aerodactyl
  142:[{ name:'Wing Attack',   type:'flying',   cat:'physical', power:60  }, { name:'Stone Edge',    type:'rock',     cat:'physical', power:100 }],
  // 143 Snorlax
  143:[{ name:'Body Slam',     type:'normal',   cat:'physical', power:85  }, { name:'Hyper Beam',    type:'normal',   cat:'special',  power:150 }],
  // 144 Articuno
  144:[{ name:'Ice Beam',      type:'ice',      cat:'special',  power:90  }, { name:'Blizzard',      type:'ice',      cat:'special',  power:110 }],
  // 145 Zapdos
  145:[{ name:'Discharge',     type:'electric', cat:'special',  power:80  }, { name:'Thunder',       type:'electric', cat:'special',  power:110 }],
  // 146 Moltres
  146:[{ name:'Flamethrower',  type:'fire',     cat:'special',  power:90  }, { name:'Fire Blast',    type:'fire',     cat:'special',  power:110 }],
  // 147 Dratini
  147:[{ name:'Dragon Pulse',  type:'dragon',   cat:'special',  power:85  }, { name:'Aqua Tail',     type:'water',    cat:'physical', power:90  }],
  // 148 Dragonair
  148:[{ name:'Dragon Pulse',  type:'dragon',   cat:'special',  power:85  }, { name:'Outrage',       type:'dragon',   cat:'physical', power:120 }],
  // 149 Dragonite
  149:[{ name:'Dragon Pulse',  type:'dragon',   cat:'special',  power:85  }, { name:'Outrage',       type:'dragon',   cat:'physical', power:120 }],
  // 150 Mewtwo
  150:[{ name:'Psychic',       type:'psychic',  cat:'special',  power:90  }, { name:'Psystrike',     type:'psychic',  cat:'special',  power:100 }],
  // 151 Mew
  151:[{ name:'Psybeam',       type:'psychic',  cat:'special',  power:65  }, { name:'Psychic',       type:'psychic',  cat:'special',  power:90  }],
};
