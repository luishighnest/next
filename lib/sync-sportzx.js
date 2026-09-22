import fs from "fs";
import path from "path";
import { createSlug } from "./slug.js";
import { getStoreData, setStoreData } from "./db.js";

const SPORTZX_REMOTE_URL = "https://raw.githubusercontent.com/mdjamsad9/dudetvapi/main/public_decrypted/events_with_channels.json";
const SPORTZX_LOCAL_FILE = path.join(process.cwd(), "public", "sportzx.json");
const SPORTZX_STORE_KEY = "sportzx_cached";

const CACHE_TTL_MS = 10 * 60 * 1000;
let memoryCache = null;
let lastCacheTime = 0;

/**
 * Converte un orario "2026/09/22 04:00:00 +0000" in ISO 8601 (UTC).
 */
function parseSportzxTime(str) {
    if (!str) return "";
    const m = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})/.exec(String(str).trim());
    if (m) {
        let offSec = (parseInt(m[7].slice(0, 3), 10) * 3600) + (parseInt(m[7].slice(3), 10) * 60);
        if (m[7][0] === "-") offSec = -offSec;
        const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - offSec * 1000;
        return new Date(ms).toISOString();
    }
    return String(str).trim();
}

/**
 * Analizza il suffisso header di un link Sportzx ("Referer=..&Origin=..&User-Agent=..").
 */
function parseLinkHeaders(suffix) {
    const out = { ua: "", referer: "", origin: "" };
    if (!suffix) return out;
    suffix.split("&").forEach(pair => {
        const eq = pair.indexOf("=");
        if (eq <= 0) return;
        const key = pair.slice(0, eq).trim().toLowerCase();
        const val = pair.slice(eq + 1).trim();
        if (key === "user-agent" || key === "ua" || key === "useragent") out.ua = val;
        else if (key === "referer" || key === "referrer") out.referer = val;
        else if (key === "origin") out.origin = val;
    });
    return out;
}

function parseLink(link) {
    const url = (link || "").trim();
    const parts = url.split("|");
    return {
        url: (parts[0] || "").trim(),
        headers: parseLinkHeaders(parts.length > 1 ? parts.slice(1).join("|") : "")
    };
}

function formatSchedule(startISO, endISO) {
    const out = { ora: "", data: "", schedule: "", isLiveNow: false, isVod: false };
    const nowMs = Date.now();
    if (!startISO) return out;

    let startMs = 0;
    let endMs = 0;
    try {
        const sd = new Date(startISO);
        startMs = sd.getTime();
        if (!isNaN(startMs)) {
            out.ora = sd.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
            const nowD = new Date();
            const startRome = sd.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
            const nowRome = nowD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
            const tomorrowD = new Date(nowD.getTime() + 24 * 60 * 60 * 1000);
            const tomorrowRome = tomorrowD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
            const yesterdayD = new Date(nowD.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayRome = yesterdayD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
            if (startRome === nowRome) out.data = "Oggi";
            else if (startRome === tomorrowRome) out.data = "Domani";
            else if (startRome === yesterdayRome) out.data = "Ieri";
            else {
                const dName = sd.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short' });
                const mName = sd.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short' });
                out.data = dName.charAt(0).toUpperCase() + dName.slice(1) + " " + mName;
            }
            out.schedule = out.data ? `${out.data} • ${out.ora}` : out.ora;
        }
    } catch(e) {}

    if (endISO) {
        try { endMs = new Date(endISO).getTime(); } catch(e) {}
    }
    if (startMs) {
        if (endMs) {
            out.isLiveNow = nowMs >= startMs && nowMs <= endMs;
            out.isVod = endMs < (nowMs - 30 * 60 * 1000);
        } else {
            out.isLiveNow = nowMs >= startMs && (nowMs - startMs) <= 6 * 60 * 60 * 1000;
            out.isVod = (nowMs - startMs) > 6 * 60 * 60 * 1000;
        }
    }
    return out;
}

function buildChannelFromEvent(ev, index) {
    const info = (ev && typeof ev.eventInfo === "object" && ev.eventInfo) || {};
    const title = (info.eventName || ev.title || "").trim();
    if (!title) return null;

    const startISO = parseSportzxTime(info.startTime);
    const endISO = parseSportzxTime(info.endTime);
    const sched = formatSchedule(startISO, endISO);

    const rawChannels = Array.isArray(ev.decoded_channels) ? ev.decoded_channels : [];
    const sources = [];
    rawChannels.forEach((c, idx) => {
        const type = String(c.type == null ? "0" : c.type).trim();
        if (type === "2") return; // pagina embed HTML non riproducibile dal player
        const { url, headers } = parseLink(c.link);
        if (!url) return;
        const kid = type === "1" ? (c.api || "") : "";
        if (type === "1" && kid && !kid.includes(":")) return;
        sources.push({
            name: (c.title || "").trim() || (type === "1" ? "FHD (MPD)" : `Sorgente ${idx + 1}`),
            isWarp: false,
            url: url,
            kid_key: kid,
            ua: headers.ua || "",
            referer: headers.referer || "",
            origin: headers.origin || "",
            dazn_token: ""
        });
    });

    let image = "";
    if (info.teamAFlag && typeof info.teamAFlag === "string" && info.teamAFlag.startsWith("http")) image = info.teamAFlag;
    else if (info.teamBFlag && typeof info.teamBFlag === "string" && info.teamBFlag.startsWith("http")) image = info.teamBFlag;
    else if (ev.image && typeof ev.image === "string" && ev.image.startsWith("http")) image = ev.image;

    // Le locandine Sofascore sono solo 150x150px: passa per /api/img che genera
    // versioni 960x540 webp nitide (gradiente brand + logo per le immagini piccole).
    if (image && image.startsWith("http")) {
        image = `/api/img?src=${encodeURIComponent(image)}&title=${encodeURIComponent(title)}`;
    }

    const slug = createSlug(title);
    const tileType = sched.isVod ? "CatchUp" : "Live";

    return {
        id: slug,
        title: title,
        name: title,
        group: "SportzX",
        navbar: "eventi",
        url: sources.length ? sources[0].url : "",
        kid_key: sources.length ? (sources[0].kid_key || "") : "",
        provider: "SportzX",
        logo: image || "/logos/dazn.png",
        image: image || "",
        ora: sched.ora,
        data: sched.data,
        schedule: sched.schedule,
        start: startISO,
        end: endISO,
        isLiveNow: sched.isLiveNow,
        isEventVod: sched.isVod,
        tile_type: tileType,
        ua: sources.length ? (sources[0].ua || "") : "",
        dazn_token: "",
        sources: sources,
        isCustom: true,
        isTestJson: true,
        eventSlug: slug,
        slug: slug
    };
}

function buildChannels(raw) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.events)) ? raw.events : [];
    const channels = [];
    list.forEach((ev, i) => {
        if (!ev) return;
        const ch = buildChannelFromEvent(ev, i);
        if (ch) channels.push(ch);
    });
    return channels;
}

function readLocalFile() {
    try {
        if (!fs.existsSync(SPORTZX_LOCAL_FILE)) return null;
        return JSON.parse(fs.readFileSync(SPORTZX_LOCAL_FILE, "utf8"));
    } catch (e) {
        console.error("[SportzX] Errore lettura public/sportzx.json:", e);
        return null;
    }
}

async function fetchRemote() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(SPORTZX_REMOTE_URL, { cache: "no-store", signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn("[SportzX] Errore fetch remoto:", e.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Restituisce i canali SportzX trasformati. Cerca in memoria, poi store Redis,
 * poi file locale public/sportzx.json, infine remoto.
 */
export async function getSportzxChannels() {
    if (memoryCache && (Date.now() - lastCacheTime < CACHE_TTL_MS)) {
        return memoryCache;
    }
    let channels = null;

    try {
        const stored = await getStoreData(SPORTZX_STORE_KEY);
        if (Array.isArray(stored) && stored.length > 0) {
            // Se lo store contiene dati raw (eventInfo, senza title) ricostruisci;
            // altrimenti usa i canali già trasformati.
            const isRaw = stored.some(c => c && c.eventInfo && !c.title);
            channels = isRaw ? buildChannels(stored) : stored;
        }
    } catch (e) {}

    if (!channels) {
        const localRaw = readLocalFile();
        if (localRaw) channels = buildChannels(localRaw);
    }
    if (!channels || channels.length === 0) {
        const remoteRaw = await fetchRemote();
        if (remoteRaw) channels = buildChannels(remoteRaw);
    }

    channels = Array.isArray(channels) ? channels : [];
    if (channels.length > 0) {
        memoryCache = channels;
        lastCacheTime = Date.now();
    }
    return channels;
}

/**
 * Aggiornamento in background: fetch remoto, trasforma e salva nello store.
 */
export async function refreshSportzxChannels() {
    try {
        const remoteRaw = await fetchRemote();
        const base = remoteRaw || readLocalFile();
        const channels = buildChannels(base);
        if (channels.length > 0) {
            memoryCache = channels;
            lastCacheTime = Date.now();
            await setStoreData(SPORTZX_STORE_KEY, channels).catch(() => {});
            console.log(`[SportzX] Sync completato: ${channels.length} eventi`);
        }
        return channels;
    } catch (e) {
        console.error("[SportzX] Errore sync:", e);
        return [];
    }
}