"use client";
import React, { useEffect, useRef, useState } from "react";

export default function VidstackShakaPlayer({
    src,
    kidKey,
    headers = {},
    poster = "",
    title = "",
    autoPlay = true
}) {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const playerInstanceRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const controlsTimeoutRef = useRef(null);

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
            }
        }, 3500);
    };

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
            video.pause();
            setIsPlaying(false);
        }
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        const video = videoRef.current;
        if (!video) return;
        video.volume = val;
        setVolume(val);
        video.muted = val === 0;
        setIsMuted(val === 0);
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    useEffect(() => {
        let isMounted = true;
        let shakaModule = null;
        let player = null;

        async function initPlayer() {
            if (!src || typeof window === "undefined" || !videoRef.current) return;
            setIsLoading(true);
            setErrorMsg(null);

            try {
                shakaModule = await import("shaka-player/dist/shaka-player.compiled.js");
                const shaka = shakaModule.default || window.shaka || shakaModule;
                if (!isMounted) return;

                shaka.polyfill.installAll();
                if (!shaka.Player.isBrowserSupported()) {
                    setErrorMsg("Il browser non supporta la riproduzione Shaka Player.");
                    setIsLoading(false);
                    return;
                }

                if (playerInstanceRef.current) {
                    try { await playerInstanceRef.current.destroy(); } catch(e) {}
                    playerInstanceRef.current = null;
                }

                player = new shaka.Player();
                await player.attach(videoRef.current);
                playerInstanceRef.current = player;

                const clearKeysObj = {};
                if (kidKey && typeof kidKey === "string") {
                    const pairs = kidKey.split(",");
                    pairs.forEach(pair => {
                        const [k, v] = pair.split(":");
                        if (k && v) {
                            clearKeysObj[k.trim().toLowerCase()] = v.trim().toLowerCase();
                        }
                    });
                }

                player.configure({
                    drm: {
                        clearKeys: clearKeysObj
                    },
                    streaming: {
                        bufferingGoal: 10,
                        rebufferingGoal: 2,
                        bufferBehind: 15
                    }
                });

                player.getNetworkingEngine().registerRequestFilter((type, request) => {
                    const uri = request.uris[0];
                    if (!uri) return;
                    // Evita assolutamente di ri-proxyficare una richiesta già proxyficata
                    if (uri.includes("/api/proxy?url=") || uri.includes("%2Fapi%2Fproxy")) {
                        return;
                    }
                    if (uri.startsWith("/api/proxy") || uri.startsWith(window.location.origin + "/api/proxy")) {
                        return;
                    }
                    if (uri.startsWith("http://") || uri.startsWith("https://")) {
                        const tokenParam = headers["dazn-token"] ? `&dazn-token=${encodeURIComponent(headers["dazn-token"])}` : "";
                        request.uris[0] = `/api/proxy?url=${encodeURIComponent(uri)}${tokenParam}`;
                    }
                });

                player.addEventListener("error", (event) => {
                    console.error("Shaka Player Error:", event.detail);
                    if (isMounted) {
                        setErrorMsg(`Errore stream (Codice ${event.detail?.code || "Sconosciuto"})`);
                        setIsLoading(false);
                    }
                });

                await player.load(src);
                if (!isMounted) return;

                setIsLoading(false);
                if (autoPlay && videoRef.current) {
                    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
                        if (videoRef.current) {
                            videoRef.current.muted = true;
                            setIsMuted(true);
                            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                        }
                    });
                }
            } catch (err) {
                console.error("Errore init Shaka:", err);
                if (isMounted) {
                    setErrorMsg("Impossibile caricare il flusso video.");
                    setIsLoading(false);
                }
            }
        }

        initPlayer();

        return () => {
            isMounted = false;
            if (playerInstanceRef.current) {
                playerInstanceRef.current.destroy().catch(() => {});
                playerInstanceRef.current = null;
            }
        };
    }, [src, kidKey]);

    return (
        <div
            ref={containerRef}
            className={`vidstack-container ${showControls ? "controls-visible" : "controls-hidden"}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={(e) => {
                if (e.target === containerRef.current || e.target === videoRef.current) {
                    togglePlay();
                }
            }}
        >
            <video
                ref={videoRef}
                className="vidstack-video"
                poster={poster}
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsLoading(true)}
                onPlaying={() => setIsLoading(false)}
            />

            {isLoading && !errorMsg && (
                <div className="vidstack-loader-overlay">
                    <div className="vidstack-spinner"></div>
                </div>
            )}

            {errorMsg && (
                <div className="vidstack-error-overlay">
                    <span className="material-symbols-rounded" style={{ fontSize: "2.5rem", color: "#e30a17" }}>
                        error_outline
                    </span>
                    <p>{errorMsg}</p>
                </div>
            )}

            <div className="vidstack-top-bar">
                <div className="vidstack-top-left">
                    <div className="vidstack-live-badge">
                        <span className="vidstack-live-dot"></span>
                        LIVE
                    </div>
                    {title && <span className="vidstack-title">{title}</span>}
                </div>
            </div>

            <div className="vidstack-controls-bar">
                <button
                    type="button"
                    className="vidstack-btn"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pausa" : "Riproduci"}
                >
                    <span className="material-symbols-rounded">
                        {isPlaying ? "pause" : "play_arrow"}
                    </span>
                </button>

                <div className="vidstack-volume-group">
                    <button
                        type="button"
                        className="vidstack-btn"
                        onClick={toggleMute}
                        aria-label={isMuted ? "Attiva audio" : "Silenzia"}
                    >
                        <span className="material-symbols-rounded">
                            {isMuted || volume === 0 ? "volume_off" : volume < 0.5 ? "volume_down" : "volume_up"}
                        </span>
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="vidstack-volume-slider"
                        aria-label="Regola volume"
                    />
                </div>

                <div className="vidstack-spacer"></div>

                <button
                    type="button"
                    className="vidstack-btn"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
                >
                    <span className="material-symbols-rounded">
                        {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                    </span>
                </button>
            </div>
        </div>
    );
}
