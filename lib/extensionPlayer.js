import { getTechSettings } from "./settings";

export const DEFAULT_EXT_ID = "opmeopcambhfimffbomjgemehjkbbmji";

export function buildExtensionUrl(item, options = {}) {
    if (!item) return "";

    let rawUrl = (item.url || item.mpd || "").trim();
    if (!rawUrl) return "";

    const tech = getTechSettings();
    const extId = tech.extensionId || DEFAULT_EXT_ID;

    // Normalizza se già presente extension:// o /player/
    if (rawUrl.startsWith("chrome-extension://") || rawUrl.startsWith("extension://")) {
        // Estrai l'hash se presente
        const hashIdx = rawUrl.indexOf("#");
        if (hashIdx !== -1) {
            return `/player/index.html${rawUrl.substring(hashIdx)}`;
        }
    }

    let rawKey = item.kid_key || item.key || options.key || "";

    // Gestione formato Heroku "URL|KEY"
    if (rawUrl.includes("|")) {
        const parts = rawUrl.split("|");
        rawUrl = parts[0].trim();
        if (!rawKey && parts[1]) {
            rawKey = parts[1].trim();
        }
    }

    const title = options.title || item.title || item.name || "Live Stream";

    // Gestione flussi TS / IPTV
    const isTsStream = rawUrl.toLowerCase().includes(".ts");
    if (isTsStream) {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://next-zeta-smoky.vercel.app";
        const m3uUrl = `${origin}/api/m3u?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(title)}`;
        return `/player/index.html#${m3uUrl}`;
    }

    // Player Standalone Web servito direttamente dal sito senza estensione Chrome
    const playerPrefix = `/player/index.html#`;

    // Estrazione token DAZN
    let daznToken = item.dazn_token || options.dazn_token || "";
    if (!daznToken && rawUrl.includes("@eyJ")) {
        const tm = rawUrl.match(/@([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)/);
        if (tm) daznToken = tm[1];
    }

    // Costruzione parametro ck= per ClearKey DRM
    let ckParam = "";
    if (rawKey && rawKey.includes(":")) {
        const ckObj = {};
        const pairs = rawKey.split(",");
        pairs.forEach(pair => {
            const p = pair.split(":");
            if (p.length >= 2 && p[0].trim() && p[1].trim()) {
                const kid = p[0].trim().replace(/-/g, "").toLowerCase();
                const key = p[1].trim().replace(/-/g, "").toLowerCase();
                ckObj[kid] = key;
            }
        });
        if (Object.keys(ckObj).length > 0) {
            try {
                ckParam = "ck=" + encodeURIComponent(btoa(JSON.stringify(ckObj)));
            } catch(e) {}
        }
    }

    // Costruzione headers
    const rawUa = (item.ua || options.ua || tech.customUserAgent || "").trim();
    const isDazn = rawUrl.includes("dazn") || Boolean(daznToken) || options.isDazn;
    const isPrime = rawUrl.includes("primevideo") || rawUrl.includes("aiv-cdn");

    let headersParam = "";
    try {
        const headersObj = {};
        if (rawUa) {
            headersObj["user-agent"] = rawUa;
        }
        if (isDazn) {
            headersObj["referer"] = "https://www.dazn.com/";
            headersObj["origin"] = "https://www.dazn.com";
            if (daznToken) headersObj["dazn-token"] = daznToken;
        } else if (isPrime) {
            headersObj["referer"] = "https://www.primevideo.com/";
            headersObj["origin"] = "https://www.primevideo.com";
        }
        if (Object.keys(headersObj).length > 0) {
            const jsonStr = JSON.stringify(headersObj);
            const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
            headersParam = "headers=" + encodeURIComponent(b64);
        }
    } catch(e) {}

    const extraParams = [ckParam, headersParam].filter(Boolean);
    const sep = rawUrl.includes("?") ? "&" : "?";
    return playerPrefix + rawUrl + (extraParams.length > 0 ? sep + extraParams.join("&") : "");
}
