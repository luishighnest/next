"use client";
import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { getChannelSlug } from "@/lib/slug";
import { getTechSettings } from "@/lib/settings";

const DEFAULT_EXT_ID = "opmeopcambhfimffbomjgemehjkbbmji";

function getDynamicColor(str) {
    if (!str) return "hsl(210, 80%, 60%)";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 80%, 60%)`;
}

// Costruisce l'URL per l'estensione Chrome (stesso meccanismo di /sky e /eventi)
function buildPreviewUrl(channel) {
    const baseUrl = (channel.url || channel.mpd || "").trim();
    if (!baseUrl || !channel.kid_key) return null;

    let extId = DEFAULT_EXT_ID;
    try {
        const tech = getTechSettings();
        if (tech.extensionId) extId = tech.extensionId;
    } catch(e) {}

    const isTsStream = baseUrl.toLowerCase().includes(".ts");
    if (isTsStream) return null; // preview non supportato per ts

    const extPrefix = `chrome-extension://${extId}/pages/player.html#`;
    const parts = [];

    // ClearKey DRM (ck=)
    const rawKey = channel.kid_key || "";
    if (rawKey && rawKey.includes(":")) {
        const ckObj = {};
        rawKey.split(",").forEach(pair => {
            const p = pair.split(":");
            if (p.length === 2 && p[0].trim() && p[1].trim()) {
                ckObj[p[0].trim()] = p[1].trim();
            }
        });
        if (Object.keys(ckObj).length > 0) {
            try { parts.push("ck=" + encodeURIComponent(btoa(JSON.stringify(ckObj)))); } catch(e) {}
        }
    }

    // Headers (ua, referer, dazn-token)
    try {
        const headersObj = {};
        if (channel.ua) headersObj["user-agent"] = channel.ua;
        if (channel.dazn_token) {
            headersObj["referer"] = "https://www.dazn.com/";
            headersObj["origin"] = "https://www.dazn.com";
            headersObj["dazn-token"] = channel.dazn_token;
        }
        if (Object.keys(headersObj).length > 0) {
            const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(headersObj))));
            parts.push("headers=" + encodeURIComponent(b64));
        }
    } catch(e) {}

    const sep = baseUrl.includes("?") ? "&" : "?";
    return extPrefix + baseUrl + (parts.length > 0 ? sep + parts.join("&") : "");
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

    // --- HOVER LIVE PREVIEW (2 fasi) ---
    // Fase 1 (3s): monta l'iframe invisibile → inizia a caricare stream + DRM
    // Fase 2 (+1.5s): mostra il video (estensione già avviata, controls nascosti)
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewVisible, setPreviewVisible] = useState(false);
    const hoverTimerRef = useRef(null);
    const visibleTimerRef = useRef(null);
    const canPreview = !isVod && Boolean(channel.url || channel.mpd) && Boolean(channel.kid_key);

    const handleMouseEnter = useCallback(() => {
        if (!canPreview) return;
        hoverTimerRef.current = setTimeout(() => {
            const url = buildPreviewUrl(channel);
            if (!url) return;
            setPreviewUrl(url);          // fase 1: iframe invisibile carica in bg
            visibleTimerRef.current = setTimeout(() => {
                setPreviewVisible(true); // fase 2: fade-in video
            }, 1500);
        }, 3000);
    }, [canPreview, channel]);

    const handleMouseLeave = useCallback(() => {
        clearTimeout(hoverTimerRef.current);
        clearTimeout(visibleTimerRef.current);
        setPreviewUrl(null);
        setPreviewVisible(false);
    }, []);
    // ------------------------------------

    const handleClick = () => {
        clearTimeout(hoverTimerRef.current);
        clearTimeout(visibleTimerRef.current);
        setPreviewUrl(null);
        setPreviewVisible(false);
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

                {/* Live Preview Iframe — fase 1: iframe invisibile carica; fase 2: fade-in */}
                {previewUrl && (
                    <div className={`card-live-preview-overlay${previewVisible ? " is-visible" : ""}`}>
                        <iframe
                            src={previewUrl}
                            className="card-live-preview-iframe"
                            allow="autoplay; encrypted-media; fullscreen"
                            allowFullScreen
                            title={`Preview ${channel.title}`}
                        />
                        {previewVisible && (
                            <div className="card-live-preview-badge">
                                <span className="card-live-preview-dot" />
                                LIVE
                                <span className="card-live-preview-mute">
                                    <i className="fas fa-volume-xmark" />
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!previewVisible && (
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

