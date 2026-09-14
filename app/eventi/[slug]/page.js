"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import MobileEventoView from "@/components/MobileEventoView";
import { useDeviceState } from "@/components/DeviceProvider";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { matchSlug, getChannelSlug } from "@/lib/slug";
import { getTechSettings } from "@/lib/settings";
import GuidaTvModal from "@/components/GuidaTvModal";
import SettingsModal from "@/components/SettingsModal";

const DEFAULT_EXT_ID = "opmeopcambhfimffbomjgemehjkbbmji";

function getInitialSource(ch) {
    if (!ch) return null;
    if (Array.isArray(ch.sources) && ch.sources.length > 0) return ch.sources[0];
    if (ch.url) {
        return {
            name: "Standard",
            isWarp: false,
            url: ch.url,
            kid_key: ch.kid_key || "",
            ua: ch.ua || "",
            dazn_token: ch.dazn_token || ""
        };
    }
    return null;
}

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
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
    const [transPoster, setTransPoster] = useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_poster") || ""; } catch(e) {}
        }
        return "";
    });

    // Modali Guida TV e Impostazioni
    const [isGuidaOpen, setIsGuidaOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Stato Drawer Canali a destra (popup nel player come in /sky)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");

    // Controlli Overlay (auto-hide deck e tasto indietro su inattività mouse)
    const [isUserActive, setIsUserActive] = useState(true);
    const idleTimerRef = useRef(null);

    const handleMouseMove = () => {
        setIsUserActive(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setIsUserActive(false);
        }, 4000);
    };

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
        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, []);

    useEffect(() => {
        setIframeLoaded(false);
        setHasStartedPlaying(false);
    }, [selectedSource, slug]);

    useEffect(() => {
        let isMounted = true;

        // Se lo slug cambia (es. navigazione o click su correlati), aggiorna subito da sessionStorage
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

            // 1. Session Storage check per risposta istantanea
            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, slug)) {
                        foundCh = parsed;
                        if (isMounted) {
                            setChannel(foundCh);
                            setSelectedSource(prev => prev && prev.url ? prev : getInitialSource(foundCh));
                            setLoading(false);
                        }
                    }
                }
            } catch(e) {}

            try {
                const res = await fetch(`/api/canali`)
                    .then(r => r.json())
                    .catch(() => null);

                // Cerca il canale nelle sezioni restituite dall'API unificata
                if (res && Array.isArray(res.sections)) {
                    for (const sec of res.sections) {
                        for (const c of (sec.channels || [])) {
                            if (matchSlug(c, slug)) {
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
                        if (matchSlug(c, slug)) {
                            foundCh = {
                                title: c.name || c.title,
                                group: c.group,
                                provider: "SKY",
                                logo: c.logo,
                                url: c.url,
                                kid_key: c.kid_key,
                                slug: getChannelSlug(c),
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

                // Sincronizza l'URL nel browser con lo slug professionale se diverso da quello grezzo
                if (foundCh) {
                    const professionalSlug = getChannelSlug(foundCh);
                    if (professionalSlug && professionalSlug !== slug && typeof window !== "undefined") {
                        try {
                            window.history.replaceState(null, "", `/eventi/${professionalSlug}`);
                        } catch(e) {}
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
                        if (prevSource && prevSource.url) {
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
                        // Solo se non abbiamo ancora una sorgente valida
                        return getInitialSource(foundCh);
                    });
                    setLoading(false);
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

        // Polling automatico in background con intervallo configurabile da impostazioni tecniche
        const tech = getTechSettings();
        const pollMs = (tech.pollIntervalSec || 5) * 1000;
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                loadEvent();
            }
        }, pollMs);

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

    // Costruzione lista unificata e unica di tutti i canali ed eventi correlati per il drawer laterale
    const allChannelsList = useMemo(() => {
        const list = [];
        const seen = new Set();
        relatedSections.forEach(sec => {
            (sec.channels || []).forEach(ch => {
                const key = getChannelSlug(ch) || ch.title || ch.name;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({ ...ch, sectionCategory: sec.title });
                }
            });
        });
        return list;
    }, [relatedSections]);

    // Categorie disponibili per i filtri a pillola
    const availableCategories = useMemo(() => {
        const cats = [];
        relatedSections.forEach(sec => {
            if (sec.title && !cats.includes(sec.title)) {
                cats.push(sec.title);
            }
        });
        return cats;
    }, [relatedSections]);

    // Filtraggio canali per ricerca e categoria
    const filteredChannels = useMemo(() => {
        return allChannelsList.filter(ch => {
            const title = (ch.title || ch.name || "").toLowerCase();
            const grp = (ch.group || ch.category || ch.sectionCategory || "").toLowerCase();
            const matchesSearch = !searchQuery || title.includes(searchQuery.toLowerCase()) || grp.includes(searchQuery.toLowerCase());
            const matchesCat = activeTab === "all" || (ch.sectionCategory && ch.sectionCategory.toLowerCase() === activeTab.toLowerCase()) || grp.includes(activeTab.toLowerCase());
            return matchesSearch && matchesCat;
        });
    }, [allChannelsList, searchQuery, activeTab]);

    // Selezione canale dal drawer laterale o zapping
    const handleSelectChannel = (ch) => {
        if (!ch) return;
        setChannel(ch);
        setSelectedSource(getInitialSource(ch));
        try {
            sessionStorage.setItem("daznEventChannel", JSON.stringify(ch));
            sessionStorage.setItem("daznCustomChannel", JSON.stringify(ch));
        } catch(e) {}
        const newSlug = getChannelSlug(ch);
        if (newSlug) {
            window.history.replaceState(null, "", `/eventi/${newSlug}`);
        }
        if (typeof window !== "undefined" && window.innerWidth < 880) {
            setIsSidebarOpen(false);
        }
    };

    // Zapping canali successivi / precedenti
    const handleNextChannel = () => {
        const currentList = filteredChannels.length > 0 ? filteredChannels : allChannelsList;
        if (currentList.length === 0) return;
        const currentKey = getChannelSlug(channel) || channel?.title;
        const curIdx = currentList.findIndex(c => (getChannelSlug(c) || c.title) === currentKey);
        const nextIdx = (curIdx + 1) % currentList.length;
        handleSelectChannel(currentList[nextIdx]);
    };

    const handlePrevChannel = () => {
        const currentList = filteredChannels.length > 0 ? filteredChannels : allChannelsList;
        if (currentList.length === 0) return;
        const currentKey = getChannelSlug(channel) || channel?.title;
        const curIdx = currentList.findIndex(c => (getChannelSlug(c) || c.title) === currentKey);
        const prevIdx = (curIdx - 1 + currentList.length) % currentList.length;
        handleSelectChannel(currentList[prevIdx]);
    };

    // Scorciatoie da tastiera Freccia Su e Freccia Giù per zapping
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowUp") {
                e.preventDefault();
                handlePrevChannel();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                handleNextChannel();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filteredChannels, allChannelsList, channel]);

    // Costruzione URL Iframe per estensione Chrome
    const getIframeUrl = () => {
        if (!selectedSource || !selectedSource.url) return "";
        const tech = getTechSettings();
        const extId = tech.extensionId || DEFAULT_EXT_ID;
        const rawUrl = selectedSource.url.trim();
        const isTsStream = rawUrl.toLowerCase().includes(".ts");
        if (isTsStream) {
            const origin = typeof window !== "undefined" ? window.location.origin : "https://next-zeta-smoky.vercel.app";
            const m3uUrl = `${origin}/api/m3u?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(channel?.title || "Stream")}`;
            return `chrome-extension://${extId}/iptv/player.html#${m3uUrl}`;
        }
        const extPrefix = `chrome-extension://${extId}/pages/player.html#`;

        // Se l'URL è già una URL di estensione, normalizzala a chrome-extension:// per l'iframe
        if (rawUrl.startsWith("chrome-extension://") || rawUrl.startsWith("extension://")) {
            return rawUrl.replace(/^(chrome-extension|extension):\/\/[^/]+/, `chrome-extension://${extId}`);
        }

        // DAZN WARP: URL tipo https://cdn.dazn.com/@JWT/dash/stream.mpd?p=web
        // L'estensione si aspetta URL PULITA + JWT come dazn-token negli headers
        let mpdUrl = rawUrl;
        let daznToken = selectedSource.dazn_token || "";

        const warpMatch = rawUrl.match(/^(https?:\/\/[^/]+)\/@(eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)(\/.*)?$/);
        if (warpMatch) {
            daznToken = warpMatch[2];
            mpdUrl = warpMatch[1] + (warpMatch[3] || "");
        }

        // Costruisci ck= dal kid_key (formato "kid:key" o "kid:key,kid2:key2")
        let ckParam = "";
        const rawKey = selectedSource.kid_key || selectedSource.key || "";
        if (rawKey && rawKey.includes(":")) {
            const ckObj = {};
            const pairs = rawKey.split(",");
            pairs.forEach(pair => {
                const parts = pair.split(":");
                if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
                    ckObj[parts[0].trim()] = parts[1].trim();
                }
            });
            if (Object.keys(ckObj).length > 0) {
                try {
                    ckParam = "ck=" + encodeURIComponent(btoa(JSON.stringify(ckObj)));
                } catch(e) {}
            }
        }

        // Usa ESCLUSIVAMENTE lo user agent dell'evento estratto (se presente nel JSON)
        const rawUa = selectedSource.ua ? String(selectedSource.ua).trim() : "";

        // Costruisci headers con user-agent, referer, origin e dazn-token
        let headersParam = "";
        try {
            const headersObj = {
                "user-agent": rawUa,
                "referer": "https://www.dazn.com/",
                "origin": "https://www.dazn.com"
            };
            if (!rawUa) {
                delete headersObj["user-agent"];
            }
            if (daznToken) {
                headersObj["dazn-token"] = daznToken;
            }
            const jsonStr = JSON.stringify(headersObj);
            const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
            headersParam = "headers=" + encodeURIComponent(b64);
        } catch(e) {
            try { 
                const fallbackObj = { "referer": "https://www.dazn.com/", "origin": "https://www.dazn.com" };
                if (rawUa) fallbackObj["user-agent"] = rawUa;
                if (daznToken) fallbackObj["dazn-token"] = daznToken;
                headersParam = "headers=" + encodeURIComponent(btoa(JSON.stringify(fallbackObj))); 
            } catch(e2) {}
        }

        const extraParams = [ckParam, headersParam].filter(Boolean);
        const sep = mpdUrl.includes("?") ? "&" : "?";
        return extPrefix + mpdUrl + (extraParams.length ? sep + extraParams.join("&") : "");
    };

    if (isMobile) {
        return (
            <MobileEventoView
                channel={channel}
                selectedSource={selectedSource}
                setSelectedSource={setSelectedSource}
                relatedSections={relatedSections}
                getIframeUrl={getIframeUrl}
            />
        );
    }

    const currentEpg = getCurrentProgramInfo(channel?.epg);
    const coverImg = channel?.image || (currentEpg && currentEpg.immagine ? currentEpg.immagine : null);
    const isTestJsonEvent = channel?.isTestJson || (channel?.group && channel?.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel?.eventSlug);
    const fallbackLogo = isTestJsonEvent ? "/logos/dazn.png" : (getChannelLogoUrl(channel) || "/logos/dazn.png");
    const displayLogo = channel?.logo || fallbackLogo;

    return (
        <div
            className={`sky-app ${mounted ? "is-mounted" : "is-mounting"}`}
            onMouseMove={handleMouseMove}
            onClick={handleMouseMove}
        >
            {/* Tasto Minimal solo icona freccia indietro che riporta alla sezione di provenienza */}
            <button
                type="button"
                className={`sky-back-minimal-btn ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}
                onClick={handleBack}
                title="Torna indietro"
                aria-label="Torna indietro"
            >
                <span className="material-symbols-rounded">arrow_back</span>
            </button>

            {/* Layout Principale Fullscreen 100vw x 100vh */}
            <main className="sky-main">
                {/* 1. Fullscreen Player Container */}
                <div className="sky-native-player-container">
                    {/* Backdrop di preload per eliminare scatti prima dell'avvio: sparisce irreversibilmente al caricamento */}
                    {Boolean(transPoster || coverImg) && !hasStartedPlaying && (
                        <div className="sky-player-backdrop-preload">
                            <img
                                src={transPoster || coverImg}
                                alt=""
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    filter: "brightness(0.55) contrast(1.05)"
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 40%, rgba(3,5,10,0.92) 85%, rgba(1,2,5,0.98) 100%)"
                                }}
                            />
                        </div>
                    )}

                    {/* Iframe del player estensione con fit fullscreen 100% x 100% */}
                    <iframe
                        id="player-frame"
                        src={getIframeUrl()}
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen"
                        title="Player"
                        onLoad={() => {
                            setTimeout(() => {
                                setIframeLoaded(true);
                                setHasStartedPlaying(true);
                            }, 350);
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

                    {/* Overlay Vignetta cinematografica per contrasto UI */}
                    <div className={`sky-player-vignette ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`} />

                    {/* Spinner di caricamento centrale durante il buffering iniziale conforme allo screenshot */}
                    {(!iframeLoaded || loading || !hasStartedPlaying) && (
                        <div className="sky-native-loader">
                            <div className="sky-spinner" style={{ width: "52px", height: "52px", borderWidth: "3.5px" }} />
                        </div>
                    )}
                </div>

                {/* 2. Deck Overlay In Basso: Stile pulito Sky Glass / Apple TV */}
                <div className={`sky-player-overlay-bottom ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}>
                    <div className="sky-player-modern-deck">
                        {/* Header Info: Logo, Tag Live, Categoria, Ora e Titolo Grande */}
                        <div className="sky-player-info-row">
                            <div className="sky-player-meta-left">
                                <div className="sky-modern-logo-box">
                                    <img
                                        src={displayLogo}
                                        className="sky-modern-logo"
                                        alt=""
                                    />
                                </div>
                                <div className="sky-player-meta-details">
                                    <div className="sky-player-tag-row">
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
                                        {channel?.title || "Caricamento evento..."}
                                    </h2>
                                    <div className="sky-player-epg-subtitle">
                                        {currentEpg?.titolo ? `${currentEpg.oraInizio ? currentEpg.oraInizio + " • " : ""}${currentEpg.titolo}` : (channel?.description || "Trasmissione in diretta")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Fluida e Cliccabile */}
                        <div
                            className="sky-player-timeline-wrapper"
                            title="Trasmissione evento in diretta"
                        >
                            <div className="sky-player-timeline-track">
                                <div
                                    className="sky-player-timeline-buffer"
                                    style={{ width: "100%" }}
                                />
                                <div
                                    className="sky-player-timeline-fill"
                                    style={{
                                        width: `${currentEpg?.percentuale !== undefined ? currentEpg.percentuale : 100}%`
                                    }}
                                />
                                <div
                                    className="sky-player-timeline-thumb"
                                    style={{
                                        left: `${currentEpg?.percentuale !== undefined ? currentEpg.percentuale : 100}%`
                                    }}
                                />
                            </div>
                            <div className="sky-player-timeline-labels">
                                <span>{currentEpg?.oraInizio || channel?.ora || "In onda ora"}</span>
                                <span style={{ color: "#e30a17", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#e30a17" }} />
                                    DIRETTA LIVE
                                </span>
                            </div>
                        </div>

                        {/* Barra dei Controlli Inferiori Integrati */}
                        <div className="sky-player-controls-bar">
                            {/* Gruppo Sinistra: Switch Sorgente (Standard vs WARP) */}
                            <div className="sky-controls-group-left">
                                {channel?.sources && channel.sources.length > 1 && (
                                    <div className="event-sources-deck">
                                        {channel.sources.map((s, idx) => {
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
                                )}
                            </div>

                            {/* Gruppo Destra: Guida TV, Impostazioni, Canali, Zapping, Fullscreen */}
                            <div className="sky-controls-group-right">
                                <button
                                    type="button"
                                    className="sky-modern-btn"
                                    onClick={() => setIsGuidaOpen(true)}
                                    title="Apri Guida TV EPG"
                                >
                                    <span className="material-symbols-rounded">calendar_today</span>
                                    <span>Guida TV</span>
                                </button>

                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={() => setIsSettingsOpen(true)}
                                    title="Impostazioni Tecniche & Player"
                                >
                                    <span className="material-symbols-rounded">settings</span>
                                </button>

                                <button
                                    type="button"
                                    className="sky-channels-trigger-btn"
                                    onClick={() => setIsSidebarOpen(true)}
                                    title="Mostra tutti gli eventi e canali correlati"
                                >
                                    <i className="fas fa-list-ul" />
                                    <span>Canali</span>
                                </button>

                                <div className="zap-controls">
                                    <button
                                        type="button"
                                        className="zap-btn"
                                        onClick={handlePrevChannel}
                                        title="Evento precedente (Freccia Su ↑)"
                                        aria-label="Evento precedente"
                                    >
                                        <span className="material-symbols-rounded">keyboard_arrow_up</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="zap-btn"
                                        onClick={handleNextChannel}
                                        title="Evento successivo (Freccia Giù ↓)"
                                        aria-label="Evento successivo"
                                    >
                                        <span className="material-symbols-rounded">keyboard_arrow_down</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={() => {
                                        if (!document.fullscreenElement) {
                                            document.documentElement.requestFullscreen().catch(() => {});
                                        } else {
                                            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                                        }
                                    }}
                                    title="Schermo intero"
                                >
                                    <span className="material-symbols-rounded">fullscreen</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Backdrop e Drawer Popup Laterale a Destra (nel player) */}
                <div
                    className={`sky-sidebar-backdrop ${isSidebarOpen ? "is-open" : ""}`}
                    onClick={() => setIsSidebarOpen(false)}
                />

                <aside className={`sky-sidebar-popup ${isSidebarOpen ? "is-open" : ""}`}>
                    {/* Header Drawer */}
                    <div className="sky-sidebar-header">
                        <h3 className="sky-sidebar-header-title">
                            <i className="fas fa-tv" style={{ color: "#00e59b" }} />
                            <span>Dirette & Canali</span>
                        </h3>
                        <button
                            type="button"
                            className="sky-sidebar-close-btn"
                            onClick={() => setIsSidebarOpen(false)}
                            aria-label="Chiudi elenco canali"
                        >
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>

                    {/* Barra di ricerca */}
                    <div className="sky-search">
                        <span className="material-symbols-rounded">search</span>
                        <input
                            type="text"
                            placeholder="Cerca evento o canale..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filtri a pillola orizzontali */}
                    <div className="sky-filters">
                        <button
                            type="button"
                            className={`sky-filter-btn ${activeTab === "all" ? "active" : ""}`}
                            onClick={() => setActiveTab("all")}
                            title="Tutti"
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        {availableCategories.map(cat => {
                            let icon = "fa-trophy";
                            const cl = cat.toLowerCase();
                            if (cl.includes("dazn")) icon = "fa-bolt";
                            else if (cl.includes("eurosport")) icon = "fa-flag-checkered";
                            else if (cl.includes("supertennis") || cl.includes("tennis")) icon = "fa-baseball";
                            else if (cl.includes("calcio") || cl.includes("serie a")) icon = "fa-futbol";
                            else if (cl.includes("basket")) icon = "fa-basketball";
                            else if (cl.includes("motori") || cl.includes("f1")) icon = "fa-car";
                            else icon = "fa-tv";

                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`sky-filter-btn ${activeTab === cat ? "active" : ""}`}
                                    onClick={() => setActiveTab(cat)}
                                    title={cat}
                                >
                                    <i className={`fas ${icon}`}></i>
                                </button>
                            );
                        })}
                    </div>

                    {/* Elenco Canali ed Eventi Correlati (Locandine in popup) */}
                    <div className="sky-list">
                        {filteredChannels.length === 0 ? (
                            <div className="sky-empty">Nessun canale o evento trovato.</div>
                        ) : (
                            filteredChannels.map((ch, idx) => {
                                const currentKey = getChannelSlug(channel) || channel?.title;
                                const itemKey = getChannelSlug(ch) || ch.title;
                                const active = currentKey && itemKey && (currentKey === itemKey || matchSlug(ch, currentKey));

                                const epg = getCurrentProgramInfo(ch.epg);
                                const itemPoster = ch.image || (epg && epg.immagine ? epg.immagine : null);
                                const isItemTestJson = ch.isTestJson || (ch.group && ch.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(ch.eventSlug);
                                const itemLogo = ch.logo || (isItemTestJson ? "/logos/dazn.png" : getChannelLogoUrl(ch));

                                return (
                                    <div
                                        key={(ch.title || ch.name) + idx}
                                        className={`sky-item ${active ? "active" : ""}`}
                                        onClick={() => handleSelectChannel(ch)}
                                    >
                                        <div className="sky-item-thumb-box">
                                            {itemPoster && (
                                                <img src={itemPoster} className="sky-item-poster-bg" alt="" />
                                            )}
                                            <img
                                                src={itemLogo || "/logos/dazn.png"}
                                                className="sky-item-logo-overlay"
                                                alt=""
                                            />
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
                                                <span className="sky-item-epg-title">
                                                    {ch.group || ch.sectionCategory || epg?.titolo || "In diretta"}
                                                </span>
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

            {/* Modale Guida TV EPG */}
            <GuidaTvModal
                isOpen={isGuidaOpen}
                onClose={() => setIsGuidaOpen(false)}
            />

            {/* Modale Impostazioni Tecniche & Player */}
            {isSettingsOpen && (
                <SettingsModal
                    onClose={() => setIsSettingsOpen(false)}
                />
            )}
        </div>
    );
}
