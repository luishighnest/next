// Native WebCrypto AES-GCM / PBKDF2 decryption matching Zadonkais auth.js
const SALT_STRING = "zadonkais_secure_salt_2026";
const SESSION_KEY_STORAGE = "zdk_auth_session_key";
const AUTH_VERIFY_TOKEN = "idlD9ar1C+deDfkb1XarbLcW43wFQaQO66///XOa0fKZcfKa2B4nPs+f";

let cachedCryptoKey = null;

export async function deriveCryptoKey(password) {
    if (typeof window === "undefined") return null;
    const enc = new TextEncoder();
    const salt = enc.encode(SALT_STRING);
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function decryptAESGCM(base64Payload, cryptoKey) {
    try {
        const raw = atob(base64Payload.trim());
        const rawBytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            rawBytes[i] = raw.charCodeAt(i);
        }
        const iv = rawBytes.subarray(0, 12);
        const ciphertext = rawBytes.subarray(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            cryptoKey,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new Error("Decifrazione fallita");
    }
}

export async function initAuth() {
    if (typeof window === "undefined") return null;
    let savedPass = sessionStorage.getItem(SESSION_KEY_STORAGE) || "2941";
    try {
        const key = await deriveCryptoKey(savedPass);
        const check = await decryptAESGCM(AUTH_VERIFY_TOKEN, key);
        const parsed = JSON.parse(check);
        if (parsed && parsed.auth === "OK") {
            cachedCryptoKey = key;
            sessionStorage.setItem(SESSION_KEY_STORAGE, savedPass);
            return key;
        }
    } catch (e) {
        try {
            const fallbackKey = await deriveCryptoKey("2941");
            cachedCryptoKey = fallbackKey;
            sessionStorage.setItem(SESSION_KEY_STORAGE, "2941");
            return fallbackKey;
        } catch (err) {}
    }
    return cachedCryptoKey;
}

export async function fetchSecureJson(url) {
    const key = cachedCryptoKey || await initAuth();
    const resp = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const text = (await resp.text()).trim();

    if (text.startsWith('{"enc":') || text.startsWith('{\n  "enc":')) {
        const envelope = JSON.parse(text);
        const decryptedString = await decryptAESGCM(envelope.enc, key);
        return JSON.parse(decryptedString);
    }
    return JSON.parse(text);
}

export function isStreamWarp(rawTitle, streamUrl) {
    const u = (streamUrl || "").toLowerCase();
    const t = (rawTitle || "").toUpperCase();
    if (u.includes(".m3u8") || (u.startsWith("http") && !u.includes(".mpd") && !u.includes("@eyj"))) {
        return false;
    }
    if (t.includes("(WARP)")) {
        return true;
    }
    if (u.includes("@eyj") || u.includes("token=eyj") || u.includes("/eyj")) {
        try {
            const tokenMatch = (streamUrl || "").match(/[@/=](eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
            if (tokenMatch) {
                const token = tokenMatch[1];
                const payloadB64 = token.split(".")[1];
                const normalizedB64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
                const pad = normalizedB64 + "=".repeat((4 - normalizedB64.length % 4) % 4);
                const payloadJson = JSON.parse(atob(pad));
                if (payloadJson.asn && Array.isArray(payloadJson.asn) && payloadJson.asn.some(a => String(a) === "13335")) {
                    return true;
                }
            }
        } catch(e) {}
    }
    return false;
}
