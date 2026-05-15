/* ============================================================
   items.js — Held Items Gen 1 (versione aggiornata)
   ============================================================
   Catalogo oggetti da equipaggiare. I prezzi sono in pokéuro 🪙.
   La logica effetto in battaglia NON è ancora implementata —
   per ora il file definisce dati + UI per lo shop.

   Ogni item può avere:
     - icon       : emoji fallback (per chi non ha l'immagine)
     - image      : percorso a PNG in assets/item/ (preferito se presente)
     - restrictedTo: array di Pokédex ID — solo questi Pokémon possono
                    equipaggiare l'oggetto (oggetti species-exclusive)
   ============================================================ */

export const ITEM_CATEGORIES = {
  type:      { id: 'type',      label: 'Potenziamento Tipo', icon: '🔮', color: '#8b6dff' },
  berry:     { id: 'berry',     label: 'Bacche',             icon: '🍒', color: '#e85d8a' },
  defense:   { id: 'defense',   label: 'Difensivi',          icon: '🛡️', color: '#5a8ad8' },
  offense:   { id: 'offense',   label: 'Offensivi',          icon: '⚔️', color: '#e87850' },
  choice:    { id: 'choice',    label: 'Choice',             icon: '🎯', color: '#f5a050' },
  special:   { id: 'special',   label: 'Speciali',           icon: '✨', color: '#5ee8d8' },
  exclusive: { id: 'exclusive', label: 'Esclusivi',          icon: '⭐', color: '#ff66cc' },
};

export const ITEM_RARITY_COLOR = {
  common:   '#a8b3cf',
  uncommon: '#88b4ff',
  rare:     '#c8a8ff',
  epic:     '#f5d050',
};

const A = (file) => `assets/item/${file}`;   // helper per i path

export const ITEMS = [
  /* ====================== POTENZIAMENTO TIPO (18) =================== */
  { id: 'sciarpa-seta',     name: 'Sciarpa Seta',     category: 'type', icon: '🧣', image: A('Sciarpa_seta.png'),
    description: 'Le mosse Normale infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'normal' },
  { id: 'carbonella',       name: 'Carbonella',       category: 'type', icon: '🔥', image: A('Carbonella.png'),
    description: 'Le mosse Fuoco infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'fire' },
  { id: 'acqua-magica',     name: 'Acqua Magica',     category: 'type', icon: '💧', image: A('Acqua_magica.png'),
    description: 'Le mosse Acqua infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'water' },
  { id: 'miracolseme',      name: 'Miracolseme',      category: 'type', icon: '🌱', image: A('Miracolseme.png'),
    description: 'Le mosse Erba infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'grass' },
  { id: 'calamita',         name: 'Calamita',         category: 'type', icon: '🧲', image: A('Calamita.png'),
    description: 'Le mosse Elettro infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'electric' },
  { id: 'gelomai',          name: 'Gelomai',          category: 'type', icon: '❄️', image: A('Gelomai.png'),
    description: 'Le mosse Ghiaccio infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'ice' },
  { id: 'cintura-nera',     name: 'Cintura Nera',     category: 'type', icon: '🥋', image: A('Cintura_nera.png'),
    description: 'Le mosse Lotta infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'fighting' },
  { id: 'velenaculeo',      name: 'Velenaculeo',      category: 'type', icon: '🦂', image: A('Velenaculeo.png'),
    description: 'Le mosse Veleno infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'poison' },
  { id: 'sabbia-soffice',   name: 'Sabbia Soffice',   category: 'type', icon: '🏜️', image: A('Sabbia_soffice.png'),
    description: 'Le mosse Terra infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'ground' },
  { id: 'beccaffilato',     name: 'Beccaffilato',     category: 'type', icon: '🦅', image: A('Beccaffilato.png'),
    description: 'Le mosse Volante infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'flying' },
  { id: 'cucchiaio-torto',  name: 'Cucchiaio Torto',  category: 'type', icon: '🥄', image: A('Cucchiaio_torto.png'),
    description: 'Le mosse Psico infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'psychic' },
  { id: 'argenpolvere',     name: 'Argenpolvere',     category: 'type', icon: '🪲', image: A('Argenpolvere.png'),
    description: 'Le mosse Coleottero infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'bug' },
  { id: 'pietradura',       name: 'Pietradura',       category: 'type', icon: '🪨', image: A('Pietradura.png'),
    description: 'Le mosse Roccia infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'rock' },
  { id: 'spettrotarga',     name: 'Spettrotarga',     category: 'type', icon: '👻', image: A('Spettrotarga.png'),
    description: 'Le mosse Spettro infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'ghost' },
  { id: 'dente-di-drago',   name: 'Dente di Drago',   category: 'type', icon: '🐉', image: A('Dente_di_drago.png'),
    description: 'Le mosse Drago infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'dragon' },
  { id: 'occhialineri',     name: 'Occhialineri',     category: 'type', icon: '🕶️', image: A('Occhialineri.png'),
    description: 'Le mosse Buio infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'dark' },
  { id: 'metalcoperta',     name: 'Metalcoperta',     category: 'type', icon: '⛓️', image: A('Metalcopertura.png'),
    description: 'Le mosse Acciaio infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'steel' },
  { id: 'piuma-fatata',     name: 'Piuma Fatata',     category: 'type', icon: '🪶', image: A('Piuma_fatata.png'),
    description: 'Le mosse Folletto infliggono +15% danni.',
    price: 600, rarity: 'uncommon', boostType: 'fairy' },

  /* ====================== BACCHE (3) =================== */
  { id: 'baccasalak',   name: 'Baccasalak',  category: 'berry', icon: '🌶️', image: A('Baccasalak.png'),
    description: '+25 SPEED quando gli HP scendono sotto il 35%.',
    price: 600, rarity: 'uncommon' },
  { id: 'baccalici',    name: 'Baccalici',   category: 'berry', icon: '🫐', image: A('Baccalici.png'),
    description: '+20% ATK quando gli HP scendono sotto il 35%.',
    price: 600, rarity: 'uncommon' },
  { id: 'baccapitaya',  name: 'Baccapitaya', category: 'berry', icon: '🥭', image: A('Baccapitaya.png'),
    description: '+20% SP.ATK quando gli HP scendono sotto il 35%.',
    price: 600, rarity: 'uncommon' },

  /* ====================== DIFENSIVI (5) =================== */
  { id: 'avanzi',            name: 'Avanzi',            category: 'defense', icon: '🥫', image: A('Avanzi.png'),
    description: 'Recupera il 6% degli HP a fine turno.',
    price: 900, rarity: 'rare' },
  { id: 'bitorzolelmo',      name: 'Bitorzolelmo',      category: 'defense', icon: '🪖', image: A('Bitorzolelmo.png'),
    description: 'Riflette il 12% del danno fisico subito al nemico.',
    price: 700, rarity: 'uncommon' },
  { id: 'focalnastro',       name: 'Focalnastro',       category: 'defense', icon: '🎗️', image: A('Focalnastro.png'),
    description: 'Se subirebbe un KO da HP pieni, sopravvive con 1 HP.',
    price: 1500, rarity: 'rare' },
  { id: 'corpetto-assalto',  name: 'Corpetto Assalto',  category: 'defense', icon: '🦺', image: A('Corpetto_assalto.png'),
    description: '+15% SP.DEF quando schierato in Frontline.',
    price: 700, rarity: 'uncommon' },
  { id: 'ancora-pesante',    name: 'Ancora Pesante',    category: 'defense', icon: '⚓',
    description: '+20% DEF ma -15 SPEED.',
    price: 700, rarity: 'uncommon' },

  /* ====================== OFFENSIVI (3) =================== */
  { id: 'assorbisfera',       name: 'Assorbisfera',       category: 'offense', icon: '💎', image: A('Assorbisfera.png'),
    description: '+20% danni inflitti ma perde 5% HP dopo aver attaccato.',
    price: 900, rarity: 'rare' },
  { id: 'conchinella',        name: 'Conchinella',        category: 'offense', icon: '🐚', image: A('Conchinella.png'),
    description: 'Recupera HP pari al 15% del danno inflitto.',
    price: 800, rarity: 'rare' },
  { id: 'cristallo-finisher', name: 'Cristallo Finisher', category: 'offense', icon: '💠',
    description: 'La mossa Finisher infligge +25% danni.',
    price: 1500, rarity: 'epic' },

  /* ====================== CHOICE (3) =================== */
  { id: 'bendascelta',  name: 'Bendascelta',  category: 'choice', icon: '🎽', image: A('Bendascelta.png'),
    description: '+25% ATK ma può usare solo la prima mossa scelta.',
    price: 1200, rarity: 'rare' },
  { id: 'lentiscelta',  name: 'Lentiscelta',  category: 'choice', icon: '👓', image: A('Lentiscelta.png'),
    description: '+25% SP.ATK ma può usare solo la prima mossa scelta.',
    price: 1200, rarity: 'rare' },
  { id: 'stolascelta',  name: 'Stolascelta',  category: 'choice', icon: '🧣', image: A('Stolascelta.png'),
    description: '+30 SPEED ma blocca sulla prima mossa usata.',
    price: 1300, rarity: 'rare' },

  /* ====================== SPECIALI (5) =================== */
  { id: 'monetamuleto',     name: 'Monetamuleto',     category: 'special', icon: '🪙', image: A('Monetamuleto.png'),
    description: '+20% di valuta ottenuta a fine match.',
    price: 1300, rarity: 'rare' },
  { id: 'distortozona',     name: 'Distortozona',     category: 'special', icon: '🌀',
    description: 'Se è il Pokémon più lento in campo, +20% danni inflitti.',
    price: 1000, rarity: 'rare' },
  { id: 'amplificatore-pp', name: 'Amplificatore PP', category: 'special', icon: '🔋',
    description: 'Ogni 2 attacchi a segno guadagna 1 PP bonus.',
    price: 800, rarity: 'rare' },
  { id: 'scudo-riflesso',   name: 'Scudo Riflesso',   category: 'special', icon: '🪞',
    description: 'La prima mossa speciale subita ogni turno infligge metà danno.',
    price: 1200, rarity: 'rare' },
  { id: 'turbo-booster',    name: 'Turbo Booster',    category: 'special', icon: '🚀',
    description: '+40 SPEED nel primo turno in cui entra in campo.',
    price: 1000, rarity: 'rare' },

  /* ====================== ESCLUSIVI (4) ===================
     Solo specifici Pokémon possono equipaggiarli (restrictedTo).
     Effetti molto forti (x2 stat) → rarità epic.                 */
  { id: 'metalpolvere',  name: 'Metalpolvere',  category: 'exclusive', icon: '🧪', image: A('Metalpolvere.png'),
    description: 'Raddoppia la DEF di Ditto.',
    price: 1500, rarity: 'epic', restrictedTo: [132] /* Ditto */ },
  { id: 'velopolvere',   name: 'Velopolvere',   category: 'exclusive', icon: '🌫️', image: A('Velopolvere.png'),
    description: 'Raddoppia la VELOCITÀ di Ditto.',
    price: 1500, rarity: 'epic', restrictedTo: [132] /* Ditto */ },
  { id: 'osso-spesso',   name: 'Osso Spesso',   category: 'exclusive', icon: '🦴', image: A('Osso_spesso.png'),
    description: 'Raddoppia l\'ATK di Cubone o Marowak.',
    price: 1500, rarity: 'epic', restrictedTo: [104, 105] /* Cubone, Marowak */ },
  { id: 'elettropalla',  name: 'Elettropalla',  category: 'exclusive', icon: '⚡', image: A('Elettropalla.png'),
    description: 'Raddoppia ATK e SP.ATK di Pikachu.',
    price: 1500, rarity: 'epic', restrictedTo: [25] /* Pikachu */ },
];

/* ============================================================
   API
   ============================================================ */

export function findItem(itemId) {
  return ITEMS.find(it => it.id === itemId) ?? null;
}

export function getItemsByCategory(categoryId) {
  return ITEMS.filter(it => it.category === categoryId);
}

export function categoryColor(catId) {
  return ITEM_CATEGORIES[catId]?.color ?? '#888';
}

/** Restituisce true se questo oggetto può essere equipaggiato su pokemonId.
 *  Se l'oggetto non ha restrictedTo, sempre true. */
export function isItemAllowedForPokemon(itemId, pokemonId) {
  const it = findItem(itemId);
  if (!it) return false;
  if (!Array.isArray(it.restrictedTo) || it.restrictedTo.length === 0) return true;
  return it.restrictedTo.includes(Number(pokemonId));
}
