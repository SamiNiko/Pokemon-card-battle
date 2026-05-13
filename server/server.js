/* ============================================================
   server.js — game server WebSocket per PvP
   ============================================================
   Modello: server "relay" — i client si scambiano azioni via il server,
   ma calcolano la risoluzione del turno localmente usando lo stesso
   motore deterministico (combat.js). Niente RNG → niente desync.

   Quando vorremo veramente difenderci da cheat:
   - spostare combat.js + types.js + movesets.js qui sul server
   - il server diventa autoritativo, valida le azioni e calcola gli eventi
   - i client ricevono solo gli eventi da animare
*/

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import http from 'http';

const PORT = process.env.PORT || 8080;
const SERVER_VERSION = 'v0.2-resume-match';

/* ============================================================
   STATO IN MEMORIA (dichiarato qui per chiarezza, usato ovunque)
   ============================================================ */

const clients = new Map();   // clientId → { ws, userId, userName, matchId, side }
const queue   = [];          // array di clientId in attesa di partita
const matches = new Map();   // matchId → { a, b, turn, aTeam, bTeam, aDisconnected, ... }

/* HTTP server: utile per:
   - health check di Railway/Render (rispondiamo 200 OK su qualsiasi GET)
   - verifica veloce "il server è vivo?" aprendo l'URL nel browser
   Il WebSocket si aggancia allo stesso server tramite l'evento 'upgrade'. */
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name:    'Pokémon Card Battle Server',
    version: SERVER_VERSION,
    status:  'ok',
    clients: clients.size,
    matches: matches.size,
    queue:   queue.length,
    uptime:  Math.floor(process.uptime()),
  }));
});

const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(PORT, () => {
  console.log('════════════════════════════════════════════════');
  console.log(`  GAME SERVER ${SERVER_VERSION}`);
  console.log(`  HTTP + WebSocket in ascolto sulla porta ${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/`);
  console.log(`  WebSocket:    ws://localhost:${PORT}`);
  console.log(`  Grace period riconnessione: 30s`);
  console.log('════════════════════════════════════════════════');
});

/* ============================================================
   ENTRY POINT
   ============================================================ */

wss.on('connection', ws => {
  const clientId = randomUUID();
  clients.set(clientId, { ws, userId: null, userName: 'Allenatore', matchId: null, side: null });
  console.log(`[server] +client ${clientId.slice(0, 8)} (totale: ${clients.size})`);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handleMessage(clientId, msg);
  });

  ws.on('close', () => {
    handleDisconnect(clientId);
  });

  // Heartbeat: chiudi connessioni morte dopo 30s di silenzio
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const interval = setInterval(() => {
    if (!alive) { ws.terminate(); clearInterval(interval); return; }
    alive = false;
    try { ws.ping(); } catch {}
  }, 30_000);
});

/* ============================================================
   HANDLER MESSAGGI
   ============================================================ */

function handleMessage(clientId, msg) {
  const client = clients.get(clientId);
  if (!client) return;

  // Log diagnostico di OGNI messaggio in ingresso
  console.log(`[server] ◀ ${msg.type} da ${clientId.slice(0,8)}`);

  switch (msg.type) {
    case 'identify':
      client.userId   = msg.userId   ?? null;
      client.userName = msg.userName ?? 'Allenatore';
      send(client, { type: 'identified', clientId });
      break;

    case 'join-queue':
      enqueue(clientId);
      break;

    case 'leave-queue':
      dequeue(clientId);
      send(client, { type: 'left-queue' });
      break;

    case 'submit-team':
      submitTeam(clientId, msg.team);
      break;

    case 'turn-action': {
      const slots = Object.keys(msg.placement ?? {}).length;
      console.log(`[server] turn-action da ${clientId.slice(0,8)} (${client.userName}) — turn ${msg.turn}, ${slots} slot`);
      const ok = relayToOpponent(clientId, {
        type: 'opponent-action',
        turn: msg.turn,
        placement: msg.placement,
        moves: msg.moves,
      });
      if (!ok) console.warn(`[server] ⚠️  relay fallito per ${clientId.slice(0,8)} — opponente non trovato`);
      break;
    }

    case 'leave-match':
      leaveMatch(clientId);
      break;

    case 'resume-match':
      resumeMatch(clientId, msg.matchId, msg.side, msg.userId);
      break;

    default:
      console.warn(`[server] tipo messaggio sconosciuto: ${msg.type}`);
  }
}

/* ============================================================
   RESUME MATCH — riassocia un nuovo clientId a un match esistente
   ============================================================
   Necessario perché navigando da online.html → battle.html il client
   apre una nuova WebSocket. Senza questo, il server vedrebbe due
   disconnessioni e distruggerebbe il match.
*/
function resumeMatch(newClientId, matchId, side, userId) {
  const newClient = clients.get(newClientId);
  if (!newClient) return;

  const match = matches.get(matchId);
  if (!match) {
    send(newClient, { type: 'match-not-found' });
    console.warn(`[server] resume-match: match ${matchId?.slice?.(0,8)} non esiste`);
    return;
  }
  if (side !== 'a' && side !== 'b') {
    send(newClient, { type: 'match-not-found' });
    return;
  }

  // Riassocia: sostituisci l'ID vecchio nello slot con quello nuovo
  const oldClientId = match[side];
  match[side] = newClientId;
  match[`${side}Disconnected`] = false;
  newClient.matchId = matchId;
  newClient.side    = side;
  if (userId) newClient.userId = userId;

  console.log(`[server] match ${matchId.slice(0,8)}: ${side} riconnesso (${oldClientId?.slice?.(0,8)} → ${newClientId.slice(0,8)})`);
  send(newClient, { type: 'match-resumed', matchId, side });

  // Notifica l'altro lato che siamo tornati (se è già collegato e attendeva)
  const otherSide = side === 'a' ? 'b' : 'a';
  const other = clients.get(match[otherSide]);
  if (other && !match[`${otherSide}Disconnected`]) {
    send(other, { type: 'opponent-resumed' });
  }
}

const GRACE_PERIOD_MS = 30_000;

function handleDisconnect(clientId) {
  const client = clients.get(clientId);
  if (!client) return;
  console.log(`[server] -client ${clientId.slice(0, 8)}`);
  dequeue(clientId);

  // Se era in un match, NON distruggere subito: avvia grace period.
  // Il client potrebbe stare navigando online.html → battle.html.
  if (client.matchId) {
    const matchId = client.matchId;
    const side    = client.side;
    const match   = matches.get(matchId);
    if (match) {
      match[`${side}Disconnected`] = true;
      match[`${side}DisconnectedAt`] = Date.now();
      console.log(`[server] match ${matchId.slice(0,8)}: ${side} disconnesso, grace ${GRACE_PERIOD_MS/1000}s`);

      setTimeout(() => {
        const m = matches.get(matchId);
        if (!m) return;                          // match già distrutto
        if (!m[`${side}Disconnected`]) return;   // riconnesso nel frattempo

        // Grace scaduto → distruggi match e notifica l'altro lato
        const otherSide = side === 'a' ? 'b' : 'a';
        const otherClient = clients.get(m[otherSide]);
        if (otherClient && !m[`${otherSide}Disconnected`]) {
          send(otherClient, { type: 'opponent-left' });
          otherClient.matchId = null;
          otherClient.side    = null;
        }
        matches.delete(matchId);
        console.log(`[server] match ${matchId.slice(0,8)} distrutto (grace scaduto su ${side})`);
      }, GRACE_PERIOD_MS);
    }
  }
  clients.delete(clientId);
}

/* ============================================================
   MATCHMAKING
   ============================================================ */

function enqueue(clientId) {
  const client = clients.get(clientId);
  if (!client || client.matchId) return;
  if (queue.includes(clientId))  return;

  queue.push(clientId);
  send(client, { type: 'queued', position: queue.length });
  console.log(`[server] queue: ${queue.length}`);

  tryMatch();
}

function dequeue(clientId) {
  const i = queue.indexOf(clientId);
  if (i !== -1) queue.splice(i, 1);
}

function tryMatch() {
  while (queue.length >= 2) {
    const aId = queue.shift();
    const bId = queue.shift();
    const a = clients.get(aId);
    const b = clients.get(bId);
    if (!a || !b) continue;

    const matchId = randomUUID();
    a.matchId = matchId; a.side = 'a';
    b.matchId = matchId; b.side = 'b';

    matches.set(matchId, { a: aId, b: bId, turn: 0, aTeam: null, bTeam: null });

    send(a, { type: 'match-found', matchId, side: 'a',
              opponent: { userId: b.userId, userName: b.userName } });
    send(b, { type: 'match-found', matchId, side: 'b',
              opponent: { userId: a.userId, userName: a.userName } });

    console.log(`[server] match ${matchId.slice(0, 8)}: ${a.userName} vs ${b.userName}`);
  }
}

function submitTeam(clientId, team) {
  const client = clients.get(clientId);
  if (!client?.matchId) return;
  const match = matches.get(client.matchId);
  if (!match) return;

  if (client.side === 'a') match.aTeam = team;
  if (client.side === 'b') match.bTeam = team;

  // Quando entrambi hanno scelto il team → invia opponentTeam a entrambi e inizia
  if (match.aTeam && match.bTeam) {
    const a = clients.get(match.a);
    const b = clients.get(match.b);
    if (a) send(a, { type: 'both-ready', opponentTeam: match.bTeam });
    if (b) send(b, { type: 'both-ready', opponentTeam: match.aTeam });
  }
}

function relayToOpponent(clientId, payload) {
  const client = clients.get(clientId);
  if (!client?.matchId) return false;
  const match = matches.get(client.matchId);
  if (!match) return false;

  const opponentId = client.side === 'a' ? match.b : match.a;
  const opponent = clients.get(opponentId);
  if (!opponent) return false;
  send(opponent, payload);
  return true;
}

function leaveMatch(clientId) {
  const client = clients.get(clientId);
  if (!client?.matchId) return;
  const match = matches.get(client.matchId);
  if (!match) return;

  const opponentId = client.side === 'a' ? match.b : match.a;
  const opponent = clients.get(opponentId);
  if (opponent) {
    send(opponent, { type: 'opponent-left' });
    opponent.matchId = null;
    opponent.side    = null;
  }
  matches.delete(client.matchId);
  client.matchId = null;
  client.side    = null;
}

/* ============================================================
   UTILITY
   ============================================================ */

function send(client, payload) {
  if (!client?.ws || client.ws.readyState !== 1) return;
  try {
    client.ws.send(JSON.stringify(payload));
  } catch (e) {
    console.warn('[server] send failed:', e.message);
  }
}
