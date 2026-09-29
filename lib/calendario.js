// Calendario sport: legge il JSON aggregato di campipaolo/Livesoccer.
// I dati sono di terzi e non vengono copiati in questo repository: li leggiamo
// dalla sorgente originale, che rigenera il file ogni 3 ore.
const CALENDARIO_URL =
    "https://raw.githubusercontent.com/campipaolo/Livesoccer/master/output/calendario_sport.json";

// Stessa mappa di durata usata dalla wiki, per capire quando un evento e' finito.
const DURATA = {
    prove: 75,
    qualifiche: 75,
    sprint_quali: 60,
    sprint: 60,
    gara: 150,
    evento: 150
};

const ICONE = {
    "Oggi": "📅",
    "Motori": "🏎️",
    "Calcio": "⚽",
    "Tennis": "🎾",
    "Basket": "🏀",
    "Volley": "🏐",
    "Altri sport": "🏅"
};

export function durataMinuti(sessione) {
    return DURATA[sessione] || 135;
}

function parseInizio(ev) {
    const t = Date.parse(ev && ev.inizio);
    return Number.isNaN(t) ? null : t;
}

function fineEvento(ev) {
    const start = parseInizio(ev);
    if (start === null) return null;
    return start + durataMinuti(ev.sessione) * 60000;
}

// Un evento e' attivo se non e' ancora finito rispetto all'ora corrente.
export function eventoAttivo(ev, adesso) {
    const fine = fineEvento(ev);
    if (fine === null) return false;
    return adesso.getTime() <= fine;
}

export function eventoLive(ev, adesso) {
    const start = parseInizio(ev);
    if (start === null) return false;
    const now = adesso.getTime();
    return now >= start && now <= start + durataMinuti(ev.sessione) * 60000;
}

function eventiDiCartella(cart) {
    if (Array.isArray(cart.eventi)) return cart.eventi;
    if (Array.isArray(cart.sottocartelle)) {
        return cart.sottocartelle.flatMap((s) => (Array.isArray(s.eventi) ? s.eventi : []));
    }
    return [];
}

export function iconaCategoria(nome) {
    return ICONE[nome] || "🏅";
}

export function categorieConConteggio(json, adesso) {
    const cartelle = (json && json.cartelle) || [];
    return cartelle.map((c) => {
        const attivi = eventiDiCartella(c).filter((ev) => eventoAttivo(ev, adesso)).length;
        return { nome: c.nome, icona: iconaCategoria(c.nome), attivi, totale: c.totale || eventiDiCartella(c).length };
    });
}

export function contaLive(json, adesso) {
    const cartelle = (json && json.cartelle) || [];
    let live = 0;
    for (const cart of cartelle) {
        for (const ev of eventiDiCartella(cart)) {
            if (eventoLive(ev, adesso)) live++;
        }
    }
    return live;
}

export function totaleAttivi(json, adesso) {
    const cartelle = (json && json.cartelle) || [];
    return cartelle
        .filter((c) => c.nome !== "Oggi")
        .reduce((n, c) => n + eventiDiCartella(c).filter((ev) => eventoAttivo(ev, adesso)).length, 0);
}

export function raggruppaPerSottocartella(cart, adesso) {
    if (!cart) return [];
    if (Array.isArray(cart.eventi)) {
        return [{ nome: cart.nome, eventi: cart.eventi }];
    }
    return (cart.sottocartelle || []).map((s) => ({
        nome: s.nome,
        eventi: [...(s.eventi || [])].sort((a, b) => (parseInizio(a) || 0) - (parseInizio(b) || 0))
    }));
}

export async function caricaCalendario() {
    const res = await fetch(CALENDARIO_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.cartelle)) throw new Error("Formato calendario non riconosciuto");
    return json;
}
