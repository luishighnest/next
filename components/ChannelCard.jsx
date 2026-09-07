"use client";
import React from "react";
import Link from "next/link";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { getChannelSlug } from "@/lib/slug";

function getDynamicColor(str) {
    if (!str) return "hsl(210, 80%, 60%)";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 80%, 60%)`;
}

function ChannelCard({ channel, priority = false }) {
    const slug = getChannelSlug(channel);
    const progInfo = getCurrentProgramInfo(channel.epg);
    const cardImgUrl = channel.image || (progInfo && progInfo.immagine ? progInfo.immagine : null);
    const hasImage = Boolean(cardImgUrl);
    const isTestJsonEvent = channel.isTestJson || (channel.group && channel.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel.eventSlug);
    const logoUrl = isTestJsonEvent ? "/logos/dazn.png" : getChannelLogoUrl(channel);
    const isSky = !isTestJsonEvent && (
        channel.provider === "SKY" || 
        (channel.group && (channel.group.includes("Sky") || channel.group === "Sky Cinema" || channel.group === "Sky Bambini")) ||
        (channel.title && channel.title.toLowerCase().includes("sky"))
    );

    const cleanSrc = channel.skySource ? (channel.skySource.includes("sky2") ? "sky2" : "") : "";
    const targetHref = isSky ? `/sky?ch=${slug}${cleanSrc ? `&src=${cleanSrc}` : ""}` : `/eventi/${slug}`;

    const isDazn1Channel = (channel.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");
    const dynColor = getDynamicColor(channel.title);

    let fallbackTime = channel.ora ? `Ore ${channel.ora}` : (channel.provider || "Live");
    if (isDazn1Channel) fallbackTime = channel.group || "Live TV";

    const handleClick = () => {
        try {
            if (isSky) {
                sessionStorage.setItem("nmdz_skyChannel", JSON.stringify(channel));
            } else {
                sessionStorage.setItem("daznEventChannel", JSON.stringify(channel));
                sessionStorage.setItem("daznCustomChannel", JSON.stringify(channel));
            }
        } catch(e) {}
    };

    return (
        <Link
            href={targetHref}
            prefetch={true}
            className="now-card-wrapper home-card-mode"
            onClick={handleClick}
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
                        {logoUrl && (
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
                <div className="now-card-play-btn">
                    <span className="material-symbols-rounded">play_arrow</span>
                </div>

                {progInfo && (
                    <div className="now-card-progress-container">
                        <div className="now-card-progress-bar" style={{ width: `${progInfo.percentuale}%` }}></div>
                    </div>
                )}
                <div className="now-card-play-icon">
                    <i className="fa fa-play" aria-hidden="true" style={{ marginLeft: "4px" }}></i>
                </div>
            </div>

            <div className="now-card-info-external">
                <span className="now-card-time-ext">
                    {progInfo ? (progInfo.oraFine ? `${progInfo.oraInizio} - ${progInfo.oraFine}` : progInfo.oraInizio) : fallbackTime}
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
    const p = prevProps.channel;
    const n = nextProps.channel;
    if (p === n) return true;
    if (!p || !n) return false;
    if (p.id !== n.id) return false;
    if (p.title !== n.title) return false;
    if (p.ora !== n.ora) return false;
    if (p.image !== n.image) return false;
    if (p.url !== n.url || p.mpd !== n.mpd) return false;
    if (p.skySource !== n.skySource) return false;
    
    // Compare epg length / first item progress
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
