import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

let redisClient = null;

export function getRedis() {
    if (redisClient) return redisClient;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
        try {
            redisClient = new Redis({ url, token });
            return redisClient;
        } catch (e) {
            console.warn("Inizializzazione Upstash Redis fallita, uso fallback:", e);
        }
    }
    return null;
}

const LOCAL_STORE_FILE = path.join(process.cwd(), "data", "store.json");

function readLocalStore() {
    try {
        if (fs.existsSync(LOCAL_STORE_FILE)) {
            const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf8");
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Errore lettura local store:", e);
    }
    return null;
}

function writeLocalStore(data) {
    try {
        const dir = path.dirname(LOCAL_STORE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (e) {
        console.error("Errore scrittura local store:", e);
        return false;
    }
}

// Helper per decifrare file storici di fallback (password 2941)
async function readAndDecryptJsonFile(fileName) {
    const filePath = path.join(process.cwd(), "public", fileName);
    if (!fs.existsSync(filePath)) return null;
    let raw = "";
    try {
        raw = fs.readFileSync(filePath, "utf8").trim();
    } catch(e) {
        return null;
    }

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch(e) {
        return null;
    }

    if (parsed && typeof parsed === "object" && typeof parsed.enc === "string") {
        try {
            const crypto = await import("crypto");
            const salt = Buffer.from("zadonkais_secure_salt_2026", "utf8");
            const key = crypto.pbkdf2Sync("2941", salt, 100000, 32, "sha256");
            const rawBytes = Buffer.from(parsed.enc.trim(), "base64");
            const iv = rawBytes.subarray(0, 12);
            const ciphertext = rawBytes.subarray(12, rawBytes.length - 16);
            const authTag = rawBytes.subarray(rawBytes.length - 16);
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            return JSON.parse(decrypted.toString("utf8"));
        } catch (e) {
            console.error(`Errore decifrazione ${fileName}:`, e);
            return null;
        }
    }

    return parsed;
}

/**
 * Ottiene i dati di una specifica chiave ('eventi', 'sky1', 'sky2', 'categorie', 'guida')
 */
export async function getStoreData(key) {
    const redis = getRedis();
    if (redis) {
        try {
            const data = await redis.get(`stream:${key}`);
            if (data) return typeof data === "string" ? JSON.parse(data) : data;
        } catch (e) {
            console.warn(`Errore lettura Redis stream:${key}:`, e);
        }
    }

    // Prova dallo store locale
    const local = readLocalStore();
    if (local && local[key]) {
        return local[key];
    }

    // Fallback automatico dai file public/*.json esistenti
    if (key === "eventi") return await readAndDecryptJsonFile("test.json") || {};
    if (key === "sky1") return await readAndDecryptJsonFile("sky.json") || {};
    if (key === "sky2") return await readAndDecryptJsonFile("sky2.json") || {};
    if (key === "categorie") return await readAndDecryptJsonFile("categorie.json") || {};
    if (key === "guida") return await readAndDecryptJsonFile("guida_tv_sky.json") || [];

    return null;
}

/**
 * Salva i dati di una specifica chiave ('eventi', 'sky1', 'sky2', ecc.)
 */
export async function setStoreData(key, value) {
    let savedInRedis = false;
    const redis = getRedis();
    if (redis) {
        try {
            await redis.set(`stream:${key}`, JSON.stringify(value));
            savedInRedis = true;
        } catch (e) {
            console.warn(`Errore salvataggio Redis stream:${key}:`, e);
        }
    }

    // Salva sempre anche copia locale se possibile
    const local = readLocalStore() || {};
    local[key] = value;
    local.updatedAt = Date.now();
    writeLocalStore(local);

    return savedInRedis || true;
}
