export function cleanStreamUrlAndKey(rawUrl, rawKey) {
    let url = (rawUrl || "").trim();
    let key = (rawKey || "").trim();

    if (url.includes("|")) {
        const parts = url.split("|");
        url = parts[0].trim();
        if (!key && parts[1]) {
            key = parts[1].trim();
        }
    }

    return { url, key };
}

export function getNormalizedSources(ch) {
    if (!ch) return [];

    const isTestJsonChannel = Boolean(ch.isTestJson || ch.navbar === "eventi" || ch.isCustom);

    if (Array.isArray(ch.sources) && ch.sources.length > 0) {
        return ch.sources.map(s => {
            const cleaned = cleanStreamUrlAndKey(s.url, s.kid_key || s.key);
            const isWarp = Boolean(isTestJsonChannel || s.isWarp || (cleaned.url && (cleaned.url.includes("@eyj") || cleaned.url.includes("token=eyj"))) || (s.name && s.name.toUpperCase().includes("WARP")));
            return {
                ...s,
                url: cleaned.url,
                kid_key: cleaned.key,
                isWarp: isWarp,
                name: s.name && !s.name.includes("Standard") ? s.name : (isWarp ? "WARP (Cloudflare)" : "Standard")
            };
        });
    }

    if (ch.url) {
        const cleaned = cleanStreamUrlAndKey(ch.url, ch.kid_key || ch.key);
        const isWarp = Boolean(isTestJsonChannel || ch.isWarp || (cleaned.url && (cleaned.url.includes("@eyj") || cleaned.url.includes("token=eyj"))));
        return [{
            name: isWarp ? "WARP (Cloudflare)" : "Standard",
            isWarp: isWarp,
            url: cleaned.url,
            kid_key: cleaned.key,
            ua: ch.ua || "",
            dazn_token: ch.dazn_token || ""
        }];
    }

    return [];
}

export function getInitialSource(ch) {
    const sources = getNormalizedSources(ch);
    return sources.length > 0 ? sources[0] : null;
}
