import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getStoreData, setStoreData } from "./db.js";

const SITE_MASTER_PASSWORD = "2941";
const SITE_SALT = Buffer.from("zadonkais_secure_salt_2026", "utf8");

export function encryptSitePayload(data, password = SITE_MASTER_PASSWORD) {
    const key = crypto.pbkdf2Sync(password, SITE_SALT, 100000, 32, "sha256");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(data), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, ciphertext, authTag]);
    return payload.toString("base64");
}

function normalizeTitle(str) {
    return (str || "")
        .replace(/\s*\(WARP\)\s*/gi, " ")
        .replace(/\s*\(HLS\)\s*/gi, " ")
        .replace(/\s*\(\d+\)\s*$/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function formatImageUrl(img) {
    if (!img) return "";
    if (typeof img === "string") {
        if (img.startsWith("http")) return img;
        return `https://image.discovery.indazn.com/eu/v3/eu/none/${img}/fill/none/top/none/100/1280/720/png/image`;
    }
    if (typeof img === "object") {
        const id = img.Id || img.id;
        if (id) {
            return `https://image.discovery.indazn.com/eu/v3/eu/none/${id}/fill/none/top/none/100/1280/720/png/image`;
        }
    }
    return "";
}

/**
 * Interroga DAZN per gli eventi Live e aggiorna dinamicamente test.json
 * Mantiene intatti tutti gli eventi estratti (con mpd/key/ua pieni).
 * Crea/aggiorna le voci con mpd="", key="", ua="" se non ancora estratti.
 */
export async function syncDaznLiveEvents() {
    try {
        const liveUrl = "https://rail-router.discovery.indazn.com/eu/v10/Rail?platform=web&id=Live&country=it&brand=dazn&languageCode=it";
        const vodUrl = "https://rail-router.discovery.indazn.com/eu/v10/Rail?platform=web&id=Catchup&country=it&brand=dazn&languageCode=it";

        const headers = {
            "accept": "application/json",
            "origin": "https://www.dazn.com",
            "referer": "https://www.dazn.com/"
        };

        const [respLive, respVod] = await Promise.all([
            fetch(liveUrl, { headers, cache: "no-store" }).catch(() => null),
            fetch(vodUrl, { headers, cache: "no-store" }).catch(() => null)
        ]);

        const allTiles = [];
        if (respLive && respLive.ok) {
            try {
                const liveData = await respLive.json();
                if (Array.isArray(liveData.Tiles)) {
                    allTiles.push(...liveData.Tiles);
                }
            } catch (e) {}
        }
        if (respVod && respVod.ok) {
            try {
                const vodData = await respVod.json();
                if (Array.isArray(vodData.Tiles)) {
                    allTiles.push(...vodData.Tiles);
                }
            } catch (e) {}
        }

        if (allTiles.length === 0) return null;

        // Carica dati attuali di test.json (da Redis o fallback)
        const currentEventi = (await getStoreData("eventi")) || {};
        const updatedEventi = {};

        // Copia profonda di currentEventi
        for (const cat of Object.keys(currentEventi)) {
            if (Array.isArray(currentEventi[cat])) {
                updatedEventi[cat] = currentEventi[cat].map(e => ({ ...e }));
            }
        }

        // Mappa per ricerca rapida di eventi esistenti
        // key: normTitle -> { cat, event }
        const existingMap = new Map();
        for (const cat of Object.keys(updatedEventi)) {
            for (const ev of updatedEventi[cat]) {
                const norm = normalizeTitle(ev.name || ev.title);
                if (norm) {
                    existingMap.set(norm, { cat, event: ev });
                }
            }
        }

        let hasChanges = false;
        const currentCatalogNorms = new Set();

        for (const t of allTiles) {
            const rawTitle = (t.Title || "").trim();
            if (!rawTitle) continue;
            const normTitle = normalizeTitle(rawTitle);
            currentCatalogNorms.add(normTitle);

            // Categoria reale
            let compTitle = "";
            if (t.Competition && t.Competition.Title) {
                compTitle = t.Competition.Title.trim();
            } else if (t.Sport && t.Sport.Title) {
                compTitle = t.Sport.Title.trim();
            }
            if (!compTitle || compTitle.toLowerCase() === "eventi live") {
                const ttype = (t.TileType || "").toLowerCase();
                if (ttype === "linear" || normTitle.includes("dazn") || normTitle.includes("eurosport")) {
                    compTitle = "Live TV";
                } else {
                    compTitle = "Eventi";
                }
            }

            // Locandina
            let imgUrl = "";
            if (t.Image) {
                imgUrl = formatImageUrl(t.Image);
            } else if (Array.isArray(t.Images) && t.Images.length > 0) {
                const header = t.Images.find(i => i.ImageType === "image-header" || i.ImageType === "image-background") || t.Images[0];
                imgUrl = formatImageUrl(header);
            }

            const startTime = t.Start || "";
            const endTime = t.End || "";

            // Controlla se è già presente in test.json
            if (existingMap.has(normTitle)) {
                const { cat, event } = existingMap.get(normTitle);
                // Se l'evento è già presente ma era dinamico vuoto, aggiorna immagine/orari se mancanti
                const hasStream = Boolean((event.mpd || event.url) && (event.key || event.kid_key));
                if (!hasStream) {
                    let itemChanged = false;
                    if (imgUrl && !event.image) { event.image = imgUrl; itemChanged = true; }
                    if (startTime && !event.start) { event.start = startTime; itemChanged = true; }
                    if (endTime && !event.end) { event.end = endTime; itemChanged = true; }
                    if (itemChanged) hasChanges = true;
                }
            } else {
                // Nuovo evento live non ancora presente: inserisci con parametri vuoti
                if (!updatedEventi[compTitle]) {
                    updatedEventi[compTitle] = [];
                }
                const newEntry = {
                    name: rawTitle,
                    image: imgUrl,
                    start: startTime,
                    end: endTime,
                    mpd: "",
                    key: "",
                    ua: ""
                };
                updatedEventi[compTitle].push(newEntry);
                existingMap.set(normTitle, { cat: compTitle, event: newEntry });
                hasChanges = true;
            }
        }

        // Rimuovi eventi con parametri vuoti (non estratti) che non sono più nel catalogo Live/VOD di DAZN
        for (const cat of Object.keys(updatedEventi)) {
            const beforeLen = updatedEventi[cat].length;
            updatedEventi[cat] = updatedEventi[cat].filter(ev => {
                const hasStream = Boolean((ev.mpd || ev.url) && (ev.key || ev.kid_key));
                if (hasStream) return true; // Mantieni SEMPRE gli eventi estratti
                const norm = normalizeTitle(ev.name || ev.title);
                return currentCatalogNorms.has(norm);
            });
            if (updatedEventi[cat].length !== beforeLen) {
                hasChanges = true;
            }
            if (updatedEventi[cat].length === 0) {
                delete updatedEventi[cat];
                hasChanges = true;
            }
        }

        if (hasChanges) {
            console.log(`[Sync DAZN Live] Modifiche rilevate nel palinsesto live. Aggiornamento test.json...`);
            // 1. Salva su Redis e store locale
            await setStoreData("eventi", updatedEventi);

            // 2. Salva file public/test.json cifrato AES-256-GCM
            try {
                const enc = encryptSitePayload(updatedEventi);
                const testJsonPath = path.join(process.cwd(), "public", "test.json");
                fs.writeFileSync(testJsonPath, JSON.stringify({ enc }, null, 2), "utf8");
            } catch (err) {
                console.error("[Sync DAZN Live] Errore scrittura public/test.json cifrato:", err);
            }
        }

        return updatedEventi;
    } catch (e) {
        console.error("[Sync DAZN Live] Errore:", e);
        return null;
    }
}
