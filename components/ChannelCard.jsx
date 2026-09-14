"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { getChannelSlug } from "@/lib/slug";
import { loadShakaScript, parseClearKeys } from "@/lib/shakaLoader";
import { useTransitionRouter } from "@/components/TransitionProvider";

function getDynamicColor(str) {
    if (!str) return "hsl(210, 80%, 60%)";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 80%, 60%)`;
}

// Verifica se uno stream è scaduto tramite timestamp _e~ o orario evento
function isChannelExpired(channel) {
    if (!channel) return false;

    // I canali Sky TV (dirette 24/7) NON scadono mai!
    const isSkyChannel = Boolean(
        channel.provider === "SKY" ||
        channel.isSky ||
        (channel.group && channel.group.toLowerCase().includes("sky")) ||
        (channel.title && channel.title.toLowerCase().includes("sky"))
    );
    if (isSkyChannel) {
        return false;
    }

    const streamUrl = (channel.url || channel.mpd || "").trim();

    const expMatch = streamUrl.match(/_e~([0-9]+)_/);
    if (expMatch) {
        const expTs = parseInt(expMatch[1], 10) * 1000;
        if (!isNaN(expTs) && expTs <= Date.now()) return true;
    }

    if (Array.isArray(channel.sources) && channel.sources.length > 0) {
        const allExpired = channel.sources.every(s => {
            const u = (s.url || s.mpd || "").trim();
            const em = u.match(/_e~([0-9]+)_/);
            if (em) {
                const ts = parseInt(em[1], 10) * 1000;
                return !isNaN(ts) && ts <= Date.now();
            }
            return false;
        });
        if (allExpired && channel.sources.some(s => (s.url || s.mpd || "").includes("_e~"))) return true;
    }

    if (channel.end) {
        try {
            const endD = new Date(channel.end);
            if (!isNaN(endD.getTime()) && !channel.end.startsWith("3000")) {
                if (Date.now() - endD.getTime() > 15 * 60 * 1000) return true;
            }
        } catch (e) {}
    }

    return false;
}

// Estrae la prima sorgente stream valida da un canale di qualsiasi formato
function getFirstStreamSource(channel) {
    if (!channel) return null;

    // Priorità 1: sources array (DAZN, eventi custom, ecc.)
    if (Array.isArray(channel.sources) && channel.sources.length > 0) {
        const first = channel.sources.find(s => s.url || s.mpd) || channel.sources[0];
        if (first) {
            return {
                url: (first.url || first.mpd || "").trim(),
                kid_key: first.kid_key || first.key || "",
                ua: first.ua || "",
                dazn_token: first.dazn_token || ""
            };
        }
    }

    // Priorità 2: url diretto (canali Sky, canali piatti)
    const directUrl = (channel.url || channel.mpd || channel.m3u8 || "").trim();
    if (directUrl) {
        return {
            url: directUrl,
            kid_key: channel.kid_key || channel.key || "",
            ua: channel.ua || "",
            dazn_token: channel.dazn_token || ""
        };
    }

    return null;
}

// Sub-component player Shaka ultra-ottimizzato per preview istantanea nella locandina
function CardShakaVideo({ channel, isReadyToDisplay }) {
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const [isMuted, setIsMuted] = useState(true);
    const [hasVideoFrame, setHasVideoFrame] = useState(false);

    const toggleMute = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
            const nextMuted = !videoRef.current.muted;
            videoRef.current.muted = nextMuted;
            setIsMuted(nextMuted);
        }
    };

    useEffect(() => {
        let isCancelled = false;
        setHasVideoFrame(false);

        const src = getFirstStreamSource(channel);
        if (!src || !src.url) return;

        let streamUrl = src.url;
        let rawKey = src.kid_key;
        let rawUa = src.ua;
        let daznToken = src.dazn_token;

        // DAZN WARP token extraction
        const warpMatch = streamUrl.match(/^(https?:\/\/[^/]+)\/@(eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)(\/.*)?$/);
        if (warpMatch) {
            daznToken = warpMatch[2];
            streamUrl = warpMatch[1] + (warpMatch[3] || "");
        }

        async function initPlayer() {
            try {
                const shaka = await loadShakaScript();
                if (isCancelled || !shaka || !videoRef.current) return;
                if (!shaka.Player.isBrowserSupported()) return;

                if (playerRef.current) {
                    try { await playerRef.current.destroy(); } catch(e) {}
                    playerRef.current = null;
                }

                const player = new shaka.Player(videoRef.current);
                playerRef.current = player;

                // Filtri MIME e rimozione veloce Widevine
                player.getNetworkingEngine().registerResponseFilter((type, response) => {
                    if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
                        if (!response.headers["content-type"] || response.headers["content-type"] === "text/plain") {
                            if (streamUrl.includes(".mpd") || (!streamUrl.includes(".m3u8") && !streamUrl.includes(".ts"))) {
                                response.headers["content-type"] = "application/dash+xml";
                            }
                        }
                        try {
                            let xmlStr = shaka.util.StringUtils.fromUTF8(response.data);
                            if (xmlStr.includes("urn:uuid:edef8ba9") || xmlStr.includes("urn:uuid:9a04f079") || xmlStr.includes("urn:uuid:5e629af5")) {
                                xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                                xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                                xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:5e629af5-38da-4063-8977-97ffbd9902d4[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                                response.data = shaka.util.StringUtils.toUTF8(xmlStr);
                            }
                        } catch (e) {}
                    }
                });

                player.getNetworkingEngine().registerRequestFilter((type, request) => {
                    if (rawUa) request.headers["User-Agent"] = rawUa;
                    if (daznToken) {
                        request.headers["dazn-token"] = daznToken;
                        request.headers["referer"] = "https://www.dazn.com/";
                        request.headers["origin"] = "https://www.dazn.com";
                    }
                });

                const clearKeys = parseClearKeys(rawKey);
                player.configure({
                    drm: {
                        clearKeys,
                        preferredKeySystems: ["org.w3.clearkey", "webkit-org.w3.clearkey"],
                        servers: {}
                    },
                    streaming: {
                        bufferingGoal: 1.5,           // Avvio ultra-veloce (1.5s di buffer anziché 6s)
                        rebufferingGoal: 0.5,         // Rebuffer istantaneo
                        bufferBehind: 3,
                        lowLatencyMode: true,         // Low latency per prendere subito l'ultimo frammento live
                        alwaysStreamFullSegments: false, // Avvia subito la riproduzione del primo segmento
                        retryParameters: {
                            maxAttempts: 3,
                            baseDelay: 300,
                            backoffFactor: 1.2,
                            fuzzFactor: 0.3,
                            timeout: 5000
                        }
                    },
                    manifest: {
                        dash: { ignoreMinBufferTime: true },
                        retryParameters: {
                            maxAttempts: 3,
                            baseDelay: 300,
                            backoffFactor: 1.2,
                            fuzzFactor: 0.3,
                            timeout: 5000
                        }
                    },
                    abr: { enabled: true }
                });

                const isHls = streamUrl.includes(".m3u8") || streamUrl.includes("/hls/");
                const mimeType = isHls ? "application/x-mpegurl" : "application/dash+xml";

                await player.load(streamUrl, null, mimeType);
                if (isCancelled || !videoRef.current) return;

                videoRef.current.muted = true;
                videoRef.current.playsInline = true;
                try {
                    await videoRef.current.play();
                } catch (err) {}
            } catch (err) {
                // Silenzioso
            }
        }

        initPlayer();

        return () => {
            isCancelled = true;
            if (playerRef.current) {
                playerRef.current.destroy().catch(() => {});
                playerRef.current = null;
            }
        };
    }, [channel]);

    const isVisible = isReadyToDisplay && hasVideoFrame;

    return (
        <div className={`card-live-preview-overlay${isVisible ? " is-visible" : ""}`}>
            <video
                ref={videoRef}
                className="card-live-preview-video"
                autoPlay
                muted
                playsInline
                disablePictureInPicture
                controls={false}
                onPlaying={() => setHasVideoFrame(true)}
                onLoadedData={() => setHasVideoFrame(true)}
                onTimeUpdate={() => {
                    if (!hasVideoFrame && videoRef.current && videoRef.current.currentTime > 0) {
                        setHasVideoFrame(true);
                    }
                }}
            />
            {isVisible && (
                <div className="card-live-preview-badge">
                    <span className="card-live-preview-dot" />
                    LIVE
                    <button
                        type="button"
                        className="card-live-preview-mute-btn"
                        onClick={toggleMute}
                        title={isMuted ? "Attiva audio" : "Silenzia audio"}
                    >
                        <i className={`fas ${isMuted ? "fa-volume-xmark" : "fa-volume-high"}`} />
                    </button>
                </div>
            )}
        </div>
    );
}

function ChannelCard({ channel, categoryName, priority = false, onCardClick }) {
    const slug = getChannelSlug(channel);
    const progInfo = getCurrentProgramInfo(channel?.epg);
    const isVod = Boolean(channel?.isVod || channel?.vodType);
    const cardImgUrl = (isVod && channel?.poster) ? channel.poster : (channel?.image || (progInfo && progInfo.immagine ? progInfo.immagine : null));
    const hasImage = Boolean(cardImgUrl);
    const isTestJsonEvent = channel?.isTestJson || (channel?.group && channel.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel?.eventSlug);
    const logoUrl = isTestJsonEvent ? "/logos/dazn.png" : getChannelLogoUrl(channel);
    const isSky = !isTestJsonEvent && (
        channel?.provider === "SKY" ||
        (channel?.group && (channel.group.includes("Sky") || channel.group === "Sky Cinema" || channel.group === "Sky Bambini")) ||
        (channel?.title && channel.title.toLowerCase().includes("sky"))
    );

    const cleanSrc = channel?.skySource ? (channel.skySource.includes("sky2") ? "sky2" : "") : "";
    const targetHref = isVod
        ? `/vod/info/${channel?.tmdbId || String(channel?.id).replace(/^vod_(movie|tv)_/, "")}?type=${channel?.vodType || "movie"}`
        : (isSky ? `/sky?ch=${slug}${cleanSrc ? `&src=${cleanSrc}` : ""}` : `/eventi/${slug}`);

    const isDazn1Channel = (channel?.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");
    const dynColor = getDynamicColor(channel?.title);

    const rawCategory = categoryName || channel?.group || channel?.category || "";
    let categoryLabel = rawCategory;
    if (isVod) {
        categoryLabel = channel?.rating ? `★ ${channel.rating} • ${channel?.group || "VOD"}` : (channel?.group || "VOD");
    } else if (!categoryLabel || categoryLabel.toUpperCase() === "DAZN") {
        if (channel?.title && channel.title.toLowerCase().includes("supertennis")) categoryLabel = "SuperTennis";
        else if (channel?.title && channel.title.toLowerCase().includes("eurosport")) categoryLabel = "Eurosport";
        else if (isSky) categoryLabel = "Sky";
        else categoryLabel = channel?.group || "Eventi";
    }

    // ─── Hover Live Preview (Avvio dopo 1.5s al passaggio del mouse) ────────
    const [isHovering, setIsHovering] = useState(false);
    const [isReadyToDisplay, setIsReadyToDisplay] = useState(false);
    const hoverTimerRef = useRef(null);

    // Controlla disponibilità stream (Sky e canali con URL/sources non VOD e non scaduti)
    const src = getFirstStreamSource(channel);
    const isExpired = isChannelExpired(channel);
    const canPreview = !isVod && !isExpired && Boolean(src && src.url);

    const handleMouseEnter = () => {
        if (!canPreview) return;
        setIsHovering(true);
        setIsReadyToDisplay(false);

        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
        }

        // Esattamente dopo 1.5 secondi abilita la visibilità della riproduzione video
        hoverTimerRef.current = setTimeout(() => {
            setIsReadyToDisplay(true);
        }, 1500);
    };

    const handleMouseLeave = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setIsHovering(false);
        setIsReadyToDisplay(false);
    };

    const { startTransitionToPlayer } = useTransitionRouter();
    const cardContainerRef = useRef(null);

    const handleClick = (e) => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setIsHovering(false);
        setIsReadyToDisplay(false);

        try {
            if (typeof window !== "undefined") {
                const currentPath = window.location.pathname + (window.location.search || "");
                if (currentPath && !currentPath.startsWith("/sky") && !currentPath.startsWith("/eventi") && !currentPath.startsWith("/evento")) {
                    sessionStorage.setItem("nmdz_returnPath", currentPath);
                }
            }
            if (isVod) {
                sessionStorage.setItem("nmdz_vodItem", JSON.stringify(channel));
            } else if (isSky) {
                sessionStorage.setItem("nmdz_skyChannel", JSON.stringify(channel));
            } else {
                sessionStorage.setItem("daznEventChannel", JSON.stringify(channel));
                sessionStorage.setItem("daznCustomChannel", JSON.stringify(channel));
            }
        } catch(e) {}

        if (onCardClick) onCardClick();

        if (!isVod && cardContainerRef.current) {
            e.preventDefault();
            const rect = cardContainerRef.current.getBoundingClientRect();
            startTransitionToPlayer({
                cardRect: rect,
                targetHref,
                posterImg: cardImgUrl || "",
                logoImg: logoUrl || "",
                title: progInfo ? progInfo.titolo : (channel?.title || ""),
                group: categoryLabel,
                ora: channel?.ora || (progInfo ? progInfo.oraInizio : "")
            });
        }
    };

    return (
        <Link
            ref={cardContainerRef}
            href={targetHref}
            prefetch={true}
            className={`now-card-wrapper home-card-mode ${isVod ? "vod-poster-card" : ""}`}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ textDecoration: "none", color: "inherit", WebkitTapHighlightColor: "transparent" }}
        >
            <div className={`now-card ${!hasImage ? "now-card-no-image" : ""}`}>
                {hasImage ? (
                    <>
                        <img
                            src={cardImgUrl}
                            className="now-card-bg"
                            alt={channel?.title || "Locandina"}
                            referrerPolicy="no-referrer"
                            loading={priority ? "eager" : "lazy"}
                            decoding="async"
                            fetchPriority={priority ? "high" : "auto"}
                        />
                        <div className="now-card-top-vignette"></div>
                        {logoUrl && !isVod && (
                            <img
                                src={logoUrl}
                                className="now-card-floating-logo"
                                alt="Logo"
                                loading="lazy"
                                decoding="async"
                            />
                        )}
                    </>
                ) : (
                    <>
                        <div className="now-card-classic-bg"></div>
                        <div className="now-card-classic-glow" style={{ background: `radial-gradient(circle at top right, ${dynColor} 0%, transparent 60%)`, opacity: 0.15 }}></div>
                        {logoUrl && (
                            <img
                                src={logoUrl}
                                className="now-card-classic-logo"
                                alt="Logo"
                                loading="lazy"
                                decoding="async"
                            />
                        )}
                    </>
                )}

                {channel?.ora && !isDazn1Channel && (
                    <div className="now-card-time-badge">{channel.ora}</div>
                )}
                <div className="now-card-vignette"></div>

                {progInfo && (
                    <div className="now-card-progress-container">
                        <div className="now-card-progress-bar" style={{ width: `${progInfo.percentuale}%` }}></div>
                    </div>
                )}

                {/* Shaka Player Preview: parte in background al hover e si attiva istantaneamente a 1.5s */}
                {isHovering && canPreview && (
                    <CardShakaVideo
                        channel={channel}
                        isReadyToDisplay={isReadyToDisplay}
                    />
                )}

                {!isReadyToDisplay && (
                    <div className="now-card-play-icon">
                        <i className="fa fa-play" aria-hidden="true" style={{ marginLeft: "3px" }}></i>
                    </div>
                )}
            </div>

            <div className="now-card-info-external">
                <span className="now-card-time-ext">
                    {progInfo ? (progInfo.oraFine ? `${progInfo.oraInizio} - ${progInfo.oraFine}` : progInfo.oraInizio) : categoryLabel}
                </span>
                <span className="now-card-title-ext">
                    {progInfo ? progInfo.titolo : (channel?.title || "")}
                </span>
            </div>
        </Link>
    );
}

function arePropsEqual(prevProps, nextProps) {
    if (prevProps.priority !== nextProps.priority) return false;
    if (prevProps.categoryName !== nextProps.categoryName) return false;
    const p = prevProps.channel;
    const n = nextProps.channel;
    if (p === n) return true;
    if (!p || !n) return false;
    if (p.id !== n.id) return false;
    if (p.title !== n.title) return false;
    if (p.group !== n.group) return false;
    if (p.ora !== n.ora) return false;
    if (p.image !== n.image || p.poster !== n.poster) return false;
    if (p.url !== n.url || p.mpd !== n.mpd) return false;
    if (p.kid_key !== n.kid_key) return false;
    if (p.skySource !== n.skySource) return false;
    if (p.isVod !== n.isVod || p.tmdbId !== n.tmdbId || p.vodType !== n.vodType) return false;

    const pEpg = p.epg || [];
    const nEpg = n.epg || [];
    if (pEpg.length !== nEpg.length) return false;
    if (pEpg.length > 0 && nEpg.length > 0) {
        if (pEpg[0]?.titolo !== nEpg[0]?.titolo) return false;
        if (pEpg[0]?.oraInizio !== nEpg[0]?.oraInizio) return false;
        if (pEpg[0]?.percentuale !== nEpg[0]?.percentuale) return false;
    }
    return true;
}

export default React.memo(ChannelCard, arePropsEqual);
