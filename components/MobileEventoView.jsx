"use client";
import React from "react";
import Link from "next/link";
import MobileBottomNav from "@/components/MobileBottomNav";
import ChannelCard from "@/components/ChannelCard";
import { getCurrentProgramInfo, getChannelLogoUrl } from "@/lib/epg";

export default function MobileEventoView({
    channel,
    selectedSource,
    setSelectedSource,
    relatedSections = [],
    getIframeUrl
}) {
    const progInfo = getCurrentProgramInfo(channel?.epg);
    const coverImg = channel?.image || (progInfo && progInfo.immagine ? progInfo.immagine : null);
    const isTestJsonEvent = channel?.isTestJson || (channel?.group && channel?.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel?.eventSlug);
    const fallbackLogo = isTestJsonEvent ? "/logos/dazn.png" : (getChannelLogoUrl(channel) || "/logos/dazn.png");
    const displayImg = coverImg || channel?.logo || fallbackLogo;

    return (
        <div className="mobile-evento-container">
            {/* 1. Header Superiore Nativo Mobile con Back */}
            <header className="mobile-sky-header">
                <Link href="/eventi" className="mobile-sky-back-btn" aria-label="Torna a Dirette">
                    <span className="material-symbols-rounded">arrow_back</span>
                </Link>

                <div className="mobile-sky-header-title-box">
                    <span className="mobile-sky-channel-name">{channel?.title || "Diretta Evento"}</span>
                    <span className="mobile-sky-live-tag">
                        <span className="mobile-live-dot"></span> LIVE
                    </span>
                </div>

                <div className="mobile-sky-header-actions">
                    <Link href="/home" className="mobile-header-btn" aria-label="Home">
                        <i className="fas fa-house"></i>
                    </Link>
                </div>
            </header>

            {/* 2. Video Player 16:9 Sticky */}
            <div className="mobile-sky-player-sticky">
                <div className="mobile-sky-player-wrap">
                    <iframe
                        id="mobile-event-iframe"
                        src={getIframeUrl()}
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                        title={channel?.title || "Event Player"}
                    />
                </div>
            </div>

            {/* 3. Event Deck Dettagliato */}
            <div className="mobile-sky-deck">
                <div className="mobile-sky-deck-top">
                    <div className="mobile-sky-logo-wrap" style={{ borderRadius: coverImg ? "8px" : "12px" }}>
                        <img
                            src={displayImg}
                            alt={channel?.title || "Logo"}
                            className="mobile-sky-logo-img"
                            style={coverImg ? { objectFit: "cover" } : {}}
                        />
                    </div>
                    <div className="mobile-sky-info-main">
                        <div className="mobile-sky-row-meta">
                            <span className="mobile-sky-group-badge">{channel?.group || channel?.category || "EVENTI"}</span>
                            {channel?.ora && (
                                <span className="mobile-sky-time-badge">
                                    <i className="fa-regular fa-clock"></i> Ore {channel.ora}
                                </span>
                            )}
                        </div>
                        <h1 className="mobile-sky-title">{channel?.title || "Caricamento evento..."}</h1>
                    </div>
                </div>

                {/* 4. Sorgenti Streaming Touch Pills (Standard vs WARP) */}
                {channel?.sources && channel.sources.length > 0 && (
                    <div className="mobile-event-sources-block">
                        <span className="mobile-event-sources-label">Sorgenti disponibili:</span>
                        <div className="mobile-event-sources-pills">
                            {channel.sources.map((s, idx) => {
                                const isSelected = selectedSource?.url === s.url && selectedSource?.isWarp === s.isWarp;
                                return (
                                    <button
                                        key={s.name + idx}
                                        type="button"
                                        className={`mobile-source-pill ${isSelected ? "active" : ""}`}
                                        onClick={() => setSelectedSource(s)}
                                    >
                                        {s.isWarp ? (
                                            <i className="fa-solid fa-shield-halved" style={{ color: isSelected ? "#06080e" : "#f38020" }}></i>
                                        ) : (
                                            <i className="fa-solid fa-bolt" style={{ color: isSelected ? "#06080e" : "#00d586" }}></i>
                                        )}
                                        <span>{s.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Sezioni Correlate Touch-Friendly con Locandine Proporzionate */}
            {relatedSections.length > 0 && (
                <div className="mobile-event-related-flow">
                    {relatedSections.map((sec) => (
                        <section key={sec.title} className="mobile-section-block">
                            <div className="mobile-section-header">
                                <h2 className="mobile-section-title">{sec.title}</h2>
                                <span className="mobile-section-count">{sec.channels?.length || 0}</span>
                            </div>
                            <div className="mobile-horizontal-scroll">
                                {(sec.channels || []).map((relCh, i) => (
                                    <div key={(relCh.id || relCh.title) + i} className="mobile-card-slot">
                                        <ChannelCard
                                            channel={relCh}
                                            categoryName={sec.title}
                                            priority={i < 2}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {/* Bottom Nav Bar */}
            <MobileBottomNav activeFilter="eventi" />
        </div>
    );
}
