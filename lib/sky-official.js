/**
 * Modulo per il recupero diretto dei canali e dei palinsesti ufficiali di Sky Italia
 * tramite l'API ufficiale (apid.sky.it).
 * 
 * Tutte le copertine per i canali Sky sono immagini JPEG WIDESCREEN native a 1920x1080 (HERO_CLEAN_WIDE / background)
 * fornite direttamente dal CDN ufficiale di Sky (ethaneurope.it.imageservice.sky.com).
 */

const SKY_API_BASE = "https://apid.sky.it/gtv/v1";
const SKY_IMAGE_CDN = "https://ethaneurope.it.imageservice.sky.com";

// Mappatura precisa tra i nomi dei canali Sky usati nell'applicazione e gli ID ufficiali Sky DTH
const SKY_OFFICIAL_CHANNELS = [
    // --- SPORT & CALCIO ---
    { id: 9097, name: "Sky Sport Uno", cat: "Sport" },
    { id: 9094, name: "Sky Sport 24", cat: "Sport" },
    { id: 9113, name: "Sky Sport Calcio", cat: "Sport" },
    { id: 11237, name: "Sky Sport Tennis", cat: "Sport" },
    { id: 9096, name: "Sky Sport F1", cat: "Sport" },
    { id: 9102, name: "Sky Sport MotoGP", cat: "Sport" },
    { id: 9093, name: "Sky Sport Arena", cat: "Sport" },
    { id: 9103, name: "Sky Sport Max", cat: "Sport" },
    { id: 10254, name: "Sky Sport Golf", cat: "Sport" },
    { id: 9116, name: "Sky Sport Basket", cat: "Sport" },
    { id: 11909, name: "Sky Sport Mix", cat: "Sport" },
    { id: 11910, name: "Sky Sport Legend", cat: "Sport" },
    { id: 10013, name: "Sky Sport 4K", cat: "Sport" },
    { id: 11497, name: "Sky Sport 251", cat: "Sport" },
    { id: 11496, name: "Sky Sport 252", cat: "Sport" },
    { id: 11494, name: "Sky Sport 253", cat: "Sport" },
    { id: 11490, name: "Sky Sport 254", cat: "Sport" },
    { id: 11491, name: "Sky Sport 255", cat: "Sport" },
    { id: 11492, name: "Sky Sport 256", cat: "Sport" },
    { id: 11386, name: "Sky Sport 257", cat: "Sport" },
    { id: 9046, name: "Sky Sport 258", cat: "Sport" },
    { id: 8613, name: "Sky Sport 259", cat: "Sport" },

    // --- INTRATTENIMENTO, SERIE & DOCUMENTARI ---
    { id: 9115, name: "Sky Uno", cat: "Intrattenimento" },
    { id: 9095, name: "Sky Atlantic", cat: "Intrattenimento" },
    { id: 11244, name: "Sky Serie", cat: "Intrattenimento" },
    { id: 11246, name: "Sky Investigation", cat: "Intrattenimento" },
    { id: 11239, name: "Sky Documentaries", cat: "Intrattenimento" },
    { id: 11242, name: "Sky Nature", cat: "Intrattenimento" },
    { id: 8336, name: "Sky Crime", cat: "Intrattenimento" },
    { id: 8473, name: "Sky Arte", cat: "Intrattenimento" },
    { id: 11889, name: "Sky Adventure", cat: "Intrattenimento" },
    { id: 9117, name: "Sky TG24", cat: "Intrattenimento" },
    { id: 9101, name: "History Channel", cat: "Intrattenimento" },
    { id: 318, name: "Comedy Central", cat: "Intrattenimento" },
    { id: 9195, name: "MTV", cat: "Intrattenimento" },

    // --- SKY CINEMA ---
    { id: 9044, name: "Sky Cinema Uno", cat: "Cinema" },
    { id: 9034, name: "Sky Cinema Due", cat: "Cinema" },
    { id: 9034, name: "Sky Cinema Stories", cat: "Cinema" },
    { id: 9047, name: "Sky Cinema Collection", cat: "Cinema" },
    { id: 9042, name: "Sky Cinema Family", cat: "Cinema" },
    { id: 9050, name: "Sky Cinema Action", cat: "Cinema" },
    { id: 10515, name: "Sky Cinema Suspense", cat: "Cinema" },
    { id: 9055, name: "Sky Cinema Romance", cat: "Cinema" },
    { id: 10518, name: "Sky Cinema Drama", cat: "Cinema" },
    { id: 9039, name: "Sky Cinema Comedy", cat: "Cinema" },
    { id: 9037, name: "Sky Cinema Uno +24", cat: "Cinema" },

    // --- BAMBINI ---
    { id: 9693, name: "Cartoon Network", cat: "Bambini" },
    { id: 472, name: "Boomerang", cat: "Bambini" },
    { id: 460, name: "DeAKids", cat: "Bambini" },
    { id: 320, name: "Nickelodeon", cat: "Bambini" },
    { id: 461, name: "Nick Jr", cat: "Bambini" },
    { id: 6460, name: "Super!", cat: "Bambini" }
];

/**
 * Estrae l'immagine ufficiale migliore (preferendo 1920x1080 background / HERO_CLEAN_WIDE)
 */
function extractBestSkyImage(event) {
    if (!event || !event.content || !Array.isArray(event.content.imagesMap)) {
        return "";
    }

    const map = event.content.imagesMap;

    // 1. Cerca prima il background o hero wide
    const bgItem = map.find(i => i.key === "background" || i.key === "scene_key_art" || i.key === "scene");
    if (bgItem && bgItem.img && bgItem.img.url) {
        let u = bgItem.img.url;
        if (!u.startsWith("http")) u = `${SKY_IMAGE_CDN}${u}`;
        return u;
    }

    // 2. Se non presente, cerca cover o locandina
    const coverItem = map.find(i => i.key === "cover" || i.key === "cover_clean" || i.key === "cover_23");
    if (coverItem && coverItem.img && coverItem.img.url) {
        let u = coverItem.img.url;
        if (!u.startsWith("http")) u = `${SKY_IMAGE_CDN}${u}`;
        return u;
    }

    return "";
}

/**
 * Converte data ISO UTC in orario HH:MM italiano (Europe/Rome)
 */
function toItalianTimeStr(isoString) {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString("it-IT", {
            timeZone: "Europe/Rome",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    } catch(e) {
        return "";
    }
}

/**
 * Scarica i palinsesti di tutti i canali Sky ufficiali in parallelo direttamente da apid.sky.it
 */
export async function fetchOfficialSkyChannels24H() {
    console.log("[SKY-OFFICIAL] Avvio download palinsesto 24H per tutti i canali Sky direttamente da apid.sky.it...");

    const now = new Date();
    // Intervallo 24H: dall'inizio della giornata odierna alla fine
    const fromStr = now.toISOString().slice(0, 10) + "T00:00:00Z";
    const toStr = now.toISOString().slice(0, 10) + "T23:59:59Z";

    // Scarichiamo in blocchi di canali (fino a 15 canali per richiesta per massima velocita e zero timeout)
    const channelIds = SKY_OFFICIAL_CHANNELS.map(c => c.id);
    const chunkSize = 12;
    const allEvents = [];

    for (let i = 0; i < channelIds.length; i += chunkSize) {
        const idsChunk = channelIds.slice(i, i + chunkSize);
        const url = `${SKY_API_BASE}/events?from=${fromStr}&to=${toStr}&pageSize=999&pageNum=0&env=DTH&channels=${idsChunk.join(",")}`;

        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                    "Accept": "application/json"
                },
                signal: AbortSignal.timeout(12000)
            });

            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.events)) {
                    allEvents.push(...data.events);
                }
            } else {
                console.warn(`[SKY-OFFICIAL] Errore richiesta chunk Sky (${res.status}):`, await res.text());
            }
        } catch (err) {
            console.warn(`[SKY-OFFICIAL] Errore di rete chunk Sky:`, err.message);
        }
    }

    console.log(`[SKY-OFFICIAL] Ricevuti in totale ${allEvents.length} eventi ufficiali da Sky!`);

    // Raggruppa gli eventi per canale
    const eventsByChannelId = new Map();
    allEvents.forEach(ev => {
        if (!ev || !ev.channel || !ev.channel.id) return;
        const chId = ev.channel.id;
        if (!eventsByChannelId.has(chId)) {
            eventsByChannelId.set(chId, []);
        }
        eventsByChannelId.get(chId).push(ev);
    });

    const skyChannelsResult = [];

    SKY_OFFICIAL_CHANNELS.forEach(chDef => {
        const rawEvents = eventsByChannelId.get(chDef.id) || [];

        // Ordina cronologicamente
        if (rawEvents.length > 0) {
            rawEvents.sort((a, b) => new Date(a.starttime) - new Date(b.starttime));
        }

        const programmi = [];
        const seenTimes = new Set();

        rawEvents.forEach(ev => {
            const startStr = toItalianTimeStr(ev.starttime);
            const endStr = toItalianTimeStr(ev.endtime);
            if (!startStr || seenTimes.has(startStr)) return;
            seenTimes.add(startStr);

            const title = (ev.eventTitle || ev.epgEventTitle || chDef.name).trim();
            let desc = (ev.eventSynopsis || (ev.content && ev.content.synopsis) || "").trim();
            // Pulisce puntini sospensivi iniziali o trattini tipici dei feed Sky EPG (es: '... Tennis Us Open. - ...')
            if (desc) {
                desc = desc
                    .replace(/^(\s*[\.…\s]+\s*)+/g, '')
                    .replace(/^[-\s:]+/, '')
                    .replace(/\\'/g, "'")
                    .replace(/&#x27;/g, "'")
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .trim();
            }
            const img = extractBestSkyImage(ev);

            programmi.push({
                ora: startStr,
                fine: endStr,
                titolo: title,
                descrizione: desc,
                immagine: img
            });
        });

        // Se il canale non ha eventi oggi (es. canali calcio 252-259 nei giorni infrasettimanali),
        // creiamo una scheda di standby per non far sparire il canale dalla guida
        if (programmi.length === 0) {
            programmi.push({
                ora: "06:00",
                fine: "23:59",
                titolo: `${chDef.name} - In attesa di trasmissione`,
                descrizione: "Le trasmissioni riprenderanno in occasione dei prossimi eventi live.",
                immagine: "https://ethaneurope.it.imageservice.sky.com/pd-image/3bb6c796-c876-40d5-b3d1-331f57a2714a/background/1920"
            });
        }

        skyChannelsResult.push({
            canale: chDef.name,
            categoria: chDef.cat,
            programmi
        });
        const withImg = programmi.filter(p => p.immagine && p.immagine.includes("sky.com")).length;
        console.log(`[OK-SKY] ${chDef.name.padEnd(24)} -> ${programmi.length} programmi (${withImg} copertine ufficiali Sky)`);
    });

    return skyChannelsResult;
}

export { SKY_OFFICIAL_CHANNELS };
