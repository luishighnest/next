import fs from "fs";
import path from "path";
import { createSlug } from "./slug.js";
import { getStoreData } from "./db.js";

const FCTV33_LOCAL_FILE = path.join(process.cwd(), "public", "fctv33.json");
const FCTV33_STORE_KEY = "fctv33_cached";

const CACHE_TTL_MS = 10 * 60 * 1000;
let memoryCache = null;
let lastCacheTime = 0;

function parseFctvTime(str) {
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

function formatSchedule(startISO) {
    const out = { ora: "", data: "", schedule: "", isLiveNow: false };
    const nowMs = Date.now();
    if (!startISO) return out;

    let startMs = 0;
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
            out.isLiveNow = nowMs >= startMs && (nowMs - startMs) <= 6 * 60 * 60 * 1000;
        }
    } catch(e) {}

    return out;
}

function buildChannelFromFctvEvent(ev) {
    const rawTitle = ev.event_title || ev.title || "Evento FCTV33";
    const catName = ev.category || "";
    const title = catName ? `[${catName}] ${rawTitle}` : rawTitle;
    const startISO = parseFctvTime(ev.startTime);
    const sched = formatSchedule(startISO);

    const rawChannels = Array.isArray(ev.channels) ? ev.channels : [];
    const sources = [];
    rawChannels.forEach((ch, idx) => {
        const u = ch.mpd_url || ch.url || "";
        if (!u) return;
        sources.push({
            name: ch.name || `Server ${idx + 1}`,
            isWarp: true,
            url: u,
            kid_key: ch.kid_key || ch.key || "",
            ua: ch.user_agent || ch.ua || "",
            referer: ch.referer || "",
            origin: "",
            dazn_token: ""
        });
    });

    if (!sources.length) return null;

    const slug = createSlug(title);
    const encodedTitle = encodeURIComponent(title);
    const posterUrl = `/api/img?src=${encodeURIComponent("https://raw.githubusercontent.com/luishighnest/script2/main/logo.png")}&title=${encodedTitle}`;

    return {
        id: slug,
        title: title,
        name: title,
        group: "FCTV33 Live",
        navbar: "eventi",
        url: sources[0].url,
        kid_key: sources[0].kid_key,
        provider: "FCTV33",
        logo: posterUrl,
        image: posterUrl,
        ora: sched.ora,
        data: sched.data,
        schedule: sched.schedule,
        start: startISO,
        end: "",
        isLiveNow: ev.isLiveNow != null ? ev.isLiveNow : sched.isLiveNow,
        isEventVod: false,
        tile_type: "Live",
        ua: sources[0].ua,
        referer: sources[0].referer,
        dazn_token: "",
        sources: sources,
        isCustom: true,
        isTestJson: true,
        eventSlug: slug,
        slug: slug
    };
}

function buildFctvChannels(raw) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.events)) ? raw.events : [];
    const channels = [];
    list.forEach(ev => {
        if (!ev) return;
        const ch = buildChannelFromFctvEvent(ev);
        if (ch) channels.push(ch);
    });
    return channels;
}

export async function getFctv33Channels() {
    if (memoryCache && (Date.now() - lastCacheTime < CACHE_TTL_MS)) {
        return memoryCache;
    }
    let channels = null;

    try {
        const stored = await getStoreData(FCTV33_STORE_KEY);
        if (stored) {
            channels = buildFctvChannels(stored);
        }
    } catch (e) {}

    if (!channels || channels.length === 0) {
        try {
            if (fs.existsSync(FCTV33_LOCAL_FILE)) {
                const localRaw = JSON.parse(fs.readFileSync(FCTV33_LOCAL_FILE, "utf8"));
                channels = buildFctvChannels(localRaw);
            }
        } catch (e) {}
    }

    channels = Array.isArray(channels) ? channels : [];
    if (channels.length > 0) {
        memoryCache = channels;
        lastCacheTime = Date.now();
    }
    return channels;
}
