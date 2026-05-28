/* ============================================================
   banners.js — definizione dei banner di summon
   ============================================================
   Struttura predisposta per banner multipli e rotazione futura.
   Attualmente è attivo SOLO 'kanto-standard' (pool completo Gen 1
   no leggendari), ma il sistema è pronto per:
     - Banner a tempo (start/end date)
     - Banner con pool ristretto (es. solo Type Acqua, solo line di evo)
     - Banner con rate-up su Pokémon specifici
     - Banner a costo gemma diverso

   Per attivare un banner secondario: aggiungi un'entry in BANNERS
   con { id, name, active: true, ... } e gestiscine il pool tramite
   getBannerPool() (filtro custom su getSummonablePool).
   ============================================================ */

import { getSummonablePool } from './rarity.js';

/**
 * Banner definition shape:
 * {
 *   id:           string           identifier univoco (slug)
 *   name:         string           nome visibile (es. 'Kanto Standard')
 *   description:  string           sottotitolo
 *   bgImage:      string|null      sfondo banner-card (opzionale)
 *   featuredIds:  number[]         Pokémon in evidenza nel banner-card
 *   active:       boolean          se appare nel selettore
 *   startsAt:     ISO string|null  data di apertura (null = sempre attivo)
 *   endsAt:       ISO string|null  data di chiusura (null = permanente)
 *   poolFilter:   fn|null          filtro custom sul pool (null = tutto)
 *   rateUp:       Map<id, mult>    moltiplicatori specifici (futuro)
 *   costSingle:   number           costo summon singola (default 100)
 *   costMulti:    number           costo summon ×10 (default 1000)
 * }
 */
export const BANNERS = [
  {
    id:          'kanto-standard',
    name:        'Kanto Standard',
    description: 'Tutti i 145 Pokémon Gen 1 (no leggendari)',
    bgImage:     null,
    featuredIds: [94, 130, 149, 131],   // Gengar, Gyarados, Dragonite, Lapras
    active:      true,
    startsAt:    null,
    endsAt:      null,
    poolFilter:  null,
    rateUp:      null,
    costSingle:  100,
    costMulti:   1000,
  },
  // ---- Esempi di banner futuri (commentati per non attivarli) ----
  //
  // {
  //   id:          'starter-fire',
  //   name:        'Sentiero del Fuoco',
  //   description: 'Solo Pokémon Fuoco — rate-up Charizard / Arcanine',
  //   featuredIds: [6, 59, 38],
  //   active:      false,
  //   poolFilter:  (entry) => {
  //     const p = findPokemon(entry.id);
  //     return p && p.types.includes('fire');
  //   },
  //   rateUp:      new Map([[6, 2.0], [59, 1.5]]),
  // },
];

/** Ritorna il banner attualmente attivo (per default il primo `active: true`). */
export function getActiveBanner() {
  const now = Date.now();
  return BANNERS.find(b => {
    if (!b.active) return false;
    if (b.startsAt && new Date(b.startsAt).getTime() > now) return false;
    if (b.endsAt   && new Date(b.endsAt).getTime()   < now) return false;
    return true;
  }) ?? BANNERS[0];
}

/** Ritorna il pool effettivo per il banner (applica poolFilter se presente). */
export function getBannerPool(banner = getActiveBanner()) {
  const full = getSummonablePool();
  if (!banner?.poolFilter) return full;
  return full.filter(banner.poolFilter);
}
