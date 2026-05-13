/* ============================================================
   online.js — client WebSocket per match PvP
   ============================================================
   Modello: il server è un relay. Entrambi i client calcolano la
   risoluzione del turno localmente usando combat.js (deterministico)
   sulle stesse azioni → identico risultato senza desync.

   API: createOnlineClient(serverUrl).on('eventName', cb)
*/

/* URL del game server. Override possibile via localStorage:
     localStorage.setItem('pkmn_server_url', 'wss://mio-server.up.railway.app')
   Pratico per switchare dev/prod senza ricompilare. */
const DEFAULT_SERVER_URL = 'ws://localhost:8080';

function resolveServerUrl(override) {
  if (override) return override;
  try { return localStorage.getItem('pkmn_server_url') || DEFAULT_SERVER_URL; }
  catch { return DEFAULT_SERVER_URL; }
}

export function createOnlineClient(serverUrl) {
  serverUrl = resolveServerUrl(serverUrl);
  let ws = null;
  let clientId = null;
  let connected = false;
  const listeners = new Map();   // eventType → Set<callback>

  /* ---- Event emitter base ---- */
  function on(type, cb) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(cb);
    return () => listeners.get(type)?.delete(cb);
  }
  function emit(type, payload) {
    listeners.get(type)?.forEach(cb => { try { cb(payload); } catch (e) { console.error(e); } });
  }

  /* ---- WebSocket lifecycle ---- */
  function connect(identity = {}) {
    if (ws?.readyState === 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(serverUrl);
      } catch (e) { reject(e); return; }

      ws.addEventListener('open', () => {
        connected = true;
        emit('connected');
        send({ type: 'identify', userId: identity.userId, userName: identity.userName });
      });

      ws.addEventListener('message', e => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        handleMessage(msg);
        if (msg.type === 'identified') {
          clientId = msg.clientId;
          resolve();
        }
      });

      ws.addEventListener('close', () => {
        connected = false;
        emit('disconnected');
      });

      ws.addEventListener('error', err => {
        emit('error', err);
        reject(err);
      });
    });
  }

  function disconnect() {
    try { ws?.close(); } catch {}
    ws = null;
    connected = false;
  }

  function send(payload) {
    if (!ws || ws.readyState !== 1) return false;
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('[online] send failed:', e);
      return false;
    }
  }

  /* ---- Handle incoming messages → emit eventi ---- */
  function handleMessage(msg) {
    switch (msg.type) {
      case 'identified':       /* gestito in connect() */ break;
      case 'queued':           emit('queued',         msg);  break;
      case 'left-queue':       emit('leftQueue',      msg);  break;
      case 'match-found':      emit('matchFound',     msg);  break;
      case 'both-ready':       emit('bothReady',      msg);  break;
      case 'opponent-action':  emit('opponentAction', msg);  break;
      case 'opponent-left':    emit('opponentLeft',   msg);  break;
      case 'opponent-resumed': emit('opponentResumed', msg); break;
      case 'match-resumed':    emit('matchResumed',   msg);  break;
      case 'match-not-found':  emit('matchNotFound',  msg);  break;
      default:                 emit('unknown',        msg);
    }
  }

  /* ---- API ad alto livello ---- */
  function joinQueue()                 { send({ type: 'join-queue' }); }
  function leaveQueue()                { send({ type: 'leave-queue' }); }
  function submitTeam(teamIds)         { send({ type: 'submit-team', team: teamIds }); }
  function sendTurnAction(turn, placement, moves) {
    return send({ type: 'turn-action', turn, placement, moves });
  }
  function leaveMatch()                { send({ type: 'leave-match' }); }
  function resumeMatch(matchId, side, userId) {
    send({ type: 'resume-match', matchId, side, userId });
  }

  return {
    connect, disconnect,
    joinQueue, leaveQueue,
    submitTeam, sendTurnAction, leaveMatch, resumeMatch,
    on,
    get connected() { return connected; },
    get clientId()  { return clientId; },
  };
}
