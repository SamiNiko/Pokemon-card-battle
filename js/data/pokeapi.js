/* ============================================================
   pokeapi.js — fetch + cache dei 151 Pokémon di prima generazione
   Fonte: https://pokeapi.co/api/v2/
   ============================================================ */

const CACHE_KEY = 'pkmn_gen1_v1';
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const API_BASE = 'https://pokeapi.co/api/v2';
const TOTAL = 151;

/**
 * Forma di ogni Pokémon nello store:
 * {
 *   id, name, types: ['fire'], height, weight,
 *   sprite: { default, shiny },
 *   stats: { hp, atk, def, spAtk, spDef, speed }
 * }
 */

let _all = null; // cache in memoria

/** Carica tutti i 151 Pokémon — ritorna Promise<Pokemon[]> */
export async function loadAllPokemon(onProgress) {
  if (_all) return _all;

  const cached = readCache();
  if (cached) {
    _all = cached;
    return cached;
  }

  // fetch in parallelo (con controllo concorrenza per non saturare)
  const ids = Array.from({ length: TOTAL }, (_, i) => i + 1);
  const out = new Array(TOTAL);
  let done = 0;
  const CONCURRENCY = 12;

  await runPool(ids, CONCURRENCY, async (id, idx) => {
    out[idx] = await fetchPokemon(id);
    done += 1;
    if (onProgress) onProgress(done, TOTAL);
  });

  _all = out;
  writeCache(out);
  return out;
}

/** Recupero singolo Pokémon dall'API con timeout di 15 secondi */
async function fetchPokemon(id) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15_000);

  let res;
  try {
    res = await fetch(`${API_BASE}/pokemon/${id}`, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} per Pokémon ${id}`);
  const j = await res.json();

  const stat = (name) => j.stats.find(s => s.stat.name === name)?.base_stat ?? 0;

  return {
    id: j.id,
    name: j.name,
    types: j.types.map(t => t.type.name),
    height: j.height,
    weight: j.weight,
    sprite: {
      default: `${SPRITE_BASE}/${j.id}.png`,
      shiny:   `${SPRITE_BASE}/shiny/${j.id}.png`,
      official: j.sprites.other?.['official-artwork']?.front_default ?? null,
    },
    stats: {
      hp:    stat('hp'),
      atk:   stat('attack'),
      def:   stat('defense'),
      spAtk: stat('special-attack'),
      spDef: stat('special-defense'),
      speed: stat('speed'),
    },
  };
}

/** Pool di concorrenza limitata — preserva l'ordine di output */
async function runPool(items, concurrency, worker) {
  const queue = items.map((item, idx) => ({ item, idx }));
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const { item, idx } = queue.shift();
      await worker(item, idx);
    }
  });
  await Promise.all(runners);
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== TOTAL) return null;
    return parsed;
  } catch (e) {
    console.warn('Cache PokéAPI corrotta, refetch:', e);
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Impossibile scrivere cache (quota piena?):', e);
  }
}

/** Utility: trova un Pokémon per id o nome (richiede loadAllPokemon prima) */
export function findPokemon(idOrName) {
  if (!_all) throw new Error('Pokémon non caricati: chiama prima loadAllPokemon()');
  if (typeof idOrName === 'number') return _all[idOrName - 1] ?? null;
  const lower = String(idOrName).toLowerCase();
  return _all.find(p => p.name === lower) ?? null;
}

