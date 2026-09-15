"use client";
import React, { useState, useEffect, useRef, useTransition, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeviceState } from "@/components/DeviceProvider";
import { fetchSecureJson } from "@/lib/crypto";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug, getChannelSlug, matchSlug } from "@/lib/slug";
import { getTechSettings } from "@/lib/settings";
import { buildExtensionUrl, DEFAULT_EXT_ID } from "@/lib/extensionPlayer";
import GuidaTvModal from "@/components/GuidaTvModal";
import SettingsModal from "@/components/SettingsModal";

const SKY_CID_MAP = {
    "skysportuno": "sksportuno.png", "skysport24": "sksport24.png", "skysportarena": "sksportarena.png",
    "skysportbasket": "sksportbasket.png", "skysportcalcio": "sksportcalcio.png", "skysportf1": "sksportf1.png",
    "skysportgolf": "sksportgolf.png", "skysportlegend": "sksportlegend.png", "skysportmax": "sksportmax.png",
    "skysportmix": "sksportmix.png", "skysportmotogp": "sksportmotogp.png", "skysporttennis": "sksporttennis.png",
    "tg24": "skytg24.png", "skyuno": "skyuno.png", "skyunoplus": "skyunoplus.png",
    "skyatlantic": "skyatlantic.png", "skyserie": "skyserie.png", "skycollection": "skycollection.png",
    "skyinvestigation": "skyinvestigation.png", "skyadventure": "skyadventure.png", "skycrime": "skycrime.png",
    "skydocumentaries": "skydocumentaries.png", "skynature": "skynature.png", "historychannel": "history.png",
    "comedycentral": "comedycentral.png", "skyarte": "skyarte.png", "mtv": "mtv.png"
};

function normalizeName(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cidFromUrl(url) {
    if (!url) return "";
    let u = url;
    try { u = decodeURIComponent(url); } catch(e) {}
    const m = u.match(/channel\(([a-z0-9_]+)\)/i);
    return m ? m[1].toLowerCase() : "";
}

const buildExtUrl = buildExtensionUrl;

function parseChannelList(json, sourceName) {
    const list = [];
    if (!json) return list;
    const allowedGroups = sourceName === "sky2.json"
        ? Object.keys(json)
        : ["Sky Sport", "Sky Intrattenimento"];

    allowedGroups.forEach(g => {
        const items = json[g];
        if (!Array.isArray(items)) return;
        items.forEach(item => {
            const url = item.mpd || item.url || "";
            const cid = cidFromUrl(url) || (item.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const rawLogo = item.logo || "";
            const hasValidLogo = rawLogo && !rawLogo.includes("ui-avatars.com");
            const channelLogo = hasValidLogo ? rawLogo : (getChannelLogoUrl({ title: item.name || item.title, group: g }));

            list.push({
                name: item.name || item.title || "",
                group: g,
                url: url,
                kid_key: item.key || item.kid_key || "",
                logo: channelLogo,
                cid: cid,
                slug: createSlug(item.name || item.title || ""),
                skySource: sourceName
            });
        });
    });
    return list;
}

let memorySkyChannels = {};
let memorySkyGuide = null;

function SkyContent() {
    const router = useRouter();
    const { isMobile } = useDeviceState();
    const searchParams = useSearchParams();
    const chParam = searchParams.get("ch") || "";
    const srcParam = searchParams.get("src") || "";

    const handleBack = () => {
        let target = "/home";
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_returnPath");
                if (stored && !stored.startsWith("/sky")) {
                    target = stored;
                }
            } catch(e) {}
        }
        router.push(target);
    };

    const [currentSource, setCurrentSource] = useState(() => {
        if (srcParam === "sky2" || srcParam === "sky2.json" || srcParam === "2") return "sky2.json";
        if (srcParam === "sky1" || srcParam === "sky.json" || srcParam === "1") return "sky.json";
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_skyChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.skySource === "sky2.json" || parsed.skySource === "sky.json") {
                        return parsed.skySource;
                    }
                }
                const tech = getTechSettings();
                if (tech.defaultSkySource === "sky2.json" || tech.defaultSkySource === "sky.json") {
                    return tech.defaultSkySource;
                }
            } catch(e) {}
        }
        return "sky.json";
    });

    const initialChannels = memorySkyChannels[currentSource] || [];
    const [channels, setChannels] = useState(() => {
        if (initialChannels.length > 0) return initialChannels;
        if (typeof window !== "undefined") {
            try {
                const cached = localStorage.getItem("nmdz_cached_sections");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        const skySecs = parsed.filter(s => s.title?.includes("Sky") || s.channels?.some(c => c.isSky));
                        const flat = [];
                        skySecs.forEach(s => (s.channels || []).forEach(c => flat.push(c)));
                        if (flat.length > 0) return flat;
                    }
                }
            } catch(e) {}
        }
        return [];
    });
    const [guideData, setGuideData] = useState(() => memorySkyGuide || []);
    const [activeTab, setActiveTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChannel, setSelectedChannel] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_skyChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (!chParam || matchSlug(parsed, chParam)) {
                        return parsed;
                    }
                }
                const cached = localStorage.getItem("nmdz_cached_sections");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        for (const sec of parsed) {
                            for (const c of (sec.channels || [])) {
                                if (chParam && matchSlug(c, chParam)) {
                                    return c;
                                }
                            }
                        }
                    }
                }
            } catch(e) {}
        }
        return null;
    });
    const [loading, setLoading] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_skyChannel");
                if (stored) return false;
            } catch(e) {}
        }
        return initialChannels.length === 0;
    });
    const [mounted, setMounted] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [transPoster, setTransPoster] = useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_poster") || ""; } catch(e) {}
        }
        return "";
    });
    const [transLogo, setTransLogo] = useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_logo") || ""; } catch(e) {}
        }
        return "";
    });

    // Stati Player e Contenitore Fullscreen
    const containerRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(true);

    // Modali Guida TV e Impostazioni Tecniche generali
    const [isGuidaOpen, setIsGuidaOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Stato Drawer Canali a destra (popup nel player)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Controlli Overlay (auto-hide dopo 3 secondi di inattività mouse, ricompare subito al movimento)
    const [isUserActive, setIsUserActive] = useState(true);
    const idleTimerRef = useRef(null);

    const handleMouseMove = useCallback(() => {
        setIsUserActive(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setIsUserActive(false);
        }, 3000);
    }, []);

    useEffect(() => {
        setMounted(true);
        const handleFsChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener("fullscreenchange", handleFsChange);

        // Ascolta il movimento del mouse su tutta la finestra
        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        window.addEventListener("pointermove", handleMouseMove, { passive: true });

        // Avvia il timer di 3 secondi all'inizio
        idleTimerRef.current = setTimeout(() => {
            setIsUserActive(false);
        }, 3000);

        // Ascolta messaggi dall'iframe del player per sincronizzazione controlli, attività e fullscreen unificato
        const handlePlayerMessage = (e) => {
            if (e.data && typeof e.data === "object") {
                if (e.data.type === "jw_user_active") {
                    handleMouseMove();
                } else if (e.data.type === "jw_user_inactive") {
                    setIsUserActive(false);
                } else if (e.data.type === "jw_toggle_container_fullscreen") {
                    toggleFullscreen();
                }
            }
        };
        window.addEventListener("message", handlePlayerMessage);

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            document.removeEventListener("fullscreenchange", handleFsChange);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("pointermove", handleMouseMove);
            window.removeEventListener("message", handlePlayerMessage);
        };
    }, [handleMouseMove]);

    // Reset stato iframe al cambio canale per transizione pulita
    useEffect(() => {
        setIframeLoaded(false);
        setHasStartedPlaying(false);
        setIsVideoBuffering(true);
        handleMouseMove();
    }, [selectedChannel, handleMouseMove]);

    const toggleFullscreen = () => {
        const el = containerRef.current || document.documentElement;
        if (!document.fullscreenElement) {
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(() => {});
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    };

    // Reagisci immediatamente al cambio di chParam
    useEffect(() => {
        if (!chParam) return;
        if (selectedChannel && matchSlug(selectedChannel, chParam)) return;

        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_skyChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, chParam)) {
                        setSelectedChannel(parsed);
                        return;
                    }
                }
            } catch(e) {}
        }

        if (channels && channels.length > 0) {
            const found = channels.find(c => matchSlug(c, chParam));
            if (found) setSelectedChannel(found);
        }
    }, [chParam, channels]);

    // Carica canali e guida tv con aggiornamento automatico silenzioso tramite API ottimizzata
    useEffect(() => {
        let isMounted = true;
        async function loadSourceChannels(isInitial = false) {
            if (isInitial && (!memorySkyChannels[currentSource] || memorySkyChannels[currentSource].length === 0)) {
                if (!selectedChannel) {
                    setLoading(true);
                }
            }
            try {
                const ts = Date.now();
                const res = await fetch(`/api/canali?source=${encodeURIComponent(currentSource)}&t=${ts}`, { cache: "no-store" })
                    .then(r => r.json())
                    .catch(() => null);

                if (!isMounted) return;

                let channelList = [];
                if (res && Array.isArray(res.channels)) {
                    channelList = res.channels;
                    memorySkyChannels[currentSource] = channelList;
                    if (Array.isArray(res.guide)) {
                        memorySkyGuide = res.guide;
                        setGuideData(res.guide);
                    }
                } else {
                    // Fallback di emergenza
                    const [srcData, guideRes] = await Promise.allSettled([
                        fetchSecureJson(`/${currentSource}?t=${ts}`).catch(() => null),
                        fetch(`/guida_tv_sky.json?t=${ts}`, { cache: "no-store" }).then(r => r.json()).catch(() => null)
                    ]);
                    const json = srcData.status === "fulfilled" ? srcData.value : null;
                    const gData = guideRes.status === "fulfilled" ? guideRes.value : [];
                    if (Array.isArray(gData)) setGuideData(gData);
                    channelList = parseChannelList(json, currentSource);
                }

                setChannels(channelList);

                // Calcola target da chParam o da sessionStorage
                let storedTarget = "";
                try {
                    const stored = sessionStorage.getItem("nmdz_skyChannel");
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        storedTarget = parsed.slug || parsed.title || parsed.name || "";
                    }
                } catch(e) {}

                const currentSelectedSlug = selectedChannel ? (getChannelSlug(selectedChannel) || selectedChannel.name || "") : "";
                const targetKey = currentSelectedSlug || chParam || storedTarget;

                // 1. Cerca il canale nella sorgente attiva
                let found = null;
                if (targetKey) {
                    found = channelList.find(c => matchSlug(c, targetKey));
                }

                // 2. Se NON esiste nella sorgente attiva, cerca automaticamente nell'altra sorgente (sky.json <-> sky2.json)
                if (!found && targetKey) {
                    const otherSource = currentSource === "sky.json" ? "sky2.json" : "sky.json";
                    try {
                        const otherRes = await fetch(`/api/canali?source=${encodeURIComponent(otherSource)}&t=${ts}`, { cache: "no-store" })
                            .then(r => r.json())
                            .catch(() => null);

                        let otherList = otherRes?.channels;
                        if (!otherList || !Array.isArray(otherList)) {
                            const otherData = await fetchSecureJson(`/${otherSource}?t=${ts}`).catch(() => null);
                            if (otherData) otherList = parseChannelList(otherData, otherSource);
                        }

                        if (otherList && Array.isArray(otherList)) {
                            const foundInOther = otherList.find(c => matchSlug(c, targetKey));
                            if (foundInOther) {
                                // Trovato nell'altra sorgente! Switch automatico a quell'esatto canale su sky2 o sky1
                                setCurrentSource(otherSource);
                                setChannels(otherList);
                                setSelectedChannel(foundInOther);
                                return;
                            }
                        }
                    } catch(err) {
                        console.error("Errore verifica automatica altra sorgente Sky", err);
                    }
                }

                // 3. Seleziona canale (NON ricreare l'oggetto se il canale attuale è già valido per non distruggere Shaka!)
                setSelectedChannel(prevSelected => {
                    if (prevSelected) {
                        const stillExists = channelList.find(c => c.slug === prevSelected.slug || c.name === prevSelected.name);
                        if (stillExists) {
                            // Se i parametri chiave non sono cambiati, mantieni esattamente la stessa referenza di memoria prevSelected!
                            const prevUrl = (prevSelected.url || prevSelected.mpd || "").trim();
                            const stillUrl = (stillExists.url || stillExists.mpd || "").trim();
                            const prevKey = (prevSelected.kid_key || prevSelected.key || "").trim();
                            const stillKey = (stillExists.kid_key || stillExists.key || "").trim();
                            if (prevUrl === stillUrl && prevKey === stillKey) {
                                return prevSelected;
                            }
                            return stillExists;
                        }
                    }
                    if (found) return found;
                    if (channelList.length > 0) return channelList[0];
                    return null;
                });
            } catch(e) {
                console.error("Errore Sky", e);
            } finally {
                if (isMounted && isInitial) setLoading(false);
            }
        }

        // Caricamento iniziale
        loadSourceChannels(true);

        // Auto-polling silenzioso ogni 5 secondi in background
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                loadSourceChannels(false);
            }
        }, 5000);

        // Aggiorna istantaneamente quando torni sulla scheda del browser
        const onFocus = () => {
            if (document.visibilityState === "visible") {
                loadSourceChannels(false);
            }
        };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, [currentSource]);


    // Trova programma EPG
    const getCurrentProgram = (channelName) => {
        if (!guideData || !Array.isArray(guideData)) return null;
        const wanted = normalizeName(channelName);
        // 1. Corrispondenza esatta
        let group = guideData.find(g => g && g.canale && normalizeName(g.canale) === wanted);

        // 2. Corrispondenza base (rimuove solo suffissi di qualita)
        if (!group) {
            const cleanQuality = s => s.replace(/fhd|uhd|4k|1080p|720p|hd/g, "");
            const wantedBase = cleanQuality(wanted);
            group = guideData.find(g => {
                if (!g || !g.canale) return false;
                const gnBase = cleanQuality(normalizeName(g.canale));
                return wantedBase === gnBase && wantedBase.length > 2;
            });
        }
        if (!group || !Array.isArray(group.programmi) || group.programmi.length === 0) return null;

        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        let currentIdx = -1;

        for (let i = 0; i < group.programmi.length; i++) {
            const parts = (group.programmi[i].ora || "0:00").split(":");
            const pm = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            if (pm > nowMin) {
                currentIdx = i > 0 ? i - 1 : 0;
                break;
            }
        }
        if (currentIdx === -1) currentIdx = group.programmi.length - 1;

        const curP = group.programmi[currentIdx];
        const nextP = currentIdx < group.programmi.length - 1 ? group.programmi[currentIdx + 1] : null;

        let percent = 50;
        const startParts = (curP.ora || "0:00").split(":");
        const startMin = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
        let endMin = 24 * 60;
        if (nextP) {
            const endParts = (nextP.ora || "0:00").split(":");
            endMin = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
            if (endMin <= startMin) endMin += 24 * 60;
        }
        let adjNow = nowMin;
        if (adjNow < startMin) adjNow += 24 * 60;
        if (adjNow >= startMin && endMin > startMin) {
            percent = Math.round(((adjNow - startMin) / (endMin - startMin)) * 100);
            if (percent > 100) percent = 100;
            if (percent < 0) percent = 0;
        }

        return {
            ora: curP.ora || "",
            titolo: curP.titolo || "",
            immagine: curP.immagine || "",
            next: nextP ? nextP.titolo : "",
            percent: percent
        };
    };

    // Filtri
    const availableGroups = currentSource === "sky2.json"
        ? ["Sky Sport", "Sky Cinema", "Sky Intrattenimento", "Sky Bambini", "RAI", "MEDIASET", "DISCOVERY", "ALTRI"]
        : ["Sky Sport", "Sky Intrattenimento"];

    const filteredChannels = channels.filter(ch => {
        if (activeTab !== "all" && ch.group !== activeTab) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const nameMatch = ch.name.toLowerCase().includes(q);
            const grpMatch = ch.group.toLowerCase().includes(q);
            const epg = getCurrentProgram(ch.name);
            const epgMatch = epg && epg.titolo ? epg.titolo.toLowerCase().includes(q) : false;
            return nameMatch || grpMatch || epgMatch;
        }
        return true;
    });

    const currentEpg = selectedChannel ? getCurrentProgram(selectedChannel.name) : null;
    const playerSrc = selectedChannel ? buildExtUrl(selectedChannel) : "";
    const channelLogo = selectedChannel?.logo || transLogo || "";

    const selectChannelWithPoster = (nextCh) => {
        if (!nextCh) return;
        const epg = getCurrentProgram(nextCh.name);
        const newPoster = epg?.immagine || "";
        const newLogo = nextCh.logo || "";
        setTransPoster(newPoster);
        setTransLogo(newLogo);
        if (typeof window !== "undefined") {
            try {
                sessionStorage.setItem("nmdz_transition_poster", newPoster);
                sessionStorage.setItem("nmdz_transition_logo", newLogo);
            } catch(e) {}
        }
        setHasStartedPlaying(false);
        setIsVideoBuffering(true);
        setSelectedChannel(nextCh);
    };

    const handleNextChannel = () => {
        if (filteredChannels.length === 0) return;
        const curIdx = filteredChannels.findIndex(c => c.slug === selectedChannel?.slug);
        const nextIdx = (curIdx + 1) % filteredChannels.length;
        selectChannelWithPoster(filteredChannels[nextIdx]);
    };

    const handlePrevChannel = () => {
        if (filteredChannels.length === 0) return;
        const curIdx = filteredChannels.findIndex(c => c.slug === selectedChannel?.slug);
        const prevIdx = (curIdx - 1 + filteredChannels.length) % filteredChannels.length;
        selectChannelWithPoster(filteredChannels[prevIdx]);
    };

    // Scorciatoie tastiera per cambiare canale su PC (Tasti Freccia Su e Freccia Giù, F per fullscreen)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowUp") {
                e.preventDefault();
                handlePrevChannel();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                handleNextChannel();
            } else if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                toggleFullscreen();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filteredChannels, selectedChannel]);

    // Sincronizza dinamicamente l'URL nel browser quando cambia il canale selezionato
    useEffect(() => {
        if (!selectedChannel) return;
        const slug = getChannelSlug(selectedChannel);
        const isSky2 = (selectedChannel.skySource || currentSource) === "sky2.json";
        const newUrl = `/sky?ch=${slug}${isSky2 ? "&src=sky2" : ""}`;
        if (typeof window !== "undefined") {
            try {
                window.history.replaceState(null, "", newUrl);
                sessionStorage.setItem("nmdz_skyChannel", JSON.stringify(selectedChannel));
            } catch(e) {}
        }
    }, [selectedChannel, currentSource]);

    if (isMobile) {
        return (
            <MobileSkyView
                channels={channels}
                guideData={guideData}
                selectedChannel={selectedChannel}
                setSelectedChannel={setSelectedChannel}
                currentSource={currentSource}
                setCurrentSource={setCurrentSource}
                filteredChannels={filteredChannels}
                currentEpg={currentEpg}
                playerSrc={playerSrc}
                loading={loading}
                handlePrevChannel={handlePrevChannel}
                handleNextChannel={handleNextChannel}
            />
        );
    }

    return (
        <div
            className={`sky-app ${mounted ? "is-mounted" : "is-mounting"} ${isFullscreen ? "is-fullscreen" : ""}`}
            onMouseMove={handleMouseMove}
            onClick={handleMouseMove}
        >
            {/* Layout Principale Fullscreen 100vw x 100vh */}
            <main className="sky-main">
                {/* 1. Fullscreen Native Player Container Unificato (include video + custom UI + popups) */}
                <div ref={containerRef} className="sky-native-player-container">
                    {/* Tasto Minimal solo icona freccia indietro che riporta alla sezione da cui si proviene */}
                    <button
                        type="button"
                        className={`sky-back-minimal-btn ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}
                        onClick={handleBack}
                        title="Torna indietro"
                        aria-label="Torna indietro"
                    >
                        <span className="material-symbols-rounded">arrow_back</span>
                    </button>
                    {/* Backdrop di preload per eliminare scatti prima dell'avvio: sparisce irreversibilmente al primo frame */}
                    {Boolean(transPoster || currentEpg?.immagine) && !hasStartedPlaying && (
                        <div className="sky-player-backdrop-preload">
                            <img
                                src={transPoster || currentEpg?.immagine}
                                alt=""
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    filter: "brightness(0.55) contrast(1.05)"
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 40%, rgba(3,5,10,0.92) 85%, rgba(1,2,5,0.98) 100%)"
                                }}
                            />
                        </div>
                    )}

                    {/* Player Iframe Estensione Chrome */}
                    <iframe
                        id="player-frame"
                        src={playerSrc}
                        allowFullScreen
                        allow="autoplay; encrypted-media; fullscreen"
                        title={selectedChannel?.name || "Sky Player"}
                        onLoad={() => {
                            setTimeout(() => {
                                setIframeLoaded(true);
                                setHasStartedPlaying(true);
                                setIsVideoBuffering(false);
                            }, 300);
                        }}
                        style={{
                            display: "block",
                            width: "100%",
                            height: "100%",
                            border: "none",
                            background: "#000000",
                            opacity: iframeLoaded ? 1 : 0.85,
                            transition: "opacity 0.4s ease-in-out"
                        }}
                    />

                    {/* Vignetta cinematografica */}
                    <div className={`sky-player-vignette ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`} />

                    {/* Spinner */}
                    {(isVideoBuffering || loading || !hasStartedPlaying) && (
                        <div className="sky-native-loader">
                            <div className="sky-spinner" style={{ width: "52px", height: "52px", borderWidth: "3.5px" }} />
                        </div>
                    )}

                    {/* 2. Deck Overlay Inferiore */}
                    <div className={`sky-player-overlay-bottom ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}>
                        <div className="sky-player-modern-deck">
                        {/* Header Info */}
                        <div className="sky-player-info-row">
                            <div className="sky-player-meta-left">
                                <div className="sky-player-meta-details">
                                    {/* Linea 1: LOGO + NOME CANALE + LIVE + CATEGORIA + SCADENZA */}
                                    <div className="sky-player-tag-row">
                                        <div className="sky-channel-identity">
                                            <img
                                                src={channelLogo || "/logos/sksport.png"}
                                                className="sky-modern-logo"
                                                alt=""
                                                onError={(e) => {
                                                    e.target.style.display = "none";
                                                }}
                                            />
                                            <span className="sky-channel-name-text">{selectedChannel?.name || "Canale Sky"}</span>
                                        </div>
                                        <span className="live-badge"><span className="dot"></span>LIVE</span>
                                        <span className="now-group">{selectedChannel?.group || "Sky"}</span>
                                        {(() => {
                                            const streamUrl = selectedChannel?.url || selectedChannel?.mpd || "";
                                            const expMatch = streamUrl.match(/_e~([0-9]+)_/);
                                            if (!expMatch) return null;
                                            const expTs = parseInt(expMatch[1], 10) * 1000;
                                            const expDate = new Date(expTs);
                                            const now = new Date();
                                            const diffMin = Math.round((expDate - now) / 60000);
                                            const timeStr = String(expDate.getHours()).padStart(2, "0") + ":" + String(expDate.getMinutes()).padStart(2, "0");
                                            const isExpired = diffMin <= 0;
                                            let expiryText = isExpired
                                                ? "Scaduto alle " + timeStr
                                                : diffMin < 60
                                                ? "Scade tra " + diffMin + " min"
                                                : "Scadenza: " + timeStr;
                                            return (
                                                <span className={`now-expiry-badge ${isExpired ? "expired" : ""}`}>
                                                    <i className="fa-regular fa-clock"></i>
                                                    <span>{expiryText}</span>
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    {/* Linea 2: TITOLO PROGRAMMA */}
                                    <h2 className="sky-player-big-title">
                                        {currentEpg?.titolo || selectedChannel?.name || "Diretta TV"}
                                    </h2>
                                    {/* Linea 3: EPG */}
                                    <div className="sky-player-epg-subtitle">
                                        {currentEpg ? `${currentEpg.ora} ${currentEpg.next ? `• A seguire: ${currentEpg.next}` : ""}` : (selectedChannel?.group || "Diretta streaming")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Barra dei Controlli Inferiori Integrati (senza timeline finta) */}
                        <div className="sky-player-controls-bar">
                            {/* Gruppo Destra: Guida TV, Impostazioni Tecniche, Canali, Zapping */}
                            <div className="sky-controls-group-right">
                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={() => setIsGuidaOpen(true)}
                                    title="Guida TV"
                                >
                                    <span className="material-symbols-rounded">calendar_today</span>
                                </button>

                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={() => setIsSettingsOpen(true)}
                                    title="Impostazioni"
                                >
                                    <span className="material-symbols-rounded">settings</span>
                                </button>

                                <button
                                    type="button"
                                    className="sky-channels-trigger-btn icon-only"
                                    onClick={() => setIsSidebarOpen(true)}
                                    title="Canali"
                                >
                                    <span className="material-symbols-rounded">format_list_bulleted</span>
                                </button>

                                <div className="zap-controls">
                                    <button
                                        type="button"
                                        className="zap-btn"
                                        onClick={handlePrevChannel}
                                        title="Canale precedente (Freccia Su ↑)"
                                        aria-label="Canale precedente"
                                    >
                                        <span className="material-symbols-rounded">keyboard_arrow_up</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="zap-btn"
                                        onClick={handleNextChannel}
                                        title="Canale successivo (Freccia Giù ↓)"
                                        aria-label="Canale successivo"
                                    >
                                        <span className="material-symbols-rounded">keyboard_arrow_down</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Backdrop e Drawer Popup Laterale a Destra (nel player) */}
                <div
                    className={`sky-sidebar-backdrop ${isSidebarOpen ? "is-open" : ""}`}
                    onClick={() => setIsSidebarOpen(false)}
                />

                <aside className={`sky-sidebar-popup desktop-persistent ${isSidebarOpen ? "is-open" : ""}`}>
                    {/* Header Drawer */}
                    <div className="sky-sidebar-header">
                        <h3 className="sky-sidebar-header-title">
                            <i className="fas fa-tv" style={{ color: "#00e59b" }} />
                            <span>Canali TV</span>
                        </h3>
                        <button
                            type="button"
                            className="sky-sidebar-close-btn"
                            onClick={() => setIsSidebarOpen(false)}
                            aria-label="Chiudi elenco canali"
                        >
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>

                    {/* Search */}
                    <div className="sky-search">
                        <span className="material-symbols-rounded">search</span>
                        <input
                            type="text"
                            placeholder="Cerca canale Sky..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Switch Sorgente Sky 1 / Sky 2 */}
                    <div className="sky-source-switch">
                        <button
                            type="button"
                            className={`sky-source-btn ${currentSource === "sky.json" ? "active" : ""}`}
                            onClick={() => setCurrentSource("sky.json")}
                        >
                            <i className="fas fa-satellite-dish"></i>Sky 1
                        </button>
                        <button
                            type="button"
                            className={`sky-source-btn ${currentSource === "sky2.json" ? "active" : ""}`}
                            onClick={() => setCurrentSource("sky2.json")}
                        >
                            <i className="fas fa-tower-broadcast"></i>Sky 2
                        </button>
                    </div>

                    {/* Filtri a pillola orizzontali */}
                    <div className="sky-filters">
                        <button
                            type="button"
                            className={`sky-filter-btn ${activeTab === "all" ? "active" : ""}`}
                            onClick={() => setActiveTab("all")}
                            title="Tutti"
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        {availableGroups.map(grp => {
                            let icon = "fa-trophy";
                            const gl = grp.toLowerCase();
                            if (gl.includes("intrattenimento")) icon = "fa-masks-theater";
                            else if (gl.includes("cinema")) icon = "fa-film";
                            else if (gl.includes("bambini")) icon = "fa-child-reaching";
                            else if (gl.includes("rai") || gl.includes("mediaset")) icon = "fa-tv";
                            else if (gl.includes("discovery")) icon = "fa-compass";
                            else if (gl.includes("sport")) icon = "fa-trophy";
                            else icon = "fa-list";
                            return (
                                <button
                                    key={grp}
                                    type="button"
                                    className={`sky-filter-btn ${activeTab === grp ? "active" : ""}`}
                                    onClick={() => setActiveTab(grp)}
                                    title={grp}
                                >
                                    <i className={`fas ${icon}`}></i>
                                </button>
                            );
                        })}
                    </div>

                    {/* Lista Canali con EPG */}
                    <div className="sky-list">
                        {filteredChannels.length === 0 ? (
                            <div className="sky-empty">Nessun canale trovato.</div>
                        ) : (
                            filteredChannels.map((ch, idx) => {
                                const active = selectedChannel?.slug === ch.slug;
                                const epg = getCurrentProgram(ch.name);
                                return (
                                    <div
                                        key={ch.name + idx}
                                        className={`sky-item ${active ? "active" : ""}`}
                                        onClick={() => {
                                            selectChannelWithPoster(ch);
                                            // Su schermi ridotti chiudi drawer dopo selezione per massima visibilità
                                            if (window.innerWidth < 880) setIsSidebarOpen(false);
                                        }}
                                    >
                                        <div className="sky-item-thumb-box">
                                            {epg?.immagine && (
                                                <img src={epg.immagine} className="sky-item-poster-bg" alt="" />
                                            )}
                                            <img
                                                src={ch.logo || "/logos/sksport.png"}
                                                className="sky-item-logo-overlay"
                                                alt=""
                                            />
                                        </div>
                                        <div className="sky-item-info">
                                            <div className="sky-item-header-row">
                                                <div className="sky-item-name">{ch.name}</div>
                                                {active && <span className="sky-item-live">LIVE</span>}
                                            </div>
                                            {epg ? (
                                                <>
                                                    <div className="sky-item-epg">
                                                        <span className="sky-item-epg-time">{epg.ora}</span>
                                                        <span className="sky-item-epg-title">{epg.titolo}</span>
                                                    </div>
                                                    <div className="sky-item-progress">
                                                        <div className="sky-item-progress-bar" style={{ width: `${epg.percent}%` }}></div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="sky-item-epg">
                                                    <span className="sky-item-epg-title" style={{ color: "rgba(255,255,255,0.4)" }}>{ch.group}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* Modale Guida TV EPG */}
                <GuidaTvModal
                    isOpen={isGuidaOpen}
                    onClose={() => setIsGuidaOpen(false)}
                />

                    {/* Modale Impostazioni Tecniche & Player */}
                    {isSettingsOpen && (
                        <SettingsModal
                            onClose={() => setIsSettingsOpen(false)}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

export default function SkyPage() {
    return (
        <Suspense fallback={
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "transparent" }}>
                <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#e30a17", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
            </div>
        }>
            <SkyContent />
        </Suspense>
    );
}
