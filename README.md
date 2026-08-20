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
fasi   = verde 45 s + rosso 375 + rosso 525 + rosso 105
         (45 s · 6m15s · 8m45s · 1m45s — rossi totali 16m45s)
ciclo  = somma delle fasi = 1050 s = 17 min 30 s
epoche = Sperlonga→Itri  2026-08-20T21:53:20+02:00
         Itri→Sperlonga  2026-08-20T21:44:35+02:00
fase   = ((adesso - epoca) mod 1050 + 1050) mod 1050
verde  ⟺ fase < 45
```

Durate ed epoche sono **misurate sul posto** e sostituiscono integralmente i
PDF di partenza, che descrivevano un ciclo da 1320 s con verde di 20 s.

**Il ciclo è la somma delle fasi, non un numero indipendente.** Tenerlo
separato ha già prodotto un errore: allungando il verde a totale fisso, un
rosso si accorciava di nascosto. Qui cambiare una fase cambia il ciclo, come
farebbe un temporizzatore reale.

Due punti da non toccare senza rileggere qui:

**Le uniche grandezze imposte sono le quattro durate di fase.** Tutto il resto
è conseguenza del modulo e non va mai scritto nel codice.

L'anticipo giornaliero è il caso esemplare. 86400 s non è un multiplo di
1050 s: restano 300 s, quindi allo stesso orario del giorno dopo il verde è
già passato da **5 minuti**. È un risultato, non una regola — programmarlo lo
conterebbe due volte. Cambiando una durata di fase cambia da sé.

Con il ciclo da 1320 s dei PDF lo stesso calcolo dava 600 s, cioè i 10 minuti
esatti da cui è partito il progetto: quel numero descriveva quel ciclo, non
una legge del semaforo.

**Le epoche hanno l'offset `+02:00` esplicito.** Senza, la stringa verrebbe
letta nel fuso del dispositivo, e un telefono su un altro fuso — o il
passaggio all'ora solare — sfaserebbe tutto di un'ora. Il semaforo è un
temporizzatore fisico: conta l'istante assoluto, non l'ora sull'orologio.

## Separazione dei due sensi

È la proprietà che conta per la sicurezza su una corsia unica. Le due
direzioni condividono lo stesso periodo, quindi il loro sfasamento è
**costante per sempre**: 525 s, cioè **esattamente mezzo ciclo**. Verificare
un ciclo li verifica tutti.

Dentro un ciclo, con riferimento il verde Itri→Sperlonga:

| da → a | cosa |
|---|---|
| 0 → 45 | **verde Itri→Sperlonga** |
| 45 → 525 | entrambi rossi — sgombero **480 s** (8m00s) |
| 525 → 570 | **verde Sperlonga→Itri** |
| 570 → 1050 | entrambi rossi — sgombero **480 s** (8m00s) |

Le due finestre di transito sono **identiche**: otto minuti per parte. È la
forma di un senso unico alternato progettato bene, e nessuna delle due
direzioni è penalizzata.

Forza bruta su 365 giorni (60.069 verdi): zero sovrapposizioni, mai due verdi
di fila nella stessa direzione, e **un solo valore di sgombero esistente**,
480 s. Non un minimo e un massimo vicini: un unico valore, sempre.

**Cambiando una delle due epoche o una qualsiasi durata, questi conti vanno
rifatti.**

### Perché queste epoche sono affidabili

Le due ancore distano 525 s, cioè **mezzo ciclo: stanno dentro lo stesso
ciclo**. È la differenza che conta rispetto alle versioni precedenti.

Lo sfasamento è `differenza − n × ciclo`, dove `n` è il numero di cicli interi
fra le due ancore. Quindi la sensibilità all'errore sul ciclo è **−n**:

| epoche | distanza | n | un secondo di errore sul ciclo sposta lo sfasamento di |
|---|---:|---:|---:|
| 16 ago (10:41 / 16:23) | 20530 s | 15 | 15 s |
| 20 ago (12:01 / 18:33) | 23508 s | 17 | 17 s |
| **20 ago (21:44 / 21:53)** | **525 s** | **0** | **0 s** |

> **La data delle epoche conta.** Sbagliarla di due giorni sposta la fase di
> `172800 mod 1050 = 600 s`, cioè dieci minuti su ogni verde, pur lasciando
> intatto lo sfasamento fra i due sensi. Le date vanno sempre scritte per
> esteso e verificate, non dedotte.

Con `n = 0` l'amplificazione sparisce: un errore sulla durata del ciclo non
tocca affatto lo sfasamento fra i due sensi, perché non c'è nessun ciclo
intero interposto da moltiplicare. L'unico errore residuo è quello del
cronometro.

**È il motivo per cui misurare i due verdi nello stesso ciclo è la procedura
corretta**, e va rifatta così ogni volta che serve ricalibrare:

1. seleziona Itri→Sperlonga e premi *"il verde è scattato adesso"* allo scatto;
2. resta lì, passa a Sperlonga→Itri e premi allo scatto del suo verde.

Poi *Pubblica per tutti* lo rende definitivo — la guardia dei 90 s chiederà
conferma, ed è il caso in cui va data.

## Calibrazione condivisa

`sync.json` sta accanto all'app e contiene le epoche in vigore per tutti i
dispositivi. Modificarlo e fare commit è il modo di ritarare il semaforo senza
toccare il codice: l'app rilegge il file da sola.

Tre livelli, dal più specifico al più generale:

| livello | origine | vale |
|---|---|---|
| **personale** | bottone "il verde è scattato adesso" | solo su quel dispositivo, **24 ore** |
| **condivisa** | `sync.json` | per tutti, finché non cambia |
| **ufficiale** | costanti in `index.html` | se non c'è nient'altro |

La calibrazione personale scade di proposito: nasce da un'osservazione al
volo, e senza scadenza un aggiustamento fatto una sera scavalcherebbe in
silenzio la calibrazione condivisa corretta per mesi.

**La rete non è mai sul percorso critico.** `sync.json` viene chiesto dopo il
primo disegno, mai atteso. Senza rete si usa l'ultima copia ricevuta; se non
c'è nemmeno quella, gli orari nel codice. In modalità aereo l'app si comporta
esattamente come sempre. Il service worker tratta `sync.json` a parte, con
strategia "prima la rete": servirlo dalla cache come il resto lo renderebbe
inutile.

Il file trasporta **solo le epoche**. Durata del verde e del ciclo restano nel
codice: sono la forma del semaforo, non la sua fase, e cambiarle da remoto
amplierebbe senza motivo ciò che un file malformato può rompere.

Un `sync.json` non valido viene ignorato e si ricade sul livello sotto.
Rifiutati: versione diversa da 1, date non interpretabili, una direzione
mancante, e un file datato più di 24 ore nel futuro (quasi sempre un orologio
sbagliato a monte, non un dato).

### Pubblicare dall'app

Il pannello *Pubblicazione* riscrive `sync.json` via API GitHub. È riservato a
chi possiede il token: **su GitHub non esiste scrittura anonima**, quindi
"chiunque può calibrare" richiederebbe un server che custodisca il segreto.
Mettere il token nel client pubblico consentirebbe a chiunque di riscrivere
`index.html` e servire codice arbitrario a tutti gli installati.

Si apre in tre modi, perché l'app installata non ha barra degli indirizzi:

- `?pubblica` nell'indirizzo (da desktop);
- **cinque tocchi rapidi sul titolo** (dal telefono);
- da solo, dove un token è già stato salvato.

Il token va creato come **fine-grained**, su *Settings → Developer settings →
Personal access tokens → Fine-grained tokens*:

- **Repository access**: solo `semaforo-sp105`
- **Permissions → Repository → Contents**: *Read and write* (nient'altro)
- **Expiration**: la più breve che ti sia comoda

Con quei limiti, un token che ti sfugge permette di riscrivere questo solo
repository. Resta comunque una credenziale: non incollarlo in chat, in un
issue o nel codice. Vive solo nel `localStorage` del tuo dispositivo, e
*Dimentica il token* lo rimuove.

**Prima di scrivere, l'app confronta con la calibrazione condivisa in vigore
e rifiuta scostamenti oltre 90 secondi**, chiedendo una seconda conferma. Una
ritaratura vera sposta la fase di pochi secondi; uno scarto grande è quasi
sempre un tocco sbagliato, e pubblicarlo desincronizzerebbe tutti.

Pubblicando, la calibrazione personale viene promossa a condivisa e la copia
locale rimossa. La propagazione richiede qualche minuto: è GitHub Pages che
ricostruisce il sito.

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
