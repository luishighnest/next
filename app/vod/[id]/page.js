"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function MoviePlayerPage() {
    const params = useParams();
    const id = params?.id ? String(params.id) : "";

    const [movieTitle, setMovieTitle] = useState("Film VOD");
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

    // Carica titolo film da sessionStorage o TMDB
    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_vodItem");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (String(parsed.tmdbId) === String(id) || String(parsed.id).includes(String(id))) {
                        setMovieTitle(parsed.title || parsed.name || "Film VOD");
                        return;
                    }
                }
            } catch (e) {}
        }

        if (id) {
            fetch(`/api/vod?action=details&type=movie&id=${id}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.details?.title) {
                        setMovieTitle(data.details.title);
                    }
                })
                .catch(() => {});
        }
    }, [id]);

    const playerSrc = `https://vixsrc.to/movie/${id}?primaryColor=e30a17&autoplay=true&lang=it`;

    return (
        <div className="vod-fullscreen-cinema" ref={containerRef}>
            {/* Topbar minimal: visibile sia normale che a schermo intero */}
            <div className="vod-fullscreen-topbar visible">
                <Link href={`/vod/info/${id}?type=movie`} className="vod-fullscreen-back-btn" title="Torna alla scheda">
                    <span className="material-symbols-rounded">arrow_back</span>
                    <span className="vod-fs-back-text">Torna alla scheda</span>
                </Link>

                {/* Titolo solo testo pulito senza casella */}
                <div className="vod-fullscreen-title-clean">
                    <span className="vod-fs-clean-ep">FILM</span>
                    <span className="vod-fs-clean-title">{movieTitle}</span>
                </div>

                <div className="vod-fullscreen-actions">
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

            {/* Iframe VixSrc Cinema a 100vw e 100vh */}
            <iframe
                src={playerSrc}
                className="vod-fullscreen-iframe"
                referrerPolicy="no-referrer"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                title={movieTitle}
            />
        </div>
    );
}
