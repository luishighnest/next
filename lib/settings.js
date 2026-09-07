"use client";

// Chiave di persistenza per le impostazioni tecniche nel localStorage
export const SETTINGS_STORAGE_KEY = "nmdz_tech_settings";

// Impostazioni tecniche predefinite
export const DEFAULT_TECH_SETTINGS = {
    // 1. STREAM & PLAYER
    extensionId: "opmeopcambhfimffbomjgemehjkbbmji",
    customUserAgent: "",
    preferredQuality: "auto", // "auto", "1080", "720", "480"
    autoplayAllowed: true,

    // 2. NETWORK & RESILIENCE
    pollIntervalSec: 5, // 3, 5, 10, 15, 30
    dnsOverHttps: "cloudflare", // "cloudflare", "google", "quad9", "disabled"
    defaultSkySource: "sky.json", // "sky.json" o "sky2.json"

    // 3. SICUREZZA & SESSIONE
    autoLockMinutes: 0, // 0 (disattivo), 5, 15, 30, 60
    wipeCacheOnExit: false,
    clearkeyDebug: false,
};

// Carica le impostazioni attuali (con fallback su default)
export function getTechSettings() {
    if (typeof window === "undefined") {
        return { ...DEFAULT_TECH_SETTINGS };
    }
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_TECH_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.error("Errore lettura impostazioni:", e);
    }
    return { ...DEFAULT_TECH_SETTINGS };
}

// Salva e notifica l'aggiornamento a tutta l'applicazione via CustomEvent
export function saveTechSettings(newSettings) {
    if (typeof window === "undefined") return;
    try {
        const merged = { ...getTechSettings(), ...newSettings };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("nmdz:settings_updated", { detail: merged }));
        return merged;
    } catch (e) {
        console.error("Errore salvataggio impostazioni:", e);
        return null;
    }
}

// Reset alle impostazioni di fabbrica
export function resetTechSettings() {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_TECH_SETTINGS));
        window.dispatchEvent(new CustomEvent("nmdz:settings_updated", { detail: DEFAULT_TECH_SETTINGS }));
        return { ...DEFAULT_TECH_SETTINGS };
    } catch (e) {
        console.error("Errore reset impostazioni:", e);
    }
}

// Calcola lo spazio di cache utilizzato (localStorage + sessionStorage) in KB
export function getStorageStats() {
    if (typeof window === "undefined") return { localKb: 0, sessionKb: 0, totalKb: 0, channelCount: 0 };
    let localBytes = 0;
    let sessionBytes = 0;
    let channelCount = 0;

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            if (val) localBytes += (key.length + val.length) * 2;
        }
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            const val = sessionStorage.getItem(key);
            if (val) sessionBytes += (key.length + val.length) * 2;
        }
        const cached = localStorage.getItem("nmdz_cached_sections");
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
                parsed.forEach(sec => {
                    channelCount += (sec.channels || []).length;
                });
            }
        }
    } catch (e) {}

    const localKb = Math.round(localBytes / 1024);
    const sessionKb = Math.round(sessionBytes / 1024);
    return {
        localKb,
        sessionKb,
        totalKb: localKb + sessionKb,
        channelCount
    };
}

// Svuota cache dati canali (mantenendo le impostazioni se specificato)
export function clearChannelsCache(preserveSettings = true) {
    if (typeof window === "undefined") return;
    try {
        const savedSettings = preserveSettings ? localStorage.getItem(SETTINGS_STORAGE_KEY) : null;
        localStorage.removeItem("nmdz_cached_sections");
        sessionStorage.removeItem("daznEventChannel");
        sessionStorage.removeItem("daznCustomChannel");
        sessionStorage.removeItem("nmdz_skyChannel");
        if (savedSettings) {
            localStorage.setItem(SETTINGS_STORAGE_KEY, savedSettings);
        }
        window.dispatchEvent(new CustomEvent("nmdz:cache_cleared"));
    } catch (e) {
        console.error("Errore svuotamento cache:", e);
    }
}
