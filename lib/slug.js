/**
 * Utility professionale per la generazione e corrispondenza degli slug URL.
 * Rimuove metadati grezzi di scraping (timestamp, tag IPTV, risoluzioni), normalizza
 * i caratteri accentati ed elimina trattini doppi o orfani.
 */

export function createSlug(str) {
    if (!str || typeof str !== "string") return "";

    let s = str.trim();

    // 1. Rimuovi timestamp iniziale tipico dei feed grezzi di scraping (es. '14:56 ', '20.45 - ', '18:00 | ')
    s = s.replace(/^\s*\d{1,2}[:.]\d{2}\s*[-–—|~•/]?\s*/i, "");

    // 2. Rimuovi tag tra parentesi quadre tipo [IT], [LIVE], [1080p], [DAZN]
    s = s.replace(/\[[^\]]*\]/g, " ");

    // 3. Rimuovi tag WARP, HLS, FHD, UHD, HEVC, ecc.
    s = s.replace(/\s*\((?:WARP|HLS|FHD|UHD|1080p|720p|50FPS|60FPS|HEVC|H\.?265|H\.?264|ITA?|DIRECTO?|LIVE)\)\s*/gi, " ");
    s = s.replace(/\s*\(\d+\)\s*$/g, ""); // rimuovi eventuale (1) o (2) di duplicazione

    // 4. Normalizza prefissi IPTV tipo 'IT : ', 'IT | ', 'IT - '
    s = s.replace(/^(?:IT|ITA)\s*[:|–—-]\s*/i, "");

    // 5. Gestione '+' tipo Sky Uno + o Rai Sport + -> plus
    s = s.replace(/\s*\+\s*/g, " plus ");

    // 6. Normalizza caratteri accentati (à -> a, é -> e, ó -> o, ecc.)
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 7. Sostituisci & con e
    s = s.replace(/&/g, " e ");

    // 8. Rimuovi parole tecniche rimaste isolate
    s = s.replace(/\b(?:1080p|720p|fhd|uhd|hevc|h265|h264|50fps|60fps)\b/gi, "");

    // 9. Standardizza Sky TG 24 -> sky-tg24, Sky Sport 251..259
    s = s.replace(/\bsky\s*tg\s*24\b/gi, "sky-tg24");

    // 10. Minuscolo
    s = s.toLowerCase();

    // 11. Sostituisci qualsiasi carattere non alfanumerico con '-'
    s = s.replace(/[^a-z0-9]+/g, "-");

    // 12. Rimuovi trattini multipli e trattini iniziali/finali
    s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");

    return s;
}

/**
 * Pulisce uno slug esistente garantendo che rispetti lo standard professionale.
 */
export function cleanSlug(slug) {
    if (!slug || typeof slug !== "string") return "";
    return createSlug(slug);
}

/**
 * Ottiene lo slug professionale di un canale o evento.
 */
export function getChannelSlug(channel) {
    if (!channel) return "";
    if (channel.slug && !channel.slug.includes("---") && !channel.slug.startsWith("-") && !channel.slug.endsWith("-")) {
        const cleaned = cleanSlug(channel.slug);
        if (cleaned) return cleaned;
    }
    const name = channel.title || channel.name || channel.titolo || "";
    return createSlug(name);
}

/**
 * Verifica se un canale o evento corrisponde allo slug cercato nell'URL.
 * Supporta corrispondenza esatta, slug calcolato e fallback pulito (senza trattini).
 */
export function matchSlug(item, targetSlug) {
    if (!item || !targetSlug) return false;

    const rawTarget = String(targetSlug).toLowerCase().trim();
    const cleanTarget = cleanSlug(rawTarget);
    const targetAlphanum = rawTarget.replace(/[^a-z0-9]/g, "");

    if (!targetAlphanum) return false;

    const itemSlug = cleanSlug(item.slug || "");
    const calcSlug = createSlug(item.title || item.name || item.titolo || "");
    const itemAlphanum = (item.slug || item.title || item.name || item.titolo || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Corrispondenza slug esatta
    if (itemSlug && (itemSlug === cleanTarget || itemSlug === rawTarget)) return true;
    if (calcSlug && (calcSlug === cleanTarget || calcSlug === rawTarget)) return true;

    // 2. Corrispondenza alfanumerica
    if (itemAlphanum === targetAlphanum) return true;

    // 3. Sky Sport numerati (es. sky-sport-hd-1 vs sky-sport-251)
    const mNumTarget = rawTarget.match(/25(\d)/);
    const mNumItem = (item.name || item.title || "").match(/25(\d)/);
    if (mNumTarget && mNumItem && mNumTarget[1] === mNumItem[1]) return true;

    // 4. Substring containment se abbastanza lungo
    if (itemAlphanum.length >= 5 && targetAlphanum.length >= 5) {
        if (itemAlphanum.includes(targetAlphanum) || targetAlphanum.includes(itemAlphanum)) {
            return true;
        }
    }

    return false;
}
