"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";

// Upgrade automatico delle copertine per massima risoluzione (Full HD / 4K)
function upgradeImageToHighRes(url) {
    if (!url || typeof url !== "string") return "";
    
    // 1. Sky CDN ufficiale (supporta sia /pd-image/ che /uuid/): upgrade Full HD nativo
    if (url.includes("imageservice.sky.com")) {
        if (url.includes("/pd-image/")) {
            return url.replace(/\/background\/\d+$/i, "/background/1920")
                      .replace(/\/cover\/\d+$/i, "/cover/1920")
                      .replace(/\/\d+$/i, "/1920");
        }
        if (url.includes("/uuid/")) {
            try {
                const u = new URL(url);
                u.searchParams.set("w", "1920");
                u.searchParams.delete("crop");
                return u.toString();
            } catch (e) {
                return url;
            }
        }
        return url;
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
    if (!url || typeof url !== "string") return "sport";
    const up = upgradeImageToHighRes(url);
    if (up.includes("image.tmdb.org") || up.includes("/t/p/")) return "poster";
    if (up.includes("COVER_CLEAN_TALL") || up.includes("COVER_TITLE_TALL") || (up.includes("/cover") && !up.includes("COVER_TITLE_WIDE") && !up.includes("HERO_CLEAN_WIDE") && !up.includes("background"))) {
        return "poster";
    }
    // Horizontal assets verificati ad alta risoluzione -> full-bleed
    if (isFullBleedWorthy(up)) return "sky-hero";
    // Tutte le sorgenti a bassa/incerta risoluzione restano nel compositing a frame
    return "sport";
}

// Certezza di risoluzione per il full-bleed: solo copertine orizzontali che
// raggiungono davvero ~1600px+ di larghezza (Sky CDN upscalata a 1920, TMDB original).
// Evita il full-bleed delle miniature guidatv/sport (300-500px) che risulterebbero pixelate.
function isFullBleedWorthy(url) {
    if (!url || typeof url !== "string") return false;
    if (url.includes("_rs_300") || url.includes("/20/")) return false;

    if (url.includes("imageservice.sky.com")) {
        if (url.includes("/background/1920") || url.includes("/cover/1920") || url.includes("/1920")) return true;
        return false;
    }
    if (url.includes("image.tmdb.org") && url.includes("/original/")) {
        return true;
    }
    return false;
}

// Verifica se l'immagine è valida per la Hero full-bleed (solo sorgenti veramente HD)
function isHighQualityHeroImage(url) {
    if (!url || typeof url !== "string") return false;
    if (url.includes("_rs_300")) return false;
    if (url.includes("/20/")) return false;
    
    if (url.includes("imageservice.sky.com")) return true;
    if (url.includes("image.tmdb.org")) return true;

    // img-guidatv / sport: finite la maggior parte sotto i 300-500px, non sono
    // mai full-bleed; restano disponibili solo come fallback (frame + backdrop).
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
        artworkType: "sport",
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
        const stored = sessionStorage.getItem("nmdz_hero_items_v4") || localStorage.getItem("nmdz_hero_items_v4");
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
                    const cached = sessionStorage.getItem("nmdz_guide_cache_v3");
                    if (cached) guideData = JSON.parse(cached);
                } catch (e) {}

                if (!guideData || guideData.length === 0) {
                    const res = await fetch("/guida_tv_sky.json?t=" + Date.now());
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
                                progImg: upgradeImageToHighRes(evImg),
                                artworkType: detectArtworkType(evImg),
                                progress: c.isLiveNow ? 50 : 0,
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

                // Shuffle pool Live Sky (Sport + Intrattenimento)
                const sportPool = sportCandidatesHD.length >= 4 ? sportCandidatesHD : [...sportCandidatesHD, ...sportCandidatesFallback];
                const entPool = entCandidatesHD.length >= 1 ? entCandidatesHD : [...entCandidatesHD, ...entCandidatesFallback];

                for (let i = sportPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [sportPool[i], sportPool[j]] = [sportPool[j], sportPool[i]];
                }
                for (let i = entPool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [entPool[i], entPool[j]] = [entPool[j], entPool[i]];
                }
                for (let i = testJsonLive.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [testJsonLive[i], testJsonLive[j]] = [testJsonLive[j], testJsonLive[i]];
                }
                for (let i = vodCandidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [vodCandidates[i], vodCandidates[j]] = [vodCandidates[j], vodCandidates[i]];
                }

                // Costruzione unificata candidati Live (DAZN live da test.json + Sky Sport live + Sky intrattenimento)
                // Gli eventi live hanno precedenza assoluta
                const liveCandidates = [
                    ...testJsonLive,
                    ...sportPool,
                    ...entPool
                ];

                let selected5 = [];
                const numLiveAvailable = liveCandidates.length;

                if (numLiveAvailable === 0) {
                    // SE NON CI SONO EVENTI LIVE, SE CI SONO SOLO VOD: MASSIMO 2 SU 5
                    selected5 = vodCandidates.slice(0, 2);
                } else if (numLiveAvailable === 1) {
                    // SE C'È SOLO UN EVENTO LIVE: 1 EVENTO LIVE E 1 VOD
                    selected5.push(liveCandidates[0]);
                    if (vodCandidates.length > 0) {
                        selected5.push(vodCandidates[0]);
                    }
                } else {
                    // GLI EVENTI LIVE HANNO SEMPRE LA PRECEDENZA
                    // Massimo 2-3 locandine fisse su 5 di VOD da test.json se ci sono slot disponibili
                    const maxVodCount = Math.min(3, vodCandidates.length);
                    const minLiveNeeded = Math.max(1, 5 - maxVodCount);
                    const chosenLiveCount = Math.min(numLiveAvailable, Math.max(minLiveNeeded, 5 - Math.min(maxVodCount, 2)));
                    
                    const chosenLive = liveCandidates.slice(0, chosenLiveCount);
                    selected5.push(...chosenLive);

                    // Aggiungi VOD di test.json (massimo 2-3 per completare fino a 5)
                    const remainingSlots = 5 - selected5.length;
                    if (remainingSlots > 0 && vodCandidates.length > 0) {
                        const vodToAdd = Math.min(remainingSlots, Math.min(3, vodCandidates.length));
                        selected5.push(...vodCandidates.slice(0, vodToAdd));
                    }
                }

                if (!isMounted || selected5.length === 0) return;

                // Precarica subito in background tutti i loghi e gli artwork per eliminare qualsiasi glitch
                selected5.forEach(it => {
                    if (it.logoUrl) preloadImage(it.logoUrl);
                    if (it.progImg) preloadImage(it.progImg);
                });

                // Salva nella cache persistente così alla ricarica della pagina la hero è presente a 0ms
                try {
                    sessionStorage.setItem("nmdz_hero_items_v6", JSON.stringify(selected5));
                    localStorage.setItem("nmdz_hero_items_v6", JSON.stringify(selected5));
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
                                {/* 1. Sopratitolo Categoria: gerarchia chiara sopra il logo */}
                                <div className="now-hero-brand-top">
                                    {item.category && (
                                        <span className="now-hero-category-tag">{item.category}</span>
                                    )}
                                </div>

                                {/* 2. Logo del Canale ben integrato */}
                                <div className="now-hero-logo-row">
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

                                {/* 3. Titolo Principale Programma: Protagonista subito sotto il logo canale */}
                                <h1 className="now-hero-heading whitespace-nowrap overflow-hidden text-ellipsis truncate" title={item.progTitle}>
                                    {item.progTitle}
                                </h1>

                                 {/* 4. Riga Metadati & Orario: [DIRETTA] o [ON DEMAND] + Orario + Timeline + spec tecniche */}
                                <div className="now-hero-meta-row">
                                    {item.isVodItem ? (
                                        <span className="now-hero-live-pill" style={{ background: "rgba(0, 229, 155, 0.2)", color: "#00e59b", borderColor: "rgba(0, 229, 155, 0.4)" }}>
                                            <span className="material-symbols-rounded" style={{ fontSize: "1rem", marginRight: "4px" }}>movie</span>
                                            ON DEMAND
                                        </span>
                                    ) : (
                                        <span className="now-hero-live-pill">
                                            <span className="now-hero-live-pulse" />
                                            DIRETTA
                                        </span>
                                    )}

                                    {item.progOraInizio ? (
                                        <div className="now-hero-time-text">
                                            <span className="material-symbols-rounded">schedule</span>
                                            <span>{item.progOraFine ? `Dalle ${item.progOraInizio} alle ${item.progOraFine}` : `Inizio alle ${item.progOraInizio}`}</span>
                                        </div>
                                    ) : (
                                        <div className="now-hero-time-text">
                                            <span className="material-symbols-rounded">play_circle</span>
                                            <span>Disponibile subito</span>
                                        </div>
                                    )}

                                    {!item.isVodItem && item.progress > 0 && (
                                        <div className="now-hero-timeline-wrap">
                                            <div className="now-hero-timeline-track">
                                                <div
                                                    className="now-hero-timeline-fill"
                                                    style={{ width: item.progress + "%" }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <span className="now-hero-spec-text">FHD</span>
                                    <span className="now-hero-spec-text">5.1</span>
                                </div>

                                {/* 4. Descrizione del programma: min-height fissa a 2 righe e line-clamp-2 per bloccare i CTA */}
                                <p className="now-hero-synopsis min-h-[2.75rem] line-clamp-2">
                                    {item.progDesc || (item.isVodItem ? "Disponibile On Demand in alta qualità streaming." : "Tutti gli eventi e i migliori appuntamenti live in onda su questo canale Sky.")}
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
                </div>
            </div>

            {/* Frecce laterali centrate verticalmente, fuori dal contenitore */}
            <button
                type="button"
                className="now-hero-nav-arrow now-hero-nav-arrow--left"
                onClick={prevSlide}
                aria-label="Canale precedente"
            >
                <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <button
                type="button"
                className="now-hero-nav-arrow now-hero-nav-arrow--right"
                onClick={nextSlide}
                aria-label="Canale successivo"
            >
                <span className="material-symbols-rounded">chevron_right</span>
            </button>

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
                            {/* Scheda Programma Attualmente in Onda o VOD */}
                            <div className="now-hero-modal-card now-active-card">
                                <div className="now-hero-modal-badge-row">
                                    {current.isVodItem ? (
                                        <span className="now-hero-live-pill small" style={{ background: "rgba(0, 229, 155, 0.2)", color: "#00e59b", borderColor: "rgba(0, 229, 155, 0.4)" }}>
                                            <span className="material-symbols-rounded" style={{ fontSize: "0.9rem", marginRight: "4px" }}>movie</span>
                                            TITOLO ON DEMAND
                                        </span>
                                    ) : (
                                        <span className="now-hero-live-pill small">
                                            <span className="now-hero-live-pulse" />
                                            IN ONDA ORA
                                        </span>
                                    )}
                                    <span className="now-hero-modal-time">
                                        <span className="material-symbols-rounded">{current.isVodItem ? "play_circle" : "schedule"}</span>
                                        {current.isVodItem ? "Disponibile On Demand" : `${current.progOraInizio}${current.progOraFine ? " - " + current.progOraFine : ""}`}
                                    </span>
                                </div>
                                <h3 className="now-hero-modal-title">{current.progTitle}</h3>
                                {current.progDesc ? (
                                    <p className="now-hero-modal-desc">{current.progDesc}</p>
                                ) : (
                                    <p className="now-hero-modal-desc muted">Nessuna sinossi disponibile per questo contenuto.</p>
                                )}
                            </div>

                            {/* Scheda Programma Successivo (se canale live) */}
                            {!current.isVodItem && (
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
                            )}
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
                                <span>{current.isVodItem ? "Scheda Film / Guarda" : "Vai alla diretta"}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
