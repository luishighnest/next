# NMDZ - Live TV & Sport

Piattaforma di streaming Next.js 16 + React 19.

## Come funziona il deploy

Il sito **non** e' deployato su un hosting statico. La catena e' questa:

1. `start_termux.sh` gira su **Termux** (Android): avvia `next start` su `0.0.0.0:3000`
   e poi un **Cloudflare quick tunnel** (`cloudflared`) verso `127.0.0.1:3000`.
   Ogni avvio genera un URL casuale `https://<random>.trycloudflare.com`.
2. `update_redirect.py <link>` scrive quel link nella pagina GitHub Pages e la
   pubblica sul branch **`gh-pages`**.
3. `https://luishighnest.github.io/next/` e' l'indirizzo stabile: reindirizza
   al tunnel attivo, verificandone prima la raggiungibilita'.

> GitHub Pages per questo progetto serve il branch `gh-pages`, **non** `main`.
> Committare `index.html` su `main` non cambia nulla per l'utente finale.

### Requisiti

- `github_token.txt` nella root del progetto: token GitHub con permesso
  `contents:write` (per scrivere sul branch `gh-pages`). Va tenuto fuori dal
  repository (e' in `.gitignore`).
- `npm install` almeno una volta (i `node_modules` non sono nel repository).

### Avvio

```bash
git fetch origin && git reset --hard origin/main
bash start_termux.sh
```

Lo script ripete il ciclo automaticamente: se Next.js va in crash riavvia, e a
ogni riavvio ripubblica il nuovo tunnel.

### Dati

I contenuti vivono in **Upstash Redis** (`stream:eventi`, `stream:sky1`,
`stream:sky2`, `stream:guida`, ...). Senza Redis le API usano il fallback locale
`data/store.json` e poi i file in `public/*.json`.

La guida TV viene ricalcolata 4 volte al giorno da
`.github/workflows/update_epg.yml`, che committa `public/guida_tv_sky.json`.

## Sviluppo

```bash
npm run dev     # sviluppo su http://localhost:3000
npm run build   # build di produzione
npm run start   # serve la build
npm run lint    # eslint
```

## Note tecniche

- `/api/proxy` e `/api/img` sono proxy server-side: accettano una URL arbitraria
  e la scaricano dal server.
- `/api/cron/guida` e `/api/richiedi` vanno protetti prima di esporli.
- Le credenziali di default in `.env.example` sono segreti reali: ruotare
  Upstash e `API_SECRET_KEY` e spostarli in secret GitHub.
