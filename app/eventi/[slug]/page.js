"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import MobileEventoView from "@/components/MobileEventoView";
import { useDeviceState } from "@/components/DeviceProvider";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { matchSlug, getChannelSlug } from "@/lib/slug";
import { getTechSettings } from "@/lib/settings";
import { buildExtensionUrl, DEFAULT_EXT_ID } from "@/lib/extensionPlayer";
import GuidaTvModal from "@/components/GuidaTvModal";
import SettingsModal from "@/components/SettingsModal";

import { getNormalizedSources, getInitialSource } from "@/lib/sources";

export default function EventoPlayerPage() {
    const router = useRouter();
    const { isMobile } = useDeviceState();
    const params = useParams();
    const slug = params?.slug ? String(params.slug).toLowerCase() : "";

    const [channel, setChannel] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, slug)) return parsed;
                }
                const cached = localStorage.getItem("nmdz_cached_sections");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        for (const sec of parsed) {
                            for (const c of (sec.channels || [])) {
                                if (matchSlug(c, slug)) return c;
                            }
                        }
                    }
                }
            } catch(e) {}
        }
        return null;
    });

    const [selectedSource, setSelectedSource] = useState(() => getInitialSource(channel));
    const [relatedSections, setRelatedSections] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const cached = localStorage.getItem("nmdz_cached_sections");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        return parsed.filter(s => s.channels?.some(c => c.isTestJson) || s.navbar === "eventi");
                    }
                }
            } catch(e) {}
        }
        return [];
    });

    const [loading, setLoading] = useState(() => !channel);
    const [mounted, setMounted] = useState(false);
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [transPoster, setTransPoster] = useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_poster") || ""; } catch(e) {}
        }
        return "";
    });

    // Stati Player e Contenitore Fullscreen
    const containerRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(true);

    // Modali
    const [isGuidaOpen, setIsGuidaOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Drawer Canali
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");

    // Overlay auto-hide (scompare dopo 3 secondi di inattività mouse, ricompare subito al movimento)
    const [isUserActive, setIsUserActive] = useState(true);
    const idleTimerRef = useRef(null);

    const handleMouseMove = useCallback(() => {
        setIsUserActive(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setIsUserActive(false);
        }, 3000);
    }, []);

    const handleBack = () => {
        let target = "/eventi";
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_returnPath");
                if (stored && !stored.startsWith("/sky") && !stored.startsWith("/eventi") && !stored.startsWith("/evento")) {
                    target = stored;
                }
            } catch(e) {}
        }
        router.push(target);
    };

    useEffect(() => {
        setMounted(true);
        const handleFsChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener("fullscreenchange", handleFsChange);

        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        window.addEventListener("pointermove", handleMouseMove, { passive: true });

        idleTimerRef.current = setTimeout(() => {
            setIsUserActive(false);
        }, 3000);

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            document.removeEventListener("fullscreenchange", handleFsChange);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("pointermove", handleMouseMove);
        };
    }, [handleMouseMove]);

    // Reset stato al cambio sorgente
    useEffect(() => {
        setHasStartedPlaying(false);
        setIsVideoBuffering(true);
        handleMouseMove();
    }, [selectedSource, slug, handleMouseMove]);

    const toggleFullscreen = () => {
        const el = containerRef.current || document.documentElement;
        if (!document.fullscreenElement) {
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(() => {});
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    };

    // ─── Caricamento canali ───────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, slug)) {
                        setChannel(parsed);
                        setSelectedSource(getInitialSource(parsed));
                        setLoading(false);
                    }
                }
            } catch(e) {}
        }

        async function loadEvent() {
            let foundCh = null;

            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, slug)) {
                        foundCh = parsed;
                        if (isMounted) {
                            setChannel(foundCh);
                            setSelectedSource(prev => prev?.url ? prev : getInitialSource(foundCh));
                            setLoading(false);
                        }
                    }
                }
            } catch(e) {}

            try {
                const res = await fetch(`/api/canali`).then(r => r.json()).catch(() => null);

                if (res && Array.isArray(res.sections)) {
                    for (const sec of res.sections) {
                        for (const c of (sec.channels || [])) {
                            if (matchSlug(c, slug)) { foundCh = c; break; }
                        }
                        if (foundCh?.sources?.length > 0) break;
                    }
                }

                if ((!foundCh || !foundCh.url) && res) {
                    const allSky = [...(res.sky1 || []), ...(res.sky2 || [])];
                    for (const c of allSky) {
                        if (matchSlug(c, slug)) {
                            foundCh = {
                                title: c.name || c.title,
                                group: c.group,
                                provider: "SKY",
                                logo: c.logo,
                                url: c.url,
                                kid_key: c.kid_key,
                                slug: getChannelSlug(c),
                                sources: [{ name: "Standard", isWarp: false, url: c.url, kid_key: c.kid_key }]
                            };
                            break;
                        }
                    }
                }

                if (foundCh) {
                    const professionalSlug = getChannelSlug(foundCh);
                    if (professionalSlug && professionalSlug !== slug && typeof window !== "undefined") {
                        try { window.history.replaceState(null, "", `/eventi/${professionalSlug}`); } catch(e) {}
                    }
                }

                if (foundCh && isMounted) {
                    setChannel(prev => {
                        if (prev && prev.title === foundCh.title && prev.sources?.length === foundCh.sources?.length) return prev;
                        return foundCh;
                    });
                    setSelectedSource(prevSource => {
                        if (prevSource?.url) {
                            const stillMatches = foundCh.sources?.find(s => (s.name === prevSource.name) || (s.url && prevSource.url && s.url === prevSource.url));
                            if (stillMatches) {
                                if (prevSource.url === stillMatches.url && prevSource.kid_key === stillMatches.kid_key) return prevSource;
                                return stillMatches;
                            }
                        }
                        return getInitialSource(foundCh);
                    });
                    setLoading(false);
                }

                const sections = [];
                const currentPlayingTitle = foundCh?.title || "";
                const currentPlayingGroup = foundCh?.group || "";

                if (res && Array.isArray(res.sections)) {
                    const EXCLUDED_CATEGORIES = ["digitale terrestre", "rai", "mediaset", "discovery"];
                    const sameCatSec = res.sections.find(sec => {
                        if (EXCLUDED_CATEGORIES.some(ex => sec.title.toLowerCase().includes(ex))) return false;
                        return (currentPlayingGroup && sec.title.toLowerCase() === currentPlayingGroup.toLowerCase()) ||
                               (sec.channels || []).some(c => c.title === currentPlayingTitle);
                    });

                    if (sameCatSec) {
                        const filtered = (sameCatSec.channels || []).filter(c => c.title !== currentPlayingTitle);
                        if (filtered.length > 0) sections.push({ title: sameCatSec.title, channels: filtered });
                    }

                    res.sections.forEach(sec => {
                        if (sameCatSec && sec.title === sameCatSec.title) return;
                        const filtered = (sec.channels || []).filter(c => c.title !== currentPlayingTitle);
                        if (filtered.length > 0) sections.push({ title: sec.title, channels: filtered });
                    });
                }

                if (isMounted) setRelatedSections(sections);
            } catch(e) {
                console.error("Errore caricamento evento:", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadEvent();

        const tech = getTechSettings();
        const pollMs = (tech.pollIntervalSec || 5) * 1000;
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") loadEvent();
        }, pollMs);

        const onFocus = () => { if (document.visibilityState === "visible") loadEvent(); };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, [slug]);

    // ─── Elenco canali e filtri ───────────────────────────────────────────────
    const allChannelsList = useMemo(() => {
        const list = [];
        const seen = new Set();
        relatedSections.forEach(sec => {
            (sec.channels || []).forEach(ch => {
                const key = getChannelSlug(ch) || ch.title || ch.name;
                if (!seen.has(key)) { seen.add(key); list.push({ ...ch, sectionCategory: sec.title }); }
            });
        });
        return list;
    }, [relatedSections]);

    const availableCategories = useMemo(() => {
        const cats = [];
        relatedSections.forEach(sec => { if (sec.title && !cats.includes(sec.title)) cats.push(sec.title); });
        return cats;
    }, [relatedSections]);

    const filteredChannels = useMemo(() => {
        return allChannelsList.filter(ch => {
            const title = (ch.title || ch.name || "").toLowerCase();
            const grp = (ch.group || ch.category || ch.sectionCategory || "").toLowerCase();
            const matchesSearch = !searchQuery || title.includes(searchQuery.toLowerCase()) || grp.includes(searchQuery.toLowerCase());
            const matchesCat = activeTab === "all" || (ch.sectionCategory && ch.sectionCategory.toLowerCase() === activeTab.toLowerCase()) || grp.includes(activeTab.toLowerCase());
            return matchesSearch && matchesCat;
        });
    }, [allChannelsList, searchQuery, activeTab]);

    const handleSelectChannel = (ch) => {
        if (!ch) return;
        const epg = getCurrentProgramInfo(ch.epg);
        const newPoster = ch.image || epg?.immagine || "";
        if (newPoster) {
            setTransPoster(newPoster);
            try { sessionStorage.setItem("nmdz_transition_poster", newPoster); } catch(e) {}
        }
        setChannel(ch);
        setSelectedSource(getInitialSource(ch));
        try {
            sessionStorage.setItem("daznEventChannel", JSON.stringify(ch));
            sessionStorage.setItem("daznCustomChannel", JSON.stringify(ch));
        } catch(e) {}
        const newSlug = getChannelSlug(ch);
        if (newSlug) window.history.replaceState(null, "", `/eventi/${newSlug}`);
        if (typeof window !== "undefined" && window.innerWidth < 880) setIsSidebarOpen(false);
    };

    const handleNextChannel = () => {
        const currentList = filteredChannels.length > 0 ? filteredChannels : allChannelsList;
        if (currentList.length === 0) return;
        const currentKey = getChannelSlug(channel) || channel?.title;
        const curIdx = currentList.findIndex(c => (getChannelSlug(c) || c.title) === currentKey);
        handleSelectChannel(currentList[(curIdx + 1) % currentList.length]);
    };

    const handlePrevChannel = () => {
        const currentList = filteredChannels.length > 0 ? filteredChannels : allChannelsList;
        if (currentList.length === 0) return;
        const currentKey = getChannelSlug(channel) || channel?.title;
        const curIdx = currentList.findIndex(c => (getChannelSlug(c) || c.title) === currentKey);
        handleSelectChannel(currentList[(curIdx - 1 + currentList.length) % currentList.length]);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowUp") { e.preventDefault(); handlePrevChannel(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); handleNextChannel(); }
            else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filteredChannels, allChannelsList, channel]);

    const playerSrc = selectedSource ? buildExtensionUrl(selectedSource, {
        title: channel?.title,
        dazn_token: channel?.dazn_token,
        isDazn: channel?.isTestJson || (channel?.group && channel?.group.toUpperCase().includes("EVENTI"))
    }) : "";

    if (isMobile) {
        return (
            <MobileEventoView
                channel={channel}
                selectedSource={selectedSource}
                setSelectedSource={setSelectedSource}
                relatedSections={relatedSections}
                getIframeUrl={() => playerSrc}
            />
        );
    }

    const currentEpg = getCurrentProgramInfo(channel?.epg);
    const coverImg = channel?.image || (currentEpg?.immagine || null);
    const isTestJsonEvent = channel?.isTestJson || (channel?.group && channel?.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel?.eventSlug);
    const fallbackLogo = isTestJsonEvent ? "/logos/dazn.png" : (getChannelLogoUrl(channel) || "/logos/dazn.png");
    const displayLogo = channel?.logo || fallbackLogo;

    return (
        <div
            ref={containerRef}
            className={`sky-app ${mounted ? "is-mounted" : "is-mounting"} ${isFullscreen ? "is-fullscreen" : ""}`}
            onMouseMove={handleMouseMove}
            onClick={handleMouseMove}
        >
            {/* Tasto Minimal Indietro */}
            <button
                type="button"
                className={`sky-back-minimal-btn ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}
                onClick={handleBack}
                title="Torna indietro"
                aria-label="Torna indietro"
            >
                <span className="material-symbols-rounded">arrow_back</span>
            </button>

            <main className="sky-main">
                {/* 1. Fullscreen Player Container con Iframe Estensione */}
                <div className="sky-native-player-container">
                    {/* Copertina di preload */}
                    {Boolean(transPoster || coverImg) && !hasStartedPlaying && (
                        <div className="sky-player-backdrop-preload">
                            <img
                                src={transPoster || coverImg}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.55) contrast(1.05)" }}
                            />
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 40%, rgba(3,5,10,0.92) 85%, rgba(1,2,5,0.98) 100%)" }} />
                            {!loading && displayLogo && (
                                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-62%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                                    <div className="evento-preload-logo-box">
                                        <img src={displayLogo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.9)) contrast(1.1)" }} />
                                    </div>
                                    <div className="evento-preload-channel-name">{channel?.title || ""}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Player Iframe Estensione Chrome */}
                    <iframe
                        id="player-frame"
                        src={playerSrc}
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen"
                        title={channel?.title || "Player"}
                        onLoad={() => {
                            setTimeout(() => {
                                setIframeLoaded(true);
                                setHasStartedPlaying(true);
                                setIsVideoBuffering(false);
                            }, 300);
                        }}
                        style={{
                            display: "block",
                            width: "100%",
                            height: "100%",
                            border: "none",
                            background: "#000000",
                            opacity: iframeLoaded ? 1 : 0.85,
                            transition: "opacity 0.4s ease-in-out"
                        }}
                    />

                    {/* Vignetta cinematografica */}
                    <div className={`sky-player-vignette ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`} />

                    {/* Spinner */}
                    {(isVideoBuffering || loading || !hasStartedPlaying) && (
                        <div className="sky-native-loader">
                            <div className="sky-spinner" style={{ width: "52px", height: "52px", borderWidth: "3.5px" }} />
                        </div>
                    )}
                </div>

                {/* 2. Deck Overlay Inferiore */}
                <div className={`sky-player-overlay-bottom ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}>
                    <div className="sky-player-modern-deck">

                        {/* Header Info */}
                        <div className="sky-player-info-row">
                            <div className="sky-player-meta-left">
                                <div className="sky-modern-logo-box">
                                    <img src={displayLogo} className="sky-modern-logo" alt="" />
                                </div>
                                <div className="sky-player-meta-details">
                                    <div className="sky-player-tag-row">
                                        <div className="sky-channel-name-badge">
                                            <span className="sky-channel-name-text">{channel?.title || "Evento"}</span>
                                        </div>
                                        <span className="live-badge"><span className="dot"></span>LIVE</span>
                                        <span className="now-group">{channel?.group || channel?.category || "EVENTI"}</span>
                                        {channel?.ora && (
                                            <span className="now-expiry-badge">
                                                <i className="fa-regular fa-clock"></i>
                                                <span>Ore {channel.ora}</span>
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="sky-player-big-title">
                                        {currentEpg?.titolo || channel?.title || "Diretta Evento"}
                                    </h2>
                                    <div className="sky-player-epg-subtitle">
                                        {currentEpg?.oraInizio ? `${currentEpg.oraInizio} • ${channel?.description || "Trasmissione in diretta"}` : (channel?.description || channel?.group || "Trasmissione in diretta")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Barra dei Controlli Inferiori Integrati (senza timeline finta) */}
                        <div className="sky-player-controls-bar">
                            {/* Sinistra: Badge Live & Switch Sorgente (Standard vs WARP) */}
                            <div className="sky-controls-group-left">
                                <span style={{ color: "#e30a17", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", letterSpacing: "0.5px" }}>
                                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#e30a17", display: "inline-block", boxShadow: "0 0 8px rgba(227,10,23,0.8)" }} />
                                    DIRETTA
                                </span>

                                {(() => {
                                    const realSources = getNormalizedSources(channel);
                                    if (realSources.length <= 1) return null;
                                    return (
                                        <div className="event-sources-deck">
                                            {realSources.map((s, idx) => {
                                                const isSelected = selectedSource?.url === s.url && selectedSource?.isWarp === s.isWarp;
                                                return (
                                                    <button
                                                        key={s.name + idx}
                                                        type="button"
                                                        className={`event-source-deck-btn ${isSelected ? "active" : ""}`}
                                                        onClick={() => setSelectedSource(s)}
                                                        title={`Passa a sorgente ${s.name}`}
                                                    >
                                                        {s.isWarp ? (
                                                            <i className="fa-solid fa-shield-halved" style={{ color: isSelected ? "#000000" : "#f38020" }}></i>
                                                        ) : (
                                                            <i className="fa-solid fa-bolt"></i>
                                                        )}
                                                        <span>{s.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Destra: Guida TV, Impostazioni Tecniche, Canali, Zapping, Fullscreen */}
                            <div className="sky-controls-group-right">
                                <button type="button" className="sky-modern-btn" onClick={() => setIsGuidaOpen(true)} title="Guida TV EPG">
                                    <span className="material-symbols-rounded">calendar_today</span>
                                    <span>Guida TV</span>
                                </button>

                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={() => setIsSettingsOpen(true)}
                                    title="Impostazioni Tecniche Generali"
                                >
                                    <span className="material-symbols-rounded">settings</span>
                                </button>

                                <button type="button" className="sky-channels-trigger-btn" onClick={() => setIsSidebarOpen(true)} title="Mostra tutti gli eventi e canali correlati">
                                    <i className="fas fa-list-ul" />
                                    <span>Canali</span>
                                </button>

                                <div className="zap-controls">
                                    <button type="button" className="zap-btn" onClick={handlePrevChannel} title="Evento precedente (↑)" aria-label="Evento precedente">
                                        <span className="material-symbols-rounded">keyboard_arrow_up</span>
                                    </button>
                                    <button type="button" className="zap-btn" onClick={handleNextChannel} title="Evento successivo (↓)" aria-label="Evento successivo">
                                        <span className="material-symbols-rounded">keyboard_arrow_down</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={toggleFullscreen}
                                    title={isFullscreen ? "Esci da schermo intero (f)" : "Schermo intero (f)"}
                                >
                                    <span className="material-symbols-rounded">
                                        {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Drawer Canali Correlati */}
                <div className={`sky-sidebar-backdrop ${isSidebarOpen ? "is-open" : ""}`} onClick={() => setIsSidebarOpen(false)} />

                <aside className={`sky-sidebar-popup ${isSidebarOpen ? "is-open" : ""}`}>
                    <div className="sky-sidebar-header">
                        <h3 className="sky-sidebar-header-title">
                            <i className="fas fa-tv" style={{ color: "#00e59b" }} />
                            <span>Dirette & Canali</span>
                        </h3>
                        <button type="button" className="sky-sidebar-close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Chiudi">
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>

                    <div className="sky-search">
                        <span className="material-symbols-rounded">search</span>
                        <input type="text" placeholder="Cerca evento o canale..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    <div className="sky-filters">
                        <button type="button" className={`sky-filter-btn ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")} title="Tutti">
                            <i className="fas fa-th-large"></i>
                        </button>
                        {availableCategories.map(cat => {
                            let icon = "fa-trophy";
                            const cl = cat.toLowerCase();
                            if (cl.includes("dazn")) icon = "fa-bolt";
                            else if (cl.includes("eurosport")) icon = "fa-flag-checkered";
                            else if (cl.includes("tennis")) icon = "fa-baseball";
                            else if (cl.includes("calcio") || cl.includes("serie a")) icon = "fa-futbol";
                            else if (cl.includes("basket")) icon = "fa-basketball";
                            else if (cl.includes("motori") || cl.includes("f1")) icon = "fa-car";
                            else icon = "fa-tv";
                            return (
                                <button key={cat} type="button" className={`sky-filter-btn ${activeTab === cat ? "active" : ""}`} onClick={() => setActiveTab(cat)} title={cat}>
                                    <i className={`fas ${icon}`}></i>
                                </button>
                            );
                        })}
                    </div>

                    <div className="sky-list">
                        {filteredChannels.length === 0 ? (
                            <div className="sky-empty">Nessun canale o evento trovato.</div>
                        ) : (
                            filteredChannels.map((ch, idx) => {
                                const currentKey = getChannelSlug(channel) || channel?.title;
                                const itemKey = getChannelSlug(ch) || ch.title;
                                const active = currentKey && itemKey && (currentKey === itemKey || matchSlug(ch, currentKey));
                                const epg = getCurrentProgramInfo(ch.epg);
                                const itemPoster = ch.image || epg?.immagine || null;
                                const isItemTestJson = ch.isTestJson || (ch.group && ch.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(ch.eventSlug);
                                const itemLogo = ch.logo || (isItemTestJson ? "/logos/dazn.png" : getChannelLogoUrl(ch));

                                return (
                                    <div
                                        key={(ch.title || ch.name) + idx}
                                        className={`sky-item ${active ? "active" : ""}`}
                                        onClick={() => handleSelectChannel(ch)}
                                    >
                                        <div className="sky-item-thumb-box">
                                            {itemPoster && <img src={itemPoster} className="sky-item-poster-bg" alt="" />}
                                            <img src={itemLogo || "/logos/dazn.png"} className="sky-item-logo-overlay" alt="" />
                                        </div>
                                        <div className="sky-item-info">
                                            <div className="sky-item-header-row">
                                                <div className="sky-item-name">{ch.title || ch.name}</div>
                                                {active && <span className="sky-item-live">LIVE</span>}
                                            </div>
                                            <div className="sky-item-epg">
                                                {ch.ora ? (
                                                    <span className="sky-item-epg-time">Ore {ch.ora}</span>
                                                ) : epg?.oraInizio ? (
                                                    <span className="sky-item-epg-time">{epg.oraInizio}</span>
                                                ) : null}
                                                <span className="sky-item-epg-title">{ch.group || ch.sectionCategory || epg?.titolo || "In diretta"}</span>
                                            </div>
                                            {epg && epg.percentuale !== undefined && (
                                                <div className="sky-item-progress">
                                                    <div className="sky-item-progress-bar" style={{ width: `${epg.percentuale}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            </main>

            <GuidaTvModal isOpen={isGuidaOpen} onClose={() => setIsGuidaOpen(false)} />
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </div>
    );
}
