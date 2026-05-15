/* ============================================================
   Registra il Service Worker per la PWA.
   Caricato da ogni pagina via <script src="js/register-sw.js"
   defer></script>. Il SW gestisce cache offline + aggiornamenti
   automatici.
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Quando arriva un aggiornamento del SW, attiva subito il nuovo
      // così la prossima nav usa il codice fresco.
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(err => console.warn('[sw] registrazione fallita:', err));

    // Quando il SW prende il controllo (dopo skipWaiting), ricarica
    // la pagina così l'utente vede subito la versione nuova.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
