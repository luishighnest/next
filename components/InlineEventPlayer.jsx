"use client";
import React, { useRef, useState, useEffect } from "react";
import { loadShakaScript, parseClearKeys } from "@/lib/shakaLoader";

function isHlsUrl(url) {
    const u = (url || "").toLowerCase();
    if (u.includes(".mpd") || u.includes("/dash/")) return false;
    if (u.includes(".m3u8") || u.includes(".m3u?") || u.includes(".m3u#") || u.includes("load-playlist") || u.includes("/hls/") || u.includes("playlist") || (u.endsWith(".m3u"))) return true;
    // URL senza estensione chiara dichiarati come HLS per sportzx (quasi tutti i type 0)
    if (u.includes("hereisman.net") || u.includes("fromthyheart") || u.includes("edgestream2") || u.includes("windows-devs.top") || u.includes("aapmains.net")) return true;
    return false;
}

function buildProxyManifestUrl(source) {
    // Carica il manifest HLS attraverso /api/proxy: i segmenti vengono riscritti
    // dal proxy (URL assoluti + proxied) aggirando CORS e aggiungendo referer/origin.
    const params = new URLSearchParams({ url: source.url.trim() });
    if (source.ua) params.set("ua", source.ua);
    if (source.referer) params.set("referer", source.referer);
    if (source.origin) params.set("origin", source.origin);
    return `/api/proxy?${params.toString()}`;
}

export default function InlineEventPlayer({ source, title, poster }) {
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const [state, setState] = useState("loading"); // loading | playing | error | unsupported
    const [isMuted, setIsMuted] = useState(false);
    const [forced, setForced] = useState(false);

    const streamUrl = (source && source.url || "").trim();
    const isHls = isHlsUrl(streamUrl);
    const manifestUrl = isHls ? buildProxyManifestUrl(source) : streamUrl;

    // Fallback: se il primo frame non arriva entro 12s mostra il poster dietro
    useEffect(() => {
        const t = setTimeout(() => setForced(true), 12000);
        return () => clearTimeout(t);
    }, [streamUrl]);

    useEffect(() => {
        let isCancelled = false;
        if (!streamUrl) return;

        async function init() {
            try {
                const shaka = await loadShakaScript();
                if (isCancelled || !shaka || !videoRef.current) return;
                if (!shaka.Player.isBrowserSupported()) {
                    setState("unsupported");
                    return;
                }

                if (playerRef.current) {
                    try { await playerRef.current.destroy(); } catch(e) {}
                    playerRef.current = null;
                }

                const player = new shaka.Player(videoRef.current);
                playerRef.current = player;

                // Headers personalizzati solo per richieste DIRETTE (non proxied);
                // sul proxy i riferimenti vengono passati come query params.
                player.getNetworkingEngine().registerRequestFilter((type, request) => {
                    if (request.uri.startsWith("/api/") || request.uri.startsWith(window.location.origin + "/api/")) return;
                    if (source.ua) request.headers["User-Agent"] = source.ua;
                    if (source.referer) request.headers["referer"] = source.referer;
                    if (source.origin) request.headers["origin"] = source.origin;
                });

                player.configure({
                    drm: {
                        clearKeys: parseClearKeys(source.kid_key),
                        preferredKeySystems: ["org.w3.clearkey", "webkit-org.w3.clearkey"],
                        servers: {}
                    },
                    streaming: {
                        bufferingGoal: 0.5,
                        rebufferingGoal: 0.2,
                        bufferBehind: 2,
                        lowLatencyMode: !isHls,
                        liveSyncTargetLatency: 4,
                        alwaysStreamFullSegments: false,
                        retryParameters: { maxAttempts: 3, baseDelay: 300, timeout: 6000 }
                    },
                    manifest: {
                        dash: { ignoreMinBufferTime: true },
                        retryParameters: { maxAttempts: 3, baseDelay: 300, timeout: 6000 }
                    },
                    abr: { enabled: true }
                });

                const mimeType = isHls ? "application/x-mpegurl" : "application/dash+xml";
                await player.load(manifestUrl, null, mimeType);
                if (isCancelled || !videoRef.current) return;
                setState("loading");

                videoRef.current.playsInline = true;
                const tryPlay = () => {
                    if (videoRef.current) videoRef.current.play().catch(() => {});
                };
                tryPlay();
                const timers = [1500, 3000, 6000].map(ms => setTimeout(tryPlay, ms));
                const done = () => { timers.forEach(t => clearTimeout(t)); };
                videoRef.current.addEventListener("playing", () => { setState("playing"); done(); }, { once: true });
                videoRef.current.addEventListener("error", () => { setState("error"); done(); });
            } catch (err) {
                if (!isCancelled) setState("error");
            }
        }

        init();

        return () => {
            isCancelled = true;
            if (playerRef.current) {
                playerRef.current.destroy().catch(() => {});
                playerRef.current = null;
            }
        };
    }, [streamUrl]);

    const toggleMute = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
            const next = !videoRef.current.muted;
            videoRef.current.muted = next;
            setIsMuted(next);
            videoRef.current.play().catch(() => {});
        }
    };

    const canShowPoster = state !== "playing" && !forced;

    return (
        <div className="inline-event-player" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#0a0d14" }}>
            <video
                ref={videoRef}
                className="inline-event-player-video"
                src=""
                style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0d14", opacity: state === "playing" ? 1 : 0.65, transition: "opacity 0.4s ease" }}
                autoPlay
                muted
                playsInline
                controls
                disablePictureInPicture
                onCanPlay={() => setState("playing")}
                onPlaying={() => setState("playing")}
            />

            {canShowPoster && (
                <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", overflow: "hidden" }}>
                    {poster ? (
                        <img src={poster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5) contrast(1.05)" }} />
                    ) : null}
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                        <div className="sky-spinner" style={{ width: "40px", height: "40px", borderWidth: "3px" }} />
                    </div>
                    <div style={{ position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)", fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.4)", padding: "6px 12px", borderRadius: "999px" }}>
                        {state === "error" ? (
                            <span style={{ color: "#ff7a7a" }}>Sorgente non riproducibile — prova un altro canale</span>
                        ) : (
                            <>
                                <span className="card-live-preview-dot" />
                                Caricamento {isHls ? "HLS" : "stream"}…
                                {!isMuted && (
                                    <button type="button" onClick={toggleMute} style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", fontSize: "13px", pointerEvents: "auto" }}>
                                        <i className="fas fa-volume-high" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {state === "error" && forced && !canShowPoster && (
                <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "rgba(255,255,255,0.85)", fontSize: "14px", fontWeight: "600" }}>
                        <i className="fas fa-triangle-exclamation" style={{ color: "#ff7a7a" }} />
                        Sorgente non riproducibile
                        <button type="button" onClick={() => window.location.reload()} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "#ffffff", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
                            Riprova
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}