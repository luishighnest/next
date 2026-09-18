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
                let guideData = [];
                try {
                    const cached = sessionStorage.getItem("nmdz_guide_cache_v3");
                    if (cached) guideData = JSON.parse(cached);
                } catch (e) {}

                if (!guideData || guideData.length === 0) {
                    const res = await fetch("/guida_tv_sky.json?t=" + Date.now(), { cache: "no-store" });
                    if (res.ok) {
                        guideData = await res.json();
                        try {
                            sessionStorage.setItem("nmdz_guide_cache_v3", JSON.stringify(guideData));
                        } catch (e) {}
                    }
                }

                if (!guideData || !Array.isArray(guideData) || guideData.length === 0) return;

                const now = new Date();
                const nowMinutes = now.getHours() * 60 + now.getMinutes();

                const candidates = [];

                for (const ch of guideData) {
                    const chName = (ch.canale || "").toLowerCase();
                    const is4k = chName.includes("4k");
                    const isNumberedSport = /\b(25[1-9]|26[0-9]|calcio\s*[1-9])\b/i.test(chName);
                    if (is4k || isNumberedSport) continue;

                    if (!ch.programmi || ch.programmi.length === 0) continue;

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

                    let matchedChannelObj = null;
                    if (categories && Array.isArray(categories)) {
                        for (const sec of categories) {
                            for (const c of (sec.channels || [])) {
                                const cTitle = (c.title || c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                                const guideTitle = (ch.canale || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                                if (cTitle === guideTitle || cTitle.includes(guideTitle) || guideTitle.includes(cTitle)) {
                                    matchedChannelObj = c;
                                    break;
                                }
                            }
                            if (matchedChannelObj) break;
                        }
                    }

                    const slug = createSlug(ch.canale);
                    const cleanSrc = matchedChannelObj?.skySource?.includes("sky2") ? "sky2" : "";
                    const targetHref = "/sky?ch=" + slug + (cleanSrc ? "&src=" + cleanSrc : "");

                    candidates.push({
                        channelName: ch.canale,
                        category: ch.categoria || (chName.includes("sport") ? "Sport" : "Intrattenimento"),
                        progTitle: prog.titolo || ch.canale,
                        progDesc: prog.descrizione || "",
                        progOraInizio: prog.ora || "",
                        progOraFine: nextProg?.ora || "",
                        progImg: rawImg,
                        targetHref,
                        channelObj: matchedChannelObj || { title: ch.canale, name: ch.canale, slug },
                        logoUrl: getChannelLogoUrl({ title: ch.canale }),
                        currentProg: prog,
                        nextProg
                    });

                    if (candidates.length >= 10) break;
                }

                // Estrazione di Eventi Live e VOD da test.json (tramite categories)
                const testJsonLive = [];
                const testJsonVod = [];

                if (categories && Array.isArray(categories)) {
                    for (const sec of categories) {
                        for (const c of (sec.channels || [])) {
                            if (!c.isTestJson) continue;
                            const evImg = c.image || c.logo;
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
                                logoUrl: c.logo && c.logo.startsWith("http") ? c.logo : (isVod ? "" : "/logos/dazn.png"),
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

                // Candidati VOD da test.json
                const vodCandidates = [...testJsonVod];

                // Shuffle pool Live Sky e Live test.json
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }
                for (let i = testJsonLive.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [testJsonLive[i], testJsonLive[j]] = [testJsonLive[j], testJsonLive[i]];
                }
                for (let i = vodCandidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [vodCandidates[i], vodCandidates[j]] = [vodCandidates[j], vodCandidates[i]];
                }

                // Live pool con DAZN live da test.json prioritario + Sky live
                const liveCandidates = [...testJsonLive, ...candidates];

                let selected = [];
                const numLiveAvailable = liveCandidates.length;

                if (numLiveAvailable === 0) {
                    // Solo VOD: max 2 su 5
                    selected = vodCandidates.slice(0, 2);
                } else if (numLiveAvailable === 1) {
                    // 1 live: 1 live e 1 VOD
                    selected.push(liveCandidates[0]);
                    if (vodCandidates.length > 0) selected.push(vodCandidates[0]);
                } else {
                    // Gli eventi live hanno sempre la precedenza
                    // Massimo 2-3 locandine fisse su 5 di VOD da test.json se ci sono slot disponibili
                    const maxVodCount = Math.min(3, vodCandidates.length);
                    const minLiveNeeded = Math.max(1, 5 - maxVodCount);
                    const chosenLiveCount = Math.min(numLiveAvailable, Math.max(minLiveNeeded, 5 - Math.min(maxVodCount, 2)));

                    selected.push(...liveCandidates.slice(0, chosenLiveCount));
                    const remainingSlots = 5 - selected.length;
                    if (remainingSlots > 0 && vodCandidates.length > 0) {
                        const maxVodToAdd = Math.min(remainingSlots, Math.min(3, vodCandidates.length));
                        selected.push(...vodCandidates.slice(0, maxVodToAdd));
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
