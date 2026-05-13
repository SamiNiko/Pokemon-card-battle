# Cloud Sync — roadmap migrazione a Supabase

Questo documento descrive **come passare da localStorage a Supabase** senza dover riscrivere il resto del codice. La preparazione architetturale è già stata fatta in `js/data/state.js`.

---

## 1. Cosa è già pronto

### Identità giocatore
Ogni utente ha già un `userId` (UUID generato localmente con prefisso `guest-`), un `userName`, un `accountType` (`'guest'` per ora). Quando arriva il login Supabase:
- `userId` viene sostituito con `auth.user.id` di Supabase
- `accountType` passa a `'supabase'`

### Hook `onSave`
In `state.js`:
```js
import { onSave } from './data/state.js';

const unsubscribe = onSave(state => {
  // chiamato ad ogni saveState()
});
```

Questo è il punto in cui si aggancia il sync su cloud: il resto del codice (battle.js, summon.js, ecc.) **non deve cambiare**.

### Export / Import JSON
Già funzionanti — utili anche dopo il cloud sync come backup offline o per spostare salvataggi tra account.

---

## 2. Setup Supabase (da fare quando vuoi)

### Step 1 — Crea il progetto
1. Vai su [supabase.com](https://supabase.com) → crea account gratis
2. New project → scegli nome (es. `pokemon-card-battle`), password DB, regione (Frankfurt per latenza migliore dall'Italia)
3. Da **Settings → API** copia:
   - `Project URL` (tipo `https://xxxxx.supabase.co`)
   - `anon public` key

### Step 2 — Crea la tabella `saves`
Dalla SQL editor (Database → SQL Editor → New query) lancia:

```sql
create table public.saves (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  state     jsonb not null,
  updated_at timestamptz default now()
);

-- Row Level Security: ogni utente legge/scrive solo il proprio salvataggio
alter table public.saves enable row level security;

create policy "Users read their own save"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "Users write their own save"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "Users update their own save"
  on public.saves for update
  using (auth.uid() = user_id);
```

### Step 3 — Abilita login Google (opzionale)
Authentication → Providers → Google → enable, e segui le istruzioni per ottenere `client_id` e `client_secret` da Google Cloud Console.

---

## 3. Codice da aggiungere

### `js/data/supabase.js` (nuovo)
```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://xxxxx.supabase.co';
const SUPABASE_ANON = 'eyJh...'; // anon public key (safe in client)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
```

### `js/data/cloud-sync.js` (nuovo)
```js
import { supabase }          from './supabase.js';
import { onSave, getState }  from './state.js';

let _saveTimer = null;

// Si registra al hook onSave di state.js: ogni salvataggio
// viene "rimbalzato" sul cloud con un piccolo debounce.
export function startCloudSync() {
  return onSave(state => {
    if (state.accountType !== 'supabase') return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => pushToCloud(state), 1500);
  });
}

async function pushToCloud(state) {
  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: state.userId, state, updated_at: new Date().toISOString() });
  if (error) console.warn('Cloud sync failed:', error);
}

// Pull dopo il login: rimpiazza lo stato locale con quello remoto.
export async function pullFromCloud(userId) {
  const { data, error } = await supabase
    .from('saves')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.state ?? null;
}
```

### Login UI in `settings.html`
Sostituire la riga "In arrivo" con un bottone reale che chiama `supabase.auth.signInWithOAuth({ provider: 'google' })`.

### Flusso login completo (in `settings.js` o nuovo `auth.js`)
```js
import { supabase }          from './data/supabase.js';
import { pullFromCloud }     from './data/cloud-sync.js';
import { getState, saveState } from './data/state.js';

async function handleLogin() {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) return alert(error.message);
  // Dopo il redirect Supabase gestisce la sessione automaticamente.
}

// All'avvio app: controlla se c'è una sessione attiva
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  const cloudState = await pullFromCloud(session.user.id);
  if (cloudState) {
    // Sostituisci lo state locale con quello cloud
    Object.assign(getState(), cloudState, {
      userId: session.user.id,
      accountType: 'supabase',
    });
    saveState();
  } else {
    // Primo login: pusha lo stato guest sul cloud
    const s = getState();
    s.userId = session.user.id;
    s.accountType = 'supabase';
    saveState();
  }
}
```

---

## 4. Anticheat e validazione (per quando arriva il PvP)

Il **client** non deve mai essere autorità sui risultati di battaglia. La logica in `js/engine/combat.js` deve girare:
- Sul **client** per single-player (storia, allenamento)
- Sul **server** per PvP online

Per fare girare `combat.js` su server:
1. Estrai la logica in un modulo Node-compatibile (rimuovi dipendenze DOM)
2. Hostalo su Railway, Render, Fly.io, ecc.
3. Usa Socket.io o WebSocket nativo per comunicazione real-time
4. Il server scrive il risultato finale su Supabase

**Determinismo:** sostituire `Math.random()` con un PRNG seeded (es. mulberry32) così il server può riprodurre/validare le battaglie.

---

## 5. Checklist quando vuoi attivare il cloud

- [ ] Progetto Supabase creato
- [ ] Tabella `saves` con RLS abilitata
- [ ] Provider Google configurato
- [ ] `js/data/supabase.js` con URL + anon key
- [ ] `js/data/cloud-sync.js` creato e `startCloudSync()` chiamato all'avvio
- [ ] Bottone login funzionante in `settings.html`
- [ ] Test: login → editing → reload → progressi presenti

Dopo questi step, **nessun altro file deve cambiare**. È questo il vantaggio della preparazione fatta ora.
