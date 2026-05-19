/* ============================================================
   trainers.js — I 10 Allenatori di Kanto
   ------------------------------------------------------------
   Capipalestra (8) + Elite Four (1) + Campione (1).
   Ognuno ha un team predefinito, un titolo, un colore tematico,
   una reward gemme alla PRIMA VITTORIA.

   I dati sono per ora hardcoded — quando avremo la modalità Storia
   completa, verranno fusi con story-state.js.
   ============================================================ */

/* Sblocco sequenziale: ogni trainer richiede aver battuto il precedente.
   Eccezione: il primo (Brock) è sempre sbloccato. */
export const TRAINERS = [
  {
    id:    'brock',
    name:  'Brock',
    title: 'Capopalestra di Plumbeopoli',
    badge: '⛰',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brock.png',
    color: '#a8a878',     // grigio roccia
    type:  'rock',
    /* 3 Pokemon: introduzione comodo per il giocatore col team minimo */
    team:  [74, 95],      // Geodude, Onix
    reward: 100,
    intro: 'Il mio team di Roccia è solido come pietra! Vediamo se ce la fai.',
  },
  {
    id:    'misty',
    name:  'Misty',
    title: 'Capopalestra di Celestopoli',
    badge: '💧',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/misty.png',
    color: '#6890f0',
    type:  'water',
    team:  [120, 121],    // Staryu, Starmie
    reward: 150,
    intro: 'Le mie sirene acquatiche ti spazzeranno via!',
  },
  {
    id:    'surge',
    name:  'Lt. Surge',
    title: 'Capopalestra di Aranciopoli',
    badge: '⚡',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/ltsurge.png',
    color: '#f8d030',
    type:  'electric',
    team:  [100, 81, 26], // Voltorb, Magnemite, Raichu
    reward: 200,
    intro: 'Stai per friggere, recluta!',
  },
  {
    id:    'erika',
    name:  'Erika',
    title: 'Capopalestra di Azzurropoli',
    badge: '🌿',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/erika.png',
    color: '#78c850',
    type:  'grass',
    team:  [71, 114, 45], // Victreebel, Tangela, Vileplume
    reward: 250,
    intro: 'Oh… avevi un appuntamento? Combattiamo allora.',
  },
  {
    id:    'koga',
    name:  'Koga',
    title: 'Capopalestra di Fucsiapoli',
    badge: '☠',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/koga.png',
    color: '#a040a0',
    type:  'poison',
    team:  [109, 89, 110], // Koffing, Muk, Weezing
    reward: 400,
    intro: 'L\'arte del ninja-veleno richiede pazienza… e silenzio.',
  },
  {
    id:    'sabrina',
    name:  'Sabrina',
    title: 'Capopalestra di Zafferanopoli',
    badge: '🔮',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/sabrina.png',
    color: '#f85888',
    type:  'psychic',
    team:  [64, 122, 49, 65], // Kadabra, Mr. Mime, Venomoth, Alakazam
    reward: 500,
    intro: 'Ho previsto la tua sconfitta. Non puoi sfuggire al destino.',
  },
  {
    id:    'blaine',
    name:  'Blaine',
    title: 'Capopalestra di Cromolitopoli',
    badge: '🔥',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blaine.png',
    color: '#f08030',
    type:  'fire',
    team:  [58, 77, 78, 59], // Growlithe, Ponyta, Rapidash, Arcanine
    reward: 600,
    intro: 'Indovinello: cosa brucia di più, il fuoco o la sconfitta?',
  },
  {
    id:    'giovanni',
    name:  'Giovanni',
    title: 'Capopalestra di Smeraldopoli',
    badge: '⛰',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png',
    color: '#e0c068',
    type:  'ground',
    team:  [111, 51, 31, 34, 112], // Rhyhorn, Dugtrio, Nidoqueen, Nidoking, Rhydon
    reward: 800,
    intro: 'Una volta capo del Team Rocket. Ora ti distruggerò.',
  },
  {
    id:    'lance',
    name:  'Lance',
    title: 'Elite Four — Drago',
    badge: '🐲',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lance.png',
    color: '#7038f8',
    type:  'dragon',
    team:  [130, 148, 142, 148, 149], // Gyarados, Dragonair, Aerodactyl, Dragonair, Dragonite
    reward: 1000,
    intro: 'Ho atteso a lungo un avversario degno. Saprai onorarmi?',
  },
  {
    id:    'blue',
    name:  'Blue',
    title: 'Campione di Kanto',
    badge: '👑',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blue.png',
    color: '#ffcb05',
    type:  'normal',
    /* Team da Campione: 6 Pokemon, mix di tipi, include uno starter finale */
    team:  [18, 65, 112, 130, 59, 6], // Pidgeot, Alakazam, Rhydon, Gyarados, Arcanine, Charizard
    reward: 1500,
    intro: 'Heh, finalmente! Sono io, Blue, il Campione di Kanto. Vediamo se hai le carte per battermi.',
  },
];

/** Restituisce il trainer con quell'id, o null. */
export function getTrainer(id) {
  return TRAINERS.find(t => t.id === id) ?? null;
}

/** Indice del trainer nella lista (per progressione). */
export function getTrainerIndex(id) {
  return TRAINERS.findIndex(t => t.id === id);
}

/** Ritorna l'array degli id dei trainer sbloccati (in ordine), dato l'array
 *  dei beaten. Il primo è sempre sbloccato; ogni successivo richiede aver
 *  battuto il precedente. */
export function getUnlockedTrainers(beatenIds = []) {
  const beatenSet = new Set(beatenIds);
  const unlocked = [];
  for (let i = 0; i < TRAINERS.length; i++) {
    if (i === 0 || beatenSet.has(TRAINERS[i - 1].id)) {
      unlocked.push(TRAINERS[i].id);
    } else {
      break;
    }
  }
  return unlocked;
}
