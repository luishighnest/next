"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CarouselSection from "@/components/CarouselSection";
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
        setSelectedSource(null);

        async function loadEvent() {
            let foundCh = null;

            // 1. Session Storage check per risposta istantanea
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

            try {
                const ts = Date.now();
                const res = await fetch(`/api/canali?t=${ts}`, { cache: "no-store" })
                    .then(r => r.json())
                    .catch(() => null);

                const targetSlug = slug.replace(/[^a-z0-9]/g, "");

                // Cerca il canale nelle sezioni restituite dall'API unificata
                if (res && Array.isArray(res.sections)) {
                    for (const sec of res.sections) {
                        for (const c of (sec.channels || [])) {
                            const cSlug = (c.slug || c.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                            if (cSlug === targetSlug || cSlug.includes(targetSlug) || targetSlug.includes(cSlug)) {
                                foundCh = c;
                                break;
                            }
                        }
                        if (foundCh && foundCh.sources?.length > 0) break;
                    }
                }

                // Se non trovato nelle sezioni, cerca nei canali Sky completi
                if ((!foundCh || !foundCh.url) && res) {
                    const allSky = [...(res.sky1 || []), ...(res.sky2 || [])];
                    for (const c of allSky) {
                        const cSlug = (c.slug || c.name || c.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                        if (cSlug === targetSlug || cSlug.includes(targetSlug) || targetSlug.includes(cSlug)) {
                            foundCh = {
                                title: c.name || c.title,
                                group: c.group,
                                provider: "SKY",
                                logo: c.logo,
                                url: c.url,
                                kid_key: c.kid_key,
                                sources: [{
                                    name: "Standard",
                                    isWarp: false,
                                    url: c.url,
                                    kid_key: c.kid_key
                                }]
                            };
                            break;
                        }
                    }
                }

                if (foundCh && isMounted) {
                    setChannel(prev => {
                        if (prev && prev.title === foundCh.title && prev.sources?.length === foundCh.sources?.length) {
                            return prev;
                        }
                        return foundCh;
                    });

                    setSelectedSource(prevSource => {
                        if (prevSource) {
                            // L'utente ha già scelto una sorgente (es. Standard o WARP): NON sovrascriverla MAI al refresh o polling!
                            const stillMatches = foundCh.sources?.find(s =>
                                (s.name === prevSource.name) ||
                                (s.url && prevSource.url && s.url === prevSource.url)
                            );
                            if (stillMatches) {
                                if (prevSource.url === stillMatches.url && prevSource.kid_key === stillMatches.kid_key && prevSource.name === stillMatches.name) {
                                    return prevSource;
                                }
                                return stillMatches;
                            }
                        }
                        // Solo al primo caricamento assoluto seleziona la prima sorgente
                        return (foundCh.sources && foundCh.sources.length > 0) ? foundCh.sources[0] : {
                            name: "Standard",
                            isWarp: false,
                            url: foundCh.url,
                            kid_key: foundCh.kid_key
                        };
                    });
                }

                // Costruisci le sezioni correlate
                const sections = [];
                const currentPlayingTitle = foundCh?.title || "";
                const currentPlayingGroup = foundCh?.group || "";

                if (res && Array.isArray(res.sections)) {
                    // 0. Se il canale appartiene a una categoria TV (es. Eurosport, SuperTennis), mostra prima quella categoria (escludendo Digitale Terrestre)
                    const EXCLUDED_CATEGORIES = ["digitale terrestre", "rai", "mediaset", "discovery"];
                    const sameCatSec = res.sections.find(sec => {
                        if (EXCLUDED_CATEGORIES.some(ex => sec.title.toLowerCase().includes(ex))) return false;
                        return (currentPlayingGroup && sec.title.toLowerCase() === currentPlayingGroup.toLowerCase()) ||
                               (sec.channels || []).some(c => c.title === currentPlayingTitle);
                    });

                    if (sameCatSec) {
                        const filtered = (sameCatSec.channels || []).filter(c => c.title !== currentPlayingTitle);
                        if (filtered.length > 0) {
                            sections.push({
                                title: sameCatSec.title,
                                channels: filtered
                            });
                        }
                    }

                    // 1. Aggiungi tutte le altre sezioni (escludendo il canale attualmente in riproduzione)
                    res.sections.forEach(sec => {
                        if (sameCatSec && sec.title === sameCatSec.title) return;
                        const filtered = (sec.channels || []).filter(c => c.title !== currentPlayingTitle);
                        if (filtered.length > 0) {
                            sections.push({
                                title: sec.title,
                                channels: filtered
                            });
                        }
                    });
                }

                if (isMounted) {
                    setRelatedSections(sections);
                }
            } catch(e) {
                console.error("Errore caricamento evento:", e);
            } finally {
                if (isMounted) setLoading(false);
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
                        <Link href="/" className="nav-link"><i className="fas fa-house" style={{ marginRight: "6px" }}></i>Home</Link>
                        <Link href="/?tab=sport" className="nav-link"><i className="fas fa-trophy" style={{ marginRight: "6px" }}></i>Sport</Link>
                        <Link href="/?tab=intrattenimento" className="nav-link"><i className="fas fa-masks-theater" style={{ marginRight: "6px" }}></i>Intrattenimento</Link>
                        <Link href="/?tab=eventi" className="nav-link active"><i className="fas fa-ticket" style={{ marginRight: "6px" }}></i>Eventi</Link>
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
                                    <span className="event-tag">{channel?.group || channel?.category || "EVENTI"}</span>
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
