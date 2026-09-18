"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";

export default function MobileHomeHero({ categories = [] }) {
    const [heroItems, setHeroItems] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const timerRef = useRef(null);
    const touchStartXRef = useRef(0);
    const touchDeltaXRef = useRef(0);

    useEffect(() => {
        let isMounted = true;

        async function loadMobileHero() {
            try {
                let sectionsList = categories;
                if (!sectionsList || !Array.isArray(sectionsList) || sectionsList.length === 0) {
                    try {
                        const localCached = localStorage.getItem("nmdz_cached_sections");
                        if (localCached) {
                            const parsed = JSON.parse(localCached);
                            if (Array.isArray(parsed) && parsed.length > 0) sectionsList = parsed;
                        }
                    } catch(e) {}
                }

                if (!sectionsList || sectionsList.length === 0) {
                    try {
                        const res = await fetch(`/api/canali?t=${Date.now()}`, { cache: "no-store" });
                        if (res.ok) {
                            const data = await res.json();
                            if (Array.isArray(data?.sections)) sectionsList = data.sections;
                        }
                    } catch(e) {}
                }

                // Estrazione di Eventi Live e VOD esclusivamente da test.json (tramite categories)
                const testJsonLive = [];
                const testJsonVod = [];

                if (sectionsList && Array.isArray(sectionsList)) {
                    for (const sec of sectionsList) {
                        for (const c of (sec.channels || [])) {
                            if (!c.isTestJson) continue;
                            const evImg = c.image;
                            if (!evImg || typeof evImg !== "string" || !evImg.startsWith("http")) continue;

                            const evTitle = c.title || c.name || "Evento";
                            const evSlug = c.slug || createSlug(evTitle);
                            const evTargetHref = `/eventi/${evSlug}`;
                            const isVod = Boolean(
                                c.isEventVod ||
                                (c.tile_type && (c.tile_type.toLowerCase() === "catchup" || c.tile_type.toLowerCase() === "ondemand")) ||
                                (c.group && c.group.toLowerCase().includes("vod"))
                            );

                            const heroEventItem = {
                                channelName: c.group || (isVod ? "Eventi VOD" : "DAZN Live"),
                                category: isVod ? "VOD" : "Sport",
                                progTitle: evTitle,
                                progDesc: c.schedule ? `${c.schedule} • Disponibile in streaming` : (isVod ? "Replay / On Demand disponibile in streaming" : "Diretta sportiva disponibile in streaming"),
                                progOraInizio: c.ora || "",
                                progOraFine: "",
                                progImg: evImg,
                                targetHref: evTargetHref,
                                channelObj: c,
                                logoUrl: "/logos/dazn.png",
                                currentProg: {
                                    titolo: evTitle,
                                    descrizione: c.schedule ? `${c.schedule} • Disponibile in streaming` : "",
                                    ora: c.ora || ""
                                },
                                nextProg: null,
                                isVodItem: isVod,
                                isTestJson: true
                            };

                            if (isVod) {
                                testJsonVod.push(heroEventItem);
                            } else {
                                testJsonLive.push(heroEventItem);
                            }
                        }
                    }
                }

                // Shuffle pool
                const livePool = [...testJsonLive];
                const vodPool = [...testJsonVod];

                for (let i = livePool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [livePool[i], livePool[j]] = [livePool[j], livePool[i]];
                }
                for (let i = vodPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [vodPool[i], vodPool[j]] = [vodPool[j], vodPool[i]];
                }

                const numLive = livePool.length;
                let selected = [];

                if (numLive === 0) {
                    // 0 eventi live: MASSIMO 2 VOD su 5
                    selected = vodPool.slice(0, 2);
                } else if (numLive === 1) {
                    // 1 evento live: 1 live + 1 VOD (totale 2)
                    selected.push(livePool[0]);
                    if (vodPool.length > 0) selected.push(vodPool[0]);
                } else {
                    // 2 o più eventi live: precedenza ai live, massimo 3 VOD su 5
                    const maxVod = Math.min(3, vodPool.length);
                    const liveCount = Math.min(numLive, 5 - maxVod);
                    selected.push(...livePool.slice(0, liveCount));

                    const remainingSlots = 5 - selected.length;
                    const vodToAdd = Math.min(remainingSlots, maxVod);
                    if (vodToAdd > 0) {
                        selected.push(...vodPool.slice(0, vodToAdd));
                    }
                }

                if (isMounted && selected.length > 0) {
                    setHeroItems(selected);
                }
            } catch (err) {
                console.error("Mobile Hero load err:", err);
            }
        }

        loadMobileHero();
        return () => { isMounted = false; };
    }, [categories]);

    const nextSlide = useCallback(() => {
        if (heroItems.length <= 1) return;
        setActiveIndex(prev => (prev + 1) % heroItems.length);
    }, [heroItems.length]);

    const prevSlide = useCallback(() => {
        if (heroItems.length <= 1) return;
        setActiveIndex(prev => (prev - 1 + heroItems.length) % heroItems.length);
    }, [heroItems.length]);

    // Timer di scorrimento automatico
    useEffect(() => {
        if (heroItems.length <= 1 || isInfoOpen) return;
        timerRef.current = setInterval(nextSlide, 6000);
        return () => clearInterval(timerRef.current);
    }, [heroItems.length, isInfoOpen, nextSlide]);

    // Supporto Touch Swipe nativo fluido
    const handleTouchStart = (e) => {
        touchStartXRef.current = e.touches[0].clientX;
        touchDeltaXRef.current = 0;
    };

    const handleTouchMove = (e) => {
        touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
    };

    const handleTouchEnd = () => {
        if (Math.abs(touchDeltaXRef.current) > 45) {
            if (touchDeltaXRef.current < 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
    };

    if (!heroItems || heroItems.length === 0) return null;

    const current = heroItems[activeIndex];

    return (
        <section
            className="nmdz-mobile-hero"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Visuale Sfondo Immagine */}
            <div className="mobile-hero-art">
                {heroItems.map((item, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                        <div
                            key={item.channelName + idx}
                            className={`mobile-hero-slide ${isActive ? "active" : ""}`}
                            style={{
                                backgroundImage: `url("${item.progImg}")`,
                                opacity: isActive ? 1 : 0
                            }}
                        />
                    );
                })}
                {/* Gradient Masks per Mobile: Proteggono la leggibilita' con profondita' cinematografica */}
                <div className="mobile-hero-gradient-top" />
                <div className="mobile-hero-gradient-bottom" />
            </div>

            {/* Contenuto Touch-Friendly */}
            <div className="mobile-hero-content">
                {/* Brand & Meta */}
                <div className="mobile-hero-top-row">
                    {current.logoUrl ? (
                        <img
                            src={current.logoUrl}
                            alt={current.channelName}
                            className="mobile-hero-logo"
                            loading="eager"
                        />
                    ) : (
                        <span className="mobile-hero-ch-badge">{current.channelName}</span>
                    )}

                    <div className="mobile-hero-badges">
                        {current.isVodItem ? (
                            <span className="mobile-live-tag" style={{ background: "rgba(0, 229, 155, 0.2)", color: "#00e59b" }}>
                                <span className="material-symbols-rounded" style={{ fontSize: "0.85rem", marginRight: "3px" }}>movie</span>
                                ON DEMAND
                            </span>
                        ) : (
                            <span className="mobile-live-tag">
                                <span className="mobile-live-dot" />
                                DIRETTA
                            </span>
                        )}
                        <span className="mobile-meta-dot">•</span>
                        <span className="mobile-cat-tag">{current.category}</span>
                    </div>
                </div>

                {/* Titolo Principale */}
                <h1 className="mobile-hero-title">{current.progTitle}</h1>

                {/* Info Programmazione EPG */}
                <div className="mobile-hero-epg-row">
                    <span className="material-symbols-rounded mobile-epg-icon">{current.isVodItem ? "play_circle" : "schedule"}</span>
                    <span className="mobile-epg-text">
                        {current.isVodItem ? "Disponibile subito" : (current.progOraFine ? `Dalle ${current.progOraInizio} alle ${current.progOraFine}` : `Inizio ${current.progOraInizio}`)}
                    </span>
                </div>

                {/* Pulsanti Azione Touch */}
                <div className="mobile-hero-actions">
                    <Link
                        href={current.targetHref}
                        className="mobile-btn-play"
                        onClick={() => {
                            try {
                                if (current.channelObj) {
                                    sessionStorage.setItem("nmdz_skyChannel", JSON.stringify(current.channelObj));
                                }
                            } catch(e) {}
                        }}
                    >
                        <span className="material-symbols-rounded">play_arrow</span>
                        <span>Guarda ora</span>
                    </Link>

                    <button
                        type="button"
                        className="mobile-btn-info"
                        onClick={() => setIsInfoOpen(true)}
                        aria-label="Dettagli guida TV"
                    >
                        <span className="material-symbols-rounded">info</span>
                    </button>
                </div>

                {/* Indicatori a pallini/barre touch in basso */}
                <div className="mobile-hero-dots">
                    {heroItems.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`mobile-dot ${i === activeIndex ? "active" : ""}`}
                            onClick={() => setActiveIndex(i)}
                            aria-label={`Vai al canale ${i + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Modal Guida TV Mobile (Bottom Sheet moderna) */}
            {isInfoOpen && (
                <div className="mobile-sheet-backdrop" onClick={() => setIsInfoOpen(false)}>
                    <div className="mobile-sheet-drawer" onClick={(e) => e.stopPropagation()}>
                        <div className="mobile-sheet-handle" />
                        <div className="mobile-sheet-header">
                            <div className="mobile-sheet-ch">
                                {current.logoUrl && <img src={current.logoUrl} alt="" className="mobile-sheet-logo" />}
                                <strong>{current.channelName}</strong>
                            </div>
                            <button
                                type="button"
                                className="mobile-sheet-close"
                                onClick={() => setIsInfoOpen(false)}
                            >
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div className="mobile-sheet-body">
                            <div className="mobile-sheet-prog-item active">
                                <span className="mobile-sheet-badge">{current.isVodItem ? "On Demand" : "In Onda"}</span>
                                <div className="mobile-sheet-time">
                                    {current.isVodItem ? "Disponibile subito in streaming" : `${current.progOraInizio} - ${current.progOraFine || "Fine"}`}
                                </div>
                                <div className="mobile-sheet-title">{current.progTitle}</div>
                                {current.progDesc && <p className="mobile-sheet-desc">{current.progDesc}</p>}
                            </div>
                            {!current.isVodItem && current.nextProg && (
                                <div className="mobile-sheet-prog-item next">
                                    <span className="mobile-sheet-badge secondary">Successivo</span>
                                    <div className="mobile-sheet-time">{current.nextProg.ora}</div>
                                    <div className="mobile-sheet-title">{current.nextProg.titolo}</div>
                                    {current.nextProg.descrizione && (
                                        <p className="mobile-sheet-desc">{current.nextProg.descrizione}</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="mobile-sheet-footer">
                            <Link
                                href={current.targetHref}
                                className="mobile-sheet-play-btn"
                                onClick={() => setIsInfoOpen(false)}
                            >
                                <span className="material-symbols-rounded">play_arrow</span>
                                <span>{current.isVodItem ? "Guarda film" : "Guarda la diretta"}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
