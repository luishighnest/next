"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
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
                    const cached = sessionStorage.getItem("nmdz_guide_cache");
                    if (cached) guideData = JSON.parse(cached);
                } catch (e) {}

                if (!guideData || guideData.length === 0) {
                    const res = await fetch("/guida_tv_sky.json", { cache: "force-cache" });
                    if (res.ok) {
                        guideData = await res.json();
                        try {
                            sessionStorage.setItem("nmdz_guide_cache", JSON.stringify(guideData));
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

                    if (candidates.length >= 6) break;
                }

                if (isMounted && candidates.length > 0) {
                    setHeroItems(candidates);
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
                        <span className="mobile-live-tag">
                            <span className="mobile-live-dot" />
                            DIRETTA
                        </span>
                        <span className="mobile-meta-dot">•</span>
                        <span className="mobile-cat-tag">{current.category}</span>
                    </div>
                </div>

                {/* Titolo Principale */}
                <h1 className="mobile-hero-title">{current.progTitle}</h1>

                {/* Info Programmazione EPG */}
                <div className="mobile-hero-epg-row">
                    <span className="material-symbols-rounded mobile-epg-icon">schedule</span>
                    <span className="mobile-epg-text">
                        {current.progOraFine ? `Dalle ${current.progOraInizio} alle ${current.progOraFine}` : `Inizio ${current.progOraInizio}`}
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
                                <span className="mobile-sheet-badge">In Onda</span>
                                <div className="mobile-sheet-time">{current.progOraInizio} - {current.progOraFine || "Fine"}</div>
                                <div className="mobile-sheet-title">{current.progTitle}</div>
                                {current.progDesc && <p className="mobile-sheet-desc">{current.progDesc}</p>}
                            </div>
                            {current.nextProg && (
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
                                <span>Guarda la diretta</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
