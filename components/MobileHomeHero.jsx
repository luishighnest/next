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

                // 1. Estrazione di Eventi Live e VOD da test.json (tramite categories)
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
                                logoUrl: "/logos/dazn.png", // Logo DAZN per test.json
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

                // Shuffle pool test.json
                const liveTestPool = [...testJsonLive];
                const vodTestPool = [...testJsonVod];
                for (let i = liveTestPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [liveTestPool[i], liveTestPool[j]] = [liveTestPool[j], liveTestPool[i]];
                }
                for (let i = vodTestPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [vodTestPool[i], vodTestPool[j]] = [vodTestPool[j], vodTestPool[i]];
                }

                // 2. Caricamento Guida TV Sky per canali Sky Live
                let guideData = null;
                try {
                    const cached = sessionStorage.getItem("nmdz_guide_cache_v3");
                    if (cached) guideData = JSON.parse(cached);
                } catch (e) {}

                if (!guideData || guideData.length === 0) {
                    try {
                        const res = await fetch("/guida_tv_sky.json?t=" + Date.now(), { cache: "no-store" });
                        if (res.ok) {
                            guideData = await res.json();
                            try {
                                sessionStorage.setItem("nmdz_guide_cache_v3", JSON.stringify(guideData));
                            } catch (e) {}
                        }
                    } catch (e) {}
                }

                const skyCandidates = [];
                if (guideData && Array.isArray(guideData)) {
                    for (const ch of guideData) {
                        const cat = (ch.categoria || "").toLowerCase();
                        const chName = (ch.canale || "").toLowerCase();
                        
                        // ESCLUDI TASSATIVAMENTE SKY CINEMA E CATEGORIA CINEMA
                        if (cat === "cinema" || chName.includes("cinema")) continue;

                        const is4k = chName.includes("4k");
                        const isGolf = chName.includes("golf");
                        const isNumberedSport = /\b(25[1-9]|26[0-9]|calcio\s*[1-9])\b/i.test(chName) || /sky\s*(?:sport|calcio)\s*25\d/i.test(chName);
                        if (is4k || isGolf || isNumberedSport) continue;

                        if (!ch.programmi || ch.programmi.length === 0) continue;

                        const now = new Date();
                        const nowMinutes = now.getHours() * 60 + now.getMinutes();

                        let currentIdx = -1;
                        for (let i = 0; i < ch.programmi.length; i++) {
                            const p = ch.programmi[i];
                            const [hh, mm] = (p.ora || "0:00").split(":").map(Number);
                            const pMin = (hh || 0) * 60 + (mm || 0);
                            if (pMin > nowMinutes) {
                                currentIdx = i > 0 ? i - 1 : 0;
                                break;
                            }
                        }
                        if (currentIdx === -1) currentIdx = ch.programmi.length - 1;

                        const prog = ch.programmi[currentIdx];
                        const nextProg = currentIdx < ch.programmi.length - 1 ? ch.programmi[currentIdx + 1] : null;

                        const rawImg = prog?.immagine;
                        if (!rawImg || !rawImg.startsWith("http")) continue;

                        const slug = createSlug(ch.canale);
                        const targetHref = `/sky?ch=${slug}`;
                        const logo = getChannelLogoUrl({ title: ch.canale });

                        skyCandidates.push({
                            channelName: ch.canale,
                            category: ch.categoria || "Sport",
                            progTitle: prog?.titolo || ch.canale,
                            progDesc: prog?.descrizione || "",
                            progOraInizio: prog?.ora || "",
                            progOraFine: nextProg?.ora || "",
                            progImg: rawImg,
                            targetHref,
                            channelObj: { title: ch.canale, name: ch.canale, slug },
                            logoUrl: logo,
                            currentProg: prog,
                            nextProg: nextProg,
                            isVodItem: false,
                            isTestJson: false
                        });
                    }
                }

                // Shuffle Sky candidates
                for (let i = skyCandidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [skyCandidates[i], skyCandidates[j]] = [skyCandidates[j], skyCandidates[i]];
                }

                // 3. Regole di selezione esatte (totale 5 contenuti):
                // - Se 2 eventi live: tutti e due in hero (SOLO 2 su 5, + 3 Sky)
                // - Se 3 eventi live: 3 in hero (SOLO 3 su 5, + 2 Sky)
                // - Se 4 o più eventi live: MASSIMO 3 di test.json in hero (+ 2 Sky)
                // - Se 1 evento live: 1 live + 1 VOD (se c'è, max 2 su 5, + 3 Sky)
                // - Se 0 eventi live: massimo 2 VOD (+ 3 Sky)
                // I contenuti di test.json devono essere SEMPRE i primi 2 o 3 dei 5!
                const numLiveTest = liveTestPool.length;
                let selectedTest = [];

                if (numLiveTest >= 4) {
                    selectedTest = liveTestPool.slice(0, 3);
                } else if (numLiveTest === 3) {
                    selectedTest = liveTestPool.slice(0, 3);
                } else if (numLiveTest === 2) {
                    selectedTest = liveTestPool.slice(0, 2);
                } else if (numLiveTest === 1) {
                    selectedTest.push(liveTestPool[0]);
                    if (vodTestPool.length > 0) selectedTest.push(vodTestPool[0]);
                } else {
                    selectedTest.push(...vodTestPool.slice(0, 2));
                }

                const neededSky = Math.max(0, 5 - selectedTest.length);
                const selectedSky = skyCandidates.slice(0, neededSky);

                // Composizione finale: SEMPRE prima i 2/3 di test.json, poi i canali Sky (totale 5)
                let final5 = [...selectedTest, ...selectedSky];
                if (final5.length < 5) {
                    const remainingNeeded = 5 - final5.length;
                    const remainingSky = skyCandidates.filter(s => !final5.some(f => f.channelName === s.channelName));
                    final5.push(...remainingSky.slice(0, remainingNeeded));
                }

                if (isMounted && final5.length > 0) {
                    setHeroItems(final5);
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
                {/* Badges Categoria & Diretta / On Demand */}
                <div className="mobile-hero-top-row">
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

                {/* Riga con Logo a sinistra e Titolo sullo stesso livello (non sopra), senza '...' per intero verso destra */}
                <div className="mobile-hero-title-row flex items-center gap-3 overflow-x-auto no-scrollbar py-1" style={{ width: "100%", scrollbarWidth: "none" }}>
                    {current.logoUrl ? (
                        <img
                            src={current.logoUrl}
                            alt={current.channelName}
                            className="mobile-hero-logo flex-shrink-0"
                            style={{ height: "30px", width: "auto", maxWidth: "90px", objectFit: "contain" }}
                            loading="eager"
                        />
                    ) : (
                        <span className="mobile-hero-ch-badge flex-shrink-0">{current.channelName}</span>
                    )}

                    <h1 
                        className="mobile-hero-title"
                        style={{
                            whiteSpace: "nowrap",
                            overflow: "visible",
                            textOverflow: "clip",
                            display: "inline-block",
                            margin: 0,
                            flexShrink: 0
                        }}
                    >
                        {current.progTitle}
                    </h1>
                </div>

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
