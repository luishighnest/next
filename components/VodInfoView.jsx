"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";

export default function VodInfoView({ id, initialType = "movie" }) {
    const router = useRouter();
    const [mediaType, setMediaType] = useState(initialType);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [seasonData, setSeasonData] = useState(null);
    const [loadingSeason, setLoadingSeason] = useState(false);
    const [similarItems, setSimilarItems] = useState([]);
    const [showTrailerModal, setShowTrailerModal] = useState(false);

    // Ref per carosello orizzontale episodi Apple TV
    const episodesScrollRef = useRef(null);
    const [canScrollEpLeft, setCanScrollEpLeft] = useState(false);
    const [canScrollEpRight, setCanScrollEpRight] = useState(true);

    // Recupera dati preliminari da sessionStorage per rendering istantaneo
    const [previewItem, setPreviewItem] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_vodItem");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (String(parsed.tmdbId) === String(id) || String(parsed.id).includes(String(id))) {
                        return parsed;
                    }
                }
            } catch (e) {}
        }
        return null;
    });

    // Fetch dettagli completi da TMDB
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        async function fetchDetails() {
            try {
                let res = await fetch(`/api/vod?action=details&type=${mediaType}&id=${id}`);
                let data = await res.json();

                if ((!data || !data.details) && mediaType === "movie") {
                    const resTv = await fetch(`/api/vod?action=details&type=tv&id=${id}`);
                    const dataTv = await resTv.json();
                    if (dataTv && dataTv.details) {
                        if (isMounted) {
                            setMediaType("tv");
                            setDetails(dataTv.details);
                            extractSimilar(dataTv.details, "tv");
                        }
                        return;
                    }
                }

                if (isMounted && data && data.details) {
                    setDetails(data.details);
                    extractSimilar(data.details, mediaType);
                }
            } catch (err) {
                console.error("Errore fetch info VOD:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        function extractSimilar(det, type) {
            const list = det?.similar?.results || det?.recommendations?.results || [];
            const formatted = list.slice(0, 12).map(item => {
                const isMov = type === "movie" || item.title !== undefined;
                const itTitle = item.title || item.name || "";
                const itYear = (item.release_date || item.first_air_date || "").slice(0, 4);
                let img = "";
                if (item.backdrop_path) img = `https://image.tmdb.org/t/p/w780${item.backdrop_path}`;
                else if (item.poster_path) img = `https://image.tmdb.org/t/p/w780${item.poster_path}`;

                return {
                    id: `vod_${isMov ? "movie" : "tv"}_${item.id}`,
                    tmdbId: item.id,
                    vodType: isMov ? "movie" : "tv",
                    title: itTitle,
                    name: itTitle,
                    image: img,
                    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : img,
                    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : img,
                    ora: itYear || (isMov ? "Film" : "Serie TV"),
                    year: itYear,
                    rating: item.vote_average ? item.vote_average.toFixed(1) : null,
                    desc: item.overview || "",
                    group: isMov ? "Film" : "Serie TV",
                    isVod: true
                };
            }).filter(x => Boolean(x.image));
            setSimilarItems(formatted);
        }

        if (id) fetchDetails();
        return () => { isMounted = false; };
    }, [id, mediaType]);

    const isMovie = mediaType === "movie" || (!details?.seasons && !previewItem?.vodType?.includes("tv"));

    // Se serie TV, carica episodi della stagione corrente
    useEffect(() => {
        if (isMovie || !id) return;
        let isMounted = true;
        setLoadingSeason(true);

        fetch(`/api/vod?action=season&id=${id}&season=${selectedSeason}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted && data && data.season) {
                    setSeasonData(data.season);
                }
            })
            .catch(err => console.error("Errore fetch season:", err))
            .finally(() => {
                if (isMounted) setLoadingSeason(false);
            });

        return () => { isMounted = false; };
    }, [id, isMovie, selectedSeason]);

    // Gestione scorrimento frecce per carosello episodi
    const checkEpisodeScroll = () => {
        const el = episodesScrollRef.current;
        if (!el) return;
        setCanScrollEpLeft(el.scrollLeft > 10);
        setCanScrollEpRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    };

    useEffect(() => {
        const el = episodesScrollRef.current;
        if (!el) return;
        checkEpisodeScroll();
        el.addEventListener("scroll", checkEpisodeScroll);
        window.addEventListener("resize", checkEpisodeScroll);
        return () => {
            el.removeEventListener("scroll", checkEpisodeScroll);
            window.removeEventListener("resize", checkEpisodeScroll);
        };
    }, [seasonData]);

    const scrollEpisodes = (dir) => {
        const el = episodesScrollRef.current;
        if (!el) return;
        const step = el.clientWidth * 0.8;
        el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
    };

    // Dati principali TMDB
    const title = details?.title || details?.name || previewItem?.title || "Dettagli Titolo";
    const tagline = details?.tagline || "";
    const overview = details?.overview || previewItem?.desc || "Nessuna sinossi disponibile.";
    const releaseDate = details?.release_date || details?.first_air_date || previewItem?.year || "";
    const year = releaseDate ? releaseDate.slice(0, 4) : "";
    const rating = details?.vote_average ? details.vote_average.toFixed(1) : (previewItem?.rating || null);
    const voteCount = details?.vote_count ? new Intl.NumberFormat('it-IT').format(details.vote_count) : null;
    const genres = details?.genres || [];
    const runtime = details?.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : null;
    
    // Trailer ufficiale YouTube
    const trailerVideo = (details?.videos?.results || []).find(v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));

    // Cast & Crew reali
    const cast = (details?.credits?.cast || []).slice(0, 10);
    const directors = (details?.credits?.crew || []).filter(c => c.job === "Director" || c.job === "Creator");
    const directorName = directors.length > 0 ? directors.map(d => d.name).join(", ") : null;
    const writers = (details?.credits?.crew || []).filter(c => c.job === "Screenplay" || c.job === "Writer").slice(0, 3);
    const writerName = writers.length > 0 ? writers.map(w => w.name).join(", ") : null;

    // Immagini
    const backdropUrl = details?.backdrop_path 
        ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` 
        : (previewItem?.backdrop || previewItem?.image || "");

    const seasonsList = (details?.seasons || []).filter(s => s.season_number > 0);
    const playHref = isMovie ? `/vod/${id}` : `/vod/${id}/1/1`;

    return (
        <div className="atv-page">
            <Navbar activeFilter="vod" onFilterChange={(tab) => {
                if (tab === "vod") router.push("/vod");
                else if (tab === "home" || tab === "all") router.push("/home");
                else router.push(`/${tab}`);
            }} />

            {/* HERO STAGE CINEMATOGRAFICO APPLE TV+ */}
            <div className="atv-hero">
                {/* Backdrop Gigante a tutta larghezza */}
                {backdropUrl && (
                    <div 
                        className="atv-hero-art" 
                        style={{ backgroundImage: `url(${backdropUrl})` }}
                    />
                )}

                {/* Gradienti multidirezionali Apple TV */}
                <div className="atv-grad-top" />
                <div className="atv-grad-bottom" />
                <div className="atv-grad-left" />

                {/* Contenuto Hero Apple TV posizionato a sinistra */}
                <div className="atv-hero-content">
                    <div className="atv-hero-lockup">
                        {/* Metadati Reali TMDB con stile Apple TV (DOT separators) */}
                        <div className="atv-hero-meta-line">
                            <span className={`atv-type-badge ${isMovie ? "type-movie" : "type-tv"}`}>
                                {isMovie ? "FILM" : "SERIE TV"}
                            </span>
                            {year && <span className="atv-meta-dot">•</span>}
                            {year && <span className="atv-meta-val">{year}</span>}
                            {runtime && <span className="atv-meta-dot">•</span>}
                            {runtime && <span className="atv-meta-val">{runtime}</span>}
                            {!isMovie && seasonsList.length > 0 && (
                                <>
                                    <span className="atv-meta-dot">•</span>
                                    <span className="atv-meta-val">
                                        {seasonsList.length} {seasonsList.length === 1 ? "Stagione" : "Stagioni"}
                                    </span>
                                </>
                            )}
                            {rating && (
                                <>
                                    <span className="atv-meta-dot">•</span>
                                    <span className="atv-rating-val">
                                        <span className="material-symbols-rounded atv-star-icon">star</span>
                                        <span>{rating}</span>
                                        {voteCount && <span className="atv-votes-num">({voteCount})</span>}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Titolo Monumentale Apple TV */}
                        <h1 className="atv-hero-title">{title}</h1>

                        {/* Tagline Ufficiale */}
                        {tagline && (
                            <p className="atv-hero-tagline">"{tagline}"</p>
                        )}

                        {/* Generi in chip VisionOS */}
                        {genres.length > 0 && (
                            <div className="atv-genres-row">
                                {genres.map(g => (
                                    <span key={g.id} className="atv-genre-pill">{g.name}</span>
                                ))}
                            </div>
                        )}

                        {/* Sinossi cinematografica */}
                        <p className="atv-hero-synopsis">{overview}</p>

                        {/* BARRA AZIONI PRINCIPALI (Stile Apple TV+ "How to Watch") */}
                        <div className="atv-actions-bar">
                            <Link href={playHref} className="atv-btn-play-primary">
                                <span className="material-symbols-rounded atv-play-icon">play_arrow</span>
                                <span>{isMovie ? "Riproduci film" : "Riproduci S1 E1"}</span>
                            </Link>

                            {trailerVideo && (
                                <button
                                    type="button"
                                    className="atv-btn-trailer-glass"
                                    onClick={() => setShowTrailerModal(true)}
                                >
                                    <span className="material-symbols-rounded atv-trailer-icon">play_circle</span>
                                    <span>Trailer</span>
                                </button>
                            )}

                            <Link href="/vod" className="atv-btn-vod-back">
                                <span className="material-symbols-rounded">arrow_back</span>
                                <span>VOD</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEZIONE EPISODI (PER LE SERIE TV - CAROSELLO ORIZZONTALE APPLE TV) */}
            {!isMovie && (
                <section className="atv-episodes-section">
                    <div className="atv-container">
                        {/* Header con Titolo, Selettore Stagione Dropdown/Pillole e Frecce Navigazione */}
                        <div className="atv-episodes-header-bar">
                            <div className="atv-episodes-title-group">
                                <h2 className="atv-section-title">Episodi</h2>
                                {seasonsList.length > 1 ? (
                                    <div className="atv-season-dropdown-wrap">
                                        <select
                                            className="atv-season-select-native"
                                            value={selectedSeason}
                                            onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                        >
                                            {seasonsList.map(s => (
                                                <option key={s.id} value={s.season_number}>
                                                    {s.name || `Stagione ${s.season_number}`}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-rounded atv-dropdown-arrow">expand_more</span>
                                    </div>
                                ) : (
                                    <span className="atv-single-season-label">Stagione 1</span>
                                )}
                            </div>

                            {/* Controlli Scorrimento Orizzontale Apple TV */}
                            <div className="atv-carousel-nav-btns">
                                <button
                                    type="button"
                                    className={`atv-nav-arrow ${!canScrollEpLeft ? "disabled" : ""}`}
                                    onClick={() => scrollEpisodes("left")}
                                    aria-label="Episodi precedenti"
                                    disabled={!canScrollEpLeft}
                                >
                                    <span className="material-symbols-rounded">chevron_left</span>
                                </button>
                                <button
                                    type="button"
                                    className={`atv-nav-arrow ${!canScrollEpRight ? "disabled" : ""}`}
                                    onClick={() => scrollEpisodes("right")}
                                    aria-label="Episodi successivi"
                                    disabled={!canScrollEpRight}
                                >
                                    <span className="material-symbols-rounded">chevron_right</span>
                                </button>
                            </div>
                        </div>

                        {loadingSeason ? (
                            <div className="atv-episodes-loading">
                                <div className="ee-spinner" />
                                <span>Caricamento episodi della Stagione {selectedSeason}...</span>
                            </div>
                        ) : seasonData?.episodes && seasonData.episodes.length > 0 ? (
                            <div className="atv-episodes-scroller" ref={episodesScrollRef}>
                                {seasonData.episodes.map(ep => {
                                    const epThumb = ep.still_path 
                                        ? `https://image.tmdb.org/t/p/w780${ep.still_path}` 
                                        : backdropUrl;
                                    const epPlayUrl = `/vod/${id}/${selectedSeason}/${ep.episode_number}`;

                                    return (
                                        <Link 
                                            key={ep.id} 
                                            href={epPlayUrl} 
                                            className="atv-ep-item"
                                            title={`Guarda Episodio ${ep.episode_number}: ${ep.name || ""}`}
                                        >
                                            {/* Miniatura 16:9 widescreen */}
                                            <div className="atv-ep-thumb-card">
                                                {epThumb ? (
                                                    <img src={epThumb} alt={ep.name} className="atv-ep-img" loading="lazy" />
                                                ) : (
                                                    <div className="atv-ep-ph">
                                                        <span className="material-symbols-rounded">tv</span>
                                                    </div>
                                                )}
                                                <div className="atv-ep-hover-overlay">
                                                    <div className="atv-ep-play-btn-circle">
                                                        <span className="material-symbols-rounded">play_arrow</span>
                                                    </div>
                                                </div>
                                                <div className="atv-ep-index-badge">
                                                    EP {ep.episode_number}
                                                </div>
                                            </div>

                                            {/* Informazioni testuali Episodio Apple TV */}
                                            <div className="atv-ep-caption">
                                                <div className="atv-ep-title-row">
                                                    <h3 className="atv-ep-name">{ep.episode_number}. {ep.name || `Episodio ${ep.episode_number}`}</h3>
                                                    {ep.runtime && <span className="atv-ep-duration">{ep.runtime}m</span>}
                                                </div>
                                                {ep.overview && (
                                                    <p className="atv-ep-overview">{ep.overview}</p>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="atv-empty-episodes">Nessun episodio disponibile per questa stagione.</div>
                        )}
                    </div>
                </section>
            )}

            {/* SEZIONE CAST & CREW (AVATAR ROTONDI APPLE TV) */}
            {cast.length > 0 && (
                <section className="atv-cast-section">
                    <div className="atv-container">
                        <div className="atv-section-heading-row">
                            <h2 className="atv-section-title">Cast e Troupe</h2>
                        </div>

                        <div className="atv-cast-scroller">
                            {/* Regista / Creatore */}
                            {directorName && (
                                <div className="atv-cast-member">
                                    <div className="atv-cast-avatar-ph">
                                        <span className="material-symbols-rounded">movie_filter</span>
                                    </div>
                                    <div className="atv-cast-name">{directorName}</div>
                                    <div className="atv-cast-role">{isMovie ? "Regista" : "Creatore"}</div>
                                </div>
                            )}

                            {/* Attori Principali */}
                            {cast.map(actor => {
                                const photo = actor.profile_path 
                                    ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` 
                                    : null;

                                return (
                                    <div key={actor.id} className="atv-cast-member">
                                        {photo ? (
                                            <img src={photo} alt={actor.name} className="atv-cast-avatar" loading="lazy" />
                                        ) : (
                                            <div className="atv-cast-avatar-ph">
                                                <span className="material-symbols-rounded">person</span>
                                            </div>
                                        )}
                                        <div className="atv-cast-name">{actor.name}</div>
                                        <div className="atv-cast-role">{actor.character || "Cast"}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* SEZIONE DETTAGLI TECNICI & INFORMAZIONI TMDB */}
            <section className="atv-specs-section">
                <div className="atv-container">
                    <h2 className="atv-section-title" style={{ marginBottom: "20px" }}>Informazioni</h2>
                    <div className="atv-specs-grid">
                        <div className="atv-spec-item">
                            <span className="atv-spec-k">Genere</span>
                            <span className="atv-spec-v">{genres.map(g => g.name).join(", ") || "—"}</span>
                        </div>
                        <div className="atv-spec-item">
                            <span className="atv-spec-k">Anno di uscita</span>
                            <span className="atv-spec-v">{year || "—"}</span>
                        </div>
                        <div className="atv-spec-item">
                            <span className="atv-spec-k">Durata / Formato</span>
                            <span className="atv-spec-v">{isMovie ? (runtime || "Film") : `${seasonsList.length} Stagioni`}</span>
                        </div>
                        <div className="atv-spec-item">
                            <span className="atv-spec-k">Lingua originale</span>
                            <span className="atv-spec-v">{(details?.original_language || "it").toUpperCase()}</span>
                        </div>
                        {directorName && (
                            <div className="atv-spec-item">
                                <span className="atv-spec-k">{isMovie ? "Regia" : "Creatori"}</span>
                                <span className="atv-spec-v">{directorName}</span>
                            </div>
                        )}
                        {writerName && (
                            <div className="atv-spec-item">
                                <span className="atv-spec-k">Sceneggiatura</span>
                                <span className="atv-spec-v">{writerName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* SEZIONE TITOLI SIMILI E CONSIGLIATI */}
            {similarItems.length > 0 && (
                <div className="atv-container atv-similar-wrapper" style={{ marginTop: "50px" }}>
                    <CarouselSection
                        title={isMovie ? "Altri film che potrebbero piacerti" : "Altre serie consigliate"}
                        channels={similarItems}
                        isRelated={true}
                    />
                </div>
            )}

            {/* MODALE TRAILER YOUTUBE UFFICIALE */}
            {showTrailerModal && trailerVideo && (
                <div className="atv-trailer-backdrop" onClick={() => setShowTrailerModal(false)}>
                    <div className="atv-trailer-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="atv-trailer-header">
                            <span className="atv-trailer-title">Trailer Ufficiale: {title}</span>
                            <button
                                type="button"
                                className="atv-trailer-close"
                                onClick={() => setShowTrailerModal(false)}
                                aria-label="Chiudi trailer"
                            >
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div className="atv-trailer-iframe-box">
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${trailerVideo.key}?autoplay=1&rel=0`}
                                className="atv-trailer-iframe"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Trailer"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
