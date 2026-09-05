"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CarouselSection from "@/components/CarouselSection";
import { fetchSecureJson, isStreamWarp } from "@/lib/crypto";
import { getChannelLogoUrl } from "@/lib/epg";

const EXT = "chrome-extension://opmeopcambhfimffbomjgemehjkbbmji/pages/player.html#";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export default function EventoPlayerPage() {
    const params = useParams();
    const slug = params?.slug ? String(params.slug).toLowerCase() : "";

    const [channel, setChannel] = useState(null);
    const [selectedSource, setSelectedSource] = useState(null);
    const [relatedSections, setRelatedSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isNavHidden, setIsNavHidden] = useState(false);

    useEffect(() => {
        let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

        function handleScroll() {
            const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
            if (currentScrollY <= 10) {
                setIsNavHidden(false);
            } else if (currentScrollY > lastScrollY && currentScrollY > 25) {
                setIsNavHidden(true);
            } else if (currentScrollY < lastScrollY) {
                setIsNavHidden(false);
            }
            lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
        }

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("touchmove", handleScroll, { passive: true });
        window.addEventListener("wheel", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("touchmove", handleScroll);
            window.removeEventListener("wheel", handleScroll);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadEvent() {
            let foundCh = null;

            // 1. Session Storage check
            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const cleanStoredSlug = (parsed.slug || parsed.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    const targetSlug = slug.replace(/[^a-z0-9]/g, "");
                    if (cleanStoredSlug === targetSlug || cleanStoredSlug.includes(targetSlug) || targetSlug.includes(cleanStoredSlug)) {
                        foundCh = parsed;
                    }
                }
            } catch(e) {}

            // 2. Fetch da categorie.json se non trovato
            if (!foundCh) {
                try {
                    const catRes = await fetch("/categorie.json");
                    if (catRes.ok) {
                        const catData = await catRes.json();
                        const targetSlug = slug.replace(/[^a-z0-9]/g, "");
                        for (const cat of (catData.categorie || [])) {
                            for (const c of (cat.canali || [])) {
                                const cSlug = (c.slug || c.titolo || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                                if (cSlug === targetSlug || cSlug.includes(targetSlug) || targetSlug.includes(cSlug)) {
                                    foundCh = {
                                        title: c.titolo,
                                        group: cat.nome,
                                        provider: cat.nome,
                                        logo: c.logo ? `/logos/${c.logo}` : getChannelLogoUrl({ title: c.titolo }),
                                        url: c.mpd || c.url || "",
                                        kid_key: c.kid_key || c.key || "",
                                        sources: [{
                                            name: "Standard",
                                            isWarp: false,
                                            url: c.mpd || c.url || "",
                                            kid_key: c.kid_key || c.key || ""
                                        }]
                                    };
                                    break;
                                }
                            }
                            if (foundCh) break;
                        }
                    }
                } catch(e) {}
            }

            // 3. Fetch da test.json se non trovato
            if (!foundCh) {
                try {
                    const daznData = await fetchSecureJson("/test.json");
                    if (daznData) {
                        const targetSlug = slug.replace(/[^a-z0-9]/g, "");
                        for (const grp of Object.keys(daznData)) {
                            const items = daznData[grp];
                            if (!Array.isArray(items)) continue;

                            const matching = [];
                            for (const ev of items) {
                                const rawTitle = (ev.name || ev.title || "").trim();
                                const isWarp = isStreamWarp(rawTitle, ev.mpd || ev.url || "");
                                let cleanTitle = rawTitle.replace(/\s*\(WARP\)\s*/gi, " ")
                                                           .replace(/\s*\(HLS\)\s*/gi, " ")
                                                           .replace(/\s*\(\d+\)\s*$/g, " ")
                                                           .trim();
                                if (cleanTitle.toUpperCase().replace(/\s+/g, "") === "DAZN") {
                                    cleanTitle = "DAZN 1";
                                }
                                const evSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

                                if (evSlug === targetSlug || evSlug.includes(targetSlug) || targetSlug.includes(evSlug)) {
                                    matching.push({
                                        name: isWarp ? "WARP (Cloudflare)" : "Standard",
                                        isWarp: isWarp,
                                        url: ev.mpd || ev.url || "",
                                        kid_key: ev.key || ev.kid_key || "",
                                        ua: ev.ua || "",
                                        dazn_token: ev.dazn_token || "",
                                        cleanTitle: cleanTitle,
                                        image: ev.image || "",
                                        ora: ev.start ? `${String(new Date(ev.start).getHours()).padStart(2, "0")}:${String(new Date(ev.start).getMinutes()).padStart(2, "0")}` : ""
                                    });
                                }
                            }

                            if (matching.length > 0) {
                                const warps = matching.filter(s => s.isWarp);
                                const stds = matching.filter(s => !s.isWarp);
                                let stdCount = 0;
                                let warpCount = 0;
                                matching.forEach(s => {
                                    if (s.isWarp) {
                                        warpCount++;
                                        s.name = warps.length > 1 ? `WARP ${warpCount}` : "WARP (Cloudflare)";
                                    } else {
                                        stdCount++;
                                        s.name = stds.length > 1 ? `Standard ${stdCount}` : "Standard";
                                    }
                                });

                                const baseEv = matching.find(x => !x.isWarp) || matching[0];
                                foundCh = {
                                    title: baseEv.cleanTitle,
                                    group: grp,
                                    provider: baseEv.provider || "DAZN",
                                    logo: "/logos/dazn.png",
                                    image: baseEv.image || "",
                                    ora: baseEv.ora || "",
                                    url: baseEv.url,
                                    kid_key: baseEv.kid_key,
                                    sources: matching
                                };
                                break;
                            }
                        }
                    }
                } catch(e) {}
            }

            if (foundCh) {
                setChannel(foundCh);
                if (foundCh.sources && foundCh.sources.length > 0) {
                    setSelectedSource(foundCh.sources[0]);
                } else {
                    setSelectedSource({
                        name: "Standard",
                        isWarp: false,
                        url: foundCh.url,
                        kid_key: foundCh.kid_key
                    });
                }
            }

            // Carica canali correlati ESATTAMENTE con l'ordine e la logica di evento.html
            try {
                const ts = Date.now();
                const [daznData, catRes, skyData, guideRes] = await Promise.allSettled([
                    fetchSecureJson(`/test.json?t=${ts}`).catch(() => null),
                    fetch(`/categorie.json?t=${ts}`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
                    fetchSecureJson(`/sky.json?t=${ts}`).catch(() => null),
                    fetch(`/guida_tv_sky.json?t=${ts}`, { cache: "no-store" }).then(r => r.json()).catch(() => null)
                ]);

                const sections = [];
                const currentPlayingTitle = foundCh?.title || "";
                const currentPlayingGroup = foundCh?.group || "";

                // 0. IN PRIMO PIANO: Se il canale aperto appartiene a una categoria TV (SuperTennis, Eurosport), mostra prima gli altri canali di quella categoria
                // ESCLUDI SEMPRE Digitale Terrestre (Rai, Mediaset, Discovery, ecc.)
                const EXCLUDED_CATEGORIES = ["digitale terrestre", "rai", "mediaset", "discovery"];
                if (catRes.status === "fulfilled" && catRes.value?.categorie) {
                    for (const cat of catRes.value.categorie) {
                        if (!cat.canali || cat.canali.length === 0) continue;
                        // Salta esplicitamente Digitale Terrestre
                        if (EXCLUDED_CATEGORIES.some(ex => cat.nome.toLowerCase().includes(ex))) continue;
                        const matchCat = (currentPlayingGroup && cat.nome.toLowerCase() === currentPlayingGroup.toLowerCase()) ||
                                         cat.canali.some(c => c.titolo === currentPlayingTitle);
                        if (matchCat) {
                            const sameCatChannels = cat.canali.map(c => ({
                                title: c.titolo,
                                group: cat.nome,
                                url: c.mpd || c.url || "",
                                kid_key: c.kid_key || c.key || "",
                                provider: cat.nome,
                                logo: c.logo ? `/logos/${c.logo}` : getChannelLogoUrl({ title: c.titolo }),
                                isCustom: true,
                                slug: (c.slug || c.titolo).toLowerCase().replace(/[^a-z0-9]/g, "-")
                            })).filter(c => c.title !== currentPlayingTitle);

                            if (sameCatChannels.length > 0) {
                                sections.push({
                                    title: cat.nome,
                                    channels: sameCatChannels
                                });
                            }
                        }
                    }
                }

                // 1. Categorie dinamiche di test.json (Eventi DAZN con deduplicazione)
                if (daznData.status === "fulfilled" && daznData.value) {
                    Object.keys(daznData.value).forEach(grpName => {
                        const items = daznData.value[grpName];
                        if (!Array.isArray(items)) return;
                        const grouped = new Map();
                        items.forEach(ev => {
                            const raw = (ev.name || ev.title || "").trim();
                            if (!raw) return;
                            const isWarp = isStreamWarp(raw, ev.mpd || ev.url || "");
                            let clean = raw.replace(/\s*\(WARP\)\s*/gi, " ")
                                           .replace(/\s*\(HLS\)\s*/gi, " ")
                                           .replace(/\s*\(\d+\)\s*$/g, " ")
                                           .trim();
                            if (clean.toUpperCase().replace(/\s+/g, "") === "DAZN") clean = "DAZN 1";

                            let timeStr = ev.ora || ev.time || "";
                            const isDazn1 = clean.toUpperCase().replace(/\s+/g, "").includes("DAZN1") || (ev.end && ev.end.startsWith("3000"));
                            if (!timeStr && ev.start && !isDazn1) {
                                try {
                                    const d = new Date(ev.start);
                                    timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                                } catch(e) {}
                            }

                            const cleanSlug = clean.toLowerCase().replace(/[^a-z0-9]/g, "-");
                            const groupKey = grpName + ":::" + clean.toLowerCase();

                            if (grouped.has(groupKey)) {
                                const existing = grouped.get(groupKey);
                                existing.sources.push({
                                    name: isWarp ? "WARP (Cloudflare)" : "Standard",
                                    isWarp: isWarp,
                                    url: ev.mpd || ev.url || "",
                                    kid_key: ev.key || ev.kid_key || ""
                                });
                            } else {
                                grouped.set(groupKey, {
                                    id: clean,
                                    title: clean,
                                    group: grpName,
                                    image: ev.image || "",
                                    logo: "/logos/dazn.png",
                                    url: ev.mpd || ev.url || "",
                                    kid_key: ev.key || ev.kid_key || "",
                                    provider: ev.provider || "DAZN",
                                    ora: timeStr,
                                    isCustom: true,
                                    isTestJson: true,
                                    slug: cleanSlug,
                                    sources: [{
                                        name: isWarp ? "WARP (Cloudflare)" : "Standard",
                                        isWarp: isWarp,
                                        url: ev.mpd || ev.url || "",
                                        kid_key: ev.key || ev.kid_key || ""
                                    }]
                                });
                            }
                        });

                        const list = Array.from(grouped.values()).filter(c => c.title !== currentPlayingTitle);
                        if (list.length > 0) {
                            sections.push({
                                title: grpName,
                                channels: list
                            });
                        }
                    });
                }

                // 2. Canali Sky Sport 24/7 con Guida TV da sky.json
                const guideData = guideRes.status === "fulfilled" ? guideRes.value : null;
                const getEpgForName = (name) => {
                    if (!guideData || !Array.isArray(guideData)) return null;
                    const norm = (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    for (const g of guideData) {
                        if (!g || !g.canale) continue;
                        const gn = g.canale.toLowerCase().replace(/[^a-z0-9]/g, "");
                        if (gn === norm || gn.includes(norm) || norm.includes(gn)) {
                            return g.programmi || null;
                        }
                    }
                    return null;
                };

                if (skyData.status === "fulfilled" && skyData.value && skyData.value["Sky Sport"]) {
                    const skySportList = skyData.value["Sky Sport"].map(c => ({
                        title: c.name || c.title || "",
                        group: "Sky Sport",
                        url: c.mpd || c.url || "",
                        kid_key: c.key || c.kid_key || "",
                        provider: "SKY",
                        logo: getChannelLogoUrl({ title: c.name || c.title, group: "SKYSPORT" }),
                        epg: getEpgForName(c.name || c.title),
                        slug: (c.name || c.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
                        isSky: true
                    })).filter(c => c.title !== currentPlayingTitle);

                    if (skySportList.length > 0) {
                        sections.push({
                            title: "Canali Sky Sport 24/7",
                            channels: skySportList
                        });
                    }
                }

                // 3. Sky Intrattenimento da sky.json
                if (skyData.status === "fulfilled" && skyData.value && skyData.value["Sky Intrattenimento"]) {
                    const skyIntrList = skyData.value["Sky Intrattenimento"].map(c => ({
                        title: c.name || c.title || "",
                        group: "Sky Intrattenimento",
                        url: c.mpd || c.url || "",
                        kid_key: c.key || c.kid_key || "",
                        provider: "SKY",
                        logo: getChannelLogoUrl({ title: c.name || c.title }),
                        epg: getEpgForName(c.name || c.title),
                        slug: (c.name || c.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
                        isSky: true
                    })).filter(c => c.title !== currentPlayingTitle);

                    if (skyIntrList.length > 0) {
                        sections.push({
                            title: "Sky Intrattenimento",
                            channels: skyIntrList
                        });
                    }
                }

                if (isMounted) {
                    setRelatedSections(sections);
                }
            } catch(e) {}

            if (isMounted) {
                setLoading(false);
            }
        }

        loadEvent();

        // Polling automatico in background ogni 5 secondi per aggiornare i correlati (es. nuovi eventi aggiunti)
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                loadEvent();
            }
        }, 5000);

        const onFocus = () => {
            if (document.visibilityState === "visible") {
                loadEvent();
            }
        };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, [slug]);

    // Costruzione URL Iframe per estensione Chrome identico ad evento.html
    const getIframeUrl = () => {
        if (!selectedSource || !selectedSource.url) return "";
        let ckParam = "";
        const rawKey = selectedSource.kid_key || "";
        if (rawKey && rawKey.includes(":")) {
            const parts = rawKey.split(":");
            const ckObj = {};
            ckObj[parts[0].trim()] = parts[1].trim();
            try { ckParam = "ck=" + btoa(JSON.stringify(ckObj)); } catch(e) {}
        }
        let headersParam = "";
        const uaVal = selectedSource.ua || UA;
        try { headersParam = "headers=" + btoa(JSON.stringify({ "User-Agent": uaVal })); } catch(e) {}

        const extraParams = [ckParam, headersParam].filter(Boolean);
        const sep = selectedSource.url.includes("?") ? "&" : "?";
        return EXT + selectedSource.url + (extraParams.length ? sep + extraParams.join("&") : "");
    };

    return (
        <div style={{ backgroundColor: "#000000", minHeight: "100vh", color: "#ffffff", paddingBottom: "60px" }}>
            {/* Header / Navbar identica (Nessun tasto selezionato in bianco) */}
            <div className={`home-header-wrapper ${isNavHidden ? "nav-hidden" : ""}`} style={{ position: "sticky", top: "14px", zIndex: 9999, marginBottom: "20px" }}>
                <div className="home-header">
                    <Link href="/">
                        <img src="/logos/premium_logo_dark.jpg" alt="Logo" className="brand-logo" />
                    </Link>
                    <nav className="sky-nav-links">
                        <Link href="/" className="nav-link"><i className="fas fa-house"></i>Home</Link>
                        <Link href="/?tab=sport" className="nav-link"><i className="fas fa-trophy"></i>Sport</Link>
                        <Link href="/?tab=intrattenimento" className="nav-link"><i className="fas fa-masks-theater"></i>Intrattenimento</Link>
                        <Link href="/?tab=eventi" className="nav-link"><i className="fas fa-ticket"></i>Eventi</Link>
                    </nav>
                </div>
            </div>

            <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 16px" }}>
                <div className="event-main-stage">
                    <div className="player-wrapper">
                        <iframe
                            id="player-frame"
                            src={getIframeUrl()}
                            allowFullScreen
                            allow="autoplay; encrypted-media; fullscreen"
                            title="Player"
                            style={{ display: "block", width: "100%", height: "100%", border: "none", background: "#000000", transition: "opacity 0.5s ease-in-out" }}
                        />
                    </div>

                    <div className="event-deck">
                        <div className="event-deck-left">
                            <div className="event-logo-box">
                                <img
                                    className="event-channel-logo"
                                    src={channel?.logo || "/logos/dazn.png"}
                                    alt="Logo"
                                />
                            </div>
                            <div className="event-details">
                                <div className="event-meta-row">
                                    <span className="live-badge"><span className="dot"></span>LIVE</span>
                                    <span className="event-tag">{channel?.provider || "DAZN"}</span>
                                    {channel?.ora && (
                                        <span className="event-time-badge">
                                            <i className="fa-regular fa-clock"></i>
                                            <span>Ore {channel.ora}</span>
                                        </span>
                                    )}
                                </div>
                                <h1 className="event-title">{channel?.title || "Caricamento evento..."}</h1>
                            </div>
                        </div>

                        {/* Deck Tasti Sorgente (Standard vs WARP) */}
                        <div className="event-sources-wrapper">
                            {channel?.sources && channel.sources.map((s, idx) => {
                                const isSelected = selectedSource?.url === s.url && selectedSource?.isWarp === s.isWarp;
                                return (
                                    <button
                                        key={s.name + idx}
                                        type="button"
                                        className={`event-source-btn ${isSelected ? "active" : ""}`}
                                        onClick={() => setSelectedSource(s)}
                                    >
                                        {s.isWarp ? (
                                            <i className="fa-solid fa-shield-halved" style={{ color: "#f38020" }}></i>
                                        ) : (
                                            <i className="fa-solid fa-bolt"></i>
                                        )}
                                        <span>{s.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sezioni Correlate identiche a evento.html */}
                <div className="related-section" id="dynamic-categories-container">
                    {relatedSections.map(sec => (
                        <CarouselSection
                            key={sec.title}
                            title={sec.title}
                            channels={sec.channels}
                            isRelated={true}
                        />
                    ))}
                </div>
            </main>
        </div>
    );
}
