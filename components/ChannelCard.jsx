"use client";
import React from "react";
import Link from "next/link";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";

function getDynamicColor(str) {
    if (!str) return "hsl(210, 80%, 60%)";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 80%, 60%)`;
}

export default function ChannelCard({ channel }) {
    const slug = channel.slug || (channel.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const progInfo = getCurrentProgramInfo(channel.epg);
    const cardImgUrl = channel.image || (progInfo && progInfo.immagine ? progInfo.immagine : null);
    const hasImage = Boolean(cardImgUrl);
    const logoUrl = getChannelLogoUrl(channel);

    const isTestJsonEvent = channel.isTestJson || (channel.group && channel.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel.eventSlug);
    const isSky = !isTestJsonEvent && (
        channel.provider === "SKY" || 
        (channel.group && (channel.group.includes("Sky") || channel.group === "Sky Cinema" || channel.group === "Sky Bambini")) ||
        (channel.title && channel.title.toLowerCase().includes("sky"))
    );

    const targetHref = isSky ? `/sky?ch=${slug}` : `/eventi/${slug}`;

    const isDazn1Channel = (channel.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");
    const dynColor = getDynamicColor(channel.title);

    let fallbackTime = channel.ora ? `Ore ${channel.ora}` : (channel.provider || "Live");
    if (isDazn1Channel) fallbackTime = channel.group || "Live TV";

    return (
        <div className="now-card-wrapper home-card-mode">
            <Link
                href={targetHref}
                onClick={() => {
                    try {
                        if (isSky) {
                            sessionStorage.setItem("nmdz_skyChannel", JSON.stringify(channel));
                        } else {
                            sessionStorage.setItem("daznEventChannel", JSON.stringify(channel));
                        }
                    } catch(e) {}
                }}
            >
                <div className={`now-card ${!hasImage ? "now-card-no-image" : ""}`}>
                    {hasImage ? (
                        <>
                            <img src={cardImgUrl} className="now-card-bg" alt={channel.title} referrerPolicy="no-referrer" />
                            <div className="now-card-top-vignette"></div>
                            {logoUrl && <img src={logoUrl} className="now-card-floating-logo" alt="Logo" />}
                        </>
                    ) : (
                        <>
                            <div className="now-card-classic-bg"></div>
                            <div className="now-card-classic-glow" style={{ background: `radial-gradient(circle at top right, ${dynColor} 0%, transparent 60%)`, opacity: 0.15 }}></div>
                            {logoUrl && <img src={logoUrl} className="now-card-classic-logo" alt="Logo" />}
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
            </Link>

            <div className="now-card-info-external">
                <span className="now-card-time-ext">
                    {progInfo ? (progInfo.oraFine ? `${progInfo.oraInizio} - ${progInfo.oraFine}` : progInfo.oraInizio) : fallbackTime}
                </span>
                <span className="now-card-title-ext">
                    {progInfo ? progInfo.titolo : channel.title}
                </span>
            </div>
        </div>
    );
}
