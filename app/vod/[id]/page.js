"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function MoviePlayerPage() {
    const params = useParams();
    const id = params?.id ? String(params.id) : "";

    const [movieTitle, setMovieTitle] = useState("Film VOD");
    const [playerSrc, setPlayerSrc] = useState("");
    const [loading, setLoading] = useState(true);
    const [embedError, setEmbedError] = useState(false);

    // Fetch signed embed URL server-side to avoid CORS/adblock/JWPlayer issues
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setEmbedError(false);
        setPlayerSrc("");

        fetch(`/api/vod?action=vixembed&type=movie&id=${id}&lang=it`)
            .then(res => res.json())
            .then(data => {
                if (data?.embedUrl) {
                    setPlayerSrc(data.embedUrl);
                } else {
                    setEmbedError(true);
                }
            })
            .catch(() => setEmbedError(true))
            .finally(() => setLoading(false));
    }, [id]);

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

    return (
        <div className="vod-fullscreen-cinema">
            {/* Overlay superiore con pulsante Indietro e Titolo - Sempre visibile e trasparente/non invasivo */}
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

            {/* Player state management */}
            {loading && (
                <div className="vod-player-loading">
                    <div className="vod-player-spinner" />
                    <p>Caricamento in corso…</p>
                </div>
            )}

            {embedError && !loading && (
                <div className="vod-player-error">
                    <span className="material-symbols-rounded">error</span>
                    <p>Impossibile caricare il film.</p>
                    <button onClick={() => window.location.reload()} className="vod-player-retry-btn">
                        Riprova
                    </button>
                </div>
            )}

            {playerSrc && !loading && (
                <iframe
                    src={playerSrc}
                    className="vod-fullscreen-iframe"
                    referrerPolicy="no-referrer"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={movieTitle}
                />
            )}
        </div>
    );
}
