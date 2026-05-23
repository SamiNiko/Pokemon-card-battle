/* ============================================================
   Registra il Service Worker per la PWA.
   Caricato da ogni pagina via <script src="js/register-sw.js"
   defer></script>. Il SW gestisce cache offline + aggiornamenti
   automatici.
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Quando arriva un nuovo SW, NON forziamo l'attivazione: resta in
      // 'waiting' finché tutte le tab non sono chiuse. Cosi' nessuna
      // sessione attiva viene interrotta (PRIMA: skipWaiting → controllerchange
      // → location.reload mid-battaglia → utente perdeva la partita).
      // L'aggiornamento si applica al prossimo cold start della PWA.
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[sw] Nuovo SW pronto. Attivazione al prossimo riavvio dell\'app.');
          }
        });
      });
    }).catch(err => console.warn('[sw] registrazione fallita:', err));
    // NO controllerchange handler: niente reload automatico.
  });
}
