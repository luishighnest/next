"use client";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { getChannelSlug } from "@/lib/slug";
import { loadShakaScript, parseClearKeys } from "@/lib/shakaLoader";

function getDynamicColor(str) {
    if (!str) return "hsl(210, 80%, 60%)";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 80%, 60%)`;
}

// Sub-component dedicato al player Shaka nativo (nessun comando, autoplay mutato)
function CardShakaVideo({ channel }) {
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        const streamUrl = (channel.url || channel.mpd || "").trim();
        const rawKey = channel.kid_key || channel.key || "";

        async function initPlayer() {
            try {
                const shaka = await loadShakaScript();
                if (isCancelled || !shaka || !videoRef.current) return;

                if (!shaka.Player.isBrowserSupported()) return;

                const player = new shaka.Player(videoRef.current);
                playerRef.current = player;

                // Gestione filtri MIME e rimozione nodi Widevine per usare ClearKey
                player.getNetworkingEngine().registerResponseFilter((type, response) => {
                    if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
                        if (!response.headers["content-type"] || response.headers["content-type"] === "text/plain") {
                            response.headers["content-type"] = "application/dash+xml";
                        }
                        try {
                            let xmlStr = shaka.util.StringUtils.fromUTF8(response.data);
                            xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                            xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                            xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:5e629af5-38da-4063-8977-97ffbd9902d4[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                            response.data = shaka.util.StringUtils.toUTF8(xmlStr);
                        } catch (e) {}
                    }
                });

                if (channel.ua || channel.dazn_token) {
                    player.getNetworkingEngine().registerRequestFilter((type, request) => {
                        if (channel.ua) request.headers["User-Agent"] = channel.ua;
                        if (channel.dazn_token) request.headers["dazn-token"] = channel.dazn_token;
                    });
                }

                const clearKeys = parseClearKeys(rawKey);
                player.configure({
                    drm: {
                        clearKeys: clearKeys,
                        preferredKeySystems: ["org.w3.clearkey", "webkit-org.w3.clearkey"],
                        servers: {}
                    },
                    streaming: {
                        bufferingGoal: 5,
                        rebufferingGoal: 1,
                        bufferBehind: 5,
                        lowLatencyMode: true
                    },
                    manifest: {
                        dash: {
                            ignoreMinBufferTime: true
                        }
                    }
                });

                await player.load(streamUrl, null, "application/dash+xml");
                if (isCancelled) return;

                if (videoRef.current) {
                    videoRef.current.muted = true;
                    videoRef.current.playsInline = true;
                    try {
                        await videoRef.current.play();
                    } catch (err) {}
                }
            } catch (err) {}
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

    return (
        <div className={`card-live-preview-overlay${isPlaying ? " is-visible" : ""}`}>
            <video
                ref={videoRef}
                className="card-live-preview-video"
                autoPlay
                muted
                playsInline
                disablePictureInPicture
                controls={false}
                onPlaying={() => setIsPlaying(true)}
            />
            {isPlaying && (
                <div className="card-live-preview-badge">
                    <span className="card-live-preview-dot" />
                    LIVE
                    <span className="card-live-preview-mute">
                        <i className="fas fa-volume-xmark" />
                    </span>
                </div>
            )}
        </div>
    );
}

function ChannelCard({ channel, categoryName, priority = false, onCardClick }) {
    const slug = getChannelSlug(channel);
    const progInfo = getCurrentProgramInfo(channel.epg);
    const isVod = Boolean(channel.isVod || channel.vodType);
    const cardImgUrl = (isVod && channel.poster) ? channel.poster : (channel.image || (progInfo && progInfo.immagine ? progInfo.immagine : null));
    const hasImage = Boolean(cardImgUrl);
    const isTestJsonEvent = channel.isTestJson || (channel.group && channel.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel.eventSlug);
    const logoUrl = isTestJsonEvent ? "/logos/dazn.png" : getChannelLogoUrl(channel);
    const isSky = !isTestJsonEvent && (
        channel.provider === "SKY" ||
        (channel.group && (channel.group.includes("Sky") || channel.group === "Sky Cinema" || channel.group === "Sky Bambini")) ||
        (channel.title && channel.title.toLowerCase().includes("sky"))
    );

    const cleanSrc = channel.skySource ? (channel.skySource.includes("sky2") ? "sky2" : "") : "";
    const targetHref = isVod
        ? `/vod/info/${channel.tmdbId || String(channel.id).replace(/^vod_(movie|tv)_/, "")}?type=${channel.vodType || "movie"}`
        : (isSky ? `/sky?ch=${slug}${cleanSrc ? `&src=${cleanSrc}` : ""}` : `/eventi/${slug}`);

    const isDazn1Channel = (channel.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");
    const dynColor = getDynamicColor(channel.title);

    const rawCategory = categoryName || channel.group || channel.category || "";
    let categoryLabel = rawCategory;
    if (isVod) {
        categoryLabel = channel.rating ? `★ ${channel.rating} • ${channel.group || "VOD"}` : (channel.group || "VOD");
    } else if (!categoryLabel || categoryLabel.toUpperCase() === "DAZN") {
        if (channel.title && channel.title.toLowerCase().includes("supertennis")) categoryLabel = "SuperTennis";
        else if (channel.title && channel.title.toLowerCase().includes("eurosport")) categoryLabel = "Eurosport";
        else if (isSky) categoryLabel = "Sky";
        else categoryLabel = channel.group || "Eventi";
    }

    // --- HOVER LIVE PREVIEW NATIVO SHAKA ---
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimerRef = useRef(null);
    const canPreview = !isVod && Boolean(channel.url || channel.mpd) && Boolean(channel.kid_key || channel.key);

    const handleMouseEnter = () => {
        if (!canPreview) return;
        hoverTimerRef.current = setTimeout(() => {
            setIsHovered(true);
        }, 3000);
    };

    const handleMouseLeave = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setIsHovered(false);
    };

    const handleClick = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setIsHovered(false);
        try {
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
    };

    return (
        <Link
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
                            alt={channel.title}
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

                {channel.ora && !isDazn1Channel && (
                    <div className="now-card-time-badge">{channel.ora}</div>
                )}
                <div className="now-card-vignette"></div>

                {progInfo && (
                    <div className="now-card-progress-container">
                        <div className="now-card-progress-bar" style={{ width: `${progInfo.percentuale}%` }}></div>
                    </div>
                )}

                {/* Shaka Player Preview (senza comandi, solo video puro con ClearKey) */}
                {isHovered && canPreview && (
                    <CardShakaVideo channel={channel} />
                )}

                {!isHovered && (
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
                    {progInfo ? progInfo.titolo : channel.title}
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

