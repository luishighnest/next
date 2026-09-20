"use client";
import React from "react";
import Link from "next/link";
import MobileBottomNav from "@/components/MobileBottomNav";
import ChannelCard from "@/components/ChannelCard";
import { getCurrentProgramInfo, getChannelLogoUrl } from "@/lib/epg";
import { getNormalizedSources } from "@/lib/sources";
import { getChannelSlug, matchSlug } from "@/lib/slug";

export default function MobileEventoView({
    channel,
    selectedSource,
    setSelectedSource,
    relatedSections = [],
    getIframeUrl,
    onRequestContent,
    requestStatus = "idle"
}) {
    const [iframeLoaded, setIframeLoaded] = React.useState(false);
    const [transPoster, setTransPoster] = React.useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_poster") || ""; } catch(e) {}
        }
        return "";
    });

    React.useEffect(() => {
        setIframeLoaded(false);
    }, [selectedSource, channel]);

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
                <div className="mobile-sky-player-wrap" style={{ position: "relative", overflow: "hidden" }}>
                    {!selectedSource?.url ? (
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
                            {(transPoster || coverImg) ? (
                                <img
                                    src={transPoster || coverImg}
                                    alt={channel?.title || "Copertina"}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover"
                                    }}
                                />
                            ) : (
                                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", fontWeight: "500" }}>
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
                            {Boolean(transPoster || coverImg) && !iframeLoaded && (
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
                                        src={transPoster || coverImg}
                                        alt=""
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            filter: "brightness(0.5) contrast(1.05)"
                                        }}
                                    />
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "50%",
                                            left: "50%",
                                            transform: "translate(-50%, -50%)"
                                        }}
                                    >
                                        <div className="sky-spinner" style={{ width: "36px", height: "36px", borderWidth: "3px" }} />
                                    </div>
                                </div>
                            )}

                            <iframe
                                id="mobile-event-iframe"
                                src={getIframeUrl()}
                                allow="autoplay; encrypted-media; fullscreen"
                                allowFullScreen
                                title={channel?.title || "Event Player"}
                                onLoad={() => {
                                    setTimeout(() => setIframeLoaded(true), 250);
                                }}
                                style={{
                                    opacity: iframeLoaded ? 1 : 0.85,
                                    transition: "opacity 0.4s ease"
                                }}
                            />
                        </>
                    )}
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
                            {(() => {
                                const isDazn1 = (channel?.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");
                                const tileTypeLower = (channel?.tile_type || "").toLowerCase();
                                const isEventVod = tileTypeLower === "live" ? false :
                                    (tileTypeLower === "catchup" || tileTypeLower === "ondemand" || tileTypeLower === "vod") ? true :
                                    Boolean(
                                        channel?.isEventVod ||
                                        (channel?.type && channel.type.toLowerCase() === "vod") ||
                                        (channel?.group && channel.group.toLowerCase().includes("vod")) ||
                                        (channel?.url && (channel.url.includes("-vod.") || channel.url.includes("/vod/"))) ||
                                        (channel?.end && new Date(channel.end).getTime() < (Date.now() - 30 * 60 * 1000) && !isDazn1) ||
                                        (!channel?.end && channel?.start && (Date.now() - new Date(channel.start).getTime()) > 6 * 60 * 60 * 1000 && !isDazn1)
                                    );
                                if (isEventVod) {
                                    return (
                                        <span className="mobile-sky-group-badge" style={{ background: "rgba(14, 116, 144, 0.4)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                                            REPLAY
                                        </span>
                                    );
                                }
                                return (
                                    <span className="mobile-sky-group-badge" style={{ background: "rgba(227, 10, 23, 0.2)", color: "#ff4d4d", border: "1px solid rgba(227, 10, 23, 0.4)" }}>
                                        LIVE
                                    </span>
                                );
                            })()}
                            <span className="mobile-sky-group-badge">{channel?.group || channel?.category || "EVENTI"}</span>
                            {channel?.data && (
                                <span className="mobile-sky-time-badge">
                                    <i className="fa-regular fa-calendar"></i> {channel.data}
                                </span>
                            )}
                            {channel?.ora && (
                                <span className="mobile-sky-time-badge">
                                    <i className="fa-regular fa-clock"></i> Ore {channel.ora}
                                </span>
                            )}
                        </div>
                        <h1 className="mobile-sky-title">{channel?.title || "Caricamento evento..."}</h1>
                    </div>
                </div>

                {/* 4. Sorgenti Streaming Touch Pills oppure Pulsante Richiedi Contenuto */}
                {(() => {
                    const hasStream = Boolean(selectedSource && selectedSource.url);
                    if (!hasStream) {
                        return (
                            <div className="mobile-event-sources-block" style={{ marginTop: "12px" }}>
                                <button
                                    type="button"
                                    onClick={onRequestContent}
                                    disabled={requestStatus === "sending" || requestStatus === "sent"}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        width: "100%",
                                        padding: "12px 16px",
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
                            </div>
                        );
                    }

                    const realSources = getNormalizedSources(channel).filter(s => Boolean(s && s.url));
                    if (realSources.length <= 1) return null;
                    return (
                        <div className="mobile-event-sources-block">
                            <span className="mobile-event-sources-label">Sorgenti disponibili:</span>
                            <div className="mobile-event-sources-pills">
                                {realSources.map((s, idx) => {
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
                    );
                })()}
            </div>

            {/* 5. Sezioni Correlate Touch-Friendly con Locandine Proporzionate */}
            {relatedSections.length > 0 && (
                <div className="mobile-event-related-flow">
                    {relatedSections
                        .map(sec => ({
                            ...sec,
                            channels: (sec.channels || []).filter(relCh => {
                                const curTitle = (channel?.title || "").trim().toLowerCase();
                                const curSlug = getChannelSlug(channel);
                                if (curTitle && relCh.title && relCh.title.trim().toLowerCase() === curTitle) return false;
                                if (curTitle && relCh.name && relCh.name.trim().toLowerCase() === curTitle) return false;
                                if (curSlug && getChannelSlug(relCh) === curSlug) return false;
                                if (curSlug && matchSlug(relCh, curSlug)) return false;
                                return true;
                            })
                        }))
                        .filter(sec => sec.channels.length > 0)
                        .map((sec) => (
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
