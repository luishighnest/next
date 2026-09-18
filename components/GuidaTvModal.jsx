"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";

// Dimensionamento ottimale per PC: 1 min = 4px (30 min = 120px, 1 ora = 240px, 24 ore = 5760px)
const PX_PER_MINUTE = 4;
const SLOT_DURATION_MINUTES = 30;

export default function GuidaTvModal({ isOpen, onClose }) {
    const router = useRouter();
    const [guideData, setGuideData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState("Tutti i canali");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);
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
    const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = Oggi

    const headerTimelineRef = useRef(null);
    const gridTimelineRef = useRef(null);

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
                        if (isMounted) setLoading(false);
                        return;
                    }
                }

                const res = await fetch("/guida_tv_sky.json?t=" + Date.now(), { cache: "no-store" });
                const json = await res.json();
                if (isMounted && Array.isArray(json)) {
                    setGuideData(json);
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

    // Blocco scroll del body
    useEffect(() => {
        if (isOpen) {
            const origOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = origOverflow;
            };
        }
    }, [isOpen]);

    // Gestione chiusura Esc
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                if (selectedProgram) {
                    setSelectedProgram(null);
                    setSelectedChannel(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, selectedProgram]);

    // Nastro giorni: da -2 a +6
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

    // Categorie
    const categories = useMemo(() => {
        return ["Tutti i canali", "Sport", "Cinema", "Intrattenimento", "Bambini", "Nazionale"];
    }, []);

    // Canali filtrati per categoria e ricerca
    const filteredChannels = useMemo(() => {
        return guideData.filter((ch) => {
            const matchesCat = activeCategory === "Tutti i canali" || ch.categoria === activeCategory;
            const q = searchQuery.trim().toLowerCase();
            const matchesSearch = !q || ch.canale.toLowerCase().includes(q) ||
                (ch.programmi || []).some((p) => p.titolo?.toLowerCase().includes(q));
            return matchesCat && matchesSearch;
        });
    }, [guideData, activeCategory, searchQuery]);

    // Funzione orario in minuti
    function timeToMins(str) {
        if (!str) return 0;
        const [h, m] = str.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    // Scroll iniziale automatico all'orario attuale
    useEffect(() => {
        if (!loading && isOpen && currentMinutes > 0) {
            const scrollTo = Math.max(0, (currentMinutes - 30) * PX_PER_MINUTE);
            if (gridTimelineRef.current) {
                gridTimelineRef.current.style.scrollBehavior = "auto";
                gridTimelineRef.current.scrollLeft = scrollTo;
            }
            if (headerTimelineRef.current) {
                headerTimelineRef.current.style.scrollBehavior = "auto";
                headerTimelineRef.current.scrollLeft = scrollTo;
            }

            const timer = setTimeout(() => {
                if (gridTimelineRef.current) gridTimelineRef.current.style.scrollBehavior = "";
                if (headerTimelineRef.current) headerTimelineRef.current.style.scrollBehavior = "";
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [loading, isOpen]);

    // Drag-to-Scroll orizzontale & verticale ottimizzato per PC
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const scrollTopRef = useRef(0);
    const hasDraggedRef = useRef(false);

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest("button, input, a, .ee-quick-watch-btn")) return;
        if (!gridTimelineRef.current) return;

        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        startXRef.current = e.pageX - gridTimelineRef.current.offsetLeft;
        startYRef.current = e.pageY - gridTimelineRef.current.offsetTop;
        scrollLeftRef.current = gridTimelineRef.current.scrollLeft;
        scrollTopRef.current = gridTimelineRef.current.scrollTop;
        gridTimelineRef.current.style.cursor = "grabbing";
        gridTimelineRef.current.style.userSelect = "none";
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current || !gridTimelineRef.current) return;
        const x = e.pageX - gridTimelineRef.current.offsetLeft;
        const y = e.pageY - gridTimelineRef.current.offsetTop;
        const walkX = (x - startXRef.current) * 1.3;
        const walkY = (y - startYRef.current) * 1.3;

        if (Math.abs(walkX) > 4 || Math.abs(walkY) > 4) {
            hasDraggedRef.current = true;
        }
        gridTimelineRef.current.scrollLeft = scrollLeftRef.current - walkX;
        gridTimelineRef.current.scrollTop = scrollTopRef.current - walkY;
    };

    const handleMouseUpOrLeave = () => {
        if (isDraggingRef.current && gridTimelineRef.current) {
            isDraggingRef.current = false;
            gridTimelineRef.current.style.cursor = "";
            gridTimelineRef.current.style.userSelect = "";
            setTimeout(() => {
                hasDraggedRef.current = false;
            }, 60);
        }
    };

    // Supporto rotellina PC per scorrimento orizzontale istantaneo con Shift o orizzontale puro
    useEffect(() => {
        const gridEl = gridTimelineRef.current;
        if (!gridEl) return;

        const handleWheel = (e) => {
            if (e.shiftKey) {
                e.preventDefault();
                gridEl.scrollLeft += e.deltaY * 1.2;
            }
        };

        gridEl.addEventListener("wheel", handleWheel, { passive: false });
        return () => gridEl.removeEventListener("wheel", handleWheel);
    }, [isOpen, loading]);

    // Sincronizzazione scroll orizzontale tra Header Orari e Griglia
    const handleGridScroll = (e) => {
        if (headerTimelineRef.current) {
            headerTimelineRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    // Salta all'orario in onda
    const handleJumpToNow = useCallback(() => {
        if (gridTimelineRef.current) {
            const scrollTo = Math.max(0, (currentMinutes - 30) * PX_PER_MINUTE);
            gridTimelineRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
        }
    }, [currentMinutes]);

    // Navigazione orizzontale a step (+/- ore)
    const handleScrollStep = (hours = 2) => {
        if (gridTimelineRef.current) {
            const delta = hours * 60 * PX_PER_MINUTE;
            gridTimelineRef.current.scrollBy({ left: delta, behavior: "smooth" });
        }
    };

    // Riproduzione canale
    const handleWatchChannel = (channelName) => {
        if (!channelName) return;
        const slug = createSlug(channelName);
        onClose();
        router.push("/sky?ch=" + slug);
    };

    // Slot orari 24 ore (48 intervalli da 30 min)
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let m = 0; m < 24 * 60; m += SLOT_DURATION_MINUTES) {
            const hh = String(Math.floor(m / 60)).padStart(2, "0");
            const mm = String(m % 60).padStart(2, "0");
            slots.push({ minute: m, label: `${hh}:${mm}` });
        }
        return slots;
    }, []);

    const totalWidthPx = 24 * 60 * PX_PER_MINUTE; // 5760px
    const nowIndicatorLeftPx = currentMinutes * PX_PER_MINUTE;

    if (!isOpen) return null;

    return (
        <div className="ee-epg-backdrop" onClick={onClose}>
            <div className="ee-epg-screen" onClick={(e) => e.stopPropagation()}>
                
                {/* 1. TOP HEADER */}
                <header className="ee-epg-top-header">
                    <div className="ee-header-left">
                        <div className="ee-brand-badge">
                            <span className="ee-live-pulse-dot"></span>
                            <span className="ee-brand-title">GUIDA TV</span>
                        </div>

                        <button
                            type="button"
                            className="ee-jump-now-btn"
                            onClick={handleJumpToNow}
                            title="Salta subito a ora in onda"
                        >
                            <span className="material-symbols-rounded">schedule</span>
                            <span>In Onda Ora</span>
                        </button>
                    </div>

                    {/* Nastro Selezione Giorno */}
                    <div className="ee-days-tape">
                        {daysList.map((day) => {
                            const isSelected = selectedDayOffset === day.offset;
                            return (
                                <button
                                    key={day.offset}
                                    type="button"
                                    className={`ee-day-pill ${isSelected ? "selected" : ""} ${day.isToday ? "is-today" : ""}`}
                                    onClick={() => setSelectedDayOffset(day.offset)}
                                >
                                    <span className="ee-day-name">{day.label}</span>
                                    <span className="ee-day-num">{day.num}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Azioni Destra: Ricerca, Orologio, Tasto Chiudi */}
                    <div className="ee-header-right">
                        {isSearchVisible ? (
                            <div className="ee-search-input-box">
                                <span className="material-symbols-rounded ee-search-ico">search</span>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Cerca canale o titolo..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="ee-clear-search-btn"
                                    >
                                        <span className="material-symbols-rounded">close</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="ee-close-search-btn"
                                    onClick={() => {
                                        setIsSearchVisible(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    <span className="material-symbols-rounded">close</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="ee-icon-action-btn"
                                onClick={() => {
                                    setIsSearchVisible(true);
                                    setTimeout(() => searchInputRef.current?.focus(), 50);
                                }}
                                title="Cerca canali o programmi"
                            >
                                <span className="material-symbols-rounded">search</span>
                            </button>
                        )}

                        <div className="ee-live-clock" title="Orario attuale">{currentTimeStr}</div>

                        <button
                            type="button"
                            className="ee-close-modal-btn"
                            onClick={onClose}
                            title="Chiudi Guida TV (Esc)"
                        >
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>
                </header>

                {/* 2. CATEGORY PILLS BAR */}
                <div className="ee-categories-bar">
                    <div className="ee-categories-track">
                        {categories.map((cat) => {
                            const isActive = activeCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`ee-cat-pill ${isActive ? "active" : ""}`}
                                    onClick={() => setActiveCategory(cat)}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. TIMELINE & GRID CONTAINER */}
                <div className="ee-epg-grid-container">
                    
                    {/* Time Ruler Header Row */}
                    <div className="ee-epg-time-header-row">
                        <div className="ee-channel-col-header">
                            <span className="material-symbols-rounded">live_tv</span>
                            <span>CANALI ({filteredChannels.length})</span>
                        </div>

                        <div className="ee-time-ruler-wrapper" ref={headerTimelineRef}>
                            <div className="ee-time-ruler" style={{ width: `${totalWidthPx}px` }}>
                                {timeSlots.map((slot) => (
                                    <div
                                        key={slot.minute}
                                        className="ee-time-tick"
                                        style={{
                                            left: `${slot.minute * PX_PER_MINUTE}px`,
                                            width: `${SLOT_DURATION_MINUTES * PX_PER_MINUTE}px`
                                        }}
                                    >
                                        <span className="ee-time-tick-label">{slot.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Viewport dei canali e palinsesto */}
                    <div className="ee-epg-body-wrapper">
                        {loading ? (
                            <div className="ee-loading-box">
                                <div className="ee-loader-spinner"></div>
                                <span>Caricamento palinsesto TV...</span>
                            </div>
                        ) : filteredChannels.length === 0 ? (
                            <div className="ee-empty-box">
                                <span className="material-symbols-rounded ee-empty-ico">search_off</span>
                                <h4>Nessun canale trovato</h4>
                                <p>Nessun risultato corrisponde ai criteri di ricerca selezionati.</p>
                            </div>
                        ) : (
                            <div
                                className="ee-epg-scroll-viewport"
                                ref={gridTimelineRef}
                                onScroll={handleGridScroll}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUpOrLeave}
                                onMouseLeave={handleMouseUpOrLeave}
                            >
                                <div className="ee-channels-grid" style={{ width: `${totalWidthPx}px` }}>
                                    
                                    {/* LINEA ORARIO ATTUALE (NOW LINE) */}
                                    {selectedDayOffset === 0 && (
                                        <div
                                            className="ee-now-indicator-line"
                                            style={{ left: `${nowIndicatorLeftPx}px` }}
                                        >
                                            <div className="ee-now-badge">
                                                <span className="ee-now-badge-dot"></span>
                                                <span>{currentTimeStr}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Righe dei Canali */}
                                    {filteredChannels.map((ch, chIdx) => {
                                        const chNum = String(chIdx + 1).padStart(3, "0");
                                        const logo = getChannelLogoUrl({ title: ch.canale });
                                        const programmi = ch.programmi || [];

                                        // Calcolo programma in onda
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
                                            if (liveIndex === -1 && programmi.length > 0) {
                                                for (let i = programmi.length - 1; i >= 0; i--) {
                                                    if (timeToMins(programmi[i].ora) <= currentMinutes) {
                                                        liveIndex = i;
                                                        break;
                                                    }
                                                }
                                            }
                                        }

                                        return (
                                            <div key={ch.canale + chIdx} className="ee-channel-row">
                                                
                                                {/* Colonna Canale Fissa a Sinistra */}
                                                <div
                                                    className="ee-channel-sticky-cell"
                                                    onClick={() => handleWatchChannel(ch.canale)}
                                                    onMouseEnter={() => {
                                                        const slug = createSlug(ch.canale);
                                                        router.prefetch("/sky?ch=" + slug);
                                                    }}
                                                    title={`Guarda ${ch.canale}`}
                                                >
                                                    <span className="ee-ch-num">{chNum}</span>
                                                    <div className="ee-ch-badge">
                                                        {logo ? (
                                                            <img src={logo} alt={ch.canale} className="ee-ch-logo" />
                                                        ) : (
                                                            <span className="ee-ch-name-text">{ch.canale}</span>
                                                        )}
                                                    </div>
                                                    <div className="ee-ch-hover-play">
                                                        <span className="material-symbols-rounded">play_arrow</span>
                                                    </div>
                                                </div>

                                                {/* Timeline Programmi Orizzontale */}
                                                <div className="ee-programs-track">
                                                    {programmi.map((prog, pIdx) => {
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

                                                        // Percentuale progresso se in onda
                                                        let progressPct = 0;
                                                        if (isNow && currentMinutes >= startMins && durationMins > 0) {
                                                            progressPct = Math.min(100, Math.max(0, ((currentMinutes - startMins) / durationMins) * 100));
                                                        }

                                                        return (
                                                            <div
                                                                key={prog.ora + pIdx}
                                                                className={`ee-program-tile ${isNow ? "is-live" : ""} ${isSelected ? "selected" : ""}`}
                                                                style={{
                                                                    left: `${leftPx}px`,
                                                                    width: `${Math.max(widthPx - 3, 24)}px`
                                                                }}
                                                                onClick={() => {
                                                                    if (hasDraggedRef.current) return;
                                                                    setSelectedProgram(prog);
                                                                    setSelectedChannel(ch);
                                                                }}
                                                                onDoubleClick={() => handleWatchChannel(ch.canale)}
                                                                onMouseEnter={() => {
                                                                    const slug = createSlug(ch.canale);
                                                                    router.prefetch("/sky?ch=" + slug);
                                                                }}
                                                            >
                                                                {/* Barra di avanzamento live */}
                                                                {isNow && (
                                                                    <div
                                                                        className="ee-program-progress-bar"
                                                                        style={{ width: `${progressPct}%` }}
                                                                    />
                                                                )}

                                                                <div className="ee-program-content">
                                                                    <div className="ee-prog-time-tag">
                                                                        {isNow && <span className="ee-live-dot-tag"></span>}
                                                                        <span>{prog.ora} {prog.fine ? `- ${prog.fine}` : ""}</span>
                                                                    </div>
                                                                    <div className="ee-prog-title-text" title={prog.titolo}>
                                                                        {prog.titolo}
                                                                    </div>
                                                                </div>

                                                                {/* Tasto rapido riproduzione hover */}
                                                                <button
                                                                    type="button"
                                                                    className="ee-quick-watch-btn"
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
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. SCHEDA DETTAGLIO PROGRAMMA SELEZIONATO IN BASSO */}
                {selectedProgram && selectedChannel && (
                    <aside className="ee-selected-drawer">
                        <div className="ee-drawer-left">
                            <div className="ee-drawer-header-row">
                                <span className="ee-drawer-ch-name">{selectedChannel.canale}</span>
                                <span className="ee-drawer-time-badge">
                                    <span className="material-symbols-rounded">schedule</span>
                                    {selectedProgram.ora} {selectedProgram.fine ? `– ${selectedProgram.fine}` : ""}
                                </span>
                            </div>
                            <h3 className="ee-drawer-title">{selectedProgram.titolo}</h3>
                            {selectedProgram.descrizione && (
                                <p className="ee-drawer-desc">{selectedProgram.descrizione}</p>
                            )}
                        </div>

                        <div className="ee-drawer-actions">
                            <button
                                type="button"
                                className="ee-drawer-watch-btn"
                                onClick={() => handleWatchChannel(selectedChannel.canale)}
                            >
                                <span className="material-symbols-rounded">play_arrow</span>
                                <span>Guarda Canale</span>
                            </button>
                            <button
                                type="button"
                                className="ee-drawer-close-btn"
                                onClick={() => {
                                    setSelectedProgram(null);
                                    setSelectedChannel(null);
                                }}
                                title="Chiudi dettagli"
                            >
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>
                    </aside>
                )}

                {/* 5. FOOTER CON CONTROLLI RAPIDI PC */}
                <footer className="ee-epg-footer">
                    <div className="ee-footer-left">
                        <button type="button" className="ee-footer-action-btn" onClick={handleJumpToNow}>
                            <span className="material-symbols-rounded">schedule</span>
                            <span>IN ONDA ORA</span>
                        </button>
                        <button type="button" className="ee-footer-action-btn" onClick={() => handleScrollStep(-2)}>
                            <span className="material-symbols-rounded">fast_rewind</span>
                            <span>-2 ORE</span>
                        </button>
                        <button type="button" className="ee-footer-action-btn" onClick={() => handleScrollStep(2)}>
                            <span className="material-symbols-rounded">fast_forward</span>
                            <span>+2 ORE</span>
                        </button>
                    </div>

                    <div className="ee-footer-hints">
                        <span className="ee-hint-item">
                            <kbd>Shift</kbd> + Rotellina mouse per scorrere il tempo
                        </span>
                        <span className="ee-hint-sep">•</span>
                        <span className="ee-hint-item">Trascina con il mouse per navigare</span>
                        <span className="ee-hint-sep">•</span>
                        <span className="ee-hint-item">Doppio click per guardare il canale</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
