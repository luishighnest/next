"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import { fetchSecureJson, isStreamWarp } from "@/lib/crypto";

export default function EventoPlayerPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug ? String(params.slug).toLowerCase() : "";

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
                const stored = sessionStorage.getItem("daznEventChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const cleanStoredSlug = (parsed.slug || parsed.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    const targetSlug = slug.replace(/[^a-z0-9]/g, "");
                    if (cleanStoredSlug === targetSlug || cleanStoredSlug.includes(targetSlug) || targetSlug.includes(cleanStoredSlug)) {
                        foundCh = parsed;
                    }
                }
            } catch(e) {}

            // 2. Fetch da test.json se non trovato
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
                                        dazn_token: ev.dazn_token || ""
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
                                    title: grp === "EVENTI" ? "Sky Sport" : (items.find(x => x.name || x.title) || {}).name || "DAZN 1",
                                    group: grp,
                                    provider: grp === "EVENTI" ? "SKY SPORT" : "DAZN",
                                    logo: "/logos/dazn.png",
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
                const [daznData, skyData] = await Promise.allSettled([
                    fetchSecureJson("/test.json"),
                    fetchSecureJson("/sky.json")
                ]);
                const sections = [];
                if (daznData.status === "fulfilled" && daznData.value) {
                    const firstGrp = Object.keys(daznData.value)[0];
                    if (firstGrp && Array.isArray(daznData.value[firstGrp])) {
                        sections.push({
                            title: "Altri Eventi in Diretta",
                            channels: daznData.value[firstGrp].slice(0, 12).map(ev => ({
                                title: ev.name || ev.title,
                                group: firstGrp,
                                image: ev.image || "",
                                logo: "/logos/dazn.png",
                                url: ev.mpd || "",
                                kid_key: ev.key || "",
                                slug: (ev.name || ev.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-")
                            }))
                        });
                    }
                }
                setRelatedSections(sections);
            } catch(e) {}

            setLoading(false);
        }

        loadEvent();
    }, [slug]);

    // Costruzione URL Iframe per estensione Chrome
    const getIframeUrl = () => {
        if (!selectedSource || !selectedSource.url) return "";
        const EXT = "chrome-extension://opmeopcambhfimffbomjgemehjkbbmji/pages/player.html#";
        let ckParam = "";
        const rawKey = selectedSource.kid_key || "";
        if (rawKey && rawKey.includes(":")) {
            const parts = rawKey.split(":");
            const ckObj = {};
            ckObj[parts[0].trim()] = parts[1].trim();
            try { ckParam = "ck=" + btoa(JSON.stringify(ckObj)); } catch(e) {}
        }
        let headersParam = "";
        if (selectedSource.ua) {
            try { headersParam = "headers=" + btoa(JSON.stringify({ "User-Agent": selectedSource.ua })); } catch(e) {}
        }
        const extraParams = [ckParam, headersParam].filter(Boolean);
        const sep = selectedSource.url.includes("?") ? "&" : "?";
        return EXT + selectedSource.url + (extraParams.length ? sep + extraParams.join("&") : "");
    };

    const isDazn1 = (channel?.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");

    return (
        <div style={{ backgroundColor: "#000000", minHeight: "100vh", color: "#ffffff" }}>
            <Navbar activeFilter="all" />

            <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 16px 60px" }}>
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

                        {/* Deck Tasti Sorgente (Standard vs WARP e 3 bottoni GitHub per DAZN 1) */}
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

                            {/* Tasto speciale DAZN 1 con 3 link GitHub che aprono il browser */}
                            {isDazn1 && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    <button
                                        type="button"
                                        className="event-source-btn"
                                        style={{ background: showGithubMenu ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.25)" }}
                                        onClick={() => setShowGithubMenu(!showGithubMenu)}
                                        title="Link GitHub Luishighnest"
                                    >
                                        <i className="fa-brands fa-github"></i>
                                        <span>GitHub {showGithubMenu ? "▲" : "▼"}</span>
                                    </button>

                                    {showGithubMenu && (
                                        <div className="github-links-container">
                                            <a
                                                href="https://github.com/luishighnest/kodi"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="github-sub-btn"
                                            >
                                                <i className="fa-brands fa-github"></i> kodi
                                            </a>
                                            <a
                                                href="https://github.com/luishighnest/zadonkais"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="github-sub-btn"
                                            >
                                                <i className="fa-brands fa-github"></i> zadonkais
                                            </a>
                                            <a
                                                href="https://github.com/luishighnest/telegram-calcio-bot"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="github-sub-btn"
                                            >
                                                <i className="fa-brands fa-github"></i> telegram-calcio-bot
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sezione Canali Correlati */}
                <div className="related-section">
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
