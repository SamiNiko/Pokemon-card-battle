/* ============================================================
   rarity.js — fonte di verità per la rarità di ogni Pokémon Gen 1
   ============================================================
   Sistema a 6 tier:
     6★ Leggendari       → SOLO storia (no summon, no costellazione)
     5★ Pseudo Leggendari → summon raro, costellazione fino a 6 stelle
     4★ Epici             → summon poco frequente
     3★ Rari              → ottenibili anche dalla storia in punti chiave
     2★ Non Comuni        → frequenti nel summon
     1★ Comuni            → la maggior parte dei pull

   I leggendari sono gli UNICI esclusivi della storia (decisione del 2026-05-13).
   Tutti gli altri Pokémon sono ottenibili sia dal summon che dalla storia,
   anche se la storia avrà drop "speciali" come Snorlax, Lapras, ecc.
*/

/* ============================================================
   LISTE PER TIER
   ============================================================
   Modificare i tier è un'operazione semplice: sposta l'ID di un
   Pokémon dall'array in cui sta a quello desiderato. Il resto
   del codice si aggiorna automaticamente.
*/

/** 6★ Leggendari — NON summonabili, ottenibili solo via storia */
export const LEGGENDARI = [
  144,  // Articuno
  145,  // Zapdos
  146,  // Moltres
  150,  // Mewtwo
  151,  // Mew
];

/** 5★ Pseudo Leggendari */
export const PSEUDO_LEGGENDARI = [
  149,  // Dragonite
];

/** 4★ Epici — final evolution dei principali starter + power picks */
export const EPICI = [
  3,    // Venusaur
  6,    // Charizard
  9,    // Blastoise
  18,   // Pidgeot
  26,   // Raichu
  38,   // Ninetales
  94,   // Gengar
  123,  // Scyther
  130,  // Gyarados
  143,  // Snorlax
];

/** 3★ Rari — final evolution di linee secondarie + Pokémon "speciali" */
export const RARI = [
  25,   // Pikachu
  31,   // Nidoqueen
  34,   // Nidoking
  45,   // Vileplume
  59,   // Arcanine
  62,   // Poliwrath
  64,   // Kadabra
  65,   // Alakazam
  68,   // Machamp
  71,   // Victreebel
  73,   // Tentacruel
  76,   // Golem
  78,   // Rapidash
  82,   // Magneton
  83,   // Farfetch'd
  106,  // Hitmonlee
  107,  // Hitmonchan
  112,  // Rhydon
  113,  // Chansey
  115,  // Kangaskhan
  122,  // Mr. Mime
  124,  // Jynx
  125,  // Electabuzz
  126,  // Magmar
  127,  // Pinsir
  128,  // Tauros
  131,  // Lapras
  132,  // Ditto
  134,  // Vaporeon
  135,  // Jolteon
  136,  // Flareon
  142,  // Aerodactyl
];

/** 2★ Non Comuni — evoluzioni intermedie e Pokémon decenti */
export const NON_COMUNI = [
  2,    // Ivysaur
  5,    // Charmeleon
  8,    // Wartortle
  12,   // Butterfree
  15,   // Beedrill
  17,   // Pidgeotto
  20,   // Raticate
  22,   // Fearow
  24,   // Arbok
  28,   // Sandslash
  30,   // Nidorina
  33,   // Nidorino
  36,   // Clefable
  40,   // Wigglytuff
  42,   // Golbat
  44,   // Gloom
  47,   // Parasect
  49,   // Venomoth
  51,   // Dugtrio
  53,   // Persian
  55,   // Golduck
  57,   // Primeape
  61,   // Poliwhirl
  67,   // Machoke
  70,   // Weepinbell
  75,   // Graveler
  80,   // Slowbro
  85,   // Dodrio
  87,   // Dewgong
  89,   // Muk
  91,   // Cloyster
  93,   // Haunter
  97,   // Hypno
  99,   // Kingler
  101,  // Electrode
  103,  // Exeggutor
  105,  // Marowak
  110,  // Weezing
  111,  // Rhyhorn
  114,  // Tangela
  117,  // Seadra
  119,  // Seaking
  121,  // Starmie
  137,  // Porygon
  139,  // Omastar
  141,  // Kabutops
  147,  // Dratini
  148,  // Dragonair
];

/** 1★ Comuni — base form, route comuni, principianti */
export const COMUNI = [
  1,    // Bulbasaur
  4,    // Charmander
  7,    // Squirtle
  10,   // Caterpie
  11,   // Metapod
  13,   // Weedle
  14,   // Kakuna
  16,   // Pidgey
  19,   // Rattata
  21,   // Spearow
  23,   // Ekans
  27,   // Sandshrew
  29,   // Nidoran♀
  32,   // Nidoran♂
  35,   // Clefairy
  37,   // Vulpix
  39,   // Jigglypuff
  41,   // Zubat
  43,   // Oddish
  46,   // Paras
  48,   // Venonat
  50,   // Diglett
  52,   // Meowth
  54,   // Psyduck
  56,   // Mankey
  58,   // Growlithe
  60,   // Poliwag
  63,   // Abra
  66,   // Machop
  69,   // Bellsprout
  72,   // Tentacool
  74,   // Geodude
  77,   // Ponyta
  79,   // Slowpoke
  81,   // Magnemite
  84,   // Doduo
  86,   // Seel
  88,   // Grimer
  90,   // Shellder
  92,   // Gastly
  95,   // Onix
  96,   // Drowzee
  98,   // Krabby
  100,  // Voltorb
  102,  // Exeggcute
  104,  // Cubone
  108,  // Lickitung
  109,  // Koffing
  116,  // Horsea
  118,  // Goldeen
  120,  // Staryu
  129,  // Magikarp
  133,  // Eevee
  138,  // Omanyte
  140,  // Kabuto
];

/* ============================================================
   PROBABILITÀ DI PULL (somma 100%)
   ============================================================
   I leggendari NON sono in tabella perché non sono summonabili.
*/
export const PULL_RATES = {
  // Bilanciamento finale pre-release (passata: 1.0 / 5.0 / 15 / 28 / 51).
  // I 5★ sono stati dimezzati e i 4★ ridotti per renderli "meritati".
  // Il multi-pull garantisce 3★ minimo (vedi summon.js pity).
  pseudo:    0.5,    // 5★
  epic:      3.0,    // 4★
  rare:      14.0,   // 3★
  uncommon:  30.0,   // 2★
  common:    52.5,   // 1★ — somma 100
};

/* ============================================================
   API
   ============================================================ */

const _tierIndex = new Map();
function buildIndex() {
  if (_tierIndex.size > 0) return;
  LEGGENDARI.forEach(id        => _tierIndex.set(id, 'legendary'));
  PSEUDO_LEGGENDARI.forEach(id => _tierIndex.set(id, 'pseudo'));
  EPICI.forEach(id             => _tierIndex.set(id, 'epic'));
  RARI.forEach(id              => _tierIndex.set(id, 'rare'));
  NON_COMUNI.forEach(id        => _tierIndex.set(id, 'uncommon'));
  COMUNI.forEach(id            => _tierIndex.set(id, 'common'));
}

/** Restituisce il tier di un Pokémon (es. 'epic', 'rare', 'legendary'). */
export function getRarity(pokemonId) {
  buildIndex();
  return _tierIndex.get(pokemonId) ?? 'common';
}

/** True se è leggendario (= esclusivo storia, no summon, no costellazione). */
export function isLegendary(pokemonId) {
  return LEGGENDARI.includes(pokemonId);
}

/** Pool di Pokémon summonabili (tutti tranne leggendari). */
export function getSummonablePool() {
  return [
    ...PSEUDO_LEGGENDARI.map(id => ({ id, rarity: 'pseudo' })),
    ...EPICI.map(id             => ({ id, rarity: 'epic' })),
    ...RARI.map(id              => ({ id, rarity: 'rare' })),
    ...NON_COMUNI.map(id        => ({ id, rarity: 'uncommon' })),
    ...COMUNI.map(id            => ({ id, rarity: 'common' })),
  ];
}

/** Numero di stelle di un tier (1-6). */
export function tierStars(rarity) {
  return {
    legendary: 6,
    pseudo:    5,
    epic:      4,
    rare:      3,
    uncommon:  2,
    common:    1,
  }[rarity] ?? 1;
}

/** Etichetta italiana di un tier. */
export function tierLabel(rarity) {
  return {
    legendary: 'Leggendario',
    pseudo:    'Pseudo Leggendario',
    epic:      'Epico',
    rare:      'Raro',
    uncommon:  'Non Comune',
    common:    'Comune',
  }[rarity] ?? '—';
}

/** Colore tipico per UI (CSS). */
export function tierColor(rarity) {
  return {
    legendary: '#ff66cc',
    pseudo:    '#f5d050',
    epic:      '#c8a8ff',
    rare:      '#88b4ff',
    uncommon:  '#80c860',
    common:    '#a8b3cf',
  }[rarity] ?? '#a8b3cf';
}
