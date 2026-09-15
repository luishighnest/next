"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MobileBottomNav from "@/components/MobileBottomNav";

export default function MobileSkyView({
    channels = [],
    selectedChannel,
    setSelectedChannel,
    currentSource,
    setCurrentSource,
    activeTab,
    setActiveTab,
    availableGroups = [],
    searchQuery,
    setSearchQuery,
    filteredChannels = [],
    currentEpg,
    playerSrc,
    loading,
    handlePrevChannel,
    handleNextChannel
}) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchInputRef = useRef(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [transPoster, setTransPoster] = useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_poster") || ""; } catch(e) {}
        }
        return "";
    });

    useEffect(() => {
        setIframeLoaded(false);
    }, [playerSrc]);

    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

    return (
        <div className="mobile-sky-container">
            {/* 1. Header Nativo Mobile per Sky Live */}
            <header className="mobile-sky-header">
                <Link href="/home" className="mobile-sky-back-btn" aria-label="Torna alla Home">
                    <span className="material-symbols-rounded">arrow_back</span>
                </Link>

                <div className="mobile-sky-header-title-box">
                    <span className="mobile-sky-channel-name">{selectedChannel?.name || "Sky Live"}</span>
                    <span className="mobile-sky-live-tag">
                        <span className="mobile-live-dot"></span> LIVE
                    </span>
                </div>

                <div className="mobile-sky-header-actions">
                    <button
                        type="button"
                        className="mobile-header-btn"
                        onClick={() => setIsSearchOpen(prev => !prev)}
                        aria-label="Cerca canali"
                    >
                        <i className={`fas ${isSearchOpen ? "fa-xmark" : "fa-magnifying-glass"}`}></i>
                    </button>
                </div>
            </header>

            {/* 2. Barra di Ricerca Rapida Espandibile */}
            {isSearchOpen && (
                <div className="mobile-sky-search-bar">
                    <span className="material-symbols-rounded search-icon">search</span>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Cerca canale o programma..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="mobile-sky-search-clear"
                            onClick={() => setSearchQuery("")}
                        >
                            <i className="fas fa-circle-xmark"></i>
                        </button>
                    )}
                </div>
            )}

            {/* 3. Sticky 16:9 Video Player */}
            <div className="mobile-sky-player-sticky">
                <div className="mobile-sky-player-wrap" style={{ position: "relative", overflow: "hidden" }}>
                    {Boolean(transPoster || currentEpg?.immagine || selectedChannel?.image) && !iframeLoaded && (
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
                                src={transPoster || currentEpg?.immagine || selectedChannel?.image}
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

                    {loading && !selectedChannel ? (
                        <div className="mobile-sky-player-loader">
                            <div className="sky-spinner"></div>
                            <span>Caricamento Sky...</span>
                        </div>
                    ) : (
                        <iframe
                            id="mobile-sky-iframe"
                            src={playerSrc}
                            allow="autoplay; encrypted-media; fullscreen"
                            allowFullScreen
                            title={selectedChannel?.name || "Sky Player"}
                            onLoad={() => {
                                setTimeout(() => setIframeLoaded(true), 250);
                            }}
                            style={{
                                opacity: iframeLoaded ? 1 : 0.85,
                                transition: "opacity 0.4s ease"
                            }}
                        />
                    )}
                </div>
            </div>

            {/* 4. Deck Info Canale & Programma Attuale */}
            <div className="mobile-sky-deck">
                <div className="mobile-sky-deck-top">
                    <div className="mobile-sky-logo-wrap">
                        <img
                            src={selectedChannel?.logo || "/logos/sksport.png"}
                            alt={selectedChannel?.name || "Logo"}
                            className="mobile-sky-logo-img"
                        />
                    </div>
                    <div className="mobile-sky-info-main">
                        <div className="mobile-sky-row-meta">
                            <span className="mobile-sky-group-badge">{selectedChannel?.group || "Sky"}</span>
                            {currentEpg?.ora && (
                                <span className="mobile-sky-time-badge">
                                    <i className="fa-regular fa-clock"></i> {currentEpg.ora}
                                </span>
                            )}
                        </div>
                        <h1 className="mobile-sky-title">{currentEpg?.titolo || selectedChannel?.name || "In onda"}</h1>
                    </div>

                    {/* Controlli Zapping Touch Rapido */}
                    <div className="mobile-sky-zap-group">
                        <button
                            type="button"
                            className="mobile-sky-zap-btn"
                            onClick={handlePrevChannel}
                            title="Canale Precedente"
                        >
                            <span className="material-symbols-rounded">keyboard_arrow_up</span>
                        </button>
                        <button
                            type="button"
                            className="mobile-sky-zap-btn"
                            onClick={handleNextChannel}
                            title="Canale Successivo"
                        >
                            <span className="material-symbols-rounded">keyboard_arrow_down</span>
                        </button>
                    </div>
                </div>

                {/* Progress Bar Programma */}
                {currentEpg && (
                    <div className="mobile-sky-prog-bar-container">
                        <div className="mobile-sky-prog-bar-fill" style={{ width: `${currentEpg.percent || 20}%` }}></div>
                    </div>
                )}

                {/* Prossimo Programma */}
                {currentEpg?.next && (
                    <div className="mobile-sky-next-row">
                        <span className="mobile-sky-next-label">A seguire:</span>
                        <span className="mobile-sky-next-title">{currentEpg.next}</span>
                    </div>
                )}
            </div>

            {/* 5. Switch Sorgente Sky 1 / Sky 2 & Gruppi Categorie */}
            <div className="mobile-sky-controls-section">
                <div className="mobile-sky-source-pills">
                    <button
                        type="button"
                        className={`mobile-source-pill ${currentSource === "sky.json" ? "active" : ""}`}
                        onClick={() => setCurrentSource("sky.json")}
                    >
                        <i className="fas fa-satellite-dish"></i> Sky 1
                    </button>
                    <button
                        type="button"
                        className={`mobile-source-pill ${currentSource === "sky2.json" ? "active" : ""}`}
                        onClick={() => setCurrentSource("sky2.json")}
                    >
                        <i className="fas fa-tower-broadcast"></i> Sky 2
                    </button>
                </div>

                {/* Chips Categorie Orizzontali a Scorrimento */}
                <div className="mobile-sky-category-chips">
                    <button
                        type="button"
                        className={`mobile-cat-pill ${activeTab === "all" ? "active" : ""}`}
                        onClick={() => setActiveTab("all")}
                    >
                        Tutti
                    </button>
                    {availableGroups.map(grp => (
                        <button
                            key={grp}
                            type="button"
                            className={`mobile-cat-pill ${activeTab === grp ? "active" : ""}`}
                            onClick={() => setActiveTab(grp)}
                        >
                            {grp}
                        </button>
                    ))}
                </div>
            </div>

            {/* 6. Elenco Canali Touch-Friendly */}
            <div className="mobile-sky-channels-list">
                {filteredChannels.length === 0 ? (
                    <div className="mobile-empty-state">
                        <span className="material-symbols-rounded">tv_off</span>
                        <p>Nessun canale trovato con questi filtri</p>
                    </div>
                ) : (
                    filteredChannels.map((ch, idx) => {
                        const isSelected = selectedChannel?.slug === ch.slug;
                        return (
                            <div
                                key={ch.slug + idx}
                                className={`mobile-sky-channel-row ${isSelected ? "is-selected" : ""}`}
                                onClick={() => {
                                    setSelectedChannel(ch);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                            >
                                <div className="mobile-sky-row-logo">
                                    <img
                                        src={ch.logo || "/logos/sksport.png"}
                                        alt={ch.name}
                                        loading="lazy"
                                    />
                                </div>
                                <div className="mobile-sky-row-info">
                                    <div className="mobile-sky-row-title-line">
                                        <span className="mobile-sky-ch-title">{ch.name}</span>
                                        {isSelected && (
                                            <span className="mobile-sky-row-live-badge">IN RIPRODUZIONE</span>
                                        )}
                                    </div>
                                    <span className="mobile-sky-ch-sub">{ch.group}</span>
                                </div>
                                <div className="mobile-sky-row-action">
                                    <span className="material-symbols-rounded">
                                        {isSelected ? "volume_up" : "play_circle"}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom Nav Bar */}
            <MobileBottomNav activeFilter="sport" />
        </div>
    );
}