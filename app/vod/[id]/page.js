"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function MoviePlayerPage() {
    const params = useParams();
    const id = params?.id ? String(params.id) : "";

    const [movieTitle, setMovieTitle] = useState("Film VOD");

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
        <div className="vod-fullscreen-cinema">
            {/* Overlay superiore con pulsante Indietro e Titolo - Sempre visibile in alto */}
            <div className="vod-fullscreen-topbar visible">
                <Link href={`/vod/info/${id}?type=movie`} className="vod-fullscreen-back-btn">
                    <span className="material-symbols-rounded">arrow_back</span>
                    <span className="vod-fs-back-text">Torna alla scheda</span>
                </Link>

                <div className="vod-fullscreen-title-badge">
                    <span className="vod-fs-type">FILM</span>
                    <span className="vod-fs-title">{movieTitle}</span>
                </div>

                <div className="vod-fullscreen-actions">
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
