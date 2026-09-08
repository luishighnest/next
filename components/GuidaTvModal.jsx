"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";

// 1 minuto = 5 pixel (30 min = 150px, 1 ora = 300px, 24 ore = 7200px)
const PX_PER_MINUTE = 5;
const SLOT_DURATION_MINUTES = 30;

export default function GuidaTvModal({ isOpen, onClose }) {
    const router = useRouter();
    const [guideData, setGuideData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState("Tutti i canali");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [currentMinutes, setCurrentMinutes] = useState(0);
    const [currentTimeStr, setCurrentTimeStr] = useState("");
    const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = Oggi

    const headerTimelineRef = useRef(null);
    const gridTimelineRef = useRef(null);

    // Aggiorna l'orario corrente ogni 30 secondi
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

    // Caricamento dati EPG
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        async function fetchGuide() {
            setLoading(true);
            try {
                const cached = typeof window !== "undefined" ? sessionStorage.getItem("nmdz_guide_cache") : null;
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setGuideData(parsed);
                        if (isMounted) setLoading(false);
                        return;
                    }
                }

                const res = await fetch("/guida_tv_sky.json", { cache: "force-cache" });
                const json = await res.json();
                if (isMounted && Array.isArray(json)) {
                    setGuideData(json);
                    try {
                        sessionStorage.setItem("nmdz_guide_cache", JSON.stringify(json));
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

    // Blocco scroll del body quando la modale è aperta
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

    // Generatore nastro dei giorni (-2 a +6 giorni da oggi)
    const daysList = useMemo(() => {
        const list = [];
        const today = new Date();
        for (let i = -2; i <= 6; i++) {
            const d = new Date();
            d.setDate(today.getDate() + i);
            const dayName = d.toLocaleDateString("it-IT", { weekday: "short" }).toUpperCase().replace(".", "");
            const dayNum = String(d.getDate()).padStart(2, "0");
            list.push({
                offset: i,
                label: i === 0 ? "OGGI" : dayName,
                num: dayNum,
                isToday: i === 0
            });
        }
        return list;
    }, []);

    // Categorie EPG standard
    const categories = useMemo(() => {
        return ["Tutti i canali", "Sport", "Cinema", "Intrattenimento", "Bambini", "Nazionale"];
    }, []);

    // Canali filtrati
    const filteredChannels = useMemo(() => {
        return guideData.filter(ch => {
            const matchesCat = activeCategory === "Tutti i canali" || ch.categoria === activeCategory;
            const matchesSearch = !searchQuery || ch.canale.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (ch.programmi || []).some(p => p.titolo?.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCat && matchesSearch;
        });
    }, [guideData, activeCategory, searchQuery]);

    // Converte "HH:MM" in minuti
    function timeToMins(str) {
        if (!str) return 0;
        const [h, m] = str.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    // Scroll iniziale automatico all'ora corrente
    useEffect(() => {
        if (!loading && gridTimelineRef.current && currentMinutes > 0) {
            const scrollTo = Math.max(0, (currentMinutes - 20) * PX_PER_MINUTE);
            gridTimelineRef.current.scrollLeft = scrollTo;
            if (headerTimelineRef.current) {
                headerTimelineRef.current.scrollLeft = scrollTo;
            }
        }
    }, [loading, isOpen]);

    // Sincronizzazione scroll orizzontale tra Header Orari e Griglia
    const handleGridScroll = (e) => {
        if (headerTimelineRef.current) {
            headerTimelineRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    // Salta a ORA IN ONDA
    const handleJumpToNow = () => {
        if (gridTimelineRef.current) {
            const scrollTo = Math.max(0, (currentMinutes - 20) * PX_PER_MINUTE);
            gridTimelineRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
        }
    };

    // Navigazione orizzontale a step (+2 ore / -2 ore)
    const handleScrollStep = (direction) => {
        if (gridTimelineRef.current) {
            const delta = direction * 120 * PX_PER_MINUTE;
            gridTimelineRef.current.scrollBy({ left: delta, behavior: "smooth" });
        }
    };

    // Avvia riproduzione canale
    const handleWatchChannel = (channelName) => {
        onClose();
        const slug = createSlug(channelName || "");
        router.push("/sky?ch=" + slug);
    };

    if (!isOpen) return null;

    // Genera gli slot orari dell'header per le 24 ore (48 blocchi da 30 min)
    const timeSlots = [];
    for (let m = 0; m < 24 * 60; m += SLOT_DURATION_MINUTES) {
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        timeSlots.push({
            minute: m,
            label: `${hh}:${mm}`
        });
    }

    const totalWidthPx = 24 * 60 * PX_PER_MINUTE; // 7200px
    const nowIndicatorLeftPx = currentMinutes * PX_PER_MINUTE;

    return (
        <div className="ee-epg-backdrop" onClick={onClose}>
            <div className="ee-epg-screen" onClick={(e) => e.stopPropagation()}>
                {/* 1. TOP HEADER: Logo/Badge + Nastro Giorni + Orologio EE */}
                <div className="ee-epg-top-header">
                    <div className="ee-epg-brand">
                        <div className="ee-brand-pill">
                            <i className="fas fa-satellite-dish"></i>
                            <span>LIVE EPG</span>
                        </div>
                    </div>

                    {/* Nastro dei giorni (Mer 01, Gio 02, Oggi 07...) */}
                    <div className="ee-days-tape">
                        {daysList.map((day) => {
                            const isSelected = selectedDayOffset === day.offset;
                            return (
                                <button
                                    key={day.offset}
                                    type="button"
                                    className={`ee-day-item ${isSelected ? "selected" : ""} ${day.isToday ? "is-today" : ""}`}
                                    onClick={() => setSelectedDayOffset(day.offset)}
                                >
                                    <span className="ee-day-name">{day.label}</span>
                                    <span className="ee-day-number">{day.num}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Orologio attuale grande a destra */}
                    <div className="ee-epg-clock">
                        {currentTimeStr || "--:--"}
                    </div>
                </div>

                {/* 2. CATEGORIES FILTER BAR */}
                <div className="ee-epg-categories-bar">
                    <div className="ee-categories-list">
                        {categories.map((cat) => {
                            const isActive = activeCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`ee-category-pill ${isActive ? "active" : ""}`}
                                    onClick={() => setActiveCategory(cat)}
                                >
                                    <span className="ee-cat-radio-dot"></span>
                                    <span>{cat}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Ricerca veloce canale */}
                    <div className="ee-search-input-wrap">
                        <i className="fas fa-magnifying-glass"></i>
                        <input
                            type="text"
                            placeholder="Cerca canale o programma..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery("")} className="ee-clear-btn">
                                <i className="fas fa-xmark"></i>
                            </button>
                        )}
                    </div>

                    <button type="button" className="ee-close-screen-btn" onClick={onClose} title="Chiudi Guida TV">
                        <i className="fas fa-xmark"></i>
                    </button>
                </div>

                {/* 3. MAIN TIMELINE GRID CONTAINER */}
                <div className="ee-epg-grid-container">
                    {/* Header degli Orari (Sopra la griglia) */}
                    <div className="ee-epg-time-header-row">
                        <div className="ee-corner-cell">
                            <span className="ee-corner-label">CANALE</span>
                        </div>

                        <div className="ee-time-ruler-wrapper" ref={headerTimelineRef}>
                            <div className="ee-time-ruler" style={{ width: `${totalWidthPx}px` }}>
                                {timeSlots.map((slot) => (
                                    <div
                                        key={slot.minute}
                                        className="ee-time-slot"
                                        style={{
                                            left: `${slot.minute * PX_PER_MINUTE}px`,
                                            width: `${SLOT_DURATION_MINUTES * PX_PER_MINUTE}px`
                                        }}
                                    >
                                        <span className="ee-time-label">{slot.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Corpo canali e palinsesto */}
                    <div className="ee-epg-body-row">
                        {loading ? (
                            <div className="ee-loading-state">
                                <div className="ee-spinner"></div>
                                <span>Caricamento Guida TV EPG...</span>
                            </div>
                        ) : (
                            <div
                                className="ee-epg-scroll-viewport"
                                ref={gridTimelineRef}
                                onScroll={handleGridScroll}
                            >
                                {/* Lista Canali con i blocchi del palinsesto */}
                                <div className="ee-channels-container" style={{ width: `${totalWidthPx}px` }}>
                                    {filteredChannels.map((ch, idx) => {
                                        const channelNumber = String(idx + 1).padStart(3, "0");
                                        const logo = getChannelLogoUrl({ title: ch.canale });
                                        const programmi = ch.programmi || [];

                                        return (
                                            <div key={ch.canale + idx} className="ee-channel-row">
                                                {/* Colonna Canale fissa a sinistra (Sticky) */}
                                                <div
                                                    className="ee-channel-cell-sticky"
                                                    onClick={() => handleWatchChannel(ch.canale)}
                                                    title={`Guarda ${ch.canale}`}
                                                >
                                                    <span className="ee-ch-num">{channelNumber}</span>
                                                    <div className="ee-ch-badge">
                                                        {logo ? (
                                                            <img src={logo} alt={ch.canale} className="ee-ch-logo" />
                                                        ) : (
                                                            <span className="ee-ch-fallback-name">{ch.canale}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Timeline orizzontale dei programmi del canale */}
                                                <div className="ee-programs-timeline">
                                                    {(() => {
                                                        // Trova in anticipo l'indice del programma in onda per questo canale
                                                        let liveIndex = -1;
                                                        if (selectedDayOffset === 0) {
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
                                                                    liveIndex = i;
                                                                    break;
                                                                }
                                                            }
                                                            // Fallback: se non ancora trovato, trova l'ultimo iniziato
                                                            if (liveIndex === -1 && programmi.length > 0) {
                                                                for (let i = programmi.length - 1; i >= 0; i--) {
                                                                    if (timeToMins(programmi[i].ora) <= currentMinutes) {
                                                                        liveIndex = i;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        return programmi.map((prog, pIdx) => {
                                                            const startMins = timeToMins(prog.ora);
                                                            let endMins = prog.fine ? timeToMins(prog.fine) : 0;

                                                            if (endMins <= startMins && prog.fine) {
                                                                endMins += 24 * 60;
                                                            } else if (!prog.fine) {
                                                                const nextProg = programmi[pIdx + 1];
                                                                if (nextProg) {
                                                                    const nextStart = timeToMins(nextProg.ora);
                                                                    endMins = nextStart <= startMins ? nextStart + 24 * 60 : nextStart;
                                                                } else {
                                                                    endMins = Math.min(startMins + 60, 24 * 60);
                                                                }
                                                            }

                                                            const durationMins = Math.max(endMins - startMins, 15);
                                                            const leftPx = startMins * PX_PER_MINUTE;
                                                            const widthPx = durationMins * PX_PER_MINUTE;

                                                            const isNow = selectedDayOffset === 0 && pIdx === liveIndex;
                                                            const isSelected = selectedProgram?.titolo === prog.titolo && selectedChannel?.canale === ch.canale;

                                                            return (
                                                                <div
                                                                    key={prog.ora + pIdx}
                                                                    className={`ee-program-block ${isNow ? "is-live" : ""} ${isSelected ? "selected" : ""}`}
                                                                    style={{
                                                                        left: `${leftPx}px`,
                                                                        width: `${widthPx}px`
                                                                    }}
                                                                    onClick={() => {
                                                                        setSelectedProgram(prog);
                                                                        setSelectedChannel(ch);
                                                                    }}
                                                                    onDoubleClick={() => handleWatchChannel(ch.canale)}
                                                                    title={`${prog.ora} - ${prog.fine || ""} | ${prog.titolo}\n(Doppio click per guardare)`}
                                                                >
                                                                    <div className="ee-prog-inner">
                                                                        <div className="ee-prog-title-row">
                                                                            {isNow && (
                                                                                <span className="ee-play-icon">
                                                                                    <i className="fas fa-play"></i>
                                                                                </span>
                                                                            )}
                                                                            <span className="ee-prog-title">{prog.titolo}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. PROGRAM DETAIL POPUP / BANNER IN BASSO SE SELEZIONATO */}
                {selectedProgram && selectedChannel && (
                    <div className="ee-selected-program-banner">
                        <div className="ee-banner-meta">
                            <div className="ee-banner-top-line">
                                <span className="ee-banner-ch">{selectedChannel.canale}</span>
                                <span className="ee-banner-time">
                                    <i className="fa-regular fa-clock"></i> {selectedProgram.ora} {selectedProgram.fine ? `- ${selectedProgram.fine}` : ""}
                                </span>
                            </div>
                            <h3 className="ee-banner-title">{selectedProgram.titolo}</h3>
                            {selectedProgram.descrizione && (
                                <p className="ee-banner-desc">{selectedProgram.descrizione}</p>
                            )}
                        </div>

                        <div className="ee-banner-actions">
                            <button
                                type="button"
                                className="ee-watch-btn"
                                onClick={() => handleWatchChannel(selectedChannel.canale)}
                            >
                                <i className="fas fa-play"></i>
                                <span>Guarda Canale</span>
                            </button>
                            <button
                                type="button"
                                className="ee-dismiss-banner-btn"
                                onClick={() => {
                                    setSelectedProgram(null);
                                    setSelectedChannel(null);
                                }}
                            >
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                )}

                {/* 5. BOTTOM FOOTER TELECOMANDO (EE Quick Keys) */}
                <div className="ee-epg-footer">
                    <button
                        type="button"
                        className="ee-footer-btn-key"
                        onClick={() => {
                            if (selectedProgram) {
                                // Chiude o apre il toggle
                                setSelectedProgram(null);
                            } else if (filteredChannels.length > 0) {
                                const ch = filteredChannels[0];
                                setSelectedChannel(ch);
                                setSelectedProgram(ch.programmi?.[0] || null);
                            }
                        }}
                    >
                        <span className="ee-key-circle info">
                            <i className="fas fa-info"></i>
                        </span>
                        <span className="ee-key-label">{selectedProgram ? "CHIUDI INFO" : "INFO PROGRAMMA"}</span>
                    </button>

                    <button type="button" className="ee-footer-btn-key" onClick={handleJumpToNow}>
                        <span className="ee-key-circle green"></span>
                        <span className="ee-key-label">ON NOW</span>
                    </button>

                    <button type="button" className="ee-footer-btn-key" onClick={() => handleScrollStep(-1)}>
                        <span className="ee-key-circle arrow">◀◀</span>
                        <span className="ee-key-label">-2 ORE</span>
                    </button>

                    <button type="button" className="ee-footer-btn-key" onClick={() => handleScrollStep(1)}>
                        <span className="ee-key-circle arrow">▶▶</span>
                        <span className="ee-key-label">+2 ORE</span>
                    </button>

                    <div className="ee-footer-key">
                        <span className="ee-key-circle blue"></span>
                        <span className="ee-key-label">DOPPIO CLICK: GUARDA CANALE</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
