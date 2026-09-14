export function getNormalizedSources(ch) {
    if (!ch) return [];

    let list = [];
    if (Array.isArray(ch.sources) && ch.sources.length > 0) {
        list = [...ch.sources];
    } else if (ch.url) {
        list = [{
            name: "Standard",
            isWarp: false,
            url: ch.url,
            kid_key: ch.kid_key || "",
            ua: ch.ua || "",
            dazn_token: ch.dazn_token || ""
        }];
    }

    // Se c'è 1 sola sorgente per l'evento, garantisci SEMPRE i 2 flussi cliccabili: Standard e WARP
    if (list.length === 1) {
        const src0 = list[0];
        const isWarpSrc = src0.isWarp || (src0.name && src0.name.toUpperCase().includes("WARP"));

        if (isWarpSrc) {
            list = [
                {
                    name: "Standard",
                    isWarp: false,
                    url: src0.url,
                    kid_key: src0.kid_key || "",
                    ua: src0.ua || "",
                    dazn_token: src0.dazn_token || ""
                },
                {
                    ...src0,
                    name: "WARP (Cloudflare)",
                    isWarp: true
                }
            ];
        } else {
            list = [
                {
                    ...src0,
                    name: "Standard",
                    isWarp: false
                },
                {
                    name: "WARP (Cloudflare)",
                    isWarp: true,
                    url: src0.url,
                    kid_key: src0.kid_key || "",
                    ua: src0.ua || "",
                    dazn_token: src0.dazn_token || ""
                }
            ];
        }
    }

    return list;
}

export function getInitialSource(ch) {
    const sources = getNormalizedSources(ch);
    return sources.length > 0 ? sources[0] : null;
}
