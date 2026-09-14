"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";

// Upgrade automatico delle copertine per massima risoluzione (Full HD / 4K)
function upgradeImageToHighRes(url) {
    if (!url || typeof url !== "string") return "";
    
    // 1. Sky CDN ufficiale: upgrade da /600 a /1920 Full HD nativo
    if (url.includes("imageservice.sky.com")) {
        return url.replace(/\/background\/\d+$/i, "/background/1920")
                  .replace(/\/cover\/\d+$/i, "/cover/1920")
                  .replace(/\/\d+$/i, "/1920");
    }

    // 2. TMDB: upgrade a original o w780
    if (url.includes("image.tmdb.org")) {
        return url.replace(/\/w\d+\//i, "/original/");
    }

    return url;
}

// Rileva la tipologia di artwork per applicare il corretto layout adattivo:
// 1. "sky-hero": Immagini orizzontali ufficiali Sky Image Service (landscape full-bleed cinematografico)
// 2. "poster": Artwork verticali tipo TMDB / locandine film & serie (non devono essere croppate a landscape)
// 3. "sport": Grafiche ed eventi sportivi con aspect ratio variabili (img-guidatv, tennis, partite, ecc.)
function detectArtworkType(url) {
    if (!url || typeof url !== "string") return "sky-hero";
    if (url.includes("image.tmdb.org") || url.includes("/t/p/")) return "poster";
    if (url.includes("imageservice.sky.com")) return "sky-hero";
    if (url.includes("img-guidatv.org") || url.includes("/partite/") || url.includes("tennis.jpeg") || url.includes("premierleague")) return "sport";
    return "sky-hero";
}

// Verifica se l'immagine è valida per la Hero (accettiamo sky, tmdb e sport ad alta risoluzione)
function isHighQualityHeroImage(url) {
    if (!url || typeof url !== "string") return false;
    if (url.includes("_rs_300")) return false;
    if (url.includes("/20/")) return false;
    
    if (url.includes("imageservice.sky.com")) return true;
    if (url.includes("image.tmdb.org")) return true;
    if (url.includes("img-guidatv.org") || url.includes("/partite/") || url.includes("tennis.jpeg")) return true;

    return false;
}

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

                const sportCandidatesHD = [];
                const sportCandidatesFallback = [];
                const entCandidatesHD = [];
                const entCandidatesFallback = [];

                guideData.forEach(ch => {
                    const cat = (ch.categoria || "").toLowerCase();
                    const name = (ch.canale || "").toLowerCase();
                    const isSky = name.includes("sky");
                    const isAllowedCat = cat === "sport" || cat === "intrattenimento";

                    if (!isSky || !isAllowedCat) return;
                    if (!ch.programmi || ch.programmi.length === 0) return;

                    // FILTRO ESPLICITO: Escludi Sky Sport 4K e tutti i canali Sky Sport 251..259 e calcio numerati
                    const is4K = name.includes("4k");
                    const isSkySportNumbered = /sky\s*sport\s*25\d+/i.test(name) || /sky\s*calcio\s*\d+/i.test(name);
                    if (is4K || isSkySportNumbered) return;

                    // Trova il programma in onda in questo momento
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

                    const rawImg = prog?.immagine;
                    if (!rawImg || !rawImg.startsWith("http")) return;

                    const highResImg = upgradeImageToHighRes(rawImg);
                    const isHD = isHighQualityHeroImage(rawImg);

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

                    const item = {
                        channelName: ch.canale,
                        category: ch.categoria || (cat === "sport" ? "Sport" : "Intrattenimento"),
                        progTitle: prog.titolo || ch.canale,
                        progDesc: prog.descrizione || "",
                        progOraInizio: prog.ora || "",
                        progOraFine: nextProg?.ora || "",
                        progImg: highResImg,
                        artworkType: detectArtworkType(rawImg),
                        progress: progressPct,
                        targetHref,
                        channelObj: matchedChannelObj || { title: ch.canale, name: ch.canale, slug },
                        logoUrl: getChannelLogoUrl({ title: ch.canale }),
                        currentProg: prog,
                        nextProg: nextProg
                    };

                    if (cat === "sport") {
                        if (isHD) sportCandidatesHD.push(item);
                        else sportCandidatesFallback.push(item);
                    } else {
                        if (isHD) entCandidatesHD.push(item);
                        else entCandidatesFallback.push(item);
                    }
                });

                // Prevalenza marcata di canali SPORT (3 o 4 su 5):
                const sportPool = sportCandidatesHD.length >= 4 ? sportCandidatesHD : [...sportCandidatesHD, ...sportCandidatesFallback];
                const entPool = entCandidatesHD.length >= 2 ? entCandidatesHD : [...entCandidatesHD, ...entCandidatesFallback];

                // Mescola casualmente entrambi i pool
                for (let i = sportPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [sportPool[i], sportPool[j]] = [sportPool[j], sportPool[i]];
                }
                for (let i = entPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [entPool[i], entPool[j]] = [entPool[j], entPool[i]];
                }

                // Seleziona 3 o 4 canali Sport e 1 o 2 canali Intrattenimento per un totale di 5
                const selectedSport = sportPool.slice(0, 3);
                const selectedEnt = entPool.slice(0, 2);
                let selected5 = [...selectedSport, ...selectedEnt];

                if (selected5.length < 5 && sportPool.length > 3) {
                    selected5.push(sportPool[3]);
                }

                // Shuffle finale dei 5 canali per alternarli casualmente nello scorrimento
                for (let i = selected5.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [selected5[i], selected5[j]] = [selected5[j], selected5[i]];
                }

                if (!isMounted || selected5.length === 0) return;

                setHeroItems(selected5);
                setActiveIndex(0);
            } catch (err) {
                console.error("Errore caricamento canali Hero:", err);
            }
        }

        initHeroChannels();
        return () => { isMounted = false; };
    }, [categories]);

    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const nextSlide = useCallback(() => {
        if (heroItems.length <= 1) return;
        setActiveIndex(prev => (prev + 1) % heroItems.length);
    }, [heroItems.length]);

    const prevSlide = useCallback(() => {
        if (heroItems.length <= 1) return;
        setActiveIndex(prev => (prev - 1 + heroItems.length) % heroItems.length);
    }, [heroItems.length]);

    useEffect(() => {
        if (isHovered || isInfoOpen || heroItems.length <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            nextSlide();
        }, 6500);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isHovered, isInfoOpen, heroItems.length, nextSlide]);

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
            className="now-hero-stage"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="In primo piano su Sky"
        >
            {/* Sfondo adattivo maestoso a tutto schermo con supporto Sky Hero, Poster TMDB e Sport */}
            <div className="now-hero-art-viewport">
                {heroItems.map((item, idx) => {
                    const isActive = idx === activeIndex;
                    const artType = item.artworkType || "sky-hero";

                    if (artType === "poster") {
                        return (
                            <div
                                key={item.channelName + idx}
                                className={"now-hero-art-slide now-hero-art-slide--poster " + (isActive ? "active" : "")}
                                style={{
                                    opacity: isActive ? 1 : 0,
                                    zIndex: isActive ? 1 : 0
                                }}
                            >
                                {/* Sfondo sfumato/ambientale con la locandina */}
                                <div
                                    className="now-hero-poster-ambient-backdrop"
                                    style={{ backgroundImage: `url("${item.progImg}")` }}
                                />
                                {/* Locandina verticale intatta e visibile a destra */}
                                <div className="now-hero-poster-frame">
                                    <img
                                        src={item.progImg}
                                        alt={item.progTitle}
                                        className="now-hero-poster-showcase"
                                        loading={isActive ? "eager" : "lazy"}
                                    />
                                </div>
                            </div>
                        );
                    }

                    if (artType === "sport") {
                        return (
                            <div
                                key={item.channelName + idx}
                                className={"now-hero-art-slide now-hero-art-slide--sport " + (isActive ? "active" : "")}
                                style={{
                                    opacity: isActive ? 1 : 0,
                                    zIndex: isActive ? 1 : 0
                                }}
                            >
                                {/* Sfondo sfumato per non lasciare bande nere nei formati non standard */}
                                <div
                                    className="now-hero-sport-ambient-backdrop"
                                    style={{ backgroundImage: `url("${item.progImg}")` }}
                                />
                                {/* Immagine sportiva pulita a destra senza crop aggressivo */}
                                <div className="now-hero-sport-frame">
                                    <img
                                        src={item.progImg}
                                        alt={item.progTitle}
                                        className="now-hero-sport-showcase"
                                        loading={isActive ? "eager" : "lazy"}
                                    />
                                </div>
                            </div>
                        );
                    }

                    // Default: "sky-hero" - Landscape full-bleed cinematografico originale Sky
                    return (
                        <div
                            key={item.channelName + idx}
                            className={"now-hero-art-slide now-hero-art-slide--sky " + (isActive ? "active" : "")}
                            style={{
                                backgroundImage: `url("${item.progImg}")`,
                                opacity: isActive ? 1 : 0,
                                zIndex: isActive ? 1 : 0
                            }}
                        />
                    );
                })}
                {/* Maschere di gradiente autentiche NOW TV */}
                <div className="now-hero-mask-top" />
                <div className="now-hero-mask-left" />
                <div className="now-hero-mask-bottom" />
            </div>

            {/* Contenuto Hero Billboard 100% stile NOW */}
            <div className="now-hero-inner">
                <div className="now-hero-billboard">
                    {/* 1. Logo del Canale ben integrato */}
                    <div className="now-hero-brand-top">
                        {current.logoUrl ? (
                            <img
                                src={current.logoUrl}
                                alt={current.channelName}
                                className="now-hero-channel-badge-logo"
                                loading="eager"
                            />
                        ) : (
                            <span className="now-hero-channel-label">{current.channelName}</span>
                        )}
                    </div>

                    {/* 2. Riga Metadati Discreta: Badge DIRETTA compatto • Categoria • FHD • 5.1 */}
                    <div className="now-hero-meta-row">
                        <span className="now-hero-live-pill">
                            <span className="now-hero-live-pulse" />
                            DIRETTA
                        </span>
                        <span className="now-hero-meta-dot">•</span>
                        <span className="now-hero-cat-tag">{current.category}</span>
                        <span className="now-hero-meta-dot">•</span>
                        <span className="now-hero-meta-text">FHD</span>
                        <span className="now-hero-meta-dot">•</span>
                        <span className="now-hero-meta-text">5.1</span>
                    </div>

                    {/* 3. Titolo Principale Programma: Elegante, bold, moderno */}
                    <h1 className="now-hero-heading">{current.progTitle}</h1>

                    {/* 4. Orario e Timeline EPG secondaria e discreta */}
                    <div className="now-hero-schedule-bar">
                        <div className="now-hero-time-badge">
                            <span className="material-symbols-rounded">schedule</span>
                            <span>{current.progOraFine ? `Dalle ${current.progOraInizio} alle ${current.progOraFine}` : `Inizio alle ${current.progOraInizio}`}</span>
                        </div>
                        {current.progress > 0 && (
                            <div className="now-hero-timeline-wrap">
                                <div className="now-hero-timeline-track">
                                    <div
                                        className="now-hero-timeline-fill"
                                        style={{ width: current.progress + "%" }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. Descrizione del programma: elegante, max 2 righe, colore attenuato */}
                    <p className="now-hero-synopsis">
                        {current.progDesc || "Tutti gli eventi e i migliori appuntamenti live in onda su questo canale Sky."}
                    </p>

                    {/* 6. Pulsanti Azione: compatti, moderni, raffinati */}
                    <div className="now-hero-cta-group">
                        <Link
                            href={current.targetHref}
                            className="now-hero-play-button"
                            onClick={() => handleCardClick(current)}
                        >
                            <span className="material-symbols-rounded now-hero-play-ico">play_arrow</span>
                            <span className="now-hero-play-label">Guarda</span>
                        </Link>

                        <button
                            type="button"
                            className="now-hero-info-button"
                            onClick={() => setIsInfoOpen(true)}
                        >
                            <span className="material-symbols-rounded now-hero-info-ico">info</span>
                            <span className="now-hero-info-label">Dettagli</span>
                        </button>
                    </div>
                </div>

                {/* 7. Barra Segmentata Cinematografica Stile Apple TV+ con Frecce Minimal */}
                <div className="now-hero-footer-bar">
                    <div className="now-hero-footer-indicators">
                        {heroItems.map((item, idx) => {
                            const isCur = idx === activeIndex;
                            return (
                                <button
                                    key={item.channelName + "-indicator-" + idx}
                                    type="button"
                                    className={"now-hero-segment-btn " + (isCur ? "active" : "")}
                                    onClick={() => setActiveIndex(idx)}
                                    aria-label={"Passa a " + item.channelName}
                                    title={item.channelName + " - " + item.progTitle}
                                >
                                    <div className="now-hero-segment-track">
                                        <div 
                                            key={isCur ? `progress-${idx}-${activeIndex}` : `idle-${idx}`}
                                            className="now-hero-segment-fill" 
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Frecce di navigazione minimal in basso a destra */}
                    <div className="now-hero-footer-arrows">
                        <button
                            type="button"
                            className="now-hero-nav-arrow"
                            onClick={prevSlide}
                            aria-label="Canale precedente"
                        >
                            <span className="material-symbols-rounded">chevron_left</span>
                        </button>
                        <button
                            type="button"
                            className="now-hero-nav-arrow"
                            onClick={nextSlide}
                            aria-label="Canale successivo"
                        >
                            <span className="material-symbols-rounded">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Sfumatura cinematografica di transizione tra la Hero e le sezioni sottostanti */}
            <div className="now-hero-bottom-transition" />

            {/* Popup Guida TV Dettagli Programma Attuale e Successivo */}
            {isInfoOpen && (
                <div className="now-hero-modal-backdrop" onClick={() => setIsInfoOpen(false)}>
                    <div className="now-hero-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="now-hero-modal-header">
                            <div className="now-hero-modal-ch-info">
                                {current.logoUrl ? (
                                    <img src={current.logoUrl} alt={current.channelName} className="now-hero-modal-logo" />
                                ) : (
                                    <span className="now-hero-modal-ch-name">{current.channelName}</span>
                                )}
                                <span className="now-hero-modal-cat-tag">{current.category}</span>
                            </div>
                            <button
                                type="button"
                                className="now-hero-modal-close-btn"
                                onClick={() => setIsInfoOpen(false)}
                                aria-label="Chiudi guida"
                            >
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>

                        <div className="now-hero-modal-body">
                            {/* Scheda Programma Attualmente in Onda */}
                            <div className="now-hero-modal-card now-active-card">
                                <div className="now-hero-modal-badge-row">
                                    <span className="now-hero-live-pill small">
                                        <span className="now-hero-live-pulse" />
                                        IN ONDA ORA
                                    </span>
                                    <span className="now-hero-modal-time">
                                        <span className="material-symbols-rounded">schedule</span>
                                        {current.progOraInizio}{current.progOraFine ? " - " + current.progOraFine : ""}
                                    </span>
                                </div>
                                <h3 className="now-hero-modal-title">{current.progTitle}</h3>
                                {current.progDesc ? (
                                    <p className="now-hero-modal-desc">{current.progDesc}</p>
                                ) : (
                                    <p className="now-hero-modal-desc muted">Nessuna sinossi disponibile per questo evento.</p>
                                )}
                            </div>

                            {/* Scheda Programma Successivo */}
                            <div className="now-hero-modal-card next-card">
                                <div className="now-hero-modal-badge-row">
                                    <span className="now-hero-modal-pill-next">A SEGUIRE</span>
                                    {current.nextProg?.ora && (
                                        <span className="now-hero-modal-time">
                                            <span className="material-symbols-rounded">schedule</span>
                                            {current.nextProg.ora}{current.nextProg.fine ? " - " + current.nextProg.fine : ""}
                                        </span>
                                    )}
                                </div>
                                <h3 className="now-hero-modal-title">
                                    {current.nextProg ? current.nextProg.titolo : "Nessun programma successivo registrato"}
                                </h3>
                                {current.nextProg?.descrizione && (
                                    <p className="now-hero-modal-desc">{current.nextProg.descrizione}</p>
                                )}
                            </div>
                        </div>

                        <div className="now-hero-modal-footer">
                            <Link
                                href={current.targetHref}
                                className="now-hero-play-button modal-play"
                                onClick={() => {
                                    handleCardClick(current);
                                    setIsInfoOpen(false);
                                }}
                            >
                                <span className="material-symbols-rounded now-hero-play-ico">play_arrow</span>
                                <span>Vai alla diretta</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
