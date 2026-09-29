"""Pubblica il link del tunnel Cloudflare sulla pagina GitHub Pages del progetto.

GitHub Pages per https://luishighnest.github.io/next/ serve il branch `gh-pages`,
NON `main`: per questo il file va committato e pushato su `gh-pages`.
Il link viene scritto direttamente dentro la pagina, senza dipendere dalla
homepage del repo ne' da chiamate all'API GitHub dal browser.

Uso:  python update_redirect.py https://xxxx.trycloudflare.com
Esito: 0 = pubblicato, 1 = errore (-nessun tunnel pubblicato).
"""
import html
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
TOKEN_FILE = BASE_DIR / "github_token.txt"
REPO = "luishighnest/next"
PAGES_BRANCH = "gh-pages"

TEMPLATE = """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NMDZ - Live TV &amp; Sport</title>
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<style>
body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0b0f14;
    color: #e2e8f0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 24px;
    text-align: center;
}}
.spinner {{
    width: 44px;
    height: 44px;
    border: 4px solid rgba(0, 229, 155, 0.15);
    border-top: 4px solid #00e59b;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 20px;
}}
.spinner.hidden {{ display: none; }}
@keyframes spin {{
    0% {{ transform: rotate(0deg); }}
    100% {{ transform: rotate(360deg); }}
}}
h2 {{ margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 600; }}
p {{ margin: 0; font-size: 0.95rem; color: #94a3b8; }}
a {{ color: #00e59b; text-decoration: none; font-weight: 500; }}
a:hover {{ text-decoration: underline; }}
.box {{
    margin-top: 22px;
    padding: 16px 20px;
    border: 1px solid #1f2937;
    border-radius: 12px;
    background: #111827;
    max-width: 560px;
}}
.box code {{
    display: block;
    margin-top: 8px;
    color: #00e59b;
    font-size: 0.85rem;
    word-break: break-all;
}}
.hidden {{ display: none; }}
</style>
</head>
<body>

<div class="spinner" id="spinner"></div>
<h2 id="title">Connessione a NMDZ...</h2>
<p id="desc">Verifica del tunnel in corso...</p>

<div class="box hidden" id="errBox">
    <h2 style="color:#f87171;font-size:1.05rem;">Tunnel non raggiungibile</h2>
    <p style="margin-top:10px;line-height:1.6;">
        Il server sul telefono non risponde. Riavvia <code>start_termux.sh</code>
        su Termux e attendi la riga <strong>SITO ONLINE</strong>.
    </p>
    <code id="errLink">{link}</code>
    <p style="margin-top:14px;">
        <a id="manualLink" href="{link}">Prova comunque ad aprire il tunnel</a>
    </p>
</div>

<script>
// Il link e' scritto qui dentro dal Termux: nessuna chiamata API, nessun rate limit.
var DEST = "{link}";
var tentativi = 0;

async function tunnelRisponde() {{
    try {{
        // no-cors: non leggiamo il corpo, ci basta sapere che il server risponde.
        await fetch(DEST + "/favicon.ico?probe=" + Date.now(), {{
            mode: "no-cors",
            cache: "no-store"
        }});
        return true;
    }} catch (e) {{
        return false;
    }}
}}

async function doRedirect() {{
    tentativi++;
    document.getElementById("desc").textContent =
        "Tentativo " + tentativi + " di 6...";

    if (await tunnelRisponde()) {{
        document.getElementById("title").textContent = "Connessione riuscita";
        document.getElementById("desc").textContent = "Apertura del sito in corso...";
        window.location.replace(DEST);
        return;
    }}

    if (tentativi >= 6) {{
        document.getElementById("spinner").classList.add("hidden");
        document.getElementById("title").textContent = "Connessione non riuscita";
        document.getElementById("errBox").classList.remove("hidden");
        return;
    }}

    setTimeout(doRedirect, 2500);
}}

doRedirect();
</script>
</body>
</html>"""


def run(args, cwd):
    return subprocess.run(
        args, cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )


def fail(msg, code=1):
    print(f"[redirect] ERRORE: {msg}")
    return code


def build_page(link):
    return TEMPLATE.format(link=html.escape(link, quote=True))


def probe(url, timeout=8):
    """Verifica se un URL risponde. Restituisce (ok, dettaglio).

    Usa curl quando disponibile: su Termux il bundle CA di Python spesso manca
    (niente certifi) e ogni chiamata HTTPS con urllib fallisce con
    'certificate verify failed' anche se il sito e' perfettamente funzionante.
    Se curl non c'e', ripiega su urllib con verifica TLS disattivata, dato che
    qui non verifichiamo il certificato ma solo se qualcosa risponde.
    """
    if shutil.which("curl"):
        r = subprocess.run(
            ["curl", "-sS", "-o", "/dev/null", "-L", "--max-time", str(timeout),
             "-w", "%{http_code}", url],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        codice = (r.stdout or "").strip()[-3:]
        if codice.isdigit() and codice != "000":
            return True, f"HTTP {codice}"
        return False, (r.stderr or "").strip()[:80] or "nessuna risposta"

    import ssl
    ctx = ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(url, timeout=timeout, context=ctx) as resp:
            return True, f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        # 401/403/404/5xx dal tunnel: il server Next.js risponde, quindi va bene.
        return True, f"HTTP {e.code}"
    except Exception as e:
        return False, str(e)[:80]


def check_tunnel(link, tentativi=3, attesa=2):
    """Verifica CONSULTIVA del tunnel: serve a informare, non a bloccare.

    Non bloccare e' deliberato: l'unico modo per raggiungere il sito e' questo
    link, quindi pubblicare quello appena creato e' sempre meglio che lasciare
    puntare alla pagina a un tunnel vecchio e morto. Se il check fallisce si
    avvisa e si pubblica lo stesso, e la pagina di redirect riprova dal lato
    del browser (che ha un percorso di rete diverso rispetto al telefono).
    """
    for tentativo in range(1, tentativi + 1):
        ok, dettaglio = probe(link + "/favicon.ico?probe=" + str(tentativo))
        if ok:
            print(f"[redirect] Tunnel raggiungibile dal telefono ({dettaglio}).")
            return True
        print(f"[redirect] Prova {tentativo}/{tentativi}: {dettaglio}")
        if tentativo < tentativi:
            time.sleep(attesa)
    print("[redirect] ATTENZIONE: non riesco a verificare il tunnel dal telefono.")
    print("[redirect] Procedo con la pubblicazione: se il tunnel non e' ancora")
    print("[redirect] pronto si attivera' entro pochi secondi.")
    return False


def read_token():
    if not TOKEN_FILE.exists():
        return None
    token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    return token or None


def update_homepage(token, link):
    """Specchio secondario: tiene aggiornata la homepage del repo.
    Non e' piu' necessario al redirect, ma utile come riferimento."""
    try:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}",
            data=json.dumps({"homepage": link}).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "Next-Sync",
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            method="PATCH",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 204):
                print(f"[redirect] Homepage del repo aggiornata: {link}")
                return True
    except Exception as e:
        print(f"[redirect] (info) homepage non aggiornata: {e}")
    return False


def publish_to_pages(token, link):
    """Scrive index.html nel branch `gh-pages` tramite worktree temporanea,
    cosi il worktree principale (su main) non viene toccato."""
    repo_url = f"https://x-access-token:{token}@github.com/{REPO}.git"
    worktree = Path(tempfile.mkdtemp(prefix="ghpages-"))
    try:
        r = run(["git", "fetch", repo_url, f"{PAGES_BRANCH}:{PAGES_BRANCH}"], BASE_DIR)
        if r.returncode != 0:
            return fail(f"fetch di {PAGES_BRANCH} fallito: {r.stdout.strip()}")

        r = run(["git", "worktree", "add", "--detach", str(worktree), PAGES_BRANCH], BASE_DIR)
        if r.returncode != 0:
            return fail(f"worktree non creato: {r.stdout.strip()}")

        target = worktree / "index.html"
        nuova = build_page(link)
        if target.exists() and target.read_text(encoding="utf-8") == nuova:
            print("[redirect] Pagina gia' aggiornata, nessun commit necessario.")
            return 0

        target.write_text(nuova, encoding="utf-8")

        # La pagina di GitHub Pages e' statica: nessun requisito di root.
        run(["git", "config", "user.name", "Termux Auto-Sync"], worktree)
        run(["git", "config", "user.email", "termux-sync@users.noreply.github.com"], worktree)
        r = run(["git", "add", "index.html"], worktree)
        if r.returncode != 0:
            return fail(f"git add fallito: {r.stdout.strip()}")
        r = run(["git", "commit", "-m", f"redirect: tunnel {link}"], worktree)
        if r.returncode != 0:
            return fail(f"git commit fallito: {r.stdout.strip()}")

        # 3 tentativi: main avanza spesso (cron Guida TV) e il push puo' essere
        # respinto. Ad ogni tentativo si riallinea gh-pages su origin.
        for tentativo in range(1, 4):
            r = run(["git", "push", repo_url, f"HEAD:{PAGES_BRANCH}"], worktree)
            if r.returncode == 0:
                print(f"[redirect] Pagina pubblicata su {PAGES_BRANCH}: {link}")
                return 0
            print(f"[redirect] Push respinto (tentativo {tentativo}/3), riallineo...")
            run(["git", "fetch", repo_url, PAGES_BRANCH], worktree)
            r = run(["git", "reset", "--hard", "FETCH_HEAD"], worktree)
            if r.returncode != 0:
                return fail(f"reset su gh-pages fallito: {r.stdout.strip()}")
            target.write_text(build_page(link), encoding="utf-8")
            run(["git", "add", "index.html"], worktree)
            run(["git", "commit", "-m", f"redirect: tunnel {link}"], worktree)

        return fail("push a gh-pages fallito dopo 3 tentativi")
    finally:
        run(["git", "worktree", "remove", "--force", str(worktree)], BASE_DIR)
        run(["git", "worktree", "prune"], BASE_DIR)
        shutil.rmtree(worktree, ignore_errors=True)


def main():
    if len(sys.argv) < 2:
        return fail("manca il link del tunnel come argomento")

    link = sys.argv[1].strip().rstrip("/")
    if not link.startswith("https://") or ".trycloudflare.com" not in link:
        return fail(f"link non valido: {link}")

    token = read_token()
    if not token:
        return fail(
            "github_token.txt non trovato o vuoto. "
            "Create il file con un token GitHub (permessi contents:write) "
            "nella cartella del progetto."
        )

    print(f"[redirect] Verifico il tunnel {link}...")
    check_tunnel(link)

    update_homepage(token, link)
    return publish_to_pages(token, link)


if __name__ == "__main__":
    sys.exit(main())
