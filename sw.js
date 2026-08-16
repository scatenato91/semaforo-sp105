/* ============================================================================
   Service worker: rende l'app utilizzabile senza rete.
   ----------------------------------------------------------------------------
   Sulla SP 105 il segnale non e' garantito, quindi la strategia e'
   "prima la cache": la pagina si apre sempre e istantaneamente, e
   l'aggiornamento avviene in secondo piano al passaggio successivo.

   Il calcolo del semaforo non ha bisogno di rete: e' aritmetica sull'orologio
   del dispositivo. La rete serve solo a ricevere nuove versioni dell'app.
   ========================================================================== */

/* Alzare questo numero a ogni modifica dei file: e' cio' che fa scattare
   il rinnovo della cache sui dispositivi gia' installati. */
const VERSIONE = "sp105-v1";

const RISORSE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icona-192.png",
  "./icona-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSIONE)
      .then(c => c.addAll(RISORSE))
      // Non aspetto la chiusura delle schede aperte: l'utente ha gia'
      // confermato l'aggiornamento premendo il bottone nella pagina.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n !== VERSIONE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;

  // Le navigazioni ricadono sempre sull'index in cache: aprire l'app senza
  // rete non deve mai mostrare la pagina di errore del browser.
  if(req.mode === "navigate"){
    e.respondWith(
      fetch(req).catch(() => caches.match("./index.html", {ignoreSearch:true}))
    );
    return;
  }

  e.respondWith(
    caches.match(req, {ignoreSearch:true}).then(inCache => {
      // Rinnovo in secondo piano: si serve subito il vecchio, si salva il nuovo.
      const dallaRete = fetch(req).then(risp => {
        if(risp && risp.ok && risp.type === "basic"){
          const copia = risp.clone();
          caches.open(VERSIONE).then(c => c.put(req, copia));
        }
        return risp;
      }).catch(() => inCache);
      return inCache || dallaRete;
    })
  );
});

// La pagina chiede l'attivazione immediata quando l'utente preme "Aggiorna".
self.addEventListener("message", e => {
  if(e.data === "attiva-subito") self.skipWaiting();
});
