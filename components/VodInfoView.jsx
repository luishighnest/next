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

    // Fetch dettagli da TMDB
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        async function fetchDetails() {
            try {
                let res = await fetch(`/api/vod?action=details&type=${mediaType}&id=${id}`);
                let data = await res.json();

                // Fallback da movie a tv o viceversa
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

    // Se serie TV, carica episodi della stagione selezionata
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

    const title = details?.title || details?.name || previewItem?.title || "Dettagli Titolo";
    const tagline = details?.tagline || "";
    const overview = details?.overview || previewItem?.desc || "Nessuna sinossi disponibile.";
    const releaseDate = details?.release_date || details?.first_air_date || previewItem?.year || "";
    const year = releaseDate ? releaseDate.slice(0, 4) : "";
    const rating = details?.vote_average ? details.vote_average.toFixed(1) : (previewItem?.rating || null);
    const voteCount = details?.vote_count ? new Intl.NumberFormat('it-IT').format(details.vote_count) : null;
    const genres = details?.genres || [];
    const runtime = details?.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : null;
    
    // Cast & Crew principali
    const cast = (details?.credits?.cast || []).slice(0, 6);
    const directors = (details?.credits?.crew || []).filter(c => c.job === "Director" || c.job === "Creator");
    const directorName = directors.length > 0 ? directors.map(d => d.name).join(", ") : null;

    // Immagini
    const backdropUrl = details?.backdrop_path 
        ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` 
        : (previewItem?.backdrop || previewItem?.image || "");
    const posterUrl = details?.poster_path 
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}` 
        : (previewItem?.poster || previewItem?.image || "");

    const seasonsList = (details?.seasons || []).filter(s => s.season_number > 0);

    return (
        <div className="vod-info-page desktop-home">
            <Navbar activeFilter="vod" onFilterChange={(tab) => {
                if (tab === "vod") router.push("/vod");
                else if (tab === "home" || tab === "all") router.push("/home");
                else router.push(`/${tab}`);
            }} />

            {/* HERO STAGE ULTRA-PREMIUM */}
            <div className="vip-hero-stage">
                {/* Backdrop Layer con Glow e Vignette VisionOS */}
                {backdropUrl && (
                    <div 
                        className="vip-hero-backdrop" 
                        style={{ backgroundImage: `url(${backdropUrl})` }}
                    />
                )}
                <div className="vip-hero-vignette-top" />
                <div className="vip-hero-vignette-bottom" />
                <div className="vip-hero-vignette-left" />

                <div className="vip-hero-container">
                    {/* Pulsante Indietro Fluttuante VisionOS */}
                    <div className="vip-back-row">
                        <Link href="/vod" className="vip-back-pill">
                            <span className="material-symbols-rounded">arrow_back</span>
                            <span>Torna al catalogo VOD</span>
                        </Link>
                    </div>

                    <div className="vip-hero-body">
                        {/* Colonna Poster 2:3 con Cornice di Luce */}
                        <div className="vip-poster-card-wrap">
                            <div className="vip-poster-card">
                                {posterUrl ? (
                                    <img src={posterUrl} alt={title} className="vip-poster-img" />
                                ) : (
                                    <div className="vip-poster-ph">
                                        <span className="material-symbols-rounded">movie</span>
                                    </div>
                                )}
                                <div className="vip-poster-reflection" />
                            </div>
                        </div>

                        {/* Colonna Info Principali */}
                        <div className="vip-meta-content">
                            {/* Badges Bar */}
                            <div className="vip-badges-bar">
                                <span className={`vip-type-badge ${isMovie ? "badge-movie" : "badge-tv"}`}>
                                    {isMovie ? "FILM" : "SERIE TV"}
                                </span>
                                {year && <span className="vip-meta-pill">{year}</span>}
                                {runtime && <span className="vip-meta-pill">{runtime}</span>}
                                {!isMovie && seasonsList.length > 0 && (
                                    <span className="vip-meta-pill">
                                        {seasonsList.length} {seasonsList.length === 1 ? "Stagione" : "Stagioni"}
                                    </span>
                                )}
                                {rating && (
                                    <span className="vip-meta-pill vip-rating-pill">
                                        <span className="material-symbols-rounded vip-star">star</span>
                                        <span className="vip-rating-val">{rating}</span>
                                        {voteCount && <span className="vip-vote-count">({voteCount})</span>}
                                    </span>
                                )}
                            </div>

                            {/* Titolo e Tagline */}
                            <h1 className="vip-title">{title}</h1>
                            {tagline && <p className="vip-tagline">"{tagline}"</p>}

                            {/* Generi in chip VisionOS */}
                            {genres.length > 0 && (
                                <div className="vip-genres-wrap">
                                    {genres.map(g => (
                                        <span key={g.id} className="vip-genre-chip">{g.name}</span>
                                    ))}
                                </div>
                            )}

                            {/* Sinossi */}
                            <p className="vip-overview">{overview}</p>

                            {/* Regia & Cast Rapido */}
                            {(directorName || cast.length > 0) && (
                                <div className="vip-credits-preview">
                                    {directorName && (
                                        <div className="vip-credit-row">
                                            <span className="vip-credit-label">{isMovie ? "Regia:" : "Creata da:"}</span>
                                            <span className="vip-credit-val">{directorName}</span>
                                        </div>
                                    )}
                                    {cast.length > 0 && (
                                        <div className="vip-credit-row">
                                            <span className="vip-credit-label">Cast:</span>
                                            <span className="vip-credit-val">{cast.map(c => c.name).join(", ")}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Azioni Primarie */}
                            <div className="vip-cta-row">
                                {isMovie ? (
                                    <Link href={`/vod/${id}`} className="vip-btn-play-primary">
                                        <span className="material-symbols-rounded vip-cta-icon">play_arrow</span>
                                        <span className="vip-cta-label">Guarda Ora</span>
                                    </Link>
                                ) : (
                                    <Link href={`/vod/${id}/1/1`} className="vip-btn-play-primary">
                                        <span className="material-symbols-rounded vip-cta-icon">play_arrow</span>
                                        <span className="vip-cta-label">Riproduci S1 E1</span>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEZIONE EPISODI (SOLO SERIE TV) */}
            {!isMovie && (
                <section className="vip-episodes-section">
                    <div className="vip-episodes-inner">
                        {/* Header Sezione con Tab Stagioni Glass */}
                        <div className="vip-section-header">
                            <div className="vip-section-title-wrap">
                                <h2 className="vip-section-title">Episodi</h2>
                                <span className="vip-episodes-count">
                                    {seasonData?.episodes ? `${seasonData.episodes.length} episodi` : ""}
                                </span>
                            </div>

                            {seasonsList.length > 1 && (
                                <div className="vip-season-tabs">
                                    {seasonsList.map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`vip-season-tab ${selectedSeason === s.season_number ? "active" : ""}`}
                                            onClick={() => setSelectedSeason(s.season_number)}
                                        >
                                            {s.name || `Stagione ${s.season_number}`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Griglia Episodi 16:9 VisionOS */}
                        {loadingSeason ? (
                            <div className="vip-loading-block">
                                <div className="ee-spinner" />
                                <span>Caricamento episodi stagione {selectedSeason}...</span>
                            </div>
                        ) : seasonData?.episodes && seasonData.episodes.length > 0 ? (
                            <div className="vip-episodes-grid">
                                {seasonData.episodes.map(ep => {
                                    const epThumb = ep.still_path 
                                        ? `https://image.tmdb.org/t/p/w500${ep.still_path}` 
                                        : backdropUrl;
                                    const epPlayUrl = `/vod/${id}/${selectedSeason}/${ep.episode_number}`;

                                    return (
                                        <Link 
                                            key={ep.id} 
                                            href={epPlayUrl} 
                                            className="vip-ep-card-wrapper"
                                            title={`Guarda Episodio ${ep.episode_number}: ${ep.name || ""}`}
                                        >
                                            <div className="vip-ep-card">
                                                {/* Miniatura 16:9 con Glow su Hover */}
                                                <div className="vip-ep-thumb-box">
                                                    {epThumb ? (
                                                        <img src={epThumb} alt={ep.name} className="vip-ep-thumb" loading="lazy" />
                                                    ) : (
                                                        <div className="vip-ep-thumb-ph">
                                                            <span className="material-symbols-rounded">tv</span>
                                                        </div>
                                                    )}
                                                    <div className="vip-ep-vignette" />
                                                    <div className="vip-ep-play-circle">
                                                        <span className="material-symbols-rounded">play_arrow</span>
                                                    </div>
                                                    <span className="vip-ep-num-pill">
                                                        EP {ep.episode_number}
                                                    </span>
                                                </div>

                                                {/* Info Episodio */}
                                                <div className="vip-ep-body">
                                                    <div className="vip-ep-header-line">
                                                        <h3 className="vip-ep-name">{ep.episode_number}. {ep.name || `Episodio ${ep.episode_number}`}</h3>
                                                        {ep.runtime && <span className="vip-ep-duration">{ep.runtime} min</span>}
                                                    </div>
                                                    {ep.overview && (
                                                        <p className="vip-ep-desc">{ep.overview}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="vip-empty-state">
                                Nessun episodio disponibile per questa stagione.
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* SEZIONE TITOLI SIMILI E CONSIGLIATI */}
            {similarItems.length > 0 && (
                <div className="vip-similar-section" style={{ maxWidth: "1360px", margin: "40px auto 0", padding: "0 48px" }}>
                    <CarouselSection
                        title={isMovie ? "Film Consigliati" : "Serie TV Simili"}
                        channels={similarItems}
                        isRelated={true}
                    />
                </div>
            )}
        </div>
    );
}
