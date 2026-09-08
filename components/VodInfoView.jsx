"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function VodInfoView({ id, initialType = "movie" }) {
    const router = useRouter();
    const [mediaType, setMediaType] = useState(initialType);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [seasonData, setSeasonData] = useState(null);
    const [loadingSeason, setLoadingSeason] = useState(false);

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
                // Prova prima con initialType
                let res = await fetch(`/api/vod?action=details&type=${mediaType}&id=${id}`);
                let data = await res.json();

                // Se dà 404 e il tipo era movie, prova tv (o viceversa)
                if ((!data || !data.details) && mediaType === "movie") {
                    const resTv = await fetch(`/api/vod?action=details&type=tv&id=${id}`);
                    const dataTv = await resTv.json();
                    if (dataTv && dataTv.details) {
                        if (isMounted) {
                            setMediaType("tv");
                            setDetails(dataTv.details);
                        }
                        return;
                    }
                }

                if (isMounted && data && data.details) {
                    setDetails(data.details);
                }
            } catch (err) {
                console.error("Errore fetch info VOD:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
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

    const title = details?.title || details?.name || previewItem?.title || "Dettagli Titolo";
    const overview = details?.overview || previewItem?.desc || "Nessuna sinossi disponibile.";
    const releaseDate = details?.release_date || details?.first_air_date || previewItem?.year || "";
    const year = releaseDate ? releaseDate.slice(0, 4) : "";
    const rating = details?.vote_average ? details.vote_average.toFixed(1) : (previewItem?.rating || null);
    const genres = details?.genres ? details.genres.map(g => g.name).join(", ") : (previewItem?.group || "");
    const runtime = details?.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : null;
    
    // Immagini
    const backdropUrl = details?.backdrop_path 
        ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` 
        : (previewItem?.backdrop || previewItem?.image || "");
    const posterUrl = details?.poster_path 
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}` 
        : (previewItem?.poster || previewItem?.image || "");

    const seasonsList = (details?.seasons || []).filter(s => s.season_number > 0);

    return (
        <div className="vod-info-page">
            <Navbar activeFilter="vod" onFilterChange={(tab) => {
                if (tab === "vod") router.push("/vod");
                else if (tab === "home" || tab === "all") router.push("/home");
                else router.push(`/${tab}`);
            }} />

            {/* Hero Backdrop Panoramico con Sfumatura */}
            <div className="vod-info-hero">
                {backdropUrl && (
                    <div 
                        className="vod-info-hero-bg" 
                        style={{ backgroundImage: `url(${backdropUrl})` }}
                    />
                )}
                <div className="vod-info-hero-gradient" />

                <div className="vod-info-hero-content">
                    {/* Pulsante Torna Indietro */}
                    <Link href="/vod" className="vod-back-btn">
                        <span className="material-symbols-rounded">arrow_back</span>
                        <span>Torna al catalogo VOD</span>
                    </Link>

                    <div className="vod-info-layout">
                        {/* Poster Card */}
                        <div className="vod-info-poster-col">
                            <div className="vod-info-poster-box">
                                {posterUrl ? (
                                    <img src={posterUrl} alt={title} className="vod-info-poster-img" />
                                ) : (
                                    <div className="vod-info-poster-ph">
                                        <span className="material-symbols-rounded">movie</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Informazioni Dettagliate */}
                        <div className="vod-info-meta-col">
                            <div className="vod-info-badges">
                                <span className={`vod-badge ${isMovie ? "vod-badge-movie" : "vod-badge-tv"}`}>
                                    {isMovie ? "FILM" : "SERIE TV"}
                                </span>
                                {year && <span className="vod-info-pill">{year}</span>}
                                {rating && (
                                    <span className="vod-info-pill vod-rating-pill">
                                        <span className="material-symbols-rounded vod-star-icon">star</span>
                                        {rating}
                                    </span>
                                )}
                                {runtime && <span className="vod-info-pill">{runtime}</span>}
                                {!isMovie && seasonsList.length > 0 && (
                                    <span className="vod-info-pill">
                                        {seasonsList.length} {seasonsList.length === 1 ? "Stagione" : "Stagioni"}
                                    </span>
                                )}
                            </div>

                            <h1 className="vod-info-title">{title}</h1>

                            {genres && <div className="vod-info-genres">{genres}</div>}

                            <p className="vod-info-overview">{overview}</p>

                            {/* Azioni Principali */}
                            <div className="vod-info-actions">
                                {isMovie ? (
                                    <Link href={`/vod/${id}`} className="vod-play-primary-btn">
                                        <span className="material-symbols-rounded">play_arrow</span>
                                        <span>Riproduci Film</span>
                                    </Link>
                                ) : (
                                    <Link href={`/vod/${id}/1/1`} className="vod-play-primary-btn">
                                        <span className="material-symbols-rounded">play_arrow</span>
                                        <span>Riproduci S1 E1</span>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Se Serie TV: Selettore Stagioni e Griglia Episodi */}
            {!isMovie && (
                <div className="vod-episodes-section">
                    <div className="vod-episodes-container">
                        <div className="vod-episodes-section-header">
                            <h2 className="vod-section-heading">Episodi</h2>
                            {seasonsList.length > 1 && (
                                <div className="vod-season-pills">
                                    {seasonsList.map(s => (
                                        <button
                                            key={s.id}
                                            className={`vod-season-pill ${selectedSeason === s.season_number ? "active" : ""}`}
                                            onClick={() => setSelectedSeason(s.season_number)}
                                        >
                                            {s.name || `Stagione ${s.season_number}`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {loadingSeason ? (
                            <div className="vod-episodes-loading">
                                <div className="ee-spinner" />
                                <span>Caricamento episodi stagione {selectedSeason}...</span>
                            </div>
                        ) : seasonData?.episodes && seasonData.episodes.length > 0 ? (
                            <div className="vod-episodes-grid">
                                {seasonData.episodes.map(ep => {
                                    const epThumb = ep.still_path 
                                        ? `https://image.tmdb.org/t/p/w500${ep.still_path}` 
                                        : backdropUrl;
                                    const epPlayUrl = `/vod/${id}/${selectedSeason}/${ep.episode_number}`;

                                    return (
                                        <Link 
                                            key={ep.id} 
                                            href={epPlayUrl} 
                                            className="vod-episode-card"
                                            title={`Riproduci Episodio ${ep.episode_number}: ${ep.name || ""}`}
                                        >
                                            <div className="vod-ep-card-thumb-wrap">
                                                {epThumb ? (
                                                    <img src={epThumb} alt={ep.name} className="vod-ep-card-thumb" loading="lazy" />
                                                ) : (
                                                    <div className="vod-ep-card-thumb-ph">
                                                        <span className="material-symbols-rounded">tv</span>
                                                    </div>
                                                )}
                                                <div className="vod-ep-card-overlay">
                                                    <span className="material-symbols-rounded ep-play-icon">play_arrow</span>
                                                </div>
                                                <div className="vod-ep-card-num-badge">
                                                    EP {ep.episode_number}
                                                </div>
                                            </div>

                                            <div className="vod-ep-card-meta">
                                                <h4 className="vod-ep-card-title">{ep.episode_number}. {ep.name || `Episodio ${ep.episode_number}`}</h4>
                                                {ep.overview && (
                                                    <p className="vod-ep-card-desc">{ep.overview}</p>
                                                )}
                                                {ep.runtime && (
                                                    <span className="vod-ep-card-runtime">{ep.runtime} min</span>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="vod-no-episodes">Nessun episodio trovato per questa stagione.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
