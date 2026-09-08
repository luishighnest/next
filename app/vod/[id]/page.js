"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function MoviePlayerPage() {
    const params = useParams();
    const id = params?.id ? String(params.id) : "";

    const [movieTitle, setMovieTitle] = useState("");
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

    // Carica titolo film da sessionStorage o TMDB
    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_vodItem");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (String(parsed.tmdbId) === String(id) || String(parsed.id).includes(String(id))) {
                        setMovieTitle(parsed.title || parsed.name || "");
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

    // Formato richiesto: SOLO "TITOLO FILM"
    const displayTitle = movieTitle || "Film";

    return (
        <div className="vod-fullscreen-cinema" ref={containerRef}>
            {/* Topbar: solo icona a sinistra, titolo al centro, azioni a destra */}
            <div className="vod-fullscreen-topbar visible">
                {/* Tasto in alto a sinistra: SOLO ICONA, nessun testo */}
                <Link href={`/vod/info/${id}?type=movie`} className="vod-fullscreen-back-btn icon-only" title="Torna alla scheda">
                    <span className="material-symbols-rounded">arrow_back</span>
                </Link>

                {/* Titolo perfettamente in alto al centro: SOLO TESTO senza casella */}
                <div className="vod-fullscreen-title-clean center-title">
                    <span className="vod-fs-clean-title">{displayTitle}</span>
                </div>

                <div className="vod-fullscreen-actions">
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
