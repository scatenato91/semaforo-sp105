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
fasi   = verde 56 s + rosso 600 + rosso 600 + rosso 100
ciclo  = somma delle fasi = 1356 s = 22 min 36 s
epoche = Sperlonga→Itri  2026-08-18T18:33:24+02:00
         Itri→Sperlonga  2026-08-18T12:01:36+02:00
fase   = ((adesso - epoca) mod 1356 + 1356) mod 1356
verde  ⟺ fase < 56
```

Il verde di 56 s e l'epoca Itri→Sperlonga delle 10:41:00 sono **misurati sul
posto** e sostituiscono i PDF, che indicavano 20 s e le 10:42:00. I tre rossi
restano quelli dei PDF.

**Il ciclo è la somma delle fasi, non un numero indipendente.** Tenerlo
separato ha già prodotto un errore: allungando il verde a totale fisso, un
rosso si accorciava di nascosto. Qui allungare il verde allunga il ciclo, come
farebbe un temporizzatore reale.

Due punti da non toccare senza rileggere qui:

**Le uniche grandezze imposte sono le quattro durate di fase.** Tutto il resto
è conseguenza del modulo e non va mai scritto nel codice.

L'anticipo giornaliero è il caso esemplare. 86400 s non è un multiplo di
1356 s: restano 972 s, quindi allo stesso orario del giorno dopo il verde è
già passato da 16 min 12 s. È un risultato, non una regola — programmarlo lo
conterebbe due volte. Cambiando una durata di fase cambia da sé.

Con il verde da 20 s dei PDF il ciclo era 1320 s e lo stesso calcolo dava
600 s, cioè i 10 minuti esatti da cui è partito il progetto: quel numero
descriveva il vecchio ciclo, non una legge del semaforo.

**Le epoche hanno l'offset `+02:00` esplicito.** Senza, la stringa verrebbe
letta nel fuso del dispositivo, e un telefono su un altro fuso — o il
passaggio all'ora solare — sfaserebbe tutto di un'ora. Il semaforo è un
temporizzatore fisico: conta l'istante assoluto, non l'ora sull'orologio.

## Separazione dei due sensi

È la proprietà che conta per la sicurezza su una corsia unica. Le due
direzioni condividono lo stesso periodo, quindi il loro sfasamento è
**costante per sempre**: 456 s. Verificare un ciclo li verifica tutti.

Dentro un ciclo, con riferimento il verde Itri→Sperlonga:

| da → a | cosa |
|---|---|
| 0 → 56 | **verde Itri→Sperlonga** |
| 56 → 456 | entrambi rossi — sgombero **400 s** (6m40s) |
| 456 → 512 | **verde Sperlonga→Itri** |
| 512 → 1356 | entrambi rossi — sgombero **844 s** (14m04s) |

Nessuna sovrapposizione e alternanza sempre stretta. Forza bruta su 365
giorni (46.513 verdi): zero sovrapposizioni, mai due verdi di fila nella
stessa direzione, e **due soli valori di sgombero esistenti**, 400 e 844 s.

Chi entra da **Itri** ha 6m40s per sgombrare, chi entra da **Sperlonga** ne ha
14m04s. Un'alternanza perfettamente pari vorrebbe 622 s per parte: si
otterrebbe spostando l'epoca Sperlonga→Itri di +222 s, cioè alle **18:37:06**.

Con le epoche del 16 agosto la finestra corta valeva 134 s.

**Cambiando una delle due epoche o una qualsiasi durata, questi conti vanno
rifatti.**

### Il ciclo di 1356 s è confermato dai dati

Le due ancore Itri→Sperlonga distano esattamente **131 cicli, resto zero**:

```
18 ago 12:01:36 − 16 ago 10:41:00 = 177636 s = 131 × 1356 + 0
```

È la verifica più forte che abbiamo. Su 131 cicli, un errore anche di 0,1 s
per ciclo avrebbe accumulato 13 secondi di scarto. Se le 12:01:36 sono
un'osservazione indipendente, il ciclo è confermato entro ~**0,01 s per
ciclo** — e questo *elimina* il problema di amplificazione descritto sotto,
che richiedeva il ciclo esatto entro ±1,8 s.

L'ancora Sperlonga→Itri è invece spostata di **+266 s** rispetto al 16 agosto
(133 cicli + 266 s): è quella correzione che porta la finestra corta da 134 s
a 400 s.

> Se invece le 12:01:36 fossero state *calcolate* con questo stesso modello, la
> coincidenza è circolare e non dimostra nulla. Vale solo se osservata.

### L'amplificazione, e perché ora conta meno

Le epoche attuali distano 23508 s, cioè poco più di **17 cicli**. Lo scarto è
`23508 − 17 × ciclo`, quindi:

> **un secondo di errore sul ciclo sposta lo sfasamento fra i due sensi di
> diciassette secondi.**

| ciclo | scarto | sgombero corto | lungo |
|---:|---:|---:|---:|
| 1352 | 524 | 468 s | 772 s |
| 1354 | 490 | 434 s | 808 s |
| **1356** | **456** | **400 s** | **844 s** |
| 1358 | 422 | 366 s | 880 s |
| 1360 | 388 | 332 s | 916 s |

Per tenere lo sfasamento entro ±30 s serve il ciclo entro ±1,8 s. La verifica
dei 131 cicli qui sopra lo dà entro ~0,01 s, quindi il margine c'è tutto —
**purché quell'ancora sia osservata e non calcolata**.

Resta il fatto che le due epoche sono prese a 6h32m di distanza: la misura
diretta descritta qui sotto rimane il modo più solido di fissare lo scarto.

### Come chiudere la questione con una misura sola

**Cronometrare i due verdi nello stesso ciclo**, non a ore di distanza. Basta
usare l'app:

1. seleziona Itri→Sperlonga e premi *"il verde è scattato adesso"* allo scatto;
2. resta lì, passa a Sperlonga→Itri e premi allo scatto del suo verde.

Così lo sfasamento è **misurato direttamente**, con l'errore del tuo pollice
(un secondo) invece che quindici volte l'errore sul ciclo. Poi *Pubblica per
tutti* lo rende definitivo — la guardia dei 90 s chiederà conferma, ed è il
caso in cui va data.

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
