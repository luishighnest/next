"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";

export default function GuidaTvModal({ isOpen, onClose }) {
    const router = useRouter();
    const [guideData, setGuideData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState("Tutti");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = Oggi
    const searchInputRef = useRef(null);

    // Orario attuale preciso
    const [currentMinutes, setCurrentMinutes] = useState(() => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    });
    const [currentTimeStr, setCurrentTimeStr] = useState(() => {
        const now = new Date();
        return now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    });

    // Aggiornamento orario live ogni 30s
    useEffect(() => {
        function updateTime() {
            const now = new Date();
            const mins = now.getHours() * 60 + now.getMinutes();
            setCurrentMinutes(mins);
            setCurrentTimeStr(now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        }
        updateTime();
        const interval = setInterval(updateTime, 30000);
        return () => clearInterval(interval);
    }, []);

    // Caricamento Dati EPG
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        async function fetchGuide() {
            setLoading(true);
            try {
                const cached = typeof window !== "undefined" ? sessionStorage.getItem("nmdz_guide_cache_v3") : null;
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setGuideData(parsed);
                        if (isMounted) {
                            setSelectedChannel(parsed[0]);
                            setSelectedProgram(parsed[0]?.programmi?.[0] || null);
                            setLoading(false);
                        }
                        return;
                    }
                }

                const res = await fetch("/guida_tv_sky.json?t=" + Date.now(), { cache: "no-store" });
                const json = await res.json();
                if (isMounted && Array.isArray(json)) {
                    setGuideData(json);
                    setSelectedChannel(json[0]);
                    setSelectedProgram(json[0]?.programmi?.[0] || null);
                    try {
                        sessionStorage.setItem("nmdz_guide_cache_v3", JSON.stringify(json));
                    } catch (e) {}
                }
            } catch (err) {
                console.error("Errore caricamento Guida TV:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchGuide();
    }, [isOpen]);

    // Blocco scroll body
    useEffect(() => {
        if (isOpen) {
            const origOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = origOverflow;
            };
        }
    }, [isOpen]);

    // Chiusura con tasto Esc
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Helper minuti
    function timeToMins(str) {
        if (!str) return 0;
        const [h, m] = str.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    // Solo giorno "OGGI"
    const daysList = useMemo(() => {
        const today = new Date();
        const dayNum = String(today.getDate()).padStart(2, "0");
        return [
            {
                offset: 0,
                label: "OGGI",
                num: dayNum,
                isToday: true
            }
        ];
    }, []);

    // Categorie
    const categories = useMemo(() => {
        return ["Tutti", "Sport", "Cinema", "Intrattenimento", "Bambini", "Nazionale"];
    }, []);

    // Trova programma in onda per un canale
    const getLiveProgram = useCallback((programmi) => {
        if (!programmi || programmi.length === 0) return null;

        for (let i = 0; i < programmi.length; i++) {
            const p = programmi[i];
            const s = timeToMins(p.ora);
            let e = p.fine ? timeToMins(p.fine) : 0;
            if (e <= s && p.fine) e += 24 * 60;
            else if (!p.fine) {
                const next = programmi[i + 1];
                e = next ? timeToMins(next.ora) : s + 60;
                if (e <= s) e += 24 * 60;
            }
            if (currentMinutes >= s && currentMinutes < e) {
                return { program: p, index: i, startMins: s, endMins: e };
            }
        }
        // Fallback ultimo iniziato
        for (let i = programmi.length - 1; i >= 0; i--) {
            if (timeToMins(programmi[i].ora) <= currentMinutes) {
                return { program: programmi[i], index: i, startMins: timeToMins(programmi[i].ora), endMins: timeToMins(programmi[i].ora) + 60 };
            }
        }
        return { program: programmi[0], index: 0, startMins: 0, endMins: 60 };
    }, [currentMinutes]);

    // Canali filtrati con calcolo immediato del programma in onda
    const filteredChannels = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return guideData
            .filter((ch) => {
                const matchesCat = activeCategory === "Tutti" || ch.categoria === activeCategory;
                const matchesSearch = !q || ch.canale.toLowerCase().includes(q) ||
                    (ch.programmi || []).some((p) => p.titolo?.toLowerCase().includes(q));
                return matchesCat && matchesSearch;
            })
            .map((ch) => {
                const liveInfo = getLiveProgram(ch.programmi);
                return {
                    ...ch,
                    liveProgram: liveInfo?.program || null,
                    liveIndex: liveInfo?.index ?? -1,
                    liveProgress: (() => {
                        if (!liveInfo) return 0;
                        const total = liveInfo.endMins - liveInfo.startMins;
                        if (total <= 0) return 0;
                        const elapsed = currentMinutes - liveInfo.startMins;
                        return Math.min(100, Math.max(0, (elapsed / total) * 100));
                    })()
                };
            });
    }, [guideData, activeCategory, searchQuery, getLiveProgram, currentMinutes]);

    // Sincronizza il canale selezionato se la lista cambia o se nullo
    useEffect(() => {
        if (filteredChannels.length > 0) {
            const exists = filteredChannels.some(c => c.canale === selectedChannel?.canale);
            if (!exists || !selectedChannel) {
                const first = filteredChannels[0];
                setSelectedChannel(first);
                setSelectedProgram(first.liveProgram || first.programmi?.[0] || null);
            }
        }
    }, [filteredChannels, selectedChannel]);

    // Seleziona canale
    const handleSelectChannel = (ch) => {
        setSelectedChannel(ch);
        setSelectedProgram(ch.liveProgram || ch.programmi?.[0] || null);
    };

    // Riproduzione rapida
    const handleWatchChannel = (channelName) => {
        if (!channelName) return;
        const slug = createSlug(channelName);
        onClose();
        router.push("/sky?ch=" + slug);
    };

    // Navigazione da tastiera rapida (Freccia Su/Giù per cambiare canale, Enter per guardare)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT") return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (filteredChannels.length === 0) return;
                const curIdx = filteredChannels.findIndex(c => c.canale === selectedChannel?.canale);
                const nextIdx = curIdx === -1 ? 0 : Math.min(curIdx + 1, filteredChannels.length - 1);
                handleSelectChannel(filteredChannels[nextIdx]);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (filteredChannels.length === 0) return;
                const curIdx = filteredChannels.findIndex(c => c.canale === selectedChannel?.canale);
                const prevIdx = curIdx <= 0 ? 0 : curIdx - 1;
                handleSelectChannel(filteredChannels[prevIdx]);
            } else if (e.key === "Enter") {
                if (selectedChannel) {
                    e.preventDefault();
                    handleWatchChannel(selectedChannel.canale);
                }
            } else if (e.key === "/") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, filteredChannels, selectedChannel]);

    if (!isOpen) return null;

    const currentChannelLogo = selectedChannel ? getChannelLogoUrl({ title: selectedChannel.canale }) : null;
    const currentChannelLive = selectedChannel ? getLiveProgram(selectedChannel.programmi) : null;
    const displayedProgram = selectedProgram || currentChannelLive?.program || selectedChannel?.programmi?.[0] || null;
    const isLiveDisplayed = Boolean(
        currentChannelLive?.program &&
        displayedProgram &&
        displayedProgram.titolo === currentChannelLive.program.titolo &&
        displayedProgram.ora === currentChannelLive.program.ora
    );

    return (
        <div className="gtv-modal-overlay" onClick={onClose}>
            <div className="gtv-modal-window" onClick={(e) => e.stopPropagation()}>
                
                {/* 1. TOP CONTROL BAR */}
                <header className="gtv-topbar">
                    <div className="gtv-topbar-left">
                        <div className="gtv-badge-brand">
                            <span className="gtv-live-dot"></span>
                            <span>GUIDA TV EPG</span>
                        </div>

                        {/* Category Navbar Links (senza contenitore / pillole) */}
                        <nav className="gtv-category-nav">
                            {categories.map((cat) => {
                                const isActive = activeCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        className={`gtv-nav-item ${isActive ? "active" : ""}`}
                                        onClick={() => setActiveCategory(cat)}
                                    >
                                        <span>{cat}</span>
                                        {isActive && <span className="gtv-nav-active-bar" />}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Day selector - SOLO OGGI */}
                    <div className="gtv-day-single-pill" title="Palinsesto di Oggi">
                        <span className="gtv-day-single-dot"></span>
                        <span className="gtv-day-single-lbl">OGGI</span>
                        <span className="gtv-day-single-date">{daysList[0]?.num}</span>
                    </div>

                    {/* Right utilities: Search, Live Clock, Close */}
                    <div className="gtv-topbar-right">
                        <div className="gtv-search-box">
                            <span className="material-symbols-rounded gtv-search-icon">search</span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Cerca canale o programma... (/)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="gtv-clear-btn"
                                    onClick={() => setSearchQuery("")}
                                >
                                    <span className="material-symbols-rounded">close</span>
                                </button>
                            )}
                        </div>

                        <div className="gtv-clock-display" title="Ora locale attuale">
                            {currentTimeStr}
                        </div>

                        <button
                            type="button"
                            className="gtv-close-btn"
                            onClick={onClose}
                            title="Chiudi (Esc)"
                        >
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>
                </header>

                {/* 2. SPLIT WORKSPACE: CHANNELS MASTER (LEFT) + PROGRAM DETAIL & TIMELINE (RIGHT) */}
                <div className="gtv-main-split">
                    
                    {/* LEFT PANEL: CHANNELS BROWSER */}
                    <aside className="gtv-channels-panel">
                        <div className="gtv-panel-header">
                            <span className="gtv-panel-title">
                                <span className="material-symbols-rounded">live_tv</span>
                                <span>CANALI DISPONIBILI ({filteredChannels.length})</span>
                            </span>
                        </div>

                        <div className="gtv-channels-scroll-list">
                            {loading ? (
                                <div className="gtv-loading-state">
                                    <div className="gtv-spinner"></div>
                                    <span>Caricamento canali EPG...</span>
                                </div>
                            ) : filteredChannels.length === 0 ? (
                                <div className="gtv-empty-channels">
                                    <span className="material-symbols-rounded">search_off</span>
                                    <span>Nessun canale trovato</span>
                                </div>
                            ) : (
                                filteredChannels.map((ch, idx) => {
                                    const isSelected = selectedChannel?.canale === ch.canale;
                                    const logo = getChannelLogoUrl({ title: ch.canale });
                                    const chNum = String(idx + 1).padStart(3, "0");
                                    const liveTitle = ch.liveProgram?.titolo || "Palinsesto non disponibile";
                                    const liveTime = ch.liveProgram ? `${ch.liveProgram.ora} - ${ch.liveProgram.fine || ""}` : "";

                                    return (
                                        <div
                                            key={ch.canale + idx}
                                            className={`gtv-ch-card ${isSelected ? "active" : ""}`}
                                            onClick={() => handleSelectChannel(ch)}
                                            onDoubleClick={() => handleWatchChannel(ch.canale)}
                                        >
                                            {/* Left: Number & Logo */}
                                            <div className="gtv-ch-card-meta">
                                                <span className="gtv-ch-num">{chNum}</span>
                                                <div className="gtv-ch-logo-container">
                                                    {logo ? (
                                                        <img src={logo} alt={ch.canale} className="gtv-ch-logo-img" />
                                                    ) : (
                                                        <span className="gtv-ch-fallback-name">{ch.canale}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Center: Live Program & Progress */}
                                            <div className="gtv-ch-card-info">
                                                <div className="gtv-ch-name-row">
                                                    <span className="gtv-ch-name-text">{ch.canale}</span>
                                                    {selectedDayOffset === 0 && (
                                                        <span className="gtv-live-tag">
                                                            <span className="gtv-mini-dot"></span>
                                                            <span>IN ONDA</span>
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="gtv-ch-prog-title" title={liveTitle}>
                                                    {liveTitle}
                                                </div>

                                                {selectedDayOffset === 0 && (
                                                    <div className="gtv-ch-progress-wrapper">
                                                        <div
                                                            className="gtv-ch-progress-fill"
                                                            style={{ width: `${ch.liveProgress}%` }}
                                                        />
                                                    </div>
                                                )}

                                                <span className="gtv-ch-prog-time">{liveTime}</span>
                                            </div>

                                            {/* Right: Quick Play Button on Hover */}
                                            <button
                                                type="button"
                                                className="gtv-ch-play-hover-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleWatchChannel(ch.canale);
                                                }}
                                                title={`Guarda subito ${ch.canale}`}
                                            >
                                                <span className="material-symbols-rounded">play_arrow</span>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* RIGHT PANEL: SELECTED CHANNEL HERO + FULL SCHEDULE TIMELINE */}
                    <main className="gtv-detail-panel">
                        {selectedChannel ? (
                            <div className="gtv-detail-scroll-area">
                                
                                {/* HERO HERO CARD OF SELECTED CHANNEL & CURRENT PROGRAM */}
                                <section className="gtv-channel-hero">
                                    <div className="gtv-hero-bg-accent"></div>
                                    <div className="gtv-hero-content">
                                        
                                        {/* Header Info */}
                                        <div className="gtv-hero-header">
                                            <div className="gtv-hero-brand-group">
                                                <div className="gtv-hero-logo-box">
                                                    {currentChannelLogo ? (
                                                        <img src={currentChannelLogo} alt={selectedChannel.canale} className="gtv-hero-logo" />
                                                    ) : (
                                                        <span className="gtv-hero-fallback-name">{selectedChannel.canale}</span>
                                                    )}
                                                </div>
                                                <div className="gtv-hero-titles">
                                                    <div className="gtv-hero-badge-row">
                                                        <span className="gtv-hero-category-tag">{selectedChannel.categoria || "TV Live"}</span>
                                                        {selectedDayOffset === 0 && (
                                                            <span className="gtv-hero-live-pill">
                                                                <span className="gtv-live-dot-pulse"></span>
                                                                <span>ORA IN ONDA</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h2 className="gtv-hero-channel-name">{selectedChannel.canale}</h2>
                                                </div>
                                            </div>

                                            {/* Play Action */}
                                            <button
                                                type="button"
                                                className="gtv-hero-play-btn"
                                                onClick={() => handleWatchChannel(selectedChannel.canale)}
                                                title={`Guarda ${selectedChannel.canale}`}
                                            >
                                                <span className="material-symbols-rounded">play_arrow</span>
                                                <span>GUARDA CANALE</span>
                                            </button>
                                        </div>

                                        {/* Program focus preview card (Programma In Onda / Selezionato) */}
                                        {displayedProgram && (
                                            <div className="gtv-hero-program-card">
                                                <div className="gtv-hero-prog-header">
                                                    <div className="gtv-hero-prog-badge-group">
                                                        <span className="gtv-prog-time-chip">
                                                            <span className="material-symbols-rounded">schedule</span>
                                                            <span>{displayedProgram.ora} {displayedProgram.fine ? `– ${displayedProgram.fine}` : ""}</span>
                                                        </span>
                                                        {isLiveDisplayed ? (
                                                            <span className="gtv-hero-badge-live-now">
                                                                <span className="gtv-live-dot-pulse"></span>
                                                                <span>PROGRAMMA IN ONDA ORA</span>
                                                            </span>
                                                        ) : (
                                                            <span className="gtv-hero-badge-selected">
                                                                <span className="material-symbols-rounded">info</span>
                                                                <span>PROGRAMMA SELEZIONATO</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="gtv-prog-day-label">OGGI</span>
                                                </div>

                                                <div className="gtv-hero-prog-body">
                                                    <div className="gtv-hero-prog-main">
                                                        <h3 className="gtv-hero-prog-title">{displayedProgram.titolo}</h3>
                                                        <p className={`gtv-hero-prog-desc ${!displayedProgram.descrizione ? "gtv-placeholder-desc" : ""}`}>
                                                            {displayedProgram.descrizione || "Nessuna descrizione aggiuntiva fornita per questo programma."}
                                                        </p>
                                                    </div>

                                                    {displayedProgram.immagine && (
                                                        <div className="gtv-hero-thumbnail-box">
                                                            <img src={displayedProgram.immagine} alt={displayedProgram.titolo} className="gtv-hero-thumb" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* FULL DAY SCHEDULE LIST FOR THIS CHANNEL */}
                                <section className="gtv-schedule-section">
                                    <div className="gtv-section-title-row">
                                        <div className="gtv-section-heading">
                                            <span className="material-symbols-rounded">view_timeline</span>
                                            <span>PALINSESTO COMPLETO DI {selectedChannel.canale.toUpperCase()}</span>
                                        </div>
                                        <span className="gtv-schedule-count">
                                            {selectedChannel.programmi?.length || 0} Programmi
                                        </span>
                                    </div>

                                    <div className="gtv-schedule-grid">
                                        {(selectedChannel.programmi || []).map((prog, pIdx) => {
                                            const isSelected = selectedProgram?.titolo === prog.titolo && selectedProgram?.ora === prog.ora;
                                            const isLive = selectedDayOffset === 0 && selectedChannel.liveIndex === pIdx;

                                            return (
                                                <div
                                                    key={prog.ora + pIdx}
                                                    className={`gtv-schedule-card ${isSelected ? "is-selected" : ""} ${isLive ? "is-live" : ""}`}
                                                    onClick={() => setSelectedProgram(prog)}
                                                    onDoubleClick={() => handleWatchChannel(selectedChannel.canale)}
                                                >
                                                    <div className="gtv-schedule-time-col">
                                                        <span className="gtv-time-start">{prog.ora}</span>
                                                        <span className="gtv-time-end">{prog.fine || ""}</span>
                                                        {isLive && (
                                                            <span className="gtv-live-chip">LIVE</span>
                                                        )}
                                                    </div>

                                                    <div className="gtv-schedule-content-col">
                                                        <h4 className="gtv-schedule-title" title={prog.titolo}>
                                                            {prog.titolo}
                                                        </h4>
                                                        {prog.descrizione && (
                                                            <p className="gtv-schedule-desc">
                                                                {prog.descrizione}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="gtv-schedule-action-col">
                                                        <button
                                                            type="button"
                                                            className="gtv-schedule-watch-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleWatchChannel(selectedChannel.canale);
                                                            }}
                                                            title="Guarda canale"
                                                        >
                                                            <span className="material-symbols-rounded">play_arrow</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className="gtv-no-channel-selected">
                                <span className="material-symbols-rounded">tv_off</span>
                                <h3>Seleziona un canale</h3>
                                <p>Scegli un canale dalla lista a sinistra per visualizzare il palinsesto e i dettagli completi.</p>
                            </div>
                        )}
                    </main>
                </div>

                {/* 3. FOOTER STATUS BAR WITH KEYBOARD SHORTCUTS */}
                <footer className="gtv-footer-bar">
                    <div className="gtv-footer-left">
                        <span className="gtv-status-indicator">
                            <span className="gtv-green-light"></span>
                            <span>EPG SKY / NAZIONALE AGGIORNATO</span>
                        </span>
                    </div>

                    <div className="gtv-footer-shortcuts">
                        <span className="gtv-shortcut-item">
                            <kbd>↑</kbd> <kbd>↓</kbd> Scorri Canali
                        </span>
                        <span className="gtv-shortcut-dot">•</span>
                        <span className="gtv-shortcut-item">
                            <kbd>Invio</kbd> Guarda Canale
                        </span>
                        <span className="gtv-shortcut-dot">•</span>
                        <span className="gtv-shortcut-item">
                            <kbd>/</kbd> Cerca
                        </span>
                        <span className="gtv-shortcut-dot">•</span>
                        <span className="gtv-shortcut-item">
                            <kbd>Esc</kbd> Chiudi
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
