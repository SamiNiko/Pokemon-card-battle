/* ============================================================
   trainers.js — I 15 Allenatori della Lega Kanto
   ------------------------------------------------------------
   8 Capipalestra + 1 Boss Rocket (Silph Co.) + Rivale +
   4 Elite Four + Campione = 15 totali.

   Ogni trainer ha un team a difficoltà CRESCENTE: i primi hanno
   2-3 Pokemon prevalentemente Comuni/Non Comuni, gli ultimi hanno
   5-6 Pokemon con Rari, Epici e Pseudo Leggendari.

   Stars del team (somma rarità): indicatore approssimativo della
   difficoltà — usato dalla UI per mostrare le "costellazioni".

   Reward in gemme alla PRIMA vittoria, scalata con la forza:
     1-3:  100-200 (entry)
     4-7:  250-700 (mid-game)
     8-10: 700-1300 (mid-late)
     11-15: 1700-3500 (Elite Four + Campione)
   ============================================================ */

import { getRarity, tierStars } from './rarity.js';

/* Sblocco sequenziale: ogni trainer richiede aver battuto il precedente. */
export const TRAINERS = [
  // ============================================================
  // 8 CAPIPALESTRA KANTO
  // ============================================================
  {
    id:    'brock',
    name:  'Brock',
    title: 'Capopalestra di Plumbeopoli',
    badge: '⛰',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/brock.png',
    color: '#a8a878',
    type:  'rock',
    team:  [74, 95],      // Geodude(1★), Onix(1★) — 2★
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
    team:  [120, 121],    // Staryu(1★), Starmie(2★) — 3★
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
    team:  [100, 81, 26], // Voltorb(1★), Magnemite(1★), Raichu(4★) — 6★
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
    team:  [71, 114, 45], // Victreebel(3★), Tangela(2★), Vileplume(3★) — 8★
    reward: 300,
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
    team:  [109, 89, 110, 49, 15], // Koffing(1) canon, Muk(2), Weezing(2), Venomoth(2), Beedrill(2) — 9★
    reward: 450,
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
    team:  [64, 122, 49, 65], // Kadabra(3★), Mr.Mime(3★), Venomoth(2★), Alakazam(3★) — 11★
    reward: 550,
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
    team:  [78, 126, 38, 59], // Rapidash(3★), Magmar(3★), Ninetales(4★), Arcanine(3★) — 13★
    reward: 700,
    intro: 'Indovinello: cosa brucia di più, il fuoco o la sconfitta?',
  },

  // ============================================================
  // BOSS INTERMEDI (Silph Co.)
  // ============================================================
  {
    id:    'rocketboss',
    name:  'Boss Team Rocket',
    title: 'Silph Co. — Quartier Generale',
    badge: '🥷',
    /* Usa il sprite "giovanni-gen3.png" → versione Rocket di Giovanni
       (diversa dal Giovanni-capopalestra HGSS). */
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni-gen3.png',
    color: '#705848',
    type:  'dark',
    team:  [33, 115, 111, 31, 94], // Nidorino(2), Kangaskhan(3), Rhyhorn(2), Nidoqueen(3), Gengar(4) — 14★ (canon Silph Co.)
    reward: 900,
    intro: 'Bambino impertinente… il Team Rocket non perdona chi si mette in mezzo.',
  },
  {
    id:    'giovanni',
    name:  'Giovanni',
    title: 'Capopalestra di Smeraldopoli',
    badge: '⛰',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/giovanni.png',
    color: '#e0c068',
    type:  'ground',
    team:  [111, 51, 31, 34, 112, 28], // Rhyhorn(2), Dugtrio(2), Nidoqueen(3), Nidoking(3), Rhydon(3), Sandslash(2) — 15★
    reward: 1100,
    intro: 'Mi hai svelato. Ora sono solo un Capopalestra… ma il più forte di Kanto.',
  },
  {
    id:    'rival',
    name:  'Rivale',
    title: 'Lega Pokémon — Sfida finale',
    badge: '🤺',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blue-gen3.png',
    color: '#3b4cca',
    type:  'normal',
    team:  [17, 64, 8, 130, 128, 53], // Pidgeotto(2), Kadabra(3), Wartortle(2), Gyarados(4), Tauros(3), Persian(2) — 16★ (canon Silph rival)
    reward: 1400,
    intro: 'Heh, ci incontriamo di nuovo! Stavolta ti distruggo.',
  },

  // ============================================================
  // ELITE FOUR
  // ============================================================
  {
    id:    'lorelei',
    name:  'Petra',
    title: 'Elite Four — Ghiaccio/Acqua',
    badge: '❄',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lorelei-gen3.png',
    color: '#98d8d8',
    type:  'ice',
    team:  [87, 91, 73, 124, 131, 134], // Dewgong(2), Cloyster(2), Tentacruel(3), Jynx(3), Lapras(3), Vaporeon(3) — 16★ (Lorelei canon + Vaporeon)
    reward: 1800,
    intro: 'Sono la prima dell\'Elite Four. Senti il freddo dell\'inverno eterno!',
  },
  {
    id:    'bruno',
    name:  'Bruno',
    title: 'Elite Four — Lotta',
    badge: '👊',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/bruno.png',
    color: '#c03028',
    type:  'fighting',
    team:  [76, 107, 106, 68, 62, 95], // Golem(3), Hitmonchan(3), Hitmonlee(3), Machamp(3), Poliwrath(3), Onix(1) — 16★
    reward: 2100,
    intro: 'I miei Pokémon e io abbiamo allenato corpo e spirito. Mostrami se sei degno.',
  },
  {
    id:    'agatha',
    name:  'Agatha',
    title: 'Elite Four — Spettro',
    badge: '👻',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/agatha-gen3.png',
    color: '#705898',
    type:  'ghost',
    team:  [94, 94, 93, 24, 110, 42], // Gengar(4), Gengar(4), Haunter(2), Arbok(2), Weezing(2), Golbat(2) — 16★
    reward: 2400,
    intro: 'Ah, eccoti! L\'ultima generazione è sempre troppo arrogante. Vediamo le tue paure.',
  },
  {
    id:    'lance',
    name:  'Lance',
    title: 'Elite Four — Drago',
    badge: '🐲',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/lance.png',
    color: '#7038f8',
    type:  'dragon',
    team:  [130, 142, 148, 148, 149, 6], // Gyarados(4), Aerodactyl(3), Dragonair(2)×2 canon R/B, Dragonite(5), Charizard(4) — 20★
    reward: 2800,
    intro: 'Ho atteso a lungo un avversario degno. Saprai onorarmi?',
  },

  // ============================================================
  // CAMPIONE
  // ============================================================
  {
    id:    'blue',
    name:  'Blue',
    title: 'Campione di Kanto',
    badge: '👑',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/blue.png',
    color: '#ffcb05',
    type:  'normal',
    team:  [18, 65, 112, 130, 59, 6], // Pidgeot(4★), Alakazam(3★), Rhydon(3★), Gyarados(4★), Arcanine(3★), Charizard(4★) — 21★
    reward: 3500,
    intro: 'Heh, finalmente! Sono io, Blue, il Campione di Kanto. Vediamo se hai le carte per battermi.',
  },

  // ============================================================
  // EASTER EGG — Prof. Oak (battaglia segreta tagliata da R/B)
  // ============================================================
  // Il team di Oak era programmato nel codice di Pokémon Rosso/Blu ma
  // l'evento non venne mai attivato. Dataminato: 6 Pokemon livello 65+,
  // include TUTTI e 3 gli starter finali Kanto (il vero "padre" dei
  // Pokemon). Sblocco solo dopo aver battuto Blue Campione.
  {
    id:    'oak',
    name:  'Prof. Oak',
    title: 'Battaglia segreta — Pallet Town',
    badge: '🔬',
    sprite: 'https://play.pokemonshowdown.com/sprites/trainers/oak.png',
    color: '#dc4f4f',     // bianco-rosso (camice da scienziato)
    type:  'normal',
    /* Team canon Oak (dataminato R/B): Pidgeot, Tauros, Exeggutor, Arcanine,
       Gyarados, + starter finale che batte quello del Rival. Per il mio gioco
       semplificato uso Venusaur al posto di Exeggutor per includere TUTTI E 3
       gli starter finali. */
    team:  [3, 6, 9, 130, 143, 128], // Venusaur(4), Charizard(4), Blastoise(4), Gyarados(4), Snorlax(4), Tauros(3) — 23★
    reward: 5000,
    intro: 'Aspetta! Una battaglia con me? Hmm… molto bene. Ti mostrerò la VERA forza dei Pokémon.',
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

/** Somma delle stars del team di un trainer (indicatore di difficoltà).
 *  Usato dall'UI per mostrare la "costellazione" del trainer. */
export function getTrainerTotalStars(trainerOrId) {
  const t = typeof trainerOrId === 'string' ? getTrainer(trainerOrId) : trainerOrId;
  if (!t) return 0;
  return (t.team ?? []).reduce((sum, id) => sum + tierStars(getRarity(id)), 0);
}

/** Tier di difficoltà di un trainer (per icona / colore in UI).
 *  Basato sulla somma stelle del team. */
export function getTrainerDifficulty(trainerOrId) {
  const stars = getTrainerTotalStars(trainerOrId);
  if (stars <= 5)  return { tier: 1, label: 'Facile',      color: '#80c860' };
  if (stars <= 9)  return { tier: 2, label: 'Medio',       color: '#88b4ff' };
  if (stars <= 12) return { tier: 3, label: 'Difficile',   color: '#f5d050' };
  if (stars <= 15) return { tier: 4, label: 'Molto Forte', color: '#c8a8ff' };
  if (stars <= 19) return { tier: 5, label: 'Lega',        color: '#ff66cc' };
  if (stars <= 22) return { tier: 6, label: 'Campione',    color: '#ffcb05' };
  return                 { tier: 7, label: 'Maestro',     color: '#ff3344' };
}
