# LIEVITA!

PWA in italiano per calcolare rinfreschi, impasti e impasti con fase in frigorifero (lievito madre). Nessun backend, nessuna dipendenza.

## Avvio
Serve un server statico (il service worker non funziona da `file://`):

    cd app_lievito
    python3 -m http.server 8000     # poi apri http://localhost:8000

## Test del modello

    node --test

## Pubblicazione
Copia i file (`index.html`, `style.css`, `app.js`, `model.js`, `sw.js`, `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`)
in qualunque hosting statico con HTTPS (GitHub Pages, Netlify, Cloudflare Pages…). Dal telefono
scegli "Aggiungi a schermata Home" per installarla; dopo la prima visita funziona offline.
Se cambi i file, incrementa `CACHE` in `sw.js`.
Le icone PNG sono generate da `icon.svg` (es. `google-chrome --headless --screenshot=icon-512.png --window-size=512,512 icon.svg`).

## Struttura
- `model.js` – calcoli puri (testati in `model.test.js`)
- `app.js` – interfaccia e `localStorage`
- Parametri e taratura: "Impostazioni avanzate" in fondo alla pagina.
