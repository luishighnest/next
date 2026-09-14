/**
 * Rilevamento Device: Mobile vs Desktop / Tablet / Smart TV
 * Combina User-Agent regex completa, Client Hints (navigator.userAgentData),
 * supporto touch / coarse pointer e test screen/viewport.
 */

// Regex completa per smartphone / dispositivi mobile reali
const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS|Windows Phone|BB10/i;

// Tablet o Smart TV da non scambiare per smartphone compatto
const TABLET_OR_TV_REGEX = /iPad|Tablet|PlayBook|Silk|Kindle|SmartTV|HbbTV|Tizen|WebOS.*TV|Android.*TV|BRAVIA|NetCast|Roku|AppleTV/i;

/**
 * Controlla se la stringa User-Agent appartiene a un dispositivo mobile (telefono)
 * @param {string} ua
 * @returns {boolean}
 */
export function isMobileUserAgent(ua = "") {
    if (!ua || typeof ua !== "string") return false;
    // Se è esplicitamente TV o Tablet grande senza flag phone
    if (TABLET_OR_TV_REGEX.test(ua) && !/Mobile/i.test(ua)) {
        return false;
    }
    return MOBILE_UA_REGEX.test(ua);
}

/**
 * Rileva in modo deterministico e completo lato client se il browser è in esecuzione su mobile
 * Non lancia eccezioni in ambienti SSR.
 * @returns {boolean}
 */
export function checkIsMobileDevice() {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false;
    }

    // 1. Client Hints moderni (Chrome, Edge, Opera, Samsung Internet)
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
        return navigator.userAgentData.mobile;
    }

    const ua = navigator.userAgent || navigator.vendor || window.opera || "";

    // 2. Controllo Regex approfondito su User-Agent
    if (isMobileUserAgent(ua)) {
        return true;
    }

    // 3. Caso specifico iOS Safari iPad/iPhone moderno (che riporta MacIntel ma ha touch points)
    const isIOSDevice = (
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && !window.MSStream)
    );

    if (isIOSDevice) {
        // Se ha schermo compatto tipico da smartphone
        if (typeof window.screen !== "undefined") {
            const minDim = Math.min(window.screen.width, window.screen.height);
            if (minDim <= 768) {
                return true;
            }
        }
    }

    // 4. Media query comportamentale: coarse pointer (dito touch) + schermo <= 768px
    if (typeof window.matchMedia === "function") {
        const isCoarseTouch = window.matchMedia("(pointer: coarse)").matches;
        const isSmallViewport = window.matchMedia("(max-width: 768px)").matches;
        if (isCoarseTouch && isSmallViewport) {
            return true;
        }
    }

    return false;
}
