"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import MobileEventoView from "@/components/MobileEventoView";
import { useDeviceState } from "@/components/DeviceProvider";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { matchSlug, getChannelSlug } from "@/lib/slug";
import { getTechSettings } from "@/lib/settings";

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
    const [mounted, setMounted] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [requestStatus, setRequestStatus] = useState("idle"); // 'idle' | 'sending' | 'sent' | 'error'
    const [transPoster, setTransPoster] = useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_poster") || ""; } catch(e) {}
        }
        return "";
    });

    const handleRequestContent = async () => {
        if (requestStatus === "sending" || requestStatus === "sent") return;
        setRequestStatus("sending");
        try {
            const res = await fetch("/api/richiedi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: channel?.title || "Evento Live",
                    category: channel?.group || channel?.category || "Live TV",
                    time: channel?.ora || ""
                })
            });
            const data = await res.json();
            if (data.ok) {
                setRequestStatus("sent");
            } else {
                setRequestStatus("error");
                setTimeout(() => setRequestStatus("idle"), 3000);
            }
        } catch (e) {
            setRequestStatus("error");
            setTimeout(() => setRequestStatus("idle"), 3000);
        }
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setIframeLoaded(false);
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
                onRequestContent={handleRequestContent}
                requestStatus={requestStatus}
            />
        );
    }

    const hasStream = Boolean(selectedSource && selectedSource.url);

    return (
        <div className={`event-player-page ${mounted ? "is-mounted" : "is-mounting"}`} style={{ background: "transparent", minHeight: "140vh", color: "#ffffff", paddingBottom: "120px" }}>
            <Navbar activeFilter={null} />

            <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "86px 16px 0 16px" }}>
                <div className="event-main-stage">
                    <div className="player-wrapper" style={{ position: "relative", overflow: "hidden" }}>
                        {/* Se l'evento NON ha ancora uno stream estratto: mostra la copertina dell'evento SENZA alcuna rotellina di caricamento */}
                        {!hasStream ? (
                            <div
                                style={{
                                    position: "relative",
                                    width: "100%",
                                    height: "100%",
                                    overflow: "hidden",
                                    background: "#0a0d14",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                {(transPoster || channel?.image) ? (
                                    <img
                                        src={transPoster || channel?.image}
                                        alt={channel?.title || "Copertina"}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover"
                                        }}
                                    />
                                ) : (
                                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", fontWeight: "500" }}>
                                        {channel?.title || "Evento in attesa di inizio"}
                                    </div>
                                )}
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)"
                                    }}
                                />
                            </div>
                        ) : (
                            <>
                                {Boolean(transPoster || channel?.image) && !iframeLoaded && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            zIndex: 1,
                                            pointerEvents: "none",
                                            overflow: "hidden",
                                            transition: "opacity 0.4s ease"
                                        }}
                                    >
                                        <img
                                            src={transPoster || channel?.image}
                                            alt=""
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                filter: "brightness(0.48) contrast(1.05)"
                                            }}
                                        />
                                        <div
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.88) 100%)"
                                            }}
                                        />
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "50%",
                                                left: "50%",
                                                transform: "translate(-50%, -50%)",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                gap: "12px"
                                            }}
                                        >
                                            <div className="sky-spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
                                        </div>
                                    </div>
                                )}

                                <iframe
                                    id="player-frame"
                                    src={getIframeUrl()}
                                    allowFullScreen
                                    allow="autoplay; encrypted-media; fullscreen"
                                    title="Player"
                                    onLoad={() => {
                                        setTimeout(() => setIframeLoaded(true), 250);
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
                            </>
                        )}
                    </div>

                    <div className="event-deck">
                        <div className="event-deck-left">
                            {(() => {
                                const progInfo = getCurrentProgramInfo(channel?.epg);
                                const coverImg = channel?.image || (progInfo && progInfo.immagine ? progInfo.immagine : null);
                                const isTestJsonEvent = channel?.isTestJson || (channel?.group && channel?.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel?.eventSlug);
                                const fallbackLogo = isTestJsonEvent ? "/logos/dazn.png" : (getChannelLogoUrl(channel) || "/logos/dazn.png");
                                const displayImg = coverImg || channel?.logo || fallbackLogo;
                                const isFullCover = Boolean(coverImg);

                                return (
                                    <div className={`event-logo-box ${isFullCover ? "has-cover" : "has-logo"}`}>
                                        <img
                                            className={`event-channel-logo ${isFullCover ? "is-cover-img" : "is-logo-img"}`}
                                            src={displayImg}
                                            alt={channel?.title || "Logo"}
                                        />
                                    </div>
                                );
                            })()}
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

                        {/* Deck Tasti: Se non c'è stream, mostra il pulsante Richiedi Contenuto (ntfy) */}
                        <div className="event-sources-wrapper">
                            {!hasStream ? (
                                <button
                                    type="button"
                                    className={`event-source-btn ${requestStatus === 'sent' ? 'active' : ''}`}
                                    onClick={handleRequestContent}
                                    disabled={requestStatus === "sending" || requestStatus === "sent"}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "10px 18px",
                                        fontWeight: "600",
                                        fontSize: "14px",
                                        borderRadius: "10px",
                                        cursor: requestStatus === "sent" ? "default" : "pointer",
                                        background: requestStatus === "sent" ? "#00d586" : (requestStatus === "error" ? "#ef4444" : "rgba(255,255,255,0.08)"),
                                        color: requestStatus === "sent" ? "#06080e" : "#ffffff",
                                        border: "1px solid rgba(255,255,255,0.16)",
                                        transition: "all 0.25s ease"
                                    }}
                                >
                                    {requestStatus === "sending" && (
                                        <>
                                            <div className="sky-spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
                                            <span>Invio richiesta...</span>
                                        </>
                                    )}
                                    {requestStatus === "sent" && (
                                        <>
                                            <i className="fa-solid fa-check"></i>
                                            <span>Richiesta inviata!</span>
                                        </>
                                    )}
                                    {requestStatus === "error" && (
                                        <>
                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                            <span>Riprova più tardi</span>
                                        </>
                                    )}
                                    {requestStatus === "idle" && (
                                        <>
                                            <i className="fa-solid fa-bell text-warning"></i>
                                            <span>Richiedi Contenuto</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                channel?.sources && channel.sources.filter(s => Boolean(s && s.url)).map((s, idx) => {
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
                                })
                            )}
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
