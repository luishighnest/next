"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TvSeriesPlayerPage() {
    const params = useParams();
    const id = params?.id ? String(params.id) : "";
    const season = params?.season ? String(params.season) : "1";
    const episode = params?.episode ? String(params.episode) : "1";

    const [seriesTitle, setSeriesTitle] = useState("");
    const [totalEpisodesInSeason, setTotalEpisodesInSeason] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);

    // Toggle schermo intero sul container
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

    // Carica dettagli serie
    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_vodItem");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (String(parsed.tmdbId) === String(id) || String(parsed.id).includes(String(id))) {
                        setSeriesTitle(parsed.title || parsed.name || "");
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

            fetch(`/api/vod?action=season&id=${id}&season=${season}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.season?.episodes) {
                        setTotalEpisodesInSeason(data.season.episodes.length);
                    }
                })
                .catch(() => {});
        }
    }, [id, season]);

    const curEpNum = parseInt(episode, 10);
    const hasNext = totalEpisodesInSeason > 0 ? curEpNum < totalEpisodesInSeason : true;
    const hasPrev = curEpNum > 1;

    const playerSrc = `https://vixsrc.to/tv/${id}/${season}/${episode}?primaryColor=e30a17&autoplay=true&lang=it`;

    // Formato richiesto: "TITOLO SERIE S2:E1"
    const displayTitle = seriesTitle ? `${seriesTitle} S${season}:E${episode}` : `S${season}:E${episode}`;

    return (
        <div className="vod-fullscreen-cinema" ref={containerRef}>
            {/* Topbar: solo icona a sinistra, titolo al centro, azioni a destra */}
            <div className="vod-fullscreen-topbar visible">
                {/* Tasto in alto a sinistra: SOLO ICONA, nessun testo */}
                <Link href={`/vod/info/${id}?type=tv`} className="vod-fullscreen-back-btn icon-only" title="Torna alla scheda">
                    <span className="material-symbols-rounded">arrow_back</span>
                </Link>

                {/* Titolo perfettamente in alto al centro: SOLO TESTO senza casella */}
                <div className="vod-fullscreen-title-clean center-title">
                    <span className="vod-fs-clean-title">{displayTitle}</span>
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
                    <Link href="/vod" className="vod-fullscreen-home-btn" title="Vai al Catalogo VOD">
                        <span className="material-symbols-rounded">grid_view</span>
                    </Link>
                </div>
            </div>

            {/* Tasto schermo intero invisibile nell'estremità più bassa in basso a destra */}
            <button
                type="button"
                onClick={toggleFullscreen}
                className="vod-fs-invisible-bottom-btn"
                title={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
                aria-label="Schermo intero"
            />

            {/* Iframe VixSrc Cinema */}
            <iframe
                src={playerSrc}
                className="vod-fullscreen-iframe"
                referrerPolicy="no-referrer"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                title={displayTitle}
            />
        </div>
    );
}
