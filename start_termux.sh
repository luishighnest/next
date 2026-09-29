#!/data/data/com.termux/files/usr/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

termux-wake-lock 2>/dev/null

while true; do
    echo "[0/4] Sincronizzazione con GitHub..."
    git fetch origin main --quiet 2>/dev/null && git reset --hard origin/main --quiet 2>/dev/null

    echo "[1/4] Pulizia vecchi processi..."
    killall -9 node cloudflared 2>/dev/null
    sleep 1

    echo "[2/4] Verifico build ed avvio server Next.js..."

    # Ricostruisci se manca la build, se non c'e' il marchio, o se QUALSIASI file
    # sorgente e' piu' recente dell'ultima build. Prima bastava controllare che la
    # cartella .next esistesse: con la build tracciata in git la cartella tornava
    # sempre dal vecchio commit e la condizione risultava vera, quindi il server
    # partiva con un bundle vecchio di molti commit e nessuna modifica al
    # sorgente si vedeva mai.
    # La build e' gia' compilata e committata nel repository, non la ricompilo
    # qui: su Termux 'npm run build' e' lento e va in errore, e il telefono deve
    # limitarsi ad avviare il server. Basta verificare che la build sia
    # presente, altrimenti il server partirebbe con pagine rotte.
    STAMP=".next/BUILD_ID"
    if [ ! -f "$STAMP" ]; then
        echo "    ERRORE: build assente (.next/BUILD_ID non trovato)."
        echo "    La build va compilata sul PC e committata, poi va tirata con:"
        echo "      git fetch origin && git reset --hard origin/main"
        echo "    Non ricompilo qui perche' su Termux la build fallisce."
        sleep 5
        continue
    fi
    echo "    Build presente (BUILD_ID: $(cat "$STAMP"))."

    npm run start -- -H 0.0.0.0 -p 3000 > /dev/null 2>&1 &
    PID_NEXT=$!

    # Il tunnel va avviato solo quando Next.js e' davvero in ascolto: altrimenti
    # cloudflared accetta connessioni e risponde 502/503, e il link pubblicato
    # porterebbe a una pagina di errore. Controllo in HTTP locale: nessun TLS,
    # quindi funziona anche senza bundle CA.
    echo "    Attendo che Next.js sia in ascolto su 127.0.0.1:3000..."
    READY=0
    for i in $(seq 1 40); do
        if ! kill -0 $PID_NEXT 2>/dev/null; then
            echo "    Next.js e' terminato durante l'avvio."
            break
        fi
        if curl -s -o /dev/null --max-time 3 http://127.0.0.1:3000/ 2>/dev/null; then
            READY=1
            break
        fi
        sleep 1
    done
    if [ "$READY" = "1" ]; then
        echo "    Next.js pronto (~$((i))s)."
    else
        echo "    ATTENZIONE: Next.js non ha risposto entro 40s."
        echo "    Procedo comunque: il link del tunnel sara' pubblicato."
    fi

    echo "[3/4] Avvio Cloudflare Tunnel (IPv4 + HTTP/2)..."
    rm -f tunnel.log
    cloudflared tunnel --edge-ip-version 4 --protocol http2 --url http://127.0.0.1:3000 --logfile tunnel.log > /dev/null 2>&1 &
    PID_TUNNEL=$!

    echo "Attendo generazione link Cloudflare..."
    LINK=""
    for i in $(seq 1 25); do
        if [ -f tunnel.log ]; then
            LINK=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' tunnel.log | head -n 1)
            if [ -n "$LINK" ]; then
                break
            fi
        fi
        sleep 1
    done

    if [ -n "$LINK" ]; then
        echo "=============================================="
        echo "  LINK TUNNEL: $LINK"
        echo "  Aggiorno https://luishighnest.github.io/next/ ..."
        if python update_redirect.py "$LINK"; then
            echo "=============================================="
            echo "  SITO ONLINE: https://luishighnest.github.io/next/"
            echo "=============================================="
        else
            echo "=============================================="
            echo "  ERRORE: redirect NON pubblicato."
            echo "  Il sito puo' mostrare un tunnel vecchio/morto."
            echo "  Controlla che github_token.txt esista e contenga un"
            echo "  token GitHub valido (permessi contents:write)."
            echo "  Tunnel attuale comunque raggiungibile qui: $LINK"
            echo "=============================================="
        fi
    else
        echo "Errore: link tunnel non trovato in tempo."
    fi

    # Resta in attesa del processo Next.js
    wait $PID_NEXT

    echo "Next.js e' terminato o andato in crash. Riavvio automatico tra 3 secondi..."
    sleep 3
done
