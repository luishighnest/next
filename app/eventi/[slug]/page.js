"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import MobileEventoView from "@/components/MobileEventoView";
import { useDeviceState } from "@/components/DeviceProvider";
import { getChannelLogoUrl, getCurrentProgramInfo } from "@/lib/epg";
import { matchSlug, getChannelSlug } from "@/lib/slug";
import { getTechSettings } from "@/lib/settings";
import { loadShakaScript, parseClearKeys } from "@/lib/shakaLoader";
import GuidaTvModal from "@/components/GuidaTvModal";
import SettingsModal from "@/components/SettingsModal";

import { getNormalizedSources, getInitialSource } from "@/lib/sources";

export default function EventoPlayerPage() {
    const router = useRouter();
    const { isMobile } = useDeviceState();
    const params = useParams();
    const slug = params?.slug ? String(params.slug).toLowerCase() : "";

    const [channel, setChannel] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, slug)) return parsed;
                }
                const cached = localStorage.getItem("nmdz_cached_sections");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        for (const sec of parsed) {
                            for (const c of (sec.channels || [])) {
                                if (matchSlug(c, slug)) return c;
                            }
                        }
                    }
                }
            } catch(e) {}
        }
        return null;
    });

    const [selectedSource, setSelectedSource] = useState(() => getInitialSource(channel));
    const [relatedSections, setRelatedSections] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const cached = localStorage.getItem("nmdz_cached_sections");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        return parsed.filter(s => s.channels?.some(c => c.isTestJson) || s.navbar === "eventi");
                    }
                }
            } catch(e) {}
        }
        return [];
    });

    const [loading, setLoading] = useState(() => !channel);
    const [mounted, setMounted] = useState(false);
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
    const [transPoster, setTransPoster] = useState(() => {
        if (typeof window !== "undefined") {
            try { return sessionStorage.getItem("nmdz_transition_poster") || ""; } catch(e) {}
        }
        return "";
    });

    // Shaka Player state
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);

    // Timeline / DVR state
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLiveStream, setIsLiveStream] = useState(true);
    const [bufferedEnd, setBufferedEnd] = useState(0);
    const [seekRange, setSeekRange] = useState({ start: 0, end: 0 });
    const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
    const timelineRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // Video Settings Popover
    const [isVideoSettingsOpen, setIsVideoSettingsOpen] = useState(false);
    const [videoQualities, setVideoQualities] = useState([]);
    const [isAbrEnabled, setIsAbrEnabled] = useState(true);
    const [audioTracks, setAudioTracks] = useState([]);
    const [selectedAudioLang, setSelectedAudioLang] = useState("");
    const [textTracks, setTextTracks] = useState([]);
    const [isTextTrackEnabled, setIsTextTrackEnabled] = useState(false);
    const [selectedTextLang, setSelectedTextLang] = useState("");

    // Modali
    const [isGuidaOpen, setIsGuidaOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Drawer Canali
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");

    // Overlay auto-hide
    const [isUserActive, setIsUserActive] = useState(true);
    const idleTimerRef = useRef(null);

    const handleMouseMove = () => {
        setIsUserActive(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            if (!isVideoSettingsOpen) setIsUserActive(false);
        }, 4000);
    };

    const handleBack = () => {
        let target = "/eventi";
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_returnPath");
                if (stored && !stored.startsWith("/sky") && !stored.startsWith("/eventi") && !stored.startsWith("/evento")) {
                    target = stored;
                }
            } catch(e) {}
        }
        router.push(target);
    };

    useEffect(() => {
        setMounted(true);
        return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
    }, []);

    // Reset stato video al cambio sorgente
    useEffect(() => {
        setHasStartedPlaying(false);
        setIsVideoBuffering(true);
        setIsVideoPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setSeekRange({ start: 0, end: 0 });
        setIsAtLiveEdge(true);
        setIsVideoSettingsOpen(false);
        setIsUserActive(true);
    }, [selectedSource, slug]);

    // ─── Shaka Player: inizializzazione e caricamento ───────────────────────
    const refreshTracks = (playerInstance) => {
        const player = playerInstance || playerRef.current;
        if (!player) return;
        try {
            const tracks = player.getVariantTracks() || [];
            const resMap = new Map();
            tracks.forEach(t => {
                if (t.height) {
                    const label = `${t.height}p`;
                    if (!resMap.has(label) || t.bandwidth > resMap.get(label).bandwidth) {
                        resMap.set(label, { id: t.id, label, height: t.height, bandwidth: t.bandwidth, active: t.active });
                    }
                }
            });
            setVideoQualities(Array.from(resMap.values()).sort((a, b) => b.height - a.height));
            const abrConf = player.getConfiguration();
            setIsAbrEnabled(abrConf?.abr?.enabled ?? true);
            const audioLangs = player.getAudioLanguagesAndRoles ? player.getAudioLanguagesAndRoles() : [];
            setAudioTracks(audioLangs.map((a, i) => ({ id: i, language: a.language || "Principale", role: a.role || "" })));
            if (player.getAudioLanguages && player.getAudioLanguages().length > 0) {
                setSelectedAudioLang(player.getAudioLanguages()[0]);
            }
            const textTrks = player.getTextTracks() || [];
            setTextTracks(textTrks);
            setIsTextTrackEnabled(player.isTextTrackVisible ? player.isTextTrackVisible() : false);
        } catch(e) {}
    };

    const handleSelectQuality = (track) => {
        const player = playerRef.current;
        if (!player) return;
        try {
            if (track === "auto") {
                player.configure({ abr: { enabled: true } });
                setIsAbrEnabled(true);
            } else {
                player.configure({ abr: { enabled: false } });
                setIsAbrEnabled(false);
                const matched = player.getVariantTracks().find(v => v.id === track.id || v.height === track.height);
                if (matched) player.selectVariantTrack(matched, false);
            }
            refreshTracks(player);
        } catch(e) {}
    };

    const handleSelectAudio = (lang) => {
        const player = playerRef.current;
        if (!player) return;
        try { player.selectAudioLanguage(lang); setSelectedAudioLang(lang); refreshTracks(player); } catch(e) {}
    };

    const handleToggleSubtitles = (trackOrDisable) => {
        const player = playerRef.current;
        if (!player) return;
        try {
            if (trackOrDisable === "off") {
                player.setTextTrackVisibility(false);
                setIsTextTrackEnabled(false);
                setSelectedTextLang("");
            } else {
                player.setTextTrackVisibility(true);
                setIsTextTrackEnabled(true);
                if (trackOrDisable?.language) {
                    player.selectTextLanguage(trackOrDisable.language);
                    setSelectedTextLang(trackOrDisable.language);
                }
            }
        } catch(e) {}
    };

    useEffect(() => {
        if (!selectedSource || isMobile) return;
        let isCancelled = false;

        let streamUrl = (selectedSource.url || "").trim();
        let rawKey = selectedSource.kid_key || selectedSource.key || "";
        const rawUa = selectedSource.ua || "";
        let daznToken = selectedSource.dazn_token || "";

        // Pulizia automatica fondamentale per link di Heroku nel formato URL|KEY
        if (streamUrl.includes("|")) {
            const parts = streamUrl.split("|");
            streamUrl = parts[0].trim();
            if (!rawKey && parts[1]) {
                rawKey = parts[1].trim();
            }
        }

        if (!daznToken && streamUrl.includes("@eyJ")) {
            const tm = streamUrl.match(/@([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)/);
            if (tm) daznToken = tm[1];
        }

        if (!streamUrl) return;

        async function initShaka() {
            try {
                const shaka = await loadShakaScript();
                if (isCancelled || !shaka || !videoRef.current) return;

                if (!shaka.Player.isBrowserSupported()) {
                    console.error("Shaka non supportato su questo browser");
                    return;
                }

                let player = playerRef.current;
                if (player) {
                    try {
                        await player.unload();
                    } catch(e) {
                        try { await player.destroy(); } catch(err) {}
                        player = null;
                    }
                }

                if (!player) {
                    player = new shaka.Player(videoRef.current);
                    playerRef.current = player;

                    // Filtri MIME e rimozione DRM Widevine per forzare ClearKey
                    player.getNetworkingEngine().registerResponseFilter((type, response) => {
                        if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
                            if (!response.headers["content-type"] || response.headers["content-type"] === "text/plain") {
                                response.headers["content-type"] = "application/dash+xml";
                            }
                            try {
                                let xmlStr = shaka.util.StringUtils.fromUTF8(response.data);
                                xmlStr = xmlStr.replace(/<ContentProtection[\s\S]*?<\/ContentProtection>/gi, (match) => {
                                    if (/9a04f079|edef8ba9|5e629af5/i.test(match)) {
                                        return "";
                                    }
                                    return match;
                                });
                                xmlStr = xmlStr.replace(/<ContentProtection[^>]*schemeIdUri="urn:uuid:(9a04f079|edef8ba9|5e629af5)[^>]*\/>/gi, "");
                                response.data = shaka.util.StringUtils.toUTF8(xmlStr);
                            } catch(e) {}
                        }
                    });

                    player.getNetworkingEngine().registerRequestFilter((type, request) => {
                        const tech = getTechSettings();
                        const effectiveUa = rawUa || tech.customUserAgent || "";
                        if (effectiveUa) request.headers["User-Agent"] = effectiveUa;
                        if (daznToken) {
                            request.headers["dazn-token"] = daznToken;
                            request.headers["referer"] = "https://www.dazn.com/";
                            request.headers["origin"] = "https://www.dazn.com";
                        }
                    });

                    player.addEventListener("buffering", (ev) => setIsVideoBuffering(ev.buffering));
                    player.addEventListener("adaptation", () => refreshTracks(player));
                    player.addEventListener("trackschanged", () => refreshTracks(player));
                    player.addEventListener("error", (err) => {
                        console.error("Shaka error (evento):", err);
                        if (playerRef.current && !err.detail?.severity) {
                            try { playerRef.current.retryStreaming(); } catch(e) {}
                        }
                    });
                }

                const clearKeys = parseClearKeys(rawKey);
                player.configure({
                    drm: {
                        clearKeys,
                        preferredKeySystems: ["org.w3.clearkey", "webkit-org.w3.clearkey"],
                        servers: {}
                    },
                    streaming: {
                        bufferingGoal: 1.0,
                        rebufferingGoal: 0.5,
                        bufferBehind: 30,
                        lowLatencyMode: true,
                        inaccurateManifestTolerance: 0,
                        alwaysStreamFullSegments: false,
                        retryParameters: { maxAttempts: 3, baseDelay: 400, backoffFactor: 1.2, fuzzFactor: 0.1, timeout: 4000 }
                    },
                    manifest: {
                        dash: { ignoreMinBufferTime: true },
                        retryParameters: { maxAttempts: 3, baseDelay: 400, backoffFactor: 1.2, fuzzFactor: 0.1, timeout: 4000 }
                    },
                    abr: { enabled: true, defaultBandwidthEstimate: 5000000 }
                });

                const isHls = streamUrl.toLowerCase().includes(".m3u8");
                const mimeType = isHls ? "application/x-mpegurl" : "application/dash+xml";
                await player.load(streamUrl, null, mimeType);
                if (isCancelled) return;

                refreshTracks(player);

                if (videoRef.current) {
                    videoRef.current.playsInline = true;
                    try {
                        videoRef.current.muted = false;
                        await videoRef.current.play();
                        setIsMuted(false);
                    } catch(playErr) {
                        if (videoRef.current) {
                            videoRef.current.muted = true;
                            setIsMuted(true);
                            await videoRef.current.play().catch(() => {});
                        }
                    }
                }
            } catch(err) {
                console.error("Errore Shaka (evento):", err);
            }
        }

        initShaka();

        return () => {
            isCancelled = true;
            if (playerRef.current) {
                playerRef.current.destroy().catch(() => {});
                playerRef.current = null;
            }
        };
    }, [selectedSource, isMobile]);

    // ─── Controlli player ─────────────────────────────────────────────────────
    const togglePlayPause = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) videoRef.current.play().catch(() => {});
        else videoRef.current.pause();
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        const newMuted = !videoRef.current.muted;
        videoRef.current.muted = newMuted;
        setIsMuted(newMuted);
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
            setIsMuted(val === 0);
        }
    };

    const handleGoLive = () => {
        if (!videoRef.current) return;
        if (seekRange.end > seekRange.start) {
            const livePoint = Math.max(seekRange.start, seekRange.end - 3);
            videoRef.current.currentTime = livePoint;
            setCurrentTime(livePoint);
            setIsAtLiveEdge(true);
        }
    };

    const handleTimelineClick = (e) => {
        if (!timelineRef.current || !videoRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (seekRange.end > seekRange.start) {
            const targetTime = seekRange.start + pos * (seekRange.end - seekRange.start);
            videoRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
            setIsAtLiveEdge(seekRange.end - targetTime < 15);
        } else if (!isLiveStream && duration > 0) {
            const seekTarget = pos * duration;
            videoRef.current.currentTime = seekTarget;
            setCurrentTime(seekTarget);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        }
    };

    // ─── Caricamento canali ───────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;

        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, slug)) {
                        setChannel(parsed);
                        setSelectedSource(getInitialSource(parsed));
                        setLoading(false);
                    }
                }
            } catch(e) {}
        }

        async function loadEvent() {
            let foundCh = null;

            try {
                const stored = sessionStorage.getItem("daznEventChannel") || sessionStorage.getItem("daznCustomChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (matchSlug(parsed, slug)) {
                        foundCh = parsed;
                        if (isMounted) {
                            setChannel(foundCh);
                            setSelectedSource(prev => prev?.url ? prev : getInitialSource(foundCh));
                            setLoading(false);
                        }
                    }
                }
            } catch(e) {}

            try {
                const res = await fetch(`/api/canali`).then(r => r.json()).catch(() => null);

                if (res && Array.isArray(res.sections)) {
                    for (const sec of res.sections) {
                        for (const c of (sec.channels || [])) {
                            if (matchSlug(c, slug)) { foundCh = c; break; }
                        }
                        if (foundCh?.sources?.length > 0) break;
                    }
                }

                if ((!foundCh || !foundCh.url) && res) {
                    const allSky = [...(res.sky1 || []), ...(res.sky2 || [])];
                    for (const c of allSky) {
                        if (matchSlug(c, slug)) {
                            foundCh = {
                                title: c.name || c.title,
                                group: c.group,
                                provider: "SKY",
                                logo: c.logo,
                                url: c.url,
                                kid_key: c.kid_key,
                                slug: getChannelSlug(c),
                                sources: [{ name: "Standard", isWarp: false, url: c.url, kid_key: c.kid_key }]
                            };
                            break;
                        }
                    }
                }

                if (foundCh) {
                    const professionalSlug = getChannelSlug(foundCh);
                    if (professionalSlug && professionalSlug !== slug && typeof window !== "undefined") {
                        try { window.history.replaceState(null, "", `/eventi/${professionalSlug}`); } catch(e) {}
                    }
                }

                if (foundCh && isMounted) {
                    setChannel(prev => {
                        if (prev && prev.title === foundCh.title && prev.sources?.length === foundCh.sources?.length) return prev;
                        return foundCh;
                    });
                    setSelectedSource(prevSource => {
                        if (prevSource?.url) {
                            const stillMatches = foundCh.sources?.find(s => (s.name === prevSource.name) || (s.url && prevSource.url && s.url === prevSource.url));
                            if (stillMatches) {
                                if (prevSource.url === stillMatches.url && prevSource.kid_key === stillMatches.kid_key) return prevSource;
                                return stillMatches;
                            }
                        }
                        return getInitialSource(foundCh);
                    });
                    setLoading(false);
                }

                const sections = [];
                const currentPlayingTitle = foundCh?.title || "";
                const currentPlayingGroup = foundCh?.group || "";

                if (res && Array.isArray(res.sections)) {
                    const EXCLUDED_CATEGORIES = ["digitale terrestre", "rai", "mediaset", "discovery"];
                    const sameCatSec = res.sections.find(sec => {
                        if (EXCLUDED_CATEGORIES.some(ex => sec.title.toLowerCase().includes(ex))) return false;
                        return (currentPlayingGroup && sec.title.toLowerCase() === currentPlayingGroup.toLowerCase()) ||
                               (sec.channels || []).some(c => c.title === currentPlayingTitle);
                    });

                    if (sameCatSec) {
                        const filtered = (sameCatSec.channels || []).filter(c => c.title !== currentPlayingTitle);
                        if (filtered.length > 0) sections.push({ title: sameCatSec.title, channels: filtered });
                    }

                    res.sections.forEach(sec => {
                        if (sameCatSec && sec.title === sameCatSec.title) return;
                        const filtered = (sec.channels || []).filter(c => c.title !== currentPlayingTitle);
                        if (filtered.length > 0) sections.push({ title: sec.title, channels: filtered });
                    });
                }

                if (isMounted) setRelatedSections(sections);
            } catch(e) {
                console.error("Errore caricamento evento:", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadEvent();

        const tech = getTechSettings();
        const pollMs = (tech.pollIntervalSec || 5) * 1000;
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") loadEvent();
        }, pollMs);

        const onFocus = () => { if (document.visibilityState === "visible") loadEvent(); };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, [slug]);

    // ─── Elenco canali e filtri ───────────────────────────────────────────────
    const allChannelsList = useMemo(() => {
        const list = [];
        const seen = new Set();
        relatedSections.forEach(sec => {
            (sec.channels || []).forEach(ch => {
                const key = getChannelSlug(ch) || ch.title || ch.name;
                if (!seen.has(key)) { seen.add(key); list.push({ ...ch, sectionCategory: sec.title }); }
            });
        });
        return list;
    }, [relatedSections]);

    const availableCategories = useMemo(() => {
        const cats = [];
        relatedSections.forEach(sec => { if (sec.title && !cats.includes(sec.title)) cats.push(sec.title); });
        return cats;
    }, [relatedSections]);

    const filteredChannels = useMemo(() => {
        return allChannelsList.filter(ch => {
            const title = (ch.title || ch.name || "").toLowerCase();
            const grp = (ch.group || ch.category || ch.sectionCategory || "").toLowerCase();
            const matchesSearch = !searchQuery || title.includes(searchQuery.toLowerCase()) || grp.includes(searchQuery.toLowerCase());
            const matchesCat = activeTab === "all" || (ch.sectionCategory && ch.sectionCategory.toLowerCase() === activeTab.toLowerCase()) || grp.includes(activeTab.toLowerCase());
            return matchesSearch && matchesCat;
        });
    }, [allChannelsList, searchQuery, activeTab]);

    const handleSelectChannel = (ch) => {
        if (!ch) return;
        const epg = getCurrentProgramInfo(ch.epg);
        const newPoster = ch.image || epg?.immagine || "";
        if (newPoster) {
            setTransPoster(newPoster);
            try { sessionStorage.setItem("nmdz_transition_poster", newPoster); } catch(e) {}
        }
        setChannel(ch);
        setSelectedSource(getInitialSource(ch));
        try {
            sessionStorage.setItem("daznEventChannel", JSON.stringify(ch));
            sessionStorage.setItem("daznCustomChannel", JSON.stringify(ch));
        } catch(e) {}
        const newSlug = getChannelSlug(ch);
        if (newSlug) window.history.replaceState(null, "", `/eventi/${newSlug}`);
        if (typeof window !== "undefined" && window.innerWidth < 880) setIsSidebarOpen(false);
    };

    const handleNextChannel = () => {
        const currentList = filteredChannels.length > 0 ? filteredChannels : allChannelsList;
        if (currentList.length === 0) return;
        const currentKey = getChannelSlug(channel) || channel?.title;
        const curIdx = currentList.findIndex(c => (getChannelSlug(c) || c.title) === currentKey);
        handleSelectChannel(currentList[(curIdx + 1) % currentList.length]);
    };

    const handlePrevChannel = () => {
        const currentList = filteredChannels.length > 0 ? filteredChannels : allChannelsList;
        if (currentList.length === 0) return;
        const currentKey = getChannelSlug(channel) || channel?.title;
        const curIdx = currentList.findIndex(c => (getChannelSlug(c) || c.title) === currentKey);
        handleSelectChannel(currentList[(curIdx - 1 + currentList.length) % currentList.length]);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowUp") { e.preventDefault(); handlePrevChannel(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); handleNextChannel(); }
            else if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlayPause(); }
            else if (e.key === "m") toggleMute();
            else if (e.key === "f") toggleFullscreen();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filteredChannels, allChannelsList, channel]);

    if (isMobile) {
        return (
            <MobileEventoView
                channel={channel}
                selectedSource={selectedSource}
                setSelectedSource={setSelectedSource}
                relatedSections={relatedSections}
                getIframeUrl={() => ""}
            />
        );
    }

    const currentEpg = getCurrentProgramInfo(channel?.epg);
    const coverImg = channel?.image || (currentEpg?.immagine || null);
    const isTestJsonEvent = channel?.isTestJson || (channel?.group && channel?.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(channel?.eventSlug);
    const fallbackLogo = isTestJsonEvent ? "/logos/dazn.png" : (getChannelLogoUrl(channel) || "/logos/dazn.png");
    const displayLogo = channel?.logo || fallbackLogo;

    // Calcolo DVR per la timeline
    const hasDvr = seekRange.end > seekRange.start;
    const dvrDuration = hasDvr ? (seekRange.end - seekRange.start) : duration;
    const dvrCurrent = hasDvr ? Math.max(0, currentTime - seekRange.start) : currentTime;
    const timelinePct = dvrDuration > 0 ? Math.min(100, Math.max(0, (dvrCurrent / dvrDuration) * 100)) : (currentEpg?.percentuale !== undefined ? currentEpg.percentuale : 100);
    const lagSeconds = hasDvr ? Math.max(0, Math.round(seekRange.end - currentTime)) : 0;
    const isLiveNow = !hasDvr || lagSeconds < 15;

    const formatTimeshift = (sec) => {
        if (sec <= 0) return "DIRETTA";
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `-${m}:${String(s).padStart(2, "0")}`;
    };

    return (
        <div
            className={`sky-app ${mounted ? "is-mounted" : "is-mounting"}`}
            onMouseMove={handleMouseMove}
            onClick={handleMouseMove}
        >
            {/* Tasto Minimal Indietro */}
            <button
                type="button"
                className={`sky-back-minimal-btn ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}
                onClick={handleBack}
                title="Torna indietro"
                aria-label="Torna indietro"
            >
                <span className="material-symbols-rounded">arrow_back</span>
            </button>

            <main className="sky-main">
                {/* 1. Fullscreen Shaka Player */}
                <div className="sky-native-player-container">
                    {/* Copertina di preload */}
                    {Boolean(transPoster || coverImg) && !hasStartedPlaying && (
                        <div className="sky-player-backdrop-preload">
                            <img
                                src={transPoster || coverImg}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.55) contrast(1.05)" }}
                            />
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 40%, rgba(3,5,10,0.92) 85%, rgba(1,2,5,0.98) 100%)" }} />
                            {!loading && displayLogo && (
                                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-62%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                                    <div className="evento-preload-logo-box">
                                        <img src={displayLogo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.9)) contrast(1.1)" }} />
                                    </div>
                                    <div className="evento-preload-channel-name">{channel?.title || ""}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Elemento video Shaka */}
                    <video
                        ref={videoRef}
                        className="sky-native-video"
                        autoPlay
                        playsInline
                        onPlaying={() => { setIsVideoPlaying(true); setHasStartedPlaying(true); setIsVideoBuffering(false); }}
                        onWaiting={() => setIsVideoBuffering(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onTimeUpdate={() => {
                            if (!videoRef.current) return;
                            const cur = videoRef.current.currentTime;
                            setCurrentTime(cur);
                            const player = playerRef.current;
                            if (player && player.seekRange) {
                                try {
                                    const sr = player.seekRange();
                                    if (sr && sr.end > sr.start) {
                                        setSeekRange({ start: sr.start, end: sr.end });
                                        setIsLiveStream(player.isLive ? player.isLive() : true);
                                        setIsAtLiveEdge(sr.end - cur < 15);
                                    }
                                } catch(e) {}
                            } else {
                                const d = videoRef.current.duration;
                                if (d && !isNaN(d) && isFinite(d)) { setDuration(d); setIsLiveStream(false); }
                                else { setIsLiveStream(true); }
                            }
                            if (videoRef.current.buffered?.length > 0) {
                                setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
                            }
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
                </div>

                {/* 2. Deck Overlay Inferiore */}
                <div className={`sky-player-overlay-bottom ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}>
                    <div className="sky-player-modern-deck">

                        {/* Header Info */}
                        <div className="sky-player-info-row">
                            <div className="sky-player-meta-left">
                                <div className="sky-modern-logo-box">
                                    <img src={displayLogo} className="sky-modern-logo" alt="" />
                                </div>
                                <div className="sky-player-meta-details">
                                    <div className="sky-player-tag-row">
                                        <div className="sky-channel-name-badge">
                                            <span className="sky-channel-name-text">{channel?.title || "Evento"}</span>
                                        </div>
                                        <span className="live-badge"><span className="dot"></span>LIVE</span>
                                        <span className="now-group">{channel?.group || channel?.category || "EVENTI"}</span>
                                        {channel?.ora && (
                                            <span className="now-expiry-badge">
                                                <i className="fa-regular fa-clock"></i>
                                                <span>Ore {channel.ora}</span>
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="sky-player-big-title">
                                        {currentEpg?.titolo || channel?.title || "Diretta Evento"}
                                    </h2>
                                    <div className="sky-player-epg-subtitle">
                                        {currentEpg?.oraInizio ? `${currentEpg.oraInizio} • ${channel?.description || "Trasmissione in diretta"}` : (channel?.description || channel?.group || "Trasmissione in diretta")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline YT-style con DVR */}
                        <div
                            ref={timelineRef}
                            className="sky-player-timeline-wrapper"
                            onClick={handleTimelineClick}
                            title={hasDvr ? "Timeline DVR — clicca per spostarti" : "Timeline diretta"}
                        >
                            <div className="sky-player-timeline-track">
                                <div className="sky-player-timeline-buffer" style={{ width: hasDvr ? "100%" : `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%` }} />
                                <div className="sky-player-timeline-fill" style={{ width: `${timelinePct}%` }} />
                                <div className="sky-player-timeline-thumb" style={{ left: `${timelinePct}%` }} />
                            </div>
                            <div className="sky-player-timeline-labels">
                                <span>
                                    {hasDvr ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: "0.75rem", color: "#00e59b" }}></i>
                                            {isLiveNow ? "Inizio buffer (-2h)" : formatTimeshift(lagSeconds)}
                                        </span>
                                    ) : (
                                        currentEpg?.oraInizio || channel?.ora || "In onda ora"
                                    )}
                                </span>
                                <div>
                                    {hasDvr && !isLiveNow ? (
                                        <button
                                            type="button"
                                            className="sky-timeline-live-btn"
                                            onClick={(e) => { e.stopPropagation(); handleGoLive(); }}
                                        >
                                            <span className="live-dot-pulse" />
                                            <span>TORNA A LIVE ({formatTimeshift(lagSeconds)})</span>
                                        </button>
                                    ) : (
                                        <span style={{ color: "#e30a17", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#e30a17" }} />
                                            DIRETTA LIVE
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Barra dei Controlli */}
                        <div className="sky-player-controls-bar">
                            {/* Sinistra: Play/Pause, Mute/Volume, Switch Sorgente */}
                            <div className="sky-controls-group-left">
                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={togglePlayPause}
                                    title={isVideoPlaying ? "Pausa (k)" : "Riproduci (k)"}
                                >
                                    <span className="material-symbols-rounded">{isVideoPlaying ? "pause" : "play_arrow"}</span>
                                </button>

                                <div className="sky-volume-control">
                                    <button type="button" className="sky-modern-btn icon-only" onClick={toggleMute} title={isMuted ? "Attiva audio (m)" : "Silenzia (m)"}>
                                        <span className="material-symbols-rounded">
                                            {isMuted || volume === 0 ? "volume_off" : volume < 0.5 ? "volume_down" : "volume_up"}
                                        </span>
                                    </button>
                                    <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="sky-volume-slider" />
                                </div>

                                {/* Switch Sorgente (Standard vs WARP) - Mostra solo i flussi reali dell'evento */}
                                {(() => {
                                    const realSources = getNormalizedSources(channel);
                                    if (realSources.length <= 1) return null;
                                    return (
                                        <div className="event-sources-deck">
                                            {realSources.map((s, idx) => {
                                                const isSelected = selectedSource?.url === s.url && selectedSource?.isWarp === s.isWarp;
                                                return (
                                                    <button
                                                        key={s.name + idx}
                                                        type="button"
                                                        className={`event-source-deck-btn ${isSelected ? "active" : ""}`}
                                                        onClick={() => setSelectedSource(s)}
                                                        title={`Passa a sorgente ${s.name}`}
                                                    >
                                                        {s.isWarp ? (
                                                            <i className="fa-solid fa-shield-halved" style={{ color: isSelected ? "#000000" : "#f38020" }}></i>
                                                        ) : (
                                                            <i className="fa-solid fa-bolt"></i>
                                                        )}
                                                        <span>{s.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Destra: Guida TV, Impostazioni Video, Canali, Zapping, Fullscreen */}
                            <div className="sky-controls-group-right">
                                <button type="button" className="sky-modern-btn" onClick={() => setIsGuidaOpen(true)} title="Guida TV EPG">
                                    <span className="material-symbols-rounded">calendar_today</span>
                                    <span>Guida TV</span>
                                </button>

                                {/* Popover Impostazioni Video Stream */}
                                <div className="sky-settings-popover-wrapper">
                                    <button
                                        type="button"
                                        className={`sky-modern-btn icon-only ${isVideoSettingsOpen ? "active" : ""}`}
                                        onClick={() => { setIsVideoSettingsOpen(prev => !prev); refreshTracks(); }}
                                        title="Impostazioni Video (Qualità, Audio, Sottotitoli)"
                                    >
                                        <span className="material-symbols-rounded">tune</span>
                                    </button>

                                    {isVideoSettingsOpen && (
                                        <div className="sky-video-settings-menu">
                                            <div className="sky-settings-menu-header">
                                                <span>Impostazioni Stream</span>
                                                <button type="button" onClick={() => setIsVideoSettingsOpen(false)} className="sky-settings-menu-close">
                                                    <span className="material-symbols-rounded">close</span>
                                                </button>
                                            </div>

                                            <div className="sky-settings-menu-section">
                                                <div className="sky-settings-section-title">
                                                    <span className="material-symbols-rounded">hd</span>
                                                    <span>Qualità Video</span>
                                                </div>
                                                <div className="sky-settings-options-list">
                                                    <button type="button" className={`sky-settings-option ${isAbrEnabled ? "selected" : ""}`} onClick={() => handleSelectQuality("auto")}>
                                                        <span>Auto (Adattiva)</span>
                                                        {isAbrEnabled && <span className="material-symbols-rounded check-icon">check</span>}
                                                    </button>
                                                    {videoQualities.map(q => (
                                                        <button key={q.id || q.label} type="button" className={`sky-settings-option ${!isAbrEnabled && q.active ? "selected" : ""}`} onClick={() => handleSelectQuality(q)}>
                                                            <span>{q.label}</span>
                                                            {!isAbrEnabled && q.active && <span className="material-symbols-rounded check-icon">check</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {audioTracks.length > 0 && (
                                                <div className="sky-settings-menu-section">
                                                    <div className="sky-settings-section-title">
                                                        <span className="material-symbols-rounded">audiotrack</span>
                                                        <span>Traccia Audio</span>
                                                    </div>
                                                    <div className="sky-settings-options-list">
                                                        {audioTracks.map(a => (
                                                            <button key={a.id || a.language} type="button" className={`sky-settings-option ${selectedAudioLang === a.language ? "selected" : ""}`} onClick={() => handleSelectAudio(a.language)}>
                                                                <span>{a.language.toUpperCase()} {a.role ? `(${a.role})` : ""}</span>
                                                                {selectedAudioLang === a.language && <span className="material-symbols-rounded check-icon">check</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {textTracks.length > 0 && (
                                                <div className="sky-settings-menu-section">
                                                    <div className="sky-settings-section-title">
                                                        <span className="material-symbols-rounded">subtitles</span>
                                                        <span>Sottotitoli</span>
                                                    </div>
                                                    <div className="sky-settings-options-list">
                                                        <button type="button" className={`sky-settings-option ${!isTextTrackEnabled ? "selected" : ""}`} onClick={() => handleToggleSubtitles("off")}>
                                                            <span>Disattivati</span>
                                                            {!isTextTrackEnabled && <span className="material-symbols-rounded check-icon">check</span>}
                                                        </button>
                                                        {textTracks.map(t => (
                                                            <button key={t.id || t.language} type="button" className={`sky-settings-option ${isTextTrackEnabled && selectedTextLang === t.language ? "selected" : ""}`} onClick={() => handleToggleSubtitles(t)}>
                                                                <span>{t.language.toUpperCase()}</span>
                                                                {isTextTrackEnabled && selectedTextLang === t.language && <span className="material-symbols-rounded check-icon">check</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="sky-settings-menu-footer">
                                                <button type="button" className="sky-settings-ext-btn" onClick={() => { setIsVideoSettingsOpen(false); setIsSettingsOpen(true); }}>
                                                    <span className="material-symbols-rounded">settings</span>
                                                    <span>Impostazioni Tecniche Generali</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button type="button" className="sky-channels-trigger-btn" onClick={() => setIsSidebarOpen(true)} title="Mostra tutti gli eventi e canali correlati">
                                    <i className="fas fa-list-ul" />
                                    <span>Canali</span>
                                </button>

                                <div className="zap-controls">
                                    <button type="button" className="zap-btn" onClick={handlePrevChannel} title="Evento precedente (↑)" aria-label="Evento precedente">
                                        <span className="material-symbols-rounded">keyboard_arrow_up</span>
                                    </button>
                                    <button type="button" className="zap-btn" onClick={handleNextChannel} title="Evento successivo (↓)" aria-label="Evento successivo">
                                        <span className="material-symbols-rounded">keyboard_arrow_down</span>
                                    </button>
                                </div>

                                <button type="button" className="sky-modern-btn icon-only" onClick={toggleFullscreen} title="Schermo intero (f)">
                                    <span className="material-symbols-rounded">fullscreen</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Drawer Canali Correlati */}
                <div className={`sky-sidebar-backdrop ${isSidebarOpen ? "is-open" : ""}`} onClick={() => setIsSidebarOpen(false)} />

                <aside className={`sky-sidebar-popup ${isSidebarOpen ? "is-open" : ""}`}>
                    <div className="sky-sidebar-header">
                        <h3 className="sky-sidebar-header-title">
                            <i className="fas fa-tv" style={{ color: "#00e59b" }} />
                            <span>Dirette & Canali</span>
                        </h3>
                        <button type="button" className="sky-sidebar-close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Chiudi">
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>

                    <div className="sky-search">
                        <span className="material-symbols-rounded">search</span>
                        <input type="text" placeholder="Cerca evento o canale..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    <div className="sky-filters">
                        <button type="button" className={`sky-filter-btn ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")} title="Tutti">
                            <i className="fas fa-th-large"></i>
                        </button>
                        {availableCategories.map(cat => {
                            let icon = "fa-trophy";
                            const cl = cat.toLowerCase();
                            if (cl.includes("dazn")) icon = "fa-bolt";
                            else if (cl.includes("eurosport")) icon = "fa-flag-checkered";
                            else if (cl.includes("tennis")) icon = "fa-baseball";
                            else if (cl.includes("calcio") || cl.includes("serie a")) icon = "fa-futbol";
                            else if (cl.includes("basket")) icon = "fa-basketball";
                            else if (cl.includes("motori") || cl.includes("f1")) icon = "fa-car";
                            else icon = "fa-tv";
                            return (
                                <button key={cat} type="button" className={`sky-filter-btn ${activeTab === cat ? "active" : ""}`} onClick={() => setActiveTab(cat)} title={cat}>
                                    <i className={`fas ${icon}`}></i>
                                </button>
                            );
                        })}
                    </div>

                    <div className="sky-list">
                        {filteredChannels.length === 0 ? (
                            <div className="sky-empty">Nessun canale o evento trovato.</div>
                        ) : (
                            filteredChannels.map((ch, idx) => {
                                const currentKey = getChannelSlug(channel) || channel?.title;
                                const itemKey = getChannelSlug(ch) || ch.title;
                                const active = currentKey && itemKey && (currentKey === itemKey || matchSlug(ch, currentKey));
                                const epg = getCurrentProgramInfo(ch.epg);
                                const itemPoster = ch.image || epg?.immagine || null;
                                const isItemTestJson = ch.isTestJson || (ch.group && ch.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")) || Boolean(ch.eventSlug);
                                const itemLogo = ch.logo || (isItemTestJson ? "/logos/dazn.png" : getChannelLogoUrl(ch));

                                return (
                                    <div
                                        key={(ch.title || ch.name) + idx}
                                        className={`sky-item ${active ? "active" : ""}`}
                                        onClick={() => handleSelectChannel(ch)}
                                    >
                                        <div className="sky-item-thumb-box">
                                            {itemPoster && <img src={itemPoster} className="sky-item-poster-bg" alt="" />}
                                            <img src={itemLogo || "/logos/dazn.png"} className="sky-item-logo-overlay" alt="" />
                                        </div>
                                        <div className="sky-item-info">
                                            <div className="sky-item-header-row">
                                                <div className="sky-item-name">{ch.title || ch.name}</div>
                                                {active && <span className="sky-item-live">LIVE</span>}
                                            </div>
                                            <div className="sky-item-epg">
                                                {ch.ora ? (
                                                    <span className="sky-item-epg-time">Ore {ch.ora}</span>
                                                ) : epg?.oraInizio ? (
                                                    <span className="sky-item-epg-time">{epg.oraInizio}</span>
                                                ) : null}
                                                <span className="sky-item-epg-title">{ch.group || ch.sectionCategory || epg?.titolo || "In diretta"}</span>
                                            </div>
                                            {epg && epg.percentuale !== undefined && (
                                                <div className="sky-item-progress">
                                                    <div className="sky-item-progress-bar" style={{ width: `${epg.percentuale}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            </main>

            <GuidaTvModal isOpen={isGuidaOpen} onClose={() => setIsGuidaOpen(false)} />
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </div>
    );
}
