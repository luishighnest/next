"use client";

let shakaPromise = null;

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

export function parseClearKeys(rawKey) {
    const clearKeys = {};
    if (!rawKey || !rawKey.includes(":")) return clearKeys;

    const pairs = rawKey.split(",");
    pairs.forEach(pair => {
        const [rawKid, rawK] = pair.split(":");
        if (rawKid && rawK) {
            const cleanKid = rawKid.replace(/-/g, "").trim().toLowerCase();
            const cleanK = rawK.replace(/-/g, "").trim().toLowerCase();
            clearKeys[cleanKid] = cleanK;
            if (cleanKid.length === 32) {
                const dashedKid = cleanKid.slice(0, 8) + "-" + cleanKid.slice(8, 12) + "-" + cleanKid.slice(12, 16) + "-" + cleanKid.slice(16, 20) + "-" + cleanKid.slice(20);
                clearKeys[dashedKid] = cleanK;
            }
        }
    });
    return clearKeys;
}
