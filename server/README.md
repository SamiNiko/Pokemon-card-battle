# Game Server — PvP Online

WebSocket server per le battaglie PvP. Architettura **relay**: il server matchma due giocatori e inoltra le loro azioni; entrambi i client calcolano la risoluzione del turno localmente usando lo stesso motore deterministico (`combat.js`). Niente desync perché il combat non usa RNG.

---

## Setup locale

```bash
cd server
npm install
npm start
```

Il server parte su `ws://localhost:8080`. Modificabile via env var `PORT`.

Per sviluppo con auto-reload:
```bash
npm run dev
```

---

## Protocollo

### Client → Server

| Tipo | Payload | Quando |
|---|---|---|
| `identify` | `{ userId, userName }` | Subito dopo la connessione |
| `join-queue` | – | Per cercare un avversario |
| `leave-queue` | – | Per uscire dalla coda |
| `submit-team` | `{ team: [ids] }` | Dopo `match-found`, invia il team scelto |
| `turn-action` | `{ turn, placement, moves }` | Ogni turno, alla conferma |
| `leave-match` | – | Per abbandonare una partita in corso |

### Server → Client

| Tipo | Payload | Significato |
|---|---|---|
| `identified` | `{ clientId }` | Connessione confermata |
| `queued` | `{ position }` | Sei in coda, posizione N |
| `left-queue` | – | Uscito dalla coda |
| `match-found` | `{ matchId, side, opponent }` | Trovato avversario! `side` = `'a'` o `'b'` |
| `both-ready` | `{ opponentTeam: [ids] }` | Entrambi hanno scelto il team |
| `opponent-action` | `{ turn, placement, moves }` | L'avversario ha confermato il suo turno |
| `opponent-left` | – | L'avversario si è disconnesso |

---

## Flusso di una partita

```
Client A                  Server                  Client B
  │  identify              │                       │
  ├──────────────────────► │ ◄────────────────────┤  identify
  │  join-queue            │                       │
  ├──────────────────────► │ ◄────────────────────┤  join-queue
  │                        │                       │
  │  match-found           │                       │
  │ ◄──────────────────────┤──────────────────────►│ match-found
  │                        │                       │
  │  submit-team [team A]  │                       │
  ├──────────────────────► │ ◄────────────────────┤  submit-team [team B]
  │                        │                       │
  │  both-ready [team B]   │                       │
  │ ◄──────────────────────┤──────────────────────►│ both-ready [team A]
  │                        │                       │
  │  turn-action (turn 1)  │                       │
  ├──────────────────────► │ ◄────────────────────┤  turn-action (turn 1)
  │                        │                       │
  │  opponent-action       │                       │
  │ ◄──────────────────────┤──────────────────────►│ opponent-action
  │                        │                       │
  │   [entrambi calcolano combat localmente]       │
  │   [stesso risultato → stesso state]            │
  │                                                │
  │  turn-action (turn 2)  │  turn-action (turn 2) │
  ├──────────────────────► │ ◄────────────────────┤
  │                        │                       │
  │  ... loop fino a fine partita ...              │
```

---

## Deployment

### Opzione consigliata: Railway / Render / Fly.io
Tutti offrono tier gratuito sufficiente per un prototipo. Esempio Railway:

1. Push del codice su GitHub
2. Su Railway: New Project → Deploy from GitHub repo → seleziona la cartella `server/`
3. Railway rileva automaticamente Node.js + `package.json`
4. Variable env: `PORT` viene impostato automaticamente
5. Il deploy esposto su `wss://<nome-progetto>.up.railway.app`

### Lato client — switchare dev → prod senza ricompilare

Apri la console del browser sul gioco (F12 → Console) ed esegui:

```js
// Per giocare contro amici via internet (server deployato):
localStorage.setItem('pkmn_server_url', 'wss://il-tuo-server.up.railway.app');

// Per tornare al server locale durante lo sviluppo:
localStorage.removeItem('pkmn_server_url');
```

Refresha la pagina → il client userà il nuovo URL. Il fallback se la chiave non c'è è `ws://localhost:8080`.

### Checklist deploy Railway (passo passo)

1. **Account**: registrati su [railway.app](https://railway.app) (gratis con GitHub)
2. **Push del codice**: assicurati che `server/` sia su GitHub
3. **Nuovo progetto**: "New Project" → "Deploy from GitHub repo" → seleziona il repo
4. **Root directory**: nelle impostazioni del servizio, imposta "Root Directory" = `server`
5. **Build**: Railway riconosce Node.js automaticamente da `package.json`, esegue `npm install` + `npm start`
6. **Networking**: Settings → Networking → "Generate Domain" — ottieni un URL tipo `pkmn-server.up.railway.app`
7. **Conversione protocollo**: usa `wss://` (NON `https://` o `ws://`) come URL nel client. Railway gestisce TLS automaticamente.
8. **Test**: dal browser, `localStorage.setItem('pkmn_server_url', 'wss://...')` e refresha
9. **Tier gratuito**: Railway offre $5/mese di crediti gratis. Un server WebSocket idle consuma pochissimo — basta avanzo per molti match.

---

## Limitazioni attuali (prototipo)

- **No anticheat**: il server è un relay, i client si fidano l'uno dell'altro. Un client modificato potrebbe inviare azioni illegali.
- **No matchmaking ELO**: prima coppia in coda → matchata.
- **No reconnect**: se cade la connessione, partita persa.
- **No persistenza**: match history non salvata.

## Evoluzioni future

Quando il prototipo è stabile e si vuole proteggere da cheat:
- Spostare `combat.js`, `types.js`, `movesets.js` sul server
- Server diventa autoritativo: valida ogni azione, calcola gli eventi
- Client riceve solo gli eventi da animare
- Match-history salvata su Supabase
- ELO + matchmaking ranked
