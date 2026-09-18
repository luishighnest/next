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

// Fallback predefinito DAZN
const DEFAULT_HERO_ITEMS = [];

// Inizializzatore sincrono dell'Hero: recupera la cache dalla sessione o dal localStorage per 0ms delay
function getInitialHeroItems() {
    if (typeof window === "undefined") return DEFAULT_HERO_ITEMS;
    try {
        const stored = sessionStorage.getItem("nmdz_hero_items_v7") || localStorage.getItem("nmdz_hero_items_v7");
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

        function initHeroChannels() {
            try {
                // Estrazione di Eventi Live e VOD esclusivamente da test.json (tramite categories)
                const testJsonLive = [];
                const testJsonVod = [];

                if (categories && Array.isArray(categories)) {
                    for (const sec of categories) {
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
                                progImg: upgradeImageToHighRes(evImg),
                                artworkType: detectArtworkType(evImg),
                                progress: c.isLiveNow ? 50 : 0,
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

                // Shuffle pool per variare i contenuti
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
                    if (vodPool.length > 0) {
                        selected.push(vodPool[0]);
                    }
                } else {
                    // 2 o più eventi live: gli eventi live hanno la precedenza, massimo 3 VOD su 5
                    const maxVod = Math.min(3, vodPool.length);
                    const liveCount = Math.min(numLive, 5 - maxVod);
                    selected.push(...livePool.slice(0, liveCount));

                    const remainingSlots = 5 - selected.length;
                    const vodToAdd = Math.min(remainingSlots, maxVod);
                    if (vodToAdd > 0) {
                        selected.push(...vodPool.slice(0, vodToAdd));
                    }
                }

                if (!isMounted || selected.length === 0) return;

                // Precarica in background tutti gli artwork
                selected.forEach(it => {
                    if (it.logoUrl) preloadImage(it.logoUrl);
                    if (it.progImg) preloadImage(it.progImg);
                });

                // Salva nella cache persistente
                try {
                    sessionStorage.setItem("nmdz_hero_items_v7", JSON.stringify(selected));
                    localStorage.setItem("nmdz_hero_items_v7", JSON.stringify(selected));
                } catch (e) {}

                setHeroItems(selected);
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
