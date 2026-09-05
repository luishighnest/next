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
    const [showGithubMenu, setShowGithubMenu] = useState(false);
    const [relatedSections, setRelatedSections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadEvent() {
            setLoading(true);
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
                                const cleanTitle = rawTitle.replace(/\s*\(WARP\)\s*/gi, " ")
                                                           .replace(/\s*\(HLS\)\s*/gi, " ")
                                                           .replace(/\s*\(\d+\)\s*$/g, " ")
                                                           .trim();
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
                                    provider: grp === "EVENTI" ? "SKY SPORT" : "DAZN",
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

            // Carica canali correlati
            try {
                const [daznData, catRes] = await Promise.allSettled([
                    fetchSecureJson("/test.json").catch(() => null),
                    fetch("/categorie.json").then(r => r.json()).catch(() => null)
                ]);

                const sections = [];
                if (daznData.status === "fulfilled" && daznData.value) {
                    Object.keys(daznData.value).forEach(grpName => {
                        const items = daznData.value[grpName];
                        if (!Array.isArray(items)) return;
                        const grouped = new Map();
                        items.forEach(ev => {
                            const raw = (ev.name || ev.title || "").trim();
                            const clean = raw.replace(/\s*\(WARP\)\s*/gi, " ").replace(/\s*\(HLS\)\s*/gi, " ").replace(/\s*\(\d+\)\s*$/g, " ").trim();
                            if (!grouped.has(clean.toLowerCase())) {
                                grouped.set(clean.toLowerCase(), {
                                    title: clean,
                                    group: grpName,
                                    image: ev.image || "",
                                    logo: "/logos/dazn.png",
                                    url: ev.mpd || "",
                                    kid_key: ev.key || "",
                                    slug: clean.toLowerCase().replace(/[^a-z0-9]/g, "-")
                                });
                            }
                        });
                        const list = Array.from(grouped.values()).filter(c => c.title !== foundCh?.title);
                        if (list.length > 0) {
                            sections.push({
                                title: grpName,
                                channels: list
                            });
                        }
                    });
                }

                if (catRes.status === "fulfilled" && catRes.value?.categorie) {
                    catRes.value.categorie.forEach(cat => {
                        if (!cat.canali || cat.canali.length === 0) return;
                        const list = cat.canali.map(c => ({
                            title: c.titolo,
                            group: cat.nome,
                            logo: c.logo ? `/logos/${c.logo}` : getChannelLogoUrl({ title: c.titolo }),
                            url: c.mpd || "",
                            kid_key: c.kid_key || "",
                            slug: (c.slug || c.titolo).toLowerCase().replace(/[^a-z0-9]/g, "-")
                        })).filter(c => c.title !== foundCh?.title);
                        if (list.length > 0) {
                            sections.push({
                                title: cat.nome,
                                channels: list
                            });
                        }
                    });
                }

                setRelatedSections(sections);
            } catch(e) {}

            setLoading(false);
        }

        loadEvent();
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

    const isDazn1 = (channel?.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");

    return (
        <div style={{ backgroundColor: "#000000", minHeight: "100vh", color: "#ffffff", paddingBottom: "60px" }}>
            {/* Header / Navbar identica */}
            <div className="home-header-wrapper" style={{ position: "sticky", top: "14px", zIndex: 9999, marginBottom: "20px" }}>
                <div className="home-header">
                    <Link href="/">
                        <img src="/logos/premium_logo_dark.jpg" alt="Logo" className="brand-logo" />
                    </Link>
                    <nav className="sky-nav-links">
                        <Link href="/" className="nav-link"><i className="fas fa-house"></i>Home</Link>
                        <Link href="/?tab=sport" className="nav-link"><i className="fas fa-trophy"></i>Sport</Link>
                        <Link href="/?tab=intrattenimento" className="nav-link"><i className="fas fa-masks-theater"></i>Intrattenimento</Link>
                        <Link href="/?tab=eventi" className="nav-link active"><i className="fas fa-ticket"></i>Eventi</Link>
                    </nav>
                </div>
            </div>

            <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 16px" }}>
                <div className="event-main-stage">
                    <div className="player-wrapper">
                        {loading ? (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                                <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#e30a17", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
                            </div>
                        ) : (
                            <iframe
                                id="player-frame"
                                src={getIframeUrl()}
                                allowFullScreen
                                allow="autoplay; encrypted-media; fullscreen"
                                title="Player"
                            />
                        )}
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

                        {/* Deck Tasti Sorgente (Standard vs WARP e tasti GitHub per DAZN 1) */}
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

                            {isDazn1 && (
                                <div style={{ position: "relative", display: "inline-block" }}>
                                    <button
                                        type="button"
                                        className="event-source-btn"
                                        style={{ background: "rgba(255,255,255,0.08)" }}
                                        onClick={() => setShowGithubMenu(!showGithubMenu)}
                                    >
                                        <i className="fa-brands fa-github"></i>
                                        <span>Server GitHub</span>
                                        <i className="fa-solid fa-chevron-down" style={{ fontSize: "0.65rem", marginLeft: "4px" }}></i>
                                    </button>
                                    {showGithubMenu && (
                                        <div className="github-sources-menu" style={{ display: "flex" }}>
                                            <a
                                                href="https://raw.githubusercontent.com/luishighnest/zadonkais/main/test.json"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="github-sub-btn"
                                            >
                                                Zadonkais
                                            </a>
                                            <a
                                                href="https://raw.githubusercontent.com/luishighnest/kodi/main/test.json"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="github-sub-btn"
                                            >
                                                Kodi
                                            </a>
                                            <a
                                                href="https://github.com/luishighnest/next"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="github-sub-btn"
                                            >
                                                Next Repo
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sezioni Correlate */}
                <div style={{ marginTop: "40px" }}>
                    {relatedSections.map(sec => (
                        <CarouselSection
                            key={sec.title}
                            title={sec.title}
                            channels={sec.channels}
                        />
                    ))}
                </div>
            </main>
        </div>
    );
}
