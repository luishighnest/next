"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TvSeriesPlayerPage() {
    const params = useParams();
    const id = params?.id ? String(params.id) : "";
    const season = params?.season ? String(params.season) : "1";
    const episode = params?.episode ? String(params.episode) : "1";

    const [seriesTitle, setSeriesTitle] = useState("Serie TV");
    const [episodeTitle, setEpisodeTitle] = useState("");
    const [totalEpisodesInSeason, setTotalEpisodesInSeason] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);

    // Gestione schermo intero nativo del browser sul container
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (containerRef.current?.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(() => {});
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
        };
    }, []);

    // Carica dettagli serie ed episodio
    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_vodItem");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (String(parsed.tmdbId) === String(id) || String(parsed.id).includes(String(id))) {
                        setSeriesTitle(parsed.title || parsed.name || "Serie TV");
                    }
                }
            } catch (e) {}
        }

        if (id) {
            fetch(`/api/vod?action=details&type=tv&id=${id}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.details?.name) {
                        setSeriesTitle(data.details.name);
                    }
                })
                .catch(() => {});

            // Info stagione per conteggio episodi e titolo episodio
            fetch(`/api/vod?action=season&id=${id}&season=${season}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.season?.episodes) {
                        setTotalEpisodesInSeason(data.season.episodes.length);
                        const curEp = data.season.episodes.find(e => String(e.episode_number) === String(episode));
                        if (curEp && curEp.name) {
                            setEpisodeTitle(curEp.name);
                        }
                    }
                })
                .catch(() => {});
        }
    }, [id, season, episode]);

    const curEpNum = parseInt(episode, 10);
    const hasNext = totalEpisodesInSeason > 0 ? curEpNum < totalEpisodesInSeason : true;
    const hasPrev = curEpNum > 1;

    const playerSrc = `https://vixsrc.to/tv/${id}/${season}/${episode}?primaryColor=e30a17&autoplay=true&lang=it`;

    return (
        <div className="vod-fullscreen-cinema" ref={containerRef}>
            {/* Topbar minimal: visibile sia normale che a schermo intero */}
            <div className="vod-fullscreen-topbar visible">
                <Link href={`/vod/info/${id}?type=tv`} className="vod-fullscreen-back-btn" title="Torna agli episodi">
                    <span className="material-symbols-rounded">arrow_back</span>
                    <span className="vod-fs-back-text">Torna agli episodi</span>
                </Link>

                {/* Titolo solo testo pulito senza casella */}
                <div className="vod-fullscreen-title-clean">
                    <span className="vod-fs-clean-ep">S{season}:E{episode}</span>
                    <span className="vod-fs-clean-title">{seriesTitle}</span>
                    {episodeTitle && <span className="vod-fs-clean-sub">• {episodeTitle}</span>}
                </div>

                <div className="vod-fullscreen-actions">
                    {hasPrev && (
                        <Link 
                            href={`/vod/${id}/${season}/${curEpNum - 1}`} 
                            className="vod-fs-nav-btn" 
                            title="Episodio precedente"
                        >
                            <span className="material-symbols-rounded">skip_previous</span>
                        </Link>
                    )}
                    {hasNext && (
                        <Link 
                            href={`/vod/${id}/${season}/${curEpNum + 1}`} 
                            className="vod-fs-nav-btn" 
                            title="Episodio successivo"
                        >
                            <span className="material-symbols-rounded">skip_next</span>
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="vod-fs-nav-btn"
                        title={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
                    >
                        <span className="material-symbols-rounded">
                            {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                        </span>
                    </button>
                    <Link href="/vod" className="vod-fullscreen-home-btn" title="Vai al Catalogo VOD">
                        <span className="material-symbols-rounded">grid_view</span>
                    </Link>
                </div>
            </div>

            {/* Iframe VixSrc Cinema a 100vw e 100vh con no-referrer */}
            <iframe
                src={playerSrc}
                className="vod-fullscreen-iframe"
                referrerPolicy="no-referrer"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                title={`${seriesTitle} - S${season} E${episode}`}
            />
        </div>
    );
}
