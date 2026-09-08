"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
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
    const [selectedTimeFilter, setSelectedTimeFilter] = useState("all");

    const listRef = useRef(null);
    const timelineRef = useRef(null);

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
                        if (isMounted) {
                            setSelectedChannel(parsed[0]);
                            const cur = getLiveProgram(parsed[0]?.programmi);
                            setSelectedProgram(cur || parsed[0]?.programmi?.[0] || null);
                            setLoading(false);
                            return;
                        }
                    }
                }

                const res = await fetch("/guida_tv_sky.json", { cache: "force-cache" });
                const json = await res.json();
                if (isMounted && Array.isArray(json)) {
                    setGuideData(json);
                    setSelectedChannel(json[0] || null);
                    const cur = getLiveProgram(json[0]?.programmi);
                    setSelectedProgram(cur || json[0]?.programmi?.[0] || null);
                    try {
                        sessionStorage.setItem("nmdz_guide_cache", JSON.stringify(json));
                    } catch(e) {}
                }
            } catch (err) {
                console.error("Errore caricamento Guida TV:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchGuide();
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            const origOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = origOverflow;
            };
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const categories = useMemo(() => {
        if (!guideData.length) return ["Tutti"];
        const set = new Set(["Tutti"]);
        guideData.forEach(c => {
            if (c.categoria) set.add(c.categoria);
        });
        return Array.from(set);
    }, [guideData]);

    const filteredChannels = useMemo(() => {
        return guideData.filter(ch => {
            const matchesCat = activeCategory === "Tutti" || ch.categoria === activeCategory;
            const matchesSearch = !searchQuery || ch.canale.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (ch.programmi || []).some(p => p.titolo?.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCat && matchesSearch;
        });
    }, [guideData, activeCategory, searchQuery]);

    function getLiveProgram(programmi) {
        if (!Array.isArray(programmi) || !programmi.length) return null;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        let liveIdx = -1;
        for (let i = 0; i < programmi.length; i++) {
            const p = programmi[i];
            const [h, m] = (p.ora || "00:00").split(":").map(Number);
            const pMins = (h || 0) * 60 + (m || 0);
            if (pMins > nowMins) {
                liveIdx = i > 0 ? i - 1 : 0;
                break;
            }
        }
        if (liveIdx === -1) liveIdx = programmi.length - 1;
        return programmi[liveIdx];
    }

    function getProgProgress(prog, nextProg) {
        if (!prog) return 0;
        const now = new Date();
        let nowMins = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = (prog.ora || "00:00").split(":").map(Number);
        const startMins = (sh || 0) * 60 + (sm || 0);
        let endMins = 24 * 60;
        if (nextProg) {
            const [eh, em] = (nextProg.ora || "00:00").split(":").map(Number);
            endMins = (eh || 0) * 60 + (em || 0);
            if (endMins <= startMins) endMins += 24 * 60;
        }
        if (nowMins < startMins) nowMins += 24 * 60;
        if (nowMins >= startMins && endMins > startMins) {
            const pct = Math.round(((nowMins - startMins) / (endMins - startMins)) * 100);
            return Math.min(Math.max(pct, 0), 100);
        }
        return 0;
    }

    useEffect(() => {
        if (filteredChannels.length > 0) {
            if (!selectedChannel || !filteredChannels.some(c => c.canale === selectedChannel.canale)) {
                const first = filteredChannels[0];
                setSelectedChannel(first);
                const cur = getLiveProgram(first.programmi);
                setSelectedProgram(cur || first.programmi?.[0] || null);
            }
        }
    }, [filteredChannels, selectedChannel]);

    const handleWatchChannel = (channelName) => {
        onClose();
        const slug = createSlug(channelName || "");
        router.push("/sky?ch=" + slug);
    };

    if (!isOpen) return null;

    const channelPrograms = (selectedChannel?.programmi || []).filter(p => {
        if (selectedTimeFilter === "all") return true;
        const [h] = (p.ora || "00:00").split(":").map(Number);
        if (selectedTimeFilter === "serata") return h >= 20 && h <= 23;
        if (selectedTimeFilter === "notte") return h >= 23 || h < 6;
        if (selectedTimeFilter === "pomeriggio") return h >= 13 && h < 20;
        if (selectedTimeFilter === "mattina") return h >= 6 && h < 13;
        return true;
    });

    const liveProg = getLiveProgram(selectedChannel?.programmi);

    return (
        <div className="guidatv-backdrop" onClick={onClose}>
            <div className="guidatv-modal" onClick={(e) => e.stopPropagation()}>
                <div className="guidatv-header">
                    <div className="guidatv-header-left">
                        <div className="guidatv-badge">
                            <i className="fas fa-tv"></i>
                            <span>GUIDA TV EPG</span>
                        </div>
                        <div className="guidatv-clock">
                            {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>

                    <div className="guidatv-search-box">
                        <i className="fas fa-magnifying-glass"></i>
                        <input
                            type="text"
                            placeholder="Cerca canale o programma..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery("")}>
                                <i className="fas fa-xmark"></i>
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        className="guidatv-close-btn"
                        onClick={onClose}
                        title="Chiudi Guida TV"
                    >
                        <i className="fas fa-xmark"></i>
                    </button>
                </div>

                <div className="guidatv-filter-bar">
                    <div className="guidatv-categories">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                className={"guidatv-cat-pill " + (activeCategory === cat ? "active" : "")}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="guidatv-time-filters">
                        <span className="guidatv-filter-label">Fascia:</span>
                        <button
                            type="button"
                            className={"guidatv-time-pill " + (selectedTimeFilter === "all" ? "active" : "")}
                            onClick={() => setSelectedTimeFilter("all")}
                        >
                            Tutto
                        </button>
                        <button
                            type="button"
                            className={"guidatv-time-pill " + (selectedTimeFilter === "serata" ? "active" : "")}
                            onClick={() => setSelectedTimeFilter("serata")}
                        >
                            Prima Serata
                        </button>
                        <button
                            type="button"
                            className={"guidatv-time-pill " + (selectedTimeFilter === "pomeriggio" ? "active" : "")}
                            onClick={() => setSelectedTimeFilter("pomeriggio")}
                        >
                            Pomeriggio
                        </button>
                    </div>
                </div>

                <div className="guidatv-content">
                    {loading ? (
                        <div className="guidatv-loading">
                            <div className="guidatv-spinner"></div>
                            <span>Caricamento Guida TV in corso...</span>
                        </div>
                    ) : (
                        <>
                            <div className="guidatv-channel-list" ref={listRef}>
                                {filteredChannels.map((ch, idx) => {
                                    const isSel = selectedChannel?.canale === ch.canale;
                                    const curr = getLiveProgram(ch.programmi);
                                    const logo = getChannelLogoUrl({ title: ch.canale });
                                    const pct = getProgProgress(curr, null);

                                    return (
                                        <div
                                            key={ch.canale + idx}
                                            className={"guidatv-ch-row " + (isSel ? "active" : "")}
                                            onClick={() => {
                                                setSelectedChannel(ch);
                                                setSelectedProgram(curr || ch.programmi?.[0] || null);
                                            }}
                                        >
                                            <div className="guidatv-ch-logo-wrap">
                                                <img src={logo} alt={ch.canale} className="guidatv-ch-logo" />
                                            </div>
                                            <div className="guidatv-ch-info">
                                                <div className="guidatv-ch-name-row">
                                                    <span className="guidatv-ch-name">{ch.canale}</span>
                                                    <span className="guidatv-ch-cat">{ch.categoria}</span>
                                                </div>
                                                <div className="guidatv-ch-curr-prog">
                                                    <span className="live-dot-pulse"></span>
                                                    <span className="prog-time">{curr?.ora || "--:--"}</span>
                                                    <span className="prog-title">{curr?.titolo || "Nessun dato"}</span>
                                                </div>
                                                {pct > 0 && (
                                                    <div className="guidatv-prog-bar">
                                                        <div className="guidatv-prog-fill" style={{ width: pct + "%" }}></div>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="guidatv-quick-play-btn"
                                                title={"Guarda " + ch.canale}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleWatchChannel(ch.canale);
                                                }}
                                            >
                                                <i className="fas fa-play"></i>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="guidatv-program-panel">
                                {/* Cinema Hero Stage del canale e programma selezionato (Coerente con Sky/Eventi) */}
                                <div className="guidatv-cinema-stage">
                                    <div className="guidatv-stage-backdrop">
                                        {selectedProgram?.immagine && (
                                            <img
                                                src={selectedProgram.immagine}
                                                alt=""
                                                className="guidatv-stage-bg-img"
                                                loading="lazy"
                                            />
                                        )}
                                        <div className="guidatv-stage-overlay-grad"></div>
                                    </div>

                                    <div className="guidatv-stage-content">
                                        <div className="guidatv-stage-top">
                                            <div className="guidatv-stage-channel-badge">
                                                <div className="guidatv-stage-logo-wrap">
                                                    <img
                                                        src={getChannelLogoUrl({ title: selectedChannel?.canale })}
                                                        alt=""
                                                        className="guidatv-stage-logo"
                                                    />
                                                </div>
                                                <div className="guidatv-stage-channel-meta">
                                                    <span className="guidatv-stage-ch-name">{selectedChannel?.canale || "Seleziona Canale"}</span>
                                                    <span className="guidatv-stage-ch-cat">{selectedChannel?.categoria || "Live TV"}</span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                className="guidatv-hero-play-btn"
                                                onClick={() => handleWatchChannel(selectedChannel?.canale)}
                                            >
                                                <i className="fas fa-play"></i>
                                                <span>Guarda Canale</span>
                                            </button>
                                        </div>

                                        {selectedProgram && (
                                            <div className="guidatv-stage-main">
                                                <div className="guidatv-stage-meta-row">
                                                    <span className="stage-time-pill">
                                                        <i className="fa-regular fa-clock"></i>
                                                        {selectedProgram.ora} {selectedProgram.fine ? `- ${selectedProgram.fine}` : ""}
                                                    </span>
                                                    {liveProg?.titolo === selectedProgram.titolo && (
                                                        <span className="stage-live-badge">
                                                            <span className="dot"></span>IN ONDA
                                                        </span>
                                                    )}
                                                </div>

                                                <h1 className="guidatv-stage-title">{selectedProgram.titolo}</h1>

                                                {selectedProgram.descrizione && (
                                                    <p className="guidatv-stage-desc">
                                                        {selectedProgram.descrizione}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Timeline orizzontale coerente con le card eventi del sito */}
                                <div className="guidatv-timeline-section">
                                    <div className="guidatv-timeline-header">
                                        <div className="timeline-header-left">
                                            <i className="fas fa-calendar-day"></i>
                                            <span className="timeline-title">Palinsesto Giornaliero</span>
                                        </div>
                                        <span className="timeline-count">{channelPrograms.length} programmi</span>
                                    </div>

                                    <div className="guidatv-timeline-scroll" ref={timelineRef}>
                                        {channelPrograms.map((prog, pIdx) => {
                                            const isSelected = selectedProgram?.titolo === prog.titolo && selectedProgram?.ora === prog.ora;
                                            const isLive = liveProg?.titolo === prog.titolo && liveProg?.ora === prog.ora;

                                            return (
                                                <div
                                                    key={prog.ora + pIdx}
                                                    className={"guidatv-schedule-card " + (isSelected ? "selected " : "") + (isLive ? "live" : "")}
                                                    onClick={() => setSelectedProgram(prog)}
                                                >
                                                    <div className="schedule-card-header">
                                                        <span className="schedule-time">{prog.ora}</span>
                                                        {isLive && <span className="schedule-live-dot">LIVE</span>}
                                                    </div>
                                                    <div className="schedule-title">{prog.titolo}</div>
                                                    {prog.descrizione && (
                                                        <div className="schedule-snippet">{prog.descrizione}</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
