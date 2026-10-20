# Fasce informative per le elezioni scolastiche

Una piccola applicazione Node.js per gestire le liste elettorali e mostrare le grafiche in OBS. Usa solo i moduli integrati di Node.js e salva le liste in `data/workflows.json`.

## Avvio in locale

Installa Node.js 18 o una versione successiva, quindi esegui:

```sh
npm start
```

Apri `http://localhost:3000` per gestire le liste oppure `http://localhost:3000/control` per il controllo in diretta. In OBS, usa `http://localhost:3000/overlay` per la fascia informativa oppure `http://localhost:3000/lists-overlay` per la presentazione che mostra tutte le liste in ordine e inserisce le istruzioni di voto dopo ogni coppia di liste. Imposta le dimensioni della sorgente come quelle del canvas (per esempio, 1920 x 1080).

## Avvio con Docker

Installa e avvia Docker Desktop, apri un terminale nella cartella del progetto ed esegui:

```sh
docker compose up --build -d
```

Apri `http://localhost:3000`. La prima password viene mostrata nei log, consultabili con `docker compose logs app`. I dati restano nella cartella locale `data/` anche quando il container viene ricreato. Per aggiornare l'app dopo aver modificato il codice, riesegui `docker compose up --build -d`; per arrestarla usa `docker compose down`.

## Pubblicazione dell'immagine Docker

Il workflow `.github/workflows/publish-image.yml` pubblica su GitHub Container Registry (`ghcr.io`) a ogni push sul branch predefinito e quando invii un tag di versione come `v1.2.0`. Non richiede segreti aggiuntivi: usa il `GITHUB_TOKEN` del workflow con permesso di scrittura dei pacchetti. L'immagine viene pubblicata come `ghcr.io/<proprietario>/<repository>:latest` e con tag di versione e commit. GHCR conserva l'immagine; per eseguire l'app serve comunque un host Docker.

Le pagine di amministrazione e controllo richiedono l'accesso. Al primo avvio viene creato `data/config.json` con l'utente `admin` e una password casuale, mostrata una sola volta nel terminale. Modifica `auth.username` e `auth.password` in quel file per scegliere le credenziali; il file è locale e non va pubblicato. `config.example.json` mostra la struttura attesa. Le sessioni durano 12 ore. Le pagine overlay restano pubbliche per poter essere caricate da OBS.

## Durante la diretta

Per ogni lista inserisci il nome, i candidati e il motto; puoi anche caricare un logo PNG, JPEG, WebP o GIF fino a 5 MB. I loghi caricati vengono salvati in `data/uploads/`, quindi conserva questa cartella insieme a `data/workflows.json`. Nel controllo in diretta, premi una lista per mostrarla e premi di nuovo quella attiva per disattivarla. La sequenza di ingresso presenta i dettagli della lista, mostra i candidati e porta la grafica nella posizione finale. La grafica si aggiorna in tempo reale quando una lista viene modificata.

## Pubblicazione

L'applicazione funziona su qualsiasi servizio compatibile con Node.js. Imposta `PORT` se richiesto dal servizio e conserva la cartella `data/` su un archivio persistente con permessi di scrittura. L'accesso all'app consente di modificare le liste e controllare la diretta: consentilo solo su una rete fidata o usa i controlli di accesso del servizio di hosting.
