/* ============================================================
   types.js — tabella efficacia tipi Pokémon (sistema moderno, 18 tipi)
   Solo le entrate non-1× sono memorizzate; tutto il resto = 1.
   ============================================================ */

// TYPE_CHART[tipoAttacco][tipoDifensore] = moltiplicatore
const TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0,   steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2,   ice: 2,   bug: 2,   rock: 0.5, dragon: 0.5, steel: 2   },
  water:    { fire: 2,   water: 0.5, grass: 0.5, ground: 2, rock: 2,  dragon: 0.5 },
  electric: { water: 2,  electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2,   grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { water: 0.5, grass: 2,  ice: 0.5,   ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2,     poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2,  poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2,   electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2,   fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2,   ice: 2,     fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/**
 * Restituisce il moltiplicatore di efficacia tipo complessivo.
 * @param {string}   attackType  - tipo della mossa (es. 'fire')
 * @param {string[]} defendTypes - tipo/i del bersaglio (es. ['fire','flying'])
 * @returns {number} 0 | 0.25 | 0.5 | 1 | 2 | 4
 */
export function getTypeEffectiveness(attackType, defendTypes) {
  let mult = 1;
  const row = TYPE_CHART[attackType];
  if (!row) return 1; // tipo sconosciuto → neutro
  for (const def of defendTypes) {
    mult *= row[def] ?? 1;
  }
  return mult;
}

/* ============================================================
   ETICHETTE ITALIANE — traduzione ufficiale dei tipi
   Le chiavi (es. 'fire') restano in inglese perché vengono da
   PokéAPI. Le label sono per la UI.
   ============================================================ */

export const TYPE_LABELS_IT = {
  normal:   'Normale',
  fire:     'Fuoco',
  water:    'Acqua',
  grass:    'Erba',
  electric: 'Elettro',
  ice:      'Ghiaccio',
  fighting: 'Lotta',
  poison:   'Veleno',
  ground:   'Terra',
  flying:   'Volante',
  psychic:  'Psico',
  bug:      'Coleottero',
  rock:     'Roccia',
  ghost:    'Spettro',
  dragon:   'Drago',
  dark:     'Buio',
  steel:    'Acciaio',
  fairy:    'Folletto',
};

export const TYPE_COLORS = {
  normal:   '#a8a878',  fire:     '#f08030',  water:    '#6890f0',  grass:    '#78c850',
  electric: '#f8d030',  ice:      '#98d8d8',  fighting: '#c03028',  poison:   '#a040a0',
  ground:   '#e0c068',  flying:   '#a890f0',  psychic:  '#f85888',  bug:      '#a8b820',
  rock:     '#b8a038',  ghost:    '#705898',  dragon:   '#7038f8',  dark:     '#705848',
  steel:    '#b8b8d0',  fairy:    '#ee99ac',
};

/** Label italiano di un tipo. Se sconosciuto, ritorna la chiave originale. */
export function typeLabel(typeKey) {
  return TYPE_LABELS_IT[typeKey] ?? typeKey;
}

/** Colore di un tipo, fallback grigio se sconosciuto. */
export function typeColor(typeKey) {
  return TYPE_COLORS[typeKey] ?? '#888';
}
