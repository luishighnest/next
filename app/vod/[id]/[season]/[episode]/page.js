"use client";
import React, { useState, useEffect } from "react";
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
    const [playerSrc, setPlayerSrc] = useState("");
    const [loading, setLoading] = useState(true);
    const [embedError, setEmbedError] = useState(false);

    // Fetch signed embed URL server-side to avoid error 233011
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setEmbedError(false);
        setPlayerSrc("");

        fetch(`/api/vod?action=vixembed&type=tv&id=${id}&season=${season}&episode=${episode}&lang=it`)
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
    }, [id, season, episode]);

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
                    if (data?.details?.name) setSeriesTitle(data.details.name);
                })
                .catch(() => {});

            fetch(`/api/vod?action=season&id=${id}&season=${season}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.season?.episodes) {
                        setTotalEpisodesInSeason(data.season.episodes.length);
                        const curEp = data.season.episodes.find(e => String(e.episode_number) === String(episode));
                        if (curEp?.name) setEpisodeTitle(curEp.name);
                    }
                })
                .catch(() => {});
        }
    }, [id, season, episode]);

    const curEpNum = parseInt(episode, 10);
    const hasNext = totalEpisodesInSeason > 0 ? curEpNum < totalEpisodesInSeason : true;
    const hasPrev = curEpNum > 1;

    return (
        <div className="vod-fullscreen-cinema">
            {/* Topbar sempre visibile */}
            <div className="vod-fullscreen-topbar visible">
                <Link href={`/vod/info/${id}?type=tv`} className="vod-fullscreen-back-btn">
                    <span className="material-symbols-rounded">arrow_back</span>
                    <span className="vod-fs-back-text">Torna agli episodi</span>
                </Link>

                <div className="vod-fullscreen-title-badge">
                    <span className="vod-fs-type tv-badge">S{season} E{episode}</span>
                    <span className="vod-fs-title">{seriesTitle}</span>
                    {episodeTitle && <span className="vod-fs-subtitle">• {episodeTitle}</span>}
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
                    <Link href="/vod" className="vod-fullscreen-home-btn" title="Catalogo VOD">
                        <span className="material-symbols-rounded">grid_view</span>
                    </Link>
                </div>
            </div>

            {/* Player */}
            {loading && (
                <div className="vod-player-loading">
                    <div className="vod-player-spinner" />
                    <p>Caricamento in corso…</p>
                </div>
            )}

            {embedError && !loading && (
                <div className="vod-player-error">
                    <span className="material-symbols-rounded">error</span>
                    <p>Impossibile caricare l&apos;episodio.</p>
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
                    title={`${seriesTitle} - S${season} E${episode}`}
                />
            )}
        </div>
    );
}
