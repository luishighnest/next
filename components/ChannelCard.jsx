"use client";
import React from "react";
import Link from "next/link";

export default function ChannelCard({ channel }) {
    const slug = channel.slug || (channel.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const hasImage = Boolean(channel.image);
    const logoUrl = channel.logo || "/logos/dazn.png";

    return (
        <div className="now-card-wrapper">
            <Link
                href={`/eventi/${slug}`}
                onClick={() => {
                    try {
                        sessionStorage.setItem("daznEventChannel", JSON.stringify(channel));
                    } catch(e) {}
                }}
            >
                <div className={`now-card ${!hasImage ? "now-card-no-image" : ""}`}>
                    {hasImage ? (
                        <>
                            <img src={channel.image} className="now-card-bg" alt={channel.title} referrerPolicy="no-referrer" />
                            <div className="now-card-top-vignette"></div>
                            {logoUrl && <img src={logoUrl} className="now-card-floating-logo" alt="Logo" />}
                        </>
                    ) : (
                        <>
                            <div className="now-card-classic-bg"></div>
                            <div className="now-card-classic-glow" style={{ background: "radial-gradient(circle at top right, rgba(227, 10, 23, 0.4) 0%, transparent 60%)" }}></div>
                            {logoUrl && <img src={logoUrl} className="now-card-classic-logo" alt="Logo" />}
                        </>
                    )}

                    {channel.ora && (
                        <div className="now-card-time-badge">{channel.ora}</div>
                    )}
                    <div className="now-card-vignette"></div>
                    <div className="now-card-play-btn">
                        <span className="material-symbols-rounded">play_arrow</span>
                    </div>
                </div>
            </Link>

            <div className="now-card-info-external">
                <span className="now-card-time-ext" style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem", fontWeight: 700 }}>
                    {channel.ora ? `Ore ${channel.ora}` : (channel.provider || "LIVE")}
                </span>
                <span className="now-card-title-ext" style={{ color: "#ffffff", fontSize: "0.92rem", fontWeight: 700 }}>
                    {channel.title}
                </span>
            </div>
        </div>
    );
}
