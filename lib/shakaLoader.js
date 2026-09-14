"use client";

let shakaPromise = null;

if (typeof window !== "undefined") {
    // Pre-caricamento istantaneo in background di Shaka Player all'avvio dell'app
    try {
        setTimeout(() => {
            loadShakaScript().catch(() => {});
        }, 50);
    } catch(e) {}
}

export function loadShakaScript() {
    if (typeof window === "undefined") return Promise.reject(new Error("Window not defined"));
    if (window.shaka) return Promise.resolve(window.shaka);

    if (shakaPromise) return shakaPromise;

    shakaPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById("shaka-player-script");
        if (existingScript) {
            if (window.shaka) {
                resolve(window.shaka);
            } else {
                existingScript.addEventListener("load", () => resolve(window.shaka));
                existingScript.addEventListener("error", (e) => {
                    shakaPromise = null;
                    reject(e);
                });
            }
            return;
        }

        const script = document.createElement("script");
        script.id = "shaka-player-script";
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js";
        script.async = true;
        script.onload = () => {
            if (window.shaka) {
                window.shaka.polyfill.installAll();
            }
            resolve(window.shaka);
        };
        script.onerror = (e) => {
            shakaPromise = null;
            reject(new Error("Impossibile caricare Shaka Player"));
        };
        document.head.appendChild(script);
    });

    return shakaPromise;
}

function hexToBase64Url(hex) {
    try {
        const clean = hex.replace(/-/g, "").trim();
        if (!clean || clean.length % 2 !== 0) return "";
        const bytes = new Uint8Array(clean.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        let binary = "";
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    } catch (e) {
        return "";
    }
}

export function parseClearKeys(rawKey) {
    const clearKeys = {};
    if (!rawKey || !rawKey.includes(":")) return clearKeys;

    const pairs = rawKey.split(",");
    pairs.forEach(pair => {
        const parts = pair.split(":");
        if (parts.length >= 2) {
            const rawKid = parts[0].trim();
            const rawK = parts[1].trim();

            const cleanKid = rawKid.replace(/-/g, "").toLowerCase();
            const cleanK = rawK.replace(/-/g, "").toLowerCase();

            if (cleanKid && cleanK) {
                clearKeys[cleanKid] = cleanK;
                clearKeys[cleanKid.toUpperCase()] = cleanK;

                if (cleanKid.length === 32) {
                    const dashedKid = cleanKid.slice(0, 8) + "-" + cleanKid.slice(8, 12) + "-" + cleanKid.slice(12, 16) + "-" + cleanKid.slice(16, 20) + "-" + cleanKid.slice(20);
                    clearKeys[dashedKid] = cleanK;
                    clearKeys[dashedKid.toUpperCase()] = cleanK;

                    const b64Kid = hexToBase64Url(cleanKid);
                    const b64K = hexToBase64Url(cleanK);
                    if (b64Kid && b64K) {
                        clearKeys[b64Kid] = b64K;
                    }
                }
            }
        }
    });
    return clearKeys;
}
