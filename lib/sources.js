export function getNormalizedSources(ch) {
    if (!ch) return [];

    if (Array.isArray(ch.sources) && ch.sources.length > 0) {
        return ch.sources.map(s => {
            const isWarp = Boolean(s.isWarp || (s.url && (s.url.includes("@eyj") || s.url.includes("token=eyj"))) || (s.name && s.name.toUpperCase().includes("WARP")));
            return {
                ...s,
                isWarp: isWarp,
                name: s.name || (isWarp ? "WARP (Cloudflare)" : "Standard")
            };
        });
    }

    if (ch.url) {
        const isWarp = Boolean(ch.isWarp || (ch.url && (ch.url.includes("@eyj") || ch.url.includes("token=eyj"))));
        return [{
            name: isWarp ? "WARP (Cloudflare)" : "Standard",
            isWarp: isWarp,
            url: ch.url,
            kid_key: ch.kid_key || "",
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
