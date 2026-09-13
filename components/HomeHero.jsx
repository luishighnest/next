"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";

export default function HomeHero({ categories = [] }) {
    const [heroItems, setHeroItems] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        async function initHeroChannels() {
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

                guideData.forEach(ch => {
                    const cat = (ch.categoria || "").toLowerCase();
                    const name = (ch.canale || "").toLowerCase();
                    const isSky = name.includes("sky");
                    const isAllowedCat = cat === "sport" || cat === "intrattenimento";

                    if (!isSky || !isAllowedCat) return;
                    if (!ch.programmi || ch.programmi.length === 0) return;

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

                    let progressPct = 0;
                    if (prog) {
                        const [sH, sM] = (prog.ora || "0:00").split(":").map(Number);
                        const sMin = (sH || 0) * 60 + (sM || 0);
                        let eMin = 24 * 60;
                        if (nextProg) {
                            const [eH, eM] = (nextProg.ora || "0:00").split(":").map(Number);
                            eMin = (eH || 0) * 60 + (eM || 0);
                            if (eMin <= sMin) eMin += 24 * 60;
                        }
                        let curAdjusted = nowMinutes;
                        if (curAdjusted < sMin) curAdjusted += 24 * 60;
                        if (curAdjusted >= sMin && eMin > sMin) {
                            progressPct = Math.min(100, Math.max(0, Math.round(((curAdjusted - sMin) / (eMin - sMin)) * 100)));
                        }
                    }

                    const img = prog?.immagine;
                    if (!img || !img.startsWith("http")) return;

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
                        category: ch.categoria || (cat === "sport" ? "Sport" : "Intrattenimento"),
                        progTitle: prog.titolo || ch.canale,
                        progDesc: prog.descrizione || "",
                        progOraInizio: prog.ora || "",
                        progOraFine: nextProg?.ora || "",
                        progImg: img,
                        progress: progressPct,
                        targetHref,
                        channelObj: matchedChannelObj || { title: ch.canale, name: ch.canale, slug },
                        logoUrl: getChannelLogoUrl({ title: ch.canale })
                    });
                });

                if (!isMounted || candidates.length === 0) return;

                // Shuffle casuale Fisher-Yates: 5 canali sempre diversi ad ogni ricarica
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }

                const selected5 = candidates.slice(0, 5);
                setHeroItems(selected5);
                setActiveIndex(0);
            } catch (err) {
                console.error("Errore caricamento canali Hero:", err);
            }
        }

        initHeroChannels();
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

    useEffect(() => {
        if (isHovered || heroItems.length <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            nextSlide();
        }, 6000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isHovered, heroItems.length, nextSlide]);

    if (!heroItems || heroItems.length === 0) {
        return null;
    }

    const current = heroItems[activeIndex];

    const handleCardClick = (item) => {
        try {
            if (item.channelObj) {
                sessionStorage.setItem("nmdz_skyChannel", JSON.stringify(item.channelObj));
            }
        } catch(e) {}
    };

    return (
        <section
            className="home-hero-container"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="In Evidenza su Sky"
        >
            <div className="home-hero-backdrop-wrapper">
                {heroItems.map((item, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                        <div
                            key={item.channelName + idx}
                            className={"home-hero-bg-layer " + (isActive ? "active" : "")}
                            style={{
                                backgroundImage: "url(" + item.progImg + ")",
                                opacity: isActive ? 1 : 0,
                                zIndex: isActive ? 1 : 0
                            }}
                        />
                    );
                })}
                <div className="home-hero-gradient-overlay" />
                <div className="home-hero-radial-overlay" />
                <div className="home-hero-bottom-fade" />
            </div>

            <div className="home-hero-content-wrapper">
                <div className="home-hero-info">
                    <div className="home-hero-meta-row">
                        <span className="home-hero-live-badge">
                            <span className="home-hero-live-dot" />
                            ORA IN ONDA
                        </span>
                        <span className="home-hero-cat-pill">{current.category}</span>
                        <span className="home-hero-channel-name">
                            {current.logoUrl && (
                                <img
                                    src={current.logoUrl}
                                    alt={current.channelName}
                                    className="home-hero-channel-logo"
                                    loading="eager"
                                />
                            )}
                            {current.channelName}
                        </span>
                    </div>

                    <h1 className="home-hero-title">{current.progTitle}</h1>

                    <div className="home-hero-time-row">
                        <span className="home-hero-time-text">
                            <span className="material-symbols-rounded">schedule</span>
                            {current.progOraInizio}
                            {current.progOraFine ? " - " + current.progOraFine : ""}
                        </span>
                        {current.progress > 0 && (
                            <div className="home-hero-prog-track" title={current.progress + "% completato"}>
                                <div
                                    className="home-hero-prog-bar"
                                    style={{ width: current.progress + "%" }}
                                />
                            </div>
                        )}
                    </div>

                    {current.progDesc && (
                        <p className="home-hero-description">
                            {current.progDesc}
                        </p>
                    )}

                    <div className="home-hero-actions">
                        <Link
                            href={current.targetHref}
                            className="home-hero-watch-btn"
                            onClick={() => handleCardClick(current)}
                        >
                            <span className="material-symbols-rounded">play_arrow</span>
                            Guarda {current.channelName}
                        </Link>
                    </div>
                </div>

                <div className="home-hero-thumbs-rail">
                    {heroItems.map((item, idx) => {
                        const isCurrent = idx === activeIndex;
                        return (
                            <button
                                key={item.channelName + "-thumb-" + idx}
                                type="button"
                                className={"home-hero-thumb-card " + (isCurrent ? "active" : "")}
                                onClick={() => setActiveIndex(idx)}
                                aria-label={"Seleziona " + item.channelName}
                            >
                                <img
                                    src={item.progImg}
                                    alt={item.channelName}
                                    className="home-hero-thumb-img"
                                    loading="eager"
                                />
                                <div className="home-hero-thumb-overlay">
                                    <div className="home-hero-thumb-channel">
                                        {item.channelName.replace("Sky Sport ", "Sky ").replace("Sky ", "")}
                                    </div>
                                    <div className="home-hero-thumb-title">
                                        {item.progTitle}
                                    </div>
                                </div>
                                {isCurrent && <div className="home-hero-thumb-active-bar" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <button
                type="button"
                className="home-hero-arrow left"
                onClick={prevSlide}
                aria-label="Canale precedente"
            >
                <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <button
                type="button"
                className="home-hero-arrow right"
                onClick={nextSlide}
                aria-label="Canale successivo"
            >
                <span className="material-symbols-rounded">chevron_right</span>
            </button>
        </section>
    );
}
