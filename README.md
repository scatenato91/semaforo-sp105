# Semaforo SP 105 — Itri ⇄ Sperlonga

App web che mostra lo stato del semaforo a senso unico alternato in tempo
reale, con countdown al prossimo verde. Nessuna dipendenza, nessuna richiesta
verso terzi, funziona senza rete.

## File

| file | ruolo |
|---|---|
| `index.html` | l'app: modello, interfaccia, avvisi |
| `sw.js` | service worker, rende l'app usabile offline |
| `manifest.webmanifest` | dati di installazione in schermata Home |
| `icona-192.png`, `icona-512.png` | icone (con margine per il ritaglio) |
| `apple-touch-icon.png` | icona per iOS, che ignora il manifest |

## Il modello

Un istante di riferimento per direzione e l'operazione modulo:

```
ciclo  = 1320 s (22 min) = verde 20 s + rosso 600 + rosso 600 + rosso 100
epoche = Sperlonga→Itri  2026-08-16T16:23:10+02:00
         Itri→Sperlonga  2026-08-16T10:42:00+02:00
fase   = ((adesso - epoca) mod 1320 + 1320) mod 1320
verde  ⟺ fase < 20
```

Due punti da non toccare senza rileggere qui:

**L'anticipo di 10 minuti al giorno non è programmato: è una conseguenza.**
86400 s = 65 cicli da 1320 s **più 600 s di resto**, quindi allo stesso orario
del giorno dopo il verde è già passato da 10 minuti. Aggiungere una correzione
esplicita lo conterebbe due volte.

**Le epoche hanno l'offset `+02:00` esplicito.** Senza, la stringa verrebbe
letta nel fuso del dispositivo, e un telefono su un altro fuso — o il
passaggio all'ora solare — sfaserebbe tutto di un'ora. Il semaforo è un
temporizzatore fisico: conta l'istante assoluto, non l'ora sull'orologio.

Verificato contro 20 righe "VERDE" estratte dalle pagine 1, 2, 3 e 10 di
entrambi i PDF: cadono tutte a fase 0. Le due direzioni distano 670 s nel
ciclo e non sono mai verdi insieme.

## Pubblicazione

Serve **HTTPS**: senza, il service worker non si registra e l'app non si
installa né funziona offline. `file://` va bene solo per una prova al volo.

**Scegli un indirizzo e non cambiarlo più.** La calibrazione vive in
`localStorage`, che è legato all'origine: cambiare dominio la azzera.

### GitHub Pages (consigliato: gratuito e permanente)

```bash
cd /home/massimo/Documenti/Semaforo-SP105
git init -b main && git add . && git commit -m "Semaforo SP 105"
git remote add origin https://github.com/UTENTE/semaforo-sp105.git
git push -u origin main
```

Poi su GitHub: **Settings → Pages → Source: main / (root)**. L'indirizzo sarà
`https://UTENTE.github.io/semaforo-sp105/`.

### Alternative

- **Cloudflare Pages** o **Netlify**: si trascina la cartella nel pannello.
  Con un account gratuito l'indirizzo è permanente; senza account il sito è
  temporaneo e l'origine cambia, quindi la calibrazione si perde.
- Qualsiasi hosting già tuo: basta copiare i file in una cartella servita in
  HTTPS. Non serve nulla lato server.

## Installazione sul telefono

1. Apri l'indirizzo HTTPS.
2. **Android/Chrome**: menu ⋮ → *Installa app*.
   **iPhone/Safari**: Condividi → *Aggiungi a Home*.
3. Apri l'app **dall'icona**, non dal browser.

Su iOS l'app in schermata Home ha un archivio **separato** da quello di
Safari: installa prima, calibra dopo, altrimenti la calibrazione resta in
Safari e l'app parte dagli orari ufficiali.

Installare non è solo comodità. iOS cancella i dati dei siti non visitati per
7 giorni; un'app installata è esente, e l'app chiede anche
`navigator.storage.persist()` alla prima calibrazione.

## Aggiornare l'app

Modificando un file, **alza `VERSIONE` in `sw.js`** (`sp105-v1` → `sp105-v2`).
È quello che fa scattare il rinnovo della cache sui dispositivi già
installati: senza, continuano a usare la versione vecchia. Al passaggio
successivo appare la barra "È disponibile una versione aggiornata".

## Calibrazione

Il bottone *"il verde è scattato adesso"* riancora l'epoca all'istante
osservato. Serve perché un semaforo di cantiere viene spento, riacceso e
ritarato, mentre i PDF restano fermi. È per direzione e reversibile con
*"ripristina orari ufficiali"*.

Se si perde non è un dramma: si torna agli orari ufficiali e si ricalibra al
passaggio successivo.

## Limiti noti

- Il countdown si fida dell'orologio del telefono. Sfasato di 30 s l'orologio,
  sfasato di 30 s il countdown: il rimedio è la calibrazione.
- L'avviso sonoro richiede la pagina in primo piano. Un avviso in secondo
  piano richiederebbe notifiche push e quindi un server: fuori scopo.
- Gli orari sono una stima. Cantieri, guasti e ritarature spostano il ciclo
  reale: il semaforo vero ha sempre ragione.
