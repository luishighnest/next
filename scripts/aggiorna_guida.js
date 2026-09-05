const fs = require('fs');
const path = require('path');

// Mappa completa di TUTTI i canali italiani (Sky Sport, Sky Cinema, Sky Intrattenimento, Sky Bambini e Digitale Terrestre)
const CHANNELS_MAP = [
    // --- SKY SPORT (Locandine HD) ---
    { name: "Sky Sport Uno", slug: "sky-sport-uno", cat: "Sport" },
    { name: "Sky Sport 24", slug: "sky-sport-24", cat: "Sport" },
    { name: "Sky Sport Calcio", slug: "sky-sport-calcio", cat: "Sport" },
    { name: "Sky Sport Tennis", slug: "sky-sport-tennis", cat: "Sport" },
    { name: "Sky Sport F1", slug: "sky-sport-f1-hd", cat: "Sport" },
    { name: "Sky Sport MotoGP", slug: "sky-sport-motogp", cat: "Sport" },
    { name: "Sky Sport Arena", slug: "sky-sport-arena", cat: "Sport" },
    { name: "Sky Sport Max", slug: "sky-sport-max", cat: "Sport" },
    { name: "Sky Sport Golf", slug: "sky-sport-golf", cat: "Sport" },
    { name: "Sky Sport Basket", slug: "sky-sport-basket", cat: "Sport" },
    { name: "Sky Sport Mix", slug: "sky-sport-mix", cat: "Sport" },
    { name: "Sky Sport Legend", slug: "sky-sport-legend", cat: "Sport" },
    { name: "Sky Sport 4K", slug: "sky-sport-4k", cat: "Sport" },
    { name: "Sky Sport 251", slug: "sky-sport-hd-1", cat: "Sport" },
    { name: "Sky Sport 252", slug: "sky-sport-hd-2", cat: "Sport" },
    { name: "Sky Sport 253", slug: "sky-sport-hd-3", cat: "Sport" },
    { name: "Sky Sport 254", slug: "sky-sport-hd-4", cat: "Sport" },
    { name: "Sky Sport 255", slug: "sky-sport-hd-5", cat: "Sport" },
    { name: "Sky Sport 256", slug: "sky-sport-hd-6", cat: "Sport" },
    { name: "Sky Sport 257", slug: "sky-sport-hd-7", cat: "Sport" },
    { name: "Sky Sport 258", slug: "sky-sport-hd-8", cat: "Sport" },
    { name: "Sky Sport 259", slug: "sky-sport-hd-9", cat: "Sport" },
    { name: "SuperTennis", slug: "supertennis", cat: "Sport" },
    { name: "Sportitalia", slug: "sportitalia", cat: "Sport" },
    { name: "Rai Sport", slug: "rai-sport", cat: "Sport" },
    { name: "Rai Sport + HD", slug: "rai-sport", cat: "Sport" },
    
    // --- SKY INTRATTENIMENTO & SERIE TV (Locandine HD) ---
    { name: "Sky Uno", slug: "sky-uno-hd", cat: "Intrattenimento" },
    { name: "Sky Uno +", slug: "sky-uno-hd", cat: "Intrattenimento", offsetHour: 1 },
    { name: "Sky Uno +1", slug: "sky-uno-hd", cat: "Intrattenimento", offsetHour: 1 },
    { name: "Sky Atlantic", slug: "sky-atlantic-hd", cat: "Intrattenimento" },
    { name: "Sky Serie", slug: "sky-serie-hd", cat: "Intrattenimento" },
    { name: "Sky Investigation", slug: "sky-investigation-hd", cat: "Intrattenimento" },
    { name: "Sky Documentaries", slug: "sky-documentaries-hd", cat: "Intrattenimento" },
    { name: "Sky Nature", slug: "sky-nature-hd", cat: "Intrattenimento" },
    { name: "Sky Crime", slug: "sky-crime", cat: "Intrattenimento" },
    { name: "Sky Arte", slug: "sky-arte-hd", cat: "Intrattenimento" },
    { name: "Sky Adventure", slug: "sky-adventure", cat: "Intrattenimento" },
    { name: "Sky Collection", slug: "sky-collection", cat: "Intrattenimento" },
    { name: "Sky TG24", slug: "sky-tg24", cat: "Intrattenimento" },
    { name: "Sky TG 24", slug: "sky-tg24", cat: "Intrattenimento" },
    { name: "History Channel", slug: "history-channel", cat: "Intrattenimento" },
    { name: "History", slug: "history-channel", cat: "Intrattenimento" },
    { name: "Sky History", slug: "history-channel", cat: "Intrattenimento" },
    { name: "Comedy Central", slug: "comedy-central", cat: "Intrattenimento" },
    { name: "Sky Comedy Central", slug: "comedy-central", cat: "Intrattenimento" },
    { name: "MTV", slug: "mtv-hd", cat: "Intrattenimento" },
    { name: "Sky Mtv", slug: "mtv-hd", cat: "Intrattenimento" },

    // --- SKY CINEMA (Locandine HD) ---
    { name: "Sky Cinema Uno", slug: "sky-cinema-uno-hd", cat: "Cinema" },
    { name: "Sky Cinema Due", slug: "sky-cinema-due-hd", cat: "Cinema" },
    { name: "Sky Cinema Collection", slug: "sky-cinema-collection-hd", cat: "Cinema" },
    { name: "Sky Cinema Family", slug: "sky-cinema-family-hd", cat: "Cinema" },
    { name: "Sky Cinema Action", slug: "sky-cinema-action-hd", cat: "Cinema" },
    { name: "Sky Cinema Suspense", slug: "sky-cinema-suspense-hd", cat: "Cinema" },
    { name: "Sky Cinema Romance", slug: "sky-cinema-romance-hd", cat: "Cinema" },
    { name: "Sky Cinema Drama", slug: "sky-cinema-drama-hd", cat: "Cinema" },
    { name: "Sky Cinema Comedy", slug: "sky-cinema-comedy-hd", cat: "Cinema" },
    { name: "Sky Cinema Stories", slug: "sky-cinema-due-hd", cat: "Cinema" },

    // --- SKY BAMBINI & RAGAZZI (Locandine HD) ---
    { name: "Cartoon Network", slug: "cartoon-network", cat: "Bambini" },
    { name: "Boomerang", slug: "boomerang", cat: "Bambini" },
    { name: "Deakids", slug: "deakids", cat: "Bambini" },
    { name: "DeAKids", slug: "deakids", cat: "Bambini" },
    { name: "Nickelodeon", slug: "nickelodeon", cat: "Bambini" },
    { name: "Nick Jr.", slug: "nick-junior", cat: "Bambini" },
    { name: "Nick Jr", slug: "nick-junior", cat: "Bambini" },
    { name: "Super!", slug: "super!", cat: "Bambini" },
    { name: "K2", slug: "k2", cat: "Bambini" },
    { name: "Frisbee", slug: "frisbee", cat: "Bambini" },
    { name: "Rai Yoyo", slug: "rai-yoyo", cat: "Bambini" },
    { name: "Rai yoyo", slug: "rai-yoyo", cat: "Bambini" },
    { name: "Rai Gulp", slug: "rai-gulp", cat: "Bambini" },
    { name: "Rai Gulp HD", slug: "rai-gulp", cat: "Bambini" },
    
    // --- DIGITALE TERRESTRE NAZIONALE COMPLETO (Locandine HD) ---
    { name: "Rai 1", slug: "rai-1", cat: "Nazionale" },
    { name: "Rai 1 HD", slug: "rai-1", cat: "Nazionale" },
    { name: "Rai 2", slug: "rai-2", cat: "Nazionale" },
    { name: "Rai 2 HD", slug: "rai-2", cat: "Nazionale" },
    { name: "Rai 3", slug: "rai-3", cat: "Nazionale" },
    { name: "Rai 3 HD", slug: "rai-3", cat: "Nazionale" },
    { name: "Rete 4", slug: "rete4", cat: "Nazionale" },
    { name: "Rete 4 HD", slug: "rete4", cat: "Nazionale" },
    { name: "Canale 5", slug: "canale-5", cat: "Nazionale" },
    { name: "Canale 5 HD", slug: "canale-5", cat: "Nazionale" },
    { name: "Italia 1", slug: "italia-uno", cat: "Nazionale" },
    { name: "Italia 1 HD", slug: "italia-uno", cat: "Nazionale" },
    { name: "LA7", slug: "la7", cat: "Nazionale" },
    { name: "La 7 HD", slug: "la7", cat: "Nazionale" },
    { name: "LA7d", slug: "la7", cat: "Nazionale" },
    { name: "LA7d HD", slug: "la7", cat: "Nazionale" },
    { name: "La 7d HD", slug: "la7", cat: "Nazionale" },
    { name: "TV8", slug: "tv8", cat: "Nazionale" },
    { name: "Nove", slug: "nove", cat: "Nazionale" },
    { name: "NOVE", slug: "nove", cat: "Nazionale" },
    { name: "20 Mediaset", slug: "canale-20", cat: "Nazionale" },
    { name: "Mediaset 20", slug: "canale-20", cat: "Nazionale" },
    { name: "Rai 4", slug: "rai-4", cat: "Nazionale" },
    { name: "Rai 4 HD", slug: "rai-4", cat: "Nazionale" },
    { name: "Iris", slug: "iris", cat: "Nazionale" },
    { name: "IRIS HD", slug: "iris", cat: "Nazionale" },
    { name: "Rai 5", slug: "rai-5", cat: "Nazionale" },
    { name: "Rai Movie", slug: "rai-movie", cat: "Nazionale" },
    { name: "Rai Movie HD", slug: "rai-movie", cat: "Nazionale" },
    { name: "Rai Premium", slug: "rai-premium", cat: "Nazionale" },
    { name: "TwentySeven", slug: "mediaset-27", cat: "Nazionale" },
    { name: "27 TwentySeven", slug: "mediaset-27", cat: "Nazionale" },
    { name: "La5", slug: "la-5", cat: "Nazionale" },
    { name: "La 5 HD", slug: "la-5", cat: "Nazionale" },
    { name: "Mediaset Extra", slug: "mediaset-extra", cat: "Nazionale" },
    { name: "Mediaset Extra HD", slug: "mediaset-extra", cat: "Nazionale" },
    { name: "Focus", slug: "focus", cat: "Nazionale" },
    { name: "Focus HD", slug: "focus", cat: "Nazionale" },
    { name: "Top Crime", slug: "topcrime", cat: "Nazionale" },
    { name: "Cine34 HD", slug: "cine34", cat: "Nazionale" },
    { name: "Italia 2", slug: "mediaset-italia-due", cat: "Nazionale" },
    { name: "Italia 2 HD", slug: "mediaset-italia-due", cat: "Nazionale" },
    { name: "TGCOM24", slug: "tgcom24", cat: "Nazionale" },
    { name: "Rai News", slug: "rai-news-24", cat: "Nazionale" },
    { name: "Rai News 24", slug: "rai-news-24", cat: "Nazionale" },
    { name: "Rai News 24 HD", slug: "rai-news-24", cat: "Nazionale" },
    { name: "Rai Storia", slug: "rai-storia", cat: "Nazionale" },
    { name: "Rai Storia HD", slug: "rai-storia", cat: "Nazionale" },
    { name: "Rai Scuola", slug: "rai-scuola", cat: "Nazionale" },
    { name: "Rai Scuola HD", slug: "rai-scuola", cat: "Nazionale" },
    { name: "Motor Trend", slug: "motor-trend", cat: "Nazionale" },
    { name: "Motor Trend HD", slug: "motor-trend", cat: "Nazionale" },
    { name: "Giallo", slug: "giallo", cat: "Nazionale" },
    { name: "GIALLO HD", slug: "giallo", cat: "Nazionale" },
    { name: "HGTV", slug: "home-and-garden-tv", cat: "Nazionale" },
    { name: "HGTV Italia HD", slug: "home-and-garden-tv", cat: "Nazionale" },
    { name: "Food Network", slug: "food-network", cat: "Nazionale" },
    { name: "Food Network HD", slug: "food-network", cat: "Nazionale" },
    { name: "Real Time", slug: "real-time", cat: "Nazionale" },
    { name: "Real Time HD", slug: "real-time", cat: "Nazionale" },
    { name: "DMAX", slug: "dmax", cat: "Nazionale" },
    { name: "DMAX HD", slug: "dmax", cat: "Nazionale" },
    { name: "Cielo", slug: "cielo", cat: "Nazionale" },
    { name: "DeeJay TV HD", slug: "deejay-tv", cat: "Nazionale" },
    { name: "RSI La1", slug: "rsi-la1", cat: "Nazionale" },
    { name: "RSI LA 1 HD", slug: "rsi-la1", cat: "Nazionale" },
    { name: "RSI La2", slug: "rsi-la2", cat: "Nazionale" },
    { name: "RSI LA 2 HD", slug: "rsi-la2", cat: "Nazionale" }
];

async function fetchPage(url) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
            },
            signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) return null;
        return await res.text();
    } catch (e) {
        return null;
    }
}

/**
 * Estrae l'array dei programmi del canale dal Flight stream di Next.js (guidatv.org).
 * I programmi hanno data/ora ISO reali (UTC) che vengono convertiti all'orario esatto di Roma (UTC+2 estate / UTC+1 inverno).
 */
function extractChannelSchedule(html, offsetHour = 0) {
    if (!html) return [];
    const progKey = '\\\"prog\\\":[';
    const startIdx = html.indexOf(progKey);
    if (startIdx === -1) return [];

    const arrayStart = startIdx + progKey.length - 1;
    let depth = 0;
    let inStr = false;
    let escape = false;
    let arrayEnd = -1;

    for (let i = arrayStart; i < html.length; i++) {
        const c = html[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (c === '\\') {
            escape = true;
            continue;
        }
        if (c === '"') {
            inStr = !inStr;
            continue;
        }
        if (!inStr) {
            if (c === '[') depth++;
            else if (c === ']') {
                depth--;
                if (depth === 0) {
                    arrayEnd = i + 1;
                    break;
                }
            }
        }
    }

    if (arrayEnd === -1) return [];

    const rawArray = html.slice(arrayStart, arrayEnd);
    const unescaped = rawArray.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    
    let progs;
    try {
        progs = JSON.parse(unescaped);
    } catch (e) {
        return [];
    }

    const list = [];
    const seen = new Set();

    for (const p of progs) {
        if (!p || !p.title || !p.inizio) continue;
        let title = (p.title || "")
            .replace(/&#x27;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/\\'/g, "'")
            .trim();
            
        if (title.toLowerCase().includes('programmazione non disponibile') || !title) continue;

        const dStart = new Date(p.inizio);
        const dEnd = p.fine ? new Date(p.fine) : null;

        // Orario locale esatto italiano (Europe/Rome)
        let startStr = dStart.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
        let endStr = dEnd ? dEnd.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }) : '';

        if (offsetHour) {
            const [h, min] = startStr.split(':').map(Number);
            startStr = String((h + offsetHour) % 24).padStart(2, '0') + ':' + String(min).padStart(2, '0');
            if (endStr) {
                const [eh, emin] = endStr.split(':').map(Number);
                endStr = String((eh + offsetHour) % 24).padStart(2, '0') + ':' + String(emin).padStart(2, '0');
            }
        }

        const img = (p.image || "").replace(/\\/g, '').trim();
        const desc = (p.description || "").replace(/\\/g, '').trim();

        if (!seen.has(startStr)) {
            seen.add(startStr);
            list.push({
                ora: startStr,
                fine: endStr,
                titolo: title,
                descrizione: desc,
                immagine: img
            });
        }
    }

    list.sort((a, b) => a.ora.localeCompare(b.ora));
    return list;
}

async function scrapeChannel24H(ch) {
    // Interroga la pagina ufficiale del canale per la giornata odierna
    const url = `https://www.guidatv.org/canali/${ch.slug}`;
    const html = await fetchPage(url);
    if (!html) return null;

    const list = extractChannelSchedule(html, ch.offsetHour || 0);
    if (list.length === 0) return null;

    return {
        canale: ch.name,
        categoria: ch.cat,
        programmi: list
    };
}

async function syncToUpstash(data) {
    const url = (process.env.UPSTASH_REDIS_REST_URL || "https://ace-seal-162556.upstash.io").trim();
    const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAAnr8AAIgcDEyZjRkYjEwYmUzZDY0M2RhYjZkNjhmMDFjNGVkMjVmYw").trim();
    if (!url || !token) return;
    try {
        console.log("Sincronizzazione Guida TV su Upstash Redis Cloud...");
        const res = await fetch(`${url}/set/stream:guida`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            console.log("[OK] Guida TV sincronizzata su Upstash Redis Cloud!");
        } else {
            console.warn("[WARN] Risposta Upstash non OK:", await res.text());
        }
    } catch (e) {
        console.warn("[WARN] Errore Upstash sync:", e.message);
    }
}

async function runScrape24H() {
    const today = new Date();
    const dateLabel = today.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
    console.log(`[${new Date().toLocaleTimeString()}] Avvio scraping Guida TV 24H (00:00 - 23:59) da guidatv.org per la data: ${dateLabel}...`);
    
    const results = [];
    // Elaborazione a blocchi di 6 canali paralleli per velocita e rispetto del rate-limit
    const chunkSize = 6;
    for (let i = 0; i < CHANNELS_MAP.length; i += chunkSize) {
        const chunk = CHANNELS_MAP.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(ch => scrapeChannel24H(ch)));
        
        chunkResults.forEach((data, idx) => {
            const ch = chunk[idx];
            if (data && data.programmi.length > 0) {
                const withImg = data.programmi.filter(p => p.immagine && p.immagine !== '').length;
                console.log(`[OK] ${ch.name.padEnd(24)} -> ${String(data.programmi.length).padStart(2)} programmi (${withImg} locandine HD)`);
                results.push(data);
            } else {
                console.log(`[--] ${ch.name.padEnd(24)} -> Non disponibile`);
            }
        });
    }
    
    const targetFile = path.join(__dirname, '..', 'public', 'guida_tv_sky.json');
    fs.writeFileSync(targetFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n[OK] Guida TV 24H salvata con successo in: ${targetFile}`);
    await syncToUpstash(results);
    console.log(`[OK] Totale canali salvati: ${results.length}/${CHANNELS_MAP.length}`);
}

runScrape24H().catch(err => {
    console.error("Errore critico durante lo scraping:", err);
    process.exit(1);
});
