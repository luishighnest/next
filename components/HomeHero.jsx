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

// Helper per precaricare loghi e immagini artwork in background
function preloadImage(src) {
    if (!src || typeof window === "undefined") return;
    const img = new Image();
    img.src = src;
}

// Fallback canali predefiniti ad altissima priorità Sport nel caso in cui sia la prima visita assoluta
const DEFAULT_HERO_ITEMS = [
    {
        channelName: "Sky Sport Uno",
        category: "Sport",
        progTitle: "Sky Sport Live",
        progDesc: "I più grandi eventi di sport in diretta esclusiva su Sky Sport Uno.",
        progOraInizio: "14:00",
        progOraFine: "16:00",
        progImg: "https://ethaneurope.it.imageservice.sky.com/pd-image/10265735-6fe3-4a96-a031-494b990861c7/background/1920",
        artworkType: "sky-hero",
        progress: 30,
        targetHref: "/sky?ch=sky-sport-uno",
        channelObj: { title: "Sky Sport Uno", name: "Sky Sport Uno", slug: "sky-sport-uno" },
        logoUrl: "/logos/sksportuno.png"
    },
    {
        channelName: "Sky Sport Calcio",
        category: "Sport",
        progTitle: "Serie A Enilive & Calcio Internazionale",
        progDesc: "Tutte le emozioni del grande calcio in diretta esclusiva.",
        progOraInizio: "15:00",
        progOraFine: "17:00",
        progImg: "https://ethaneurope.it.imageservice.sky.com/pd-image/08cb506c-aabd-4112-afc0-4d763f125337/background/1920",
        artworkType: "sky-hero",
        progress: 45,
        targetHref: "/sky?ch=sky-sport-calcio",
        channelObj: { title: "Sky Sport Calcio", name: "Sky Sport Calcio", slug: "sky-sport-calcio" },
        logoUrl: "/logos/sksportcalcio.png"
    },
    {
        channelName: "Sky Sport Tennis",
        category: "Sport",
        progTitle: "ATP Masters & Grande Slam",
        progDesc: "Le grandi sfide del circuito mondiale di tennis in diretta su Sky Sport Tennis.",
        progOraInizio: "16:00",
        progOraFine: "18:30",
        progImg: "https://img-guidatv.org/immagini/tennis.jpeg",
        artworkType: "sport",
        progress: 50,
        targetHref: "/sky?ch=sky-sport-tennis",
        channelObj: { title: "Sky Sport Tennis", name: "Sky Sport Tennis", slug: "sky-sport-tennis" },
        logoUrl: "/logos/sksporttennis.png"
    },
    {
        channelName: "Sky Sport F1",
        category: "Sport",
        progTitle: "Formula 1 Live Weekend",
        progDesc: "Tutti i gran premi, le qualifiche e le prove libere di F1 in tempo reale.",
        progOraInizio: "14:30",
        progOraFine: "16:30",
        progImg: "https://ethaneurope.it.imageservice.sky.com/pd-image/cbc934a0-9d28-4e52-bf0b-a819db2f1948/background/1920",
        artworkType: "sky-hero",
        progress: 20,
        targetHref: "/sky?ch=sky-sport-f1",
        channelObj: { title: "Sky Sport F1", name: "Sky Sport F1", slug: "sky-sport-f1" },
        logoUrl: "/logos/sksportf1.png"
    },
    {
        channelName: "Sky Cinema Uno",
        category: "Cinema",
        progTitle: "Prime Visioni & Grandi Successi",
        progDesc: "I migliori film nazionali e internazionali in prima visione e qualità cinematografica.",
        progOraInizio: "15:15",
        progOraFine: "17:15",
        progImg: "https://img-guidatv.org/film_new/altro/5ec2c31c3b29343e97a8b656/5ec2c31c3b29343e97a8b656_p_1_rs_300.jpg",
        artworkType: "sky-hero",
        progress: 15,
        targetHref: "/sky?ch=sky-cinema-uno",
        channelObj: { title: "Sky Cinema Uno", name: "Sky Cinema Uno", slug: "sky-cinema-uno" },
        logoUrl: "/logos/skycinemauno.png"
    }
];

// Inizializzatore sincrono dell'Hero: recupera la cache dalla sessione o dal localStorage per 0ms delay
function getInitialHeroItems() {
    if (typeof window === "undefined") return DEFAULT_HERO_ITEMS;
    try {
        const stored = sessionStorage.getItem("nmdz_hero_items_v3") || localStorage.getItem("nmdz_hero_items_v3");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {}
    return DEFAULT_HERO_ITEMS;
}

export default function HomeHero({ categories = [] }) {
    const [heroItems, setHeroItems] = useState(getInitialHeroItems);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        async function initHeroChannels() {
            try {
                let guideData = [];
                try {
                    const cached = sessionStorage.getItem("nmdz_guide_cache_v2");
                    if (cached) guideData = JSON.parse(cached);
                } catch (e) {}

                if (!guideData || guideData.length === 0) {
                    const res = await fetch("/guida_tv_sky.json?t=" + Date.now());
                    if (res.ok) {
                        guideData = await res.json();
                        try {
                            sessionStorage.setItem("nmdz_guide_cache_v2", JSON.stringify(guideData));
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
                    const isAllowedCat = cat === "sport" || cat === "intrattenimento" || cat === "cinema";

                    if (!isSky || !isAllowedCat) return;
                    if (!ch.programmi || ch.programmi.length === 0) return;

                    // FILTRO RIGOROSO:
                    // 1. Escludi Sky Sport 4K
                    // 2. Escludi Sky Sport Golf
                    // 3. Escludi canali Sky Sport / Calcio 251-259
                    const is4K = name.includes("4k");
                    const isGolf = name.includes("golf");
                    const isSkySportNumbered = /sky\s*(?:sport|calcio)\s*25\d/i.test(name) || /25[1-9]/i.test(name);
                    if (is4K || isGolf || isSkySportNumbered) return;

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

                    const logo = getChannelLogoUrl({ title: ch.canale });

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
                        logoUrl: logo,
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

                // Prevalenza massima di canali SPORT: 4 canali Sport su 5 totali (o 5 su 5 se ent non sufficienti)
                const sportPool = sportCandidatesHD.length >= 4 ? sportCandidatesHD : [...sportCandidatesHD, ...sportCandidatesFallback];
                const entPool = entCandidatesHD.length >= 1 ? entCandidatesHD : [...entCandidatesHD, ...entCandidatesFallback];

                // Shuffle di entrambi i pool per non mostrare sempre gli stessi canali nell'arco della giornata
                for (let i = sportPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [sportPool[i], sportPool[j]] = [sportPool[j], sportPool[i]];
                }
                for (let i = entPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [entPool[i], entPool[j]] = [entPool[j], entPool[i]];
                }

                // 4 canali SPORT prioritari e 1 canale Cinema/Intrattenimento per varietà
                const selectedSport = sportPool.slice(0, 4);
                const selectedEnt = entPool.slice(0, 1);
                let selected5 = [...selectedSport, ...selectedEnt];

                // Se non c'è abbastanza intrattenimento, prendi un 5° canale sport
                if (selected5.length < 5 && sportPool.length > 4) {
                    selected5.push(sportPool[4]);
                }

                // Mescola i 5 selezionati in modo che lo sport appaia con altissima frequenza
                for (let i = selected5.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [selected5[i], selected5[j]] = [selected5[j], selected5[i]];
                }

                if (!isMounted || selected5.length === 0) return;

                // Precarica subito in background tutti i loghi e gli artwork per eliminare qualsiasi glitch
                selected5.forEach(it => {
                    preloadImage(it.logoUrl);
                    preloadImage(it.progImg);
                });

                // Salva nella cache persistente così alla ricarica della pagina la hero è presente a 0ms
                try {
                    sessionStorage.setItem("nmdz_hero_items_v3", JSON.stringify(selected5));
                    localStorage.setItem("nmdz_hero_items_v3", JSON.stringify(selected5));
                } catch (e) {}

                setHeroItems(selected5);
            } catch (err) {
                console.error("Errore caricamento canali Hero:", err);
            }
        }

        initHeroChannels();
        return () => { isMounted = false; };
    }, [categories]);

    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const nextSlide = useCallback(() => {
        setHeroItems(items => {
            if (!items || items.length <= 1) return items;
            setActiveIndex(prev => (prev + 1) % items.length);
            return items;
        });
    }, []);

    const prevSlide = useCallback(() => {
        setHeroItems(items => {
            if (!items || items.length <= 1) return items;
            setActiveIndex(prev => (prev - 1 + items.length) % items.length);
            return items;
        });
    }, []);

    // Timer robusto per il cambio canale automatico (6.5 secondi)
    useEffect(() => {
        if (heroItems.length <= 1 || isInfoOpen) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        // Se l'utente è con il mouse sopra la hero, mettiamo in pausa il timer
        if (isHovered) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            nextSlide();
        }, 6500);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [heroItems.length, isInfoOpen, isHovered, activeIndex, nextSlide]);

    // Gestione cambio scheda del browser: ripristina la fluidità quando l'utente torna sulla pagina
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && !isHovered && !isInfoOpen && heroItems.length > 1) {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => {
                    nextSlide();
                }, 6500);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
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
                <div className="now-hero-billboard-container">
                    {heroItems.map((item, idx) => {
                        const isActive = idx === activeIndex;
                        return (
                            <div
                                key={item.channelName + "-billboard-" + idx}
                                className={"now-hero-billboard " + (isActive ? "active" : "")}
                                style={{
                                    opacity: isActive ? 1 : 0,
                                    pointerEvents: isActive ? "auto" : "none",
                                    visibility: isActive ? "visible" : "hidden",
                                    zIndex: isActive ? 5 : 1
                                }}
                            >
                                {/* 1. Logo del Canale ben integrato */}
                                <div className="now-hero-brand-top">
                                    {item.logoUrl ? (
                                        <img
                                            src={item.logoUrl}
                                            alt={item.channelName}
                                            className="now-hero-channel-badge-logo"
                                            loading="eager"
                                            decoding="async"
                                        />
                                    ) : (
                                        <span className="now-hero-channel-label">{item.channelName}</span>
                                    )}
                                </div>

                                {/* 2. Riga Metadati Discreta: Badge DIRETTA compatto + Micro-badge Categoria / Risoluzione / Audio */}
                                <div className="now-hero-meta-row">
                                    <span className="now-hero-live-pill">
                                        <span className="now-hero-live-pulse" />
                                        DIRETTA
                                    </span>
                                    {item.category && (
                                        <span className="now-hero-meta-box">{item.category}</span>
                                    )}
                                    <span className="now-hero-meta-box">FHD</span>
                                    <span className="now-hero-meta-box">5.1</span>
                                </div>

                                {/* 3. Titolo Principale Programma: Elegante, bold, moderno */}
                                <h1 className="now-hero-heading">{item.progTitle}</h1>

                                {/* 4. Orario e Timeline EPG racchiusi in container/pillola elegante */}
                                <div className="now-hero-schedule-bar">
                                    <div className="now-hero-time-badge">
                                        <span className="material-symbols-rounded">schedule</span>
                                        <span>{item.progOraFine ? `Dalle ${item.progOraInizio} alle ${item.progOraFine}` : `Inizio alle ${item.progOraInizio}`}</span>
                                    </div>
                                    {item.progress > 0 && (
                                        <div className="now-hero-timeline-wrap">
                                            <div className="now-hero-timeline-track">
                                                <div
                                                    className="now-hero-timeline-fill"
                                                    style={{ width: item.progress + "%" }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 5. Descrizione del programma: elegante, max 2 righe, colore attenuato */}
                                <p className="now-hero-synopsis">
                                    {item.progDesc || "Tutti gli eventi e i migliori appuntamenti live in onda su questo canale Sky."}
                                </p>

                                {/* 6. Pulsanti Azione: compatti, moderni, raffinati */}
                                <div className="now-hero-cta-group">
                                    <Link
                                        href={item.targetHref}
                                        className="now-hero-play-button"
                                        onClick={() => handleCardClick(item)}
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
                        );
                    })}
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
                                            onAnimationEnd={() => {
                                                if (isCur) nextSlide();
                                            }}
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
