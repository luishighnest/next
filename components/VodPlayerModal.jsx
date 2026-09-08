"use client";
import React, { useState, useEffect, useRef } from "react";

export default function VodPlayerModal({ item, isOpen, onClose }) {
    const [details, setDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);
    const [seasonData, setSeasonData] = useState(null);
    const [loadingSeason, setLoadingSeason] = useState(false);

    const isMovie = !item || item.vodType === "movie" || item.group === "Film";
    const tmdbId = item?.tmdbId || (item?.id ? String(item.id).replace(/^vod_(movie|tv)_/, "") : "");

    // Carica dettagli da TMDB quando si apre la modale
    useEffect(() => {
        if (!isOpen || !tmdbId) return;

        let isMounted = true;
        setLoadingDetails(true);
        const type = isMovie ? "movie" : "tv";

        fetch(`/api/vod?action=details&type=${type}&id=${tmdbId}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted && data && data.details) {
                    setDetails(data.details);
                }
            })
            .catch(err => console.error("Errore fetch details VOD:", err))
            .finally(() => {
                if (isMounted) setLoadingDetails(false);
            });

        return () => { isMounted = false; };
    }, [isOpen, tmdbId, isMovie]);

    // Per le serie TV: carica gli episodi della stagione selezionata
    useEffect(() => {
        if (!isOpen || isMovie || !tmdbId) return;

        let isMounted = true;
        setLoadingSeason(true);

        fetch(`/api/vod?action=season&id=${tmdbId}&season=${selectedSeason}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted && data && data.season) {
                    setSeasonData(data.season);
                }
            })
            .catch(err => console.error("Errore fetch season VOD:", err))
            .finally(() => {
                if (isMounted) setLoadingSeason(false);
            });

        return () => { isMounted = false; };
    }, [isOpen, isMovie, tmdbId, selectedSeason]);

    // Gestione chiusura con tasto Esc
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Blocco scroll body
    useEffect(() => {
        if (isOpen) {
            const origOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = origOverflow;
            };
        }
    }, [isOpen]);

    if (!isOpen || !item) return null;

    // Costruzione URL VixSrc secondo documentazione ufficiale:
    // https://vixsrc.to/movie/{id}?primaryColor=e30a17&autoplay=true&lang=it
    // https://vixsrc.to/tv/{id}/{season}/{episode}?primaryColor=e30a17&autoplay=true&lang=it
    const playerUrl = isMovie
        ? `https://vixsrc.to/movie/${tmdbId}?primaryColor=e30a17&autoplay=true&lang=it`
        : `https://vixsrc.to/tv/${tmdbId}/${selectedSeason}/${selectedEpisode}?primaryColor=e30a17&autoplay=true&lang=it`;

    const title = item.title || item.name || details?.title || details?.name || "Video VOD";
    const year = item.year || (details?.release_date || details?.first_air_date || "").slice(0, 4);
    const genres = details?.genres ? details.genres.map(g => g.name).join(", ") : item.group;
    const overview = details?.overview || item.desc || "";
    const seasonsList = (details?.seasons || []).filter(s => s.season_number > 0);

    return (
        <div className="vod-player-backdrop" onClick={onClose}>
            <div className="vod-player-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header Modale */}
                <div className="vod-player-header">
                    <div className="vod-header-info">
                        <div className="vod-badge-group">
                            <span className="vod-type-pill">{isMovie ? "FILM" : "SERIE TV"}</span>
                            {year && <span className="vod-year-pill">{year}</span>}
                            {item.rating && <span className="vod-rating-pill">★ {item.rating}</span>}
                        </div>
                        <h2 className="vod-player-title">
                            {title}
                            {!isMovie && (
                                <span className="vod-current-ep-badge">
                                    S{selectedSeason} E{selectedEpisode}
                                </span>
                            )}
                        </h2>
                    </div>

                    <button
                        type="button"
                        className="vod-close-btn"
                        onClick={onClose}
                        title="Chiudi player (Esc)"
                        aria-label="Chiudi"
                    >
                        <i className="fas fa-xmark"></i>
                    </button>
                </div>

                {/* Contenuto Principale: Player + Selettore Episodi (se Serie TV) */}
                <div className={`vod-player-body ${!isMovie ? "has-sidebar" : ""}`}>
                    {/* Area Video Iframe VixSrc */}
                    <div className="vod-iframe-container">
                        <iframe
                            src={playerUrl}
                            className="vod-iframe"
                            allow="autoplay; encrypted-media; fullscreen"
                            allowFullScreen
                            title={title}
                        />
                    </div>

                    {/* Sidebar Episodi e Dettagli (Solo per Serie TV) */}
                    {!isMovie && (
                        <div className="vod-episodes-sidebar">
                            <div className="vod-sidebar-header">
                                <span className="vod-sidebar-title">Stagioni ed Episodi</span>
                                {seasonsList.length > 1 && (
                                    <div className="vod-season-selector-wrapper">
                                        <select
                                            className="vod-season-select"
                                            value={selectedSeason}
                                            onChange={(e) => {
                                                const sNum = parseInt(e.target.value, 10);
                                                setSelectedSeason(sNum);
                                                setSelectedEpisode(1);
                                            }}
                                        >
                                            {seasonsList.map(s => (
                                                <option key={s.id} value={s.season_number}>
                                                    {s.name || `Stagione ${s.season_number}`} ({s.episode_count} ep)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Lista Episodi */}
                            <div className="vod-episodes-list">
                                {loadingSeason ? (
                                    <div className="vod-episodes-loading">
                                        <div className="vod-spinner"></div>
                                        <span>Caricamento episodi...</span>
                                    </div>
                                ) : seasonData && Array.isArray(seasonData.episodes) && seasonData.episodes.length > 0 ? (
                                    seasonData.episodes.map(ep => {
                                        const isCurrent = ep.episode_number === selectedEpisode;
                                        const still = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null;
                                        return (
                                            <div
                                                key={ep.id}
                                                className={`vod-episode-item ${isCurrent ? "active" : ""}`}
                                                onClick={() => setSelectedEpisode(ep.episode_number)}
                                            >
                                                <div className="vod-ep-thumb-wrap">
                                                    {still ? (
                                                        <img src={still} alt="" className="vod-ep-thumb" />
                                                    ) : (
                                                        <div className="vod-ep-thumb-placeholder">
                                                            <i className="fas fa-film"></i>
                                                        </div>
                                                    )}
                                                    <div className="vod-ep-play-overlay">
                                                        <i className="fas fa-play"></i>
                                                    </div>
                                                </div>
                                                <div className="vod-ep-meta">
                                                    <div className="vod-ep-num-title">
                                                        <span className="vod-ep-num">Ep. {ep.episode_number}</span>
                                                        <span className="vod-ep-title">{ep.name}</span>
                                                    </div>
                                                    {ep.overview && (
                                                        <p className="vod-ep-desc">{ep.overview}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="vod-episodes-empty">
                                        Nessun episodio trovato per questa stagione.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Dettagli Trama & Info */}
                {overview && (
                    <div className="vod-player-footer">
                        <div className="vod-footer-meta">
                            {genres && <span className="vod-genres-label">{genres}</span>}
                            <p className="vod-overview-text">{overview}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}