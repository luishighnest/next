#!/data/data/com.termux/files/usr/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

termux-wake-lock 2>/dev/null

while true; do
    echo "[1/3] Pulizia vecchi processi..."
    killall -9 node cloudflared 2>/dev/null
    sleep 1

    echo "[2/3] Avvio server Next.js (production mode)..."
    npm run start -- -H 0.0.0.0 -p 3000 > /dev/null 2>&1 &
    PID_NEXT=$!
    sleep 4

    echo "[3/3] Avvio Cloudflare Tunnel..."
    rm -f tunnel.log
    cloudflared tunnel --url http://127.0.0.1:3000 --logfile tunnel.log > /dev/null 2>&1 &
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
        python update_redirect.py "$LINK"
        echo "=============================================="
        echo "  SITO ONLINE FISSO: https://luishighnest.github.io/next/"
        echo "=============================================="
    else
        echo "Errore: link tunnel non trovato in tempo."
    fi

    # Resta in attesa del processo Next.js
    wait $PID_NEXT

    echo "Next.js e' terminato o andato in crash. Riavvio automatico tra 3 secondi..."
    sleep 3
done
