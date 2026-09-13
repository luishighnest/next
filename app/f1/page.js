"use client";
import React, { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import { fetchSecureJson } from "@/lib/crypto";

const FALLBACK_F1 = {
    name: "Sky Sport F1",
    logo: "/logos/sksportf1.png",
    mpd: "https://g006-lin-it-cmaf-prd-ak.pcdn07.cssott02.com/v~a-0-0_e~1789390775_s~732aee10-68df-4b0b-baaf-e8a1a844d466_u~8667264aa0002ce6cd68f666e7e13810d7ed4de0899695bbff26836e0d5f25f855720036e56c24e297c52c53667a8393_l~70_x~3dfbff8e7bd8f021db6e42f2c4e31f4f17476879d5cd47112103919fdbeacc51/nowitlin2/Content/CMAF_CTR_H1/Live/channel(GmNkZkEhHwZyLEqoafQKOFLW)/master_2hr-all.mpd",
    key: "11184a9a65df0f9fcd62ea270560fbd8:5a072e18cc6e9959eaa9d9a5a5513eb4"
};

export default function F1SpecialPage() {
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const [status, setStatus] = useState("Inizializzazione...");
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [channelData, setChannelData] = useState(FALLBACK_F1);

    useEffect(() => {
        let isCancelled = false;

        async function loadShakaScript() {
            if (typeof window === "undefined") return;
            if (window.shaka) return window.shaka;

            return new Promise((resolve, reject) => {
                const existingScript = document.getElementById("shaka-player-script");
                if (existingScript) {
                    if (window.shaka) resolve(window.shaka);
                    else {
                        existingScript.addEventListener("load", () => resolve(window.shaka));
                        existingScript.addEventListener("error", reject);
                    }
                    return;
                }
                const script = document.createElement("script");
                script.id = "shaka-player-script";
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js";
                script.async = true;
                script.onload = () => resolve(window.shaka);
                script.onerror = () => reject(new Error("Impossibile caricare la libreria Shaka Player"));
                document.head.appendChild(script);
            });
        }

        async function initPlayer() {
            try {
                setStatus("Lettura configurazione canale...");
                setIsLoading(true);
                setErrorMsg(null);

                let ch = FALLBACK_F1;
                try {
                    const skyData = await fetchSecureJson("/sky.json");
                    if (skyData) {
                        for (const cat in skyData) {
                            if (Array.isArray(skyData[cat])) {
                                const found = skyData[cat].find(c => {
                                    const n = (c.name || c.title || "").toLowerCase();
                                    return n.includes("f1") || n.includes("formula 1");
                                });
                                if (found && (found.mpd || found.url)) {
                                    ch = {
                                        name: found.name || "Sky Sport F1",
                                        logo: found.logo || "/logos/sksportf1.png",
                                        mpd: found.mpd || found.url,
                                        key: found.key || found.kid_key || FALLBACK_F1.key
                                    };
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Uso canale fallback F1:", e);
                }

                if (isCancelled) return;
                setChannelData(ch);

                setStatus("Avvio Shaka Player nativo...");
                const shaka = await loadShakaScript();
                if (!shaka) throw new Error("Shaka Player non disponibile");

                shaka.polyfill.installAll();
                if (!shaka.Player.isBrowserSupported()) {
                    throw new Error("Il tuo browser non supporta MSE/EME per Shaka Player");
                }

                if (!videoRef.current) return;

                if (!playerRef.current) {
                    const player = new shaka.Player(videoRef.current);
                    playerRef.current = player;

                    // Gestione filtri di rete
                    player.getNetworkingEngine().registerResponseFilter((type, response) => {
                        if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
                            if (!response.headers["content-type"] || response.headers["content-type"] === "text/plain") {
                                response.headers["content-type"] = "application/dash+xml";
                            }
                            try {
                                let xmlStr = shaka.util.StringUtils.fromUTF8(response.data);
                                // Rimuovi Widevine/PlayReady per forzare l'uso esclusivo di ClearKey locale
                                xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                                xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                                xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:5e629af5-38da-4063-8977-97ffbd9902d4[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                                response.data = shaka.util.StringUtils.toUTF8(xmlStr);
                            } catch (err) {
                                console.warn("Errore filtro manifest:", err);
                            }
                        }
                    });

                    player.addEventListener("error", (event) => {
                        console.error("Errore Shaka:", event.detail);
                        const d = event.detail;
                        let extra = "";
                        if (d.data && d.data.length > 0) {
                            extra = ` [URI: ${d.data[0] || ""} - Status: ${d.data[1] || ""}]`;
                        }
                        setErrorMsg(`Errore stream ${d.code}: ${d.message || "Errore di rete"}${extra}`);
                    });
                }

                const player = playerRef.current;

                // Configura ClearKey (sia con trattini che senza)
                const clearKeys = {};
                if (ch.key && ch.key.includes(":")) {
                    const pairs = ch.key.split(",");
                    pairs.forEach(pair => {
                        const [rawKid, rawK] = pair.split(":");
                        if (rawKid && rawK) {
                            const cleanKid = rawKid.replace(/-/g, "").trim().toLowerCase();
                            const cleanK = rawK.replace(/-/g, "").trim().toLowerCase();
                            clearKeys[cleanKid] = cleanK;
                            if (cleanKid.length === 32) {
                                const dashedKid = `${cleanKid.slice(0,8)}-${cleanKid.slice(8,12)}-${cleanKid.slice(12,16)}-${cleanKid.slice(16,20)}-${cleanKid.slice(20)}`;
                                clearKeys[dashedKid] = cleanK;
                            }
                        }
                    });
                }

                player.configure({
                    drm: {
                        clearKeys: clearKeys,
                        preferredKeySystems: ["org.w3.clearkey", "webkit-org.w3.clearkey"],
                        servers: {}
                    },
                    streaming: {
                        bufferingGoal: 20,
                        rebufferingGoal: 2,
                        bufferBehind: 30,
                        lowLatencyMode: true
                    },
                    manifest: {
                        dash: {
                            ignoreMinBufferTime: true
                        }
                    }
                });

                setStatus("Connessione al flusso live...");
                await player.load(ch.mpd, null, "application/dash+xml");

                if (isCancelled) return;
                setStatus("In riproduzione");
                setIsLoading(false);

                if (videoRef.current) {
                    videoRef.current.play().catch(() => {
                        if (videoRef.current) {
                            videoRef.current.muted = true;
                            videoRef.current.play().catch(e => console.warn("Play manuale:", e));
                        }
                    });
                }

            } catch (err) {
                console.error("Errore initPlayer:", err);
                if (!isCancelled) {
                    setIsLoading(false);
                    setErrorMsg(err.message || "Errore durante il caricamento dello stream F1");
                }
            }
        }

        initPlayer();

        return () => {
            isCancelled = true;
            if (playerRef.current) {
                playerRef.current.destroy().catch(() => null);
                playerRef.current = null;
            }
        };
    }, []);

    const handleRetry = () => {
        if (typeof window !== "undefined") {
            window.location.reload();
        }
    };

    return (
        <div style={{ backgroundColor: "#080808", minHeight: "100vh", color: "#ffffff" }}>
            <Navbar activeFilter={null} />

            <main style={{ maxWidth: "1500px", margin: "0 auto", padding: "80px 16px 40px 16px" }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "linear-gradient(90deg, #18181b 0%, #09090b 100%)",
                    border: "1px solid #27272a",
                    borderRadius: "14px",
                    marginBottom: "18px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "10px",
                            backgroundColor: "#e10600",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "900",
                            fontSize: "1.2rem",
                            boxShadow: "0 0 16px rgba(225, 6, 0, 0.4)"
                        }}>
                            F1
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "800", letterSpacing: "0.5px" }}>
                                {channelData.name}
                            </h1>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                                <span style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    backgroundColor: "rgba(225, 6, 0, 0.2)",
                                    color: "#ff4d4d",
                                    fontSize: "0.75rem",
                                    fontWeight: "700"
                                }}>
                                    <span style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        backgroundColor: "#ff4d4d",
                                        boxShadow: "0 0 8px #ff4d4d"
                                    }} />
                                    DIRETTA
                                </span>
                                <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                                    Player Shaka Nativo (ClearKey)
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleRetry}
                        style={{
                            background: "#27272a",
                            border: "1px solid #3f3f46",
                            color: "#ffffff",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: "600",
                            transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => e.target.style.background = "#3f3f46"}
                        onMouseLeave={(e) => e.target.style.background = "#27272a"}
                    >
                        ↻ Ricarica Stream
                    </button>
                </div>

                <div style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    backgroundColor: "#000000",
                    borderRadius: "14px",
                    overflow: "hidden",
                    border: "1px solid #27272a",
                    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                }}>
                    <video
                        ref={videoRef}
                        controls
                        autoPlay
                        playsInline
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            outline: "none"
                        }}
                    />

                    {isLoading && (
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.75)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "14px",
                            zIndex: 10
                        }}>
                            <div style={{
                                width: "42px",
                                height: "42px",
                                border: "4px solid rgba(225, 6, 0, 0.3)",
                                borderTopColor: "#e10600",
                                borderRadius: "50%",
                                animation: "spin 1s linear infinite"
                            }} />
                            <div style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: "600" }}>
                                {status}
                            </div>
                        </div>
                    )}

                    {errorMsg && (
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.85)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "20px",
                            textAlign: "center",
                            gap: "12px",
                            zIndex: 20
                        }}>
                            <div style={{ fontSize: "2rem" }}>⚠️</div>
                            <div style={{ color: "#ff4d4d", fontSize: "1.1rem", fontWeight: "700" }}>
                                Impossibile avviare la riproduzione
                            </div>
                            <div style={{ color: "#a1a1aa", fontSize: "0.9rem", maxWidth: "600px" }}>
                                {errorMsg}
                            </div>
                            <button
                                onClick={handleRetry}
                                style={{
                                    marginTop: "10px",
                                    backgroundColor: "#e10600",
                                    color: "#ffffff",
                                    border: "none",
                                    padding: "10px 20px",
                                    borderRadius: "8px",
                                    fontWeight: "700",
                                    cursor: "pointer"
                                }}
                            >
                                Riprova
                            </button>
                        </div>
                    )}
                </div>

                <div style={{
                    marginTop: "16px",
                    padding: "16px",
                    backgroundColor: "#121215",
                    borderRadius: "10px",
                    border: "1px solid #1f1f23",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "20px",
                    fontSize: "0.85rem",
                    color: "#a1a1aa"
                }}>
                    <div>
                        <strong style={{ color: "#ffffff" }}>Engine:</strong> Shaka Player Native (MSE / EME)
                    </div>
                    <div>
                        <strong style={{ color: "#ffffff" }}>DRM:</strong> ClearKey W3C Standard
                    </div>
                    <div>
                        <strong style={{ color: "#ffffff" }}>KID:KEY:</strong> {channelData.key ? channelData.key.substring(0, 36) + "..." : "Non disponibile"}
                    </div>
                </div>
            </main>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
