"use client";
import React, { useState, useEffect, useRef, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import MobileSkyView from "@/components/MobileSkyView";
import { useDeviceState } from "@/components/DeviceProvider";
import { fetchSecureJson } from "@/lib/crypto";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug, getChannelSlug, matchSlug } from "@/lib/slug";
import { getTechSettings } from "@/lib/settings";
import { loadShakaScript, parseClearKeys } from "@/lib/shakaLoader";
import GuidaTvModal from "@/components/GuidaTvModal";
import SettingsModal from "@/components/SettingsModal";

const DEFAULT_EXT_ID = "opmeopcambhfimffbomjgemehjkbbmji";

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

function buildExtUrl(ch) {
    const baseUrl = (ch?.url || ch?.mpd || "").trim();
    if (!baseUrl) return "";
    const tech = getTechSettings();
    const extId = tech.extensionId || DEFAULT_EXT_ID;
    const isTsStream = baseUrl.toLowerCase().includes(".ts");
    if (isTsStream) {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://next-zeta-smoky.vercel.app";
        const m3uUrl = `${origin}/api/m3u?url=${encodeURIComponent(baseUrl)}&title=${encodeURIComponent(ch.name || "Sky Sport F1")}`;
        return `chrome-extension://${extId}/iptv/player.html#${m3uUrl}`;
    }
    const extPrefix = `chrome-extension://${extId}/pages/player.html#`;

    const parts = [];
    const rawKey = ch.kid_key || "";
    if (rawKey && rawKey.includes(":")) {
        const ckObj = {};
        const pairs = rawKey.split(",");
        pairs.forEach(pair => {
            const p = pair.split(":");
            if (p.length === 2 && p[0].trim() && p[1].trim()) {
                ckObj[p[0].trim()] = p[1].trim();
            }
        });
        if (Object.keys(ckObj).length > 0) {
            try { parts.push("ck=" + btoa(JSON.stringify(ckObj))); } catch(e) {}
        }
    }
    const uaVal = tech.customUserAgent || "";
    if (uaVal) {
        try { parts.push("headers=" + btoa(JSON.stringify({ "User-Agent": uaVal }))); } catch(e) {}
    }
    const sep = baseUrl.includes("?") ? "&" : "?";
    return extPrefix + baseUrl + (parts.length > 0 ? sep + parts.join("&") : "");
}

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

    // Stati Shaka Player Nativo
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [needsUnmute, setNeedsUnmute] = useState(false);
    const [volume, setVolume] = useState(1);

    // Timeline fluida interattiva e DVR Timeshift (2 ore)
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLiveStream, setIsLiveStream] = useState(true);
    const [bufferedEnd, setBufferedEnd] = useState(0);
    const [seekRange, setSeekRange] = useState({ start: 0, end: 0 });
    const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
    const timelineRef = useRef(null);

    // Menu Impostazioni Video Stream (Qualità, Audio, Sottotitoli)
    const [isVideoSettingsOpen, setIsVideoSettingsOpen] = useState(false);
    const [videoQualities, setVideoQualities] = useState([]); // [{ id, height, width, bandwidth, active }]
    const [isAbrEnabled, setIsAbrEnabled] = useState(true);
    const [audioTracks, setAudioTracks] = useState([]);
    const [selectedAudioLang, setSelectedAudioLang] = useState("");
    const [textTracks, setTextTracks] = useState([]);
    const [isTextTrackEnabled, setIsTextTrackEnabled] = useState(false);
    const [selectedTextLang, setSelectedTextLang] = useState("");

    // Modali Guida TV e Impostazioni Tecniche generali
    const [isGuidaOpen, setIsGuidaOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Stato Drawer Canali a destra (popup nel player)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Controlli Overlay (auto-hide su inattività mouse)
    const [isUserActive, setIsUserActive] = useState(true);
    const idleTimerRef = useRef(null);

    const handleMouseMove = () => {
        setIsUserActive(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            if (!isVideoSettingsOpen) {
                setIsUserActive(false);
            }
        }, 4000);
    };

    useEffect(() => {
        setMounted(true);
        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, []);

    // Helper per aggiornare tracce video/audio/sottotitoli da Shaka
    const refreshTracks = (playerInstance) => {
        const player = playerInstance || playerRef.current;
        if (!player) return;
        try {
            const tracks = player.getVariantTracks() || [];
            // Raggruppa varianti per risoluzione
            const resMap = new Map();
            tracks.forEach(t => {
                if (t.height) {
                    const label = `${t.height}p`;
                    if (!resMap.has(label) || (t.bandwidth > resMap.get(label).bandwidth)) {
                        resMap.set(label, {
                            id: t.id,
                            label: label,
                            height: t.height,
                            width: t.width,
                            bandwidth: t.bandwidth,
                            active: t.active
                        });
                    }
                }
            });
            const list = Array.from(resMap.values()).sort((a, b) => b.height - a.height);
            setVideoQualities(list);

            const abrConf = player.getConfiguration();
            setIsAbrEnabled(abrConf?.abr?.enabled ?? true);

            // Audio tracks
            const audioLangs = player.getAudioLanguagesAndRoles ? player.getAudioLanguagesAndRoles() : [];
            const audioList = audioLangs.map((a, i) => ({
                id: i,
                language: a.language || "Principale",
                role: a.role || ""
            }));
            setAudioTracks(audioList);
            if (player.getAudioLanguages && player.getAudioLanguages().length > 0) {
                setSelectedAudioLang(player.getAudioLanguages()[0]);
            }

            // Text / Subtitles
            const textTrks = player.getTextTracks() || [];
            setTextTracks(textTrks);
            setIsTextTrackEnabled(player.isTextTrackVisible ? player.isTextTrackVisible() : false);
        } catch (e) {
            console.warn("Errore lettura tracce:", e);
        }
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
                const allVariants = player.getVariantTracks();
                const matched = allVariants.find(v => v.id === track.id || v.height === track.height);
                if (matched) {
                    player.selectVariantTrack(matched, /* clearBuffer */ false);
                }
            }
            refreshTracks(player);
        } catch (e) {
            console.error("Errore selezione traccia video:", e);
        }
    };

    const handleSelectAudio = (lang) => {
        const player = playerRef.current;
        if (!player) return;
        try {
            player.selectAudioLanguage(lang);
            setSelectedAudioLang(lang);
            refreshTracks(player);
        } catch (e) {
            console.error("Errore selezione audio:", e);
        }
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
                if (trackOrDisable && trackOrDisable.language) {
                    player.selectTextLanguage(trackOrDisable.language);
                    setSelectedTextLang(trackOrDisable.language);
                }
            }
        } catch (e) {
            console.error("Errore gestione sottotitoli:", e);
        }
    };

    // Resetta stati video al cambio canale per transizione fluida
    useEffect(() => {
        setIframeLoaded(false);
        setIsVideoBuffering(true);
        setIsVideoPlaying(false);
        setHasStartedPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setSeekRange({ start: 0, end: 0 });
        setIsAtLiveEdge(true);
        setIsVideoSettingsOpen(false);
        setIsUserActive(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setIsUserActive(false);
        }, 4000);
    }, [selectedChannel]);

    // Inizializzazione e caricamento Shaka Player nativo per il canale Sky selezionato
    useEffect(() => {
        if (!selectedChannel || isMobile) return;
        let isCancelled = false;

        let streamUrl = (selectedChannel.url || selectedChannel.mpd || "").trim();
        let rawKey = selectedChannel.kid_key || selectedChannel.key || "";
        let rawUa = selectedChannel.ua || "";
        let daznToken = selectedChannel.dazn_token || "";

        if (Array.isArray(selectedChannel.sources) && selectedChannel.sources.length > 0) {
            const firstValid = selectedChannel.sources.find(s => s.url || s.mpd) || selectedChannel.sources[0];
            if (firstValid) {
                if (!streamUrl) streamUrl = (firstValid.url || firstValid.mpd || "").trim();
                if (!rawKey) rawKey = firstValid.kid_key || firstValid.key || "";
                if (!rawUa) rawUa = firstValid.ua || "";
                if (!daznToken) daznToken = firstValid.dazn_token || "";
            }
        }

        if (!daznToken && streamUrl.includes("@eyJ")) {
            const tm = streamUrl.match(/@([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)/);
            if (tm) daznToken = tm[1];
        }

        async function initShaka() {
            try {
                const shaka = await loadShakaScript();
                if (isCancelled || !shaka || !videoRef.current) return;

                if (!shaka.Player.isBrowserSupported()) {
                    console.error("Shaka Player non supportato su questo browser");
                    return;
                }

                if (playerRef.current) {
                    try { await playerRef.current.destroy(); } catch(e) {}
                    playerRef.current = null;
                }

                const player = new shaka.Player(videoRef.current);
                playerRef.current = player;

                // Gestione filtri MIME e rimozione nodi Widevine per forzare ClearKey
                player.getNetworkingEngine().registerResponseFilter((type, response) => {
                    if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
                        if (!response.headers["content-type"] || response.headers["content-type"] === "text/plain") {
                            response.headers["content-type"] = "application/dash+xml";
                        }
                        try {
                            let xmlStr = shaka.util.StringUtils.fromUTF8(response.data);
                            xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                            xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                            xmlStr = xmlStr.replace(/<ContentProtection[^>]+urn:uuid:5e629af5-38da-4063-8977-97ffbd9902d4[^>]*>([\s\S]*?<\/ContentProtection>)?/gi, '');
                            response.data = shaka.util.StringUtils.toUTF8(xmlStr);
                        } catch (e) {}
                    }
                });

                // Iniezione headers di sistema
                const tech = getTechSettings();
                const effectiveUa = rawUa || tech.customUserAgent || "";
                player.getNetworkingEngine().registerRequestFilter((type, request) => {
                    if (effectiveUa) request.headers["User-Agent"] = effectiveUa;
                    if (daznToken) {
                        request.headers["dazn-token"] = daznToken;
                        request.headers["referer"] = "https://www.dazn.com/";
                        request.headers["origin"] = "https://www.dazn.com";
                    }
                });

                const clearKeys = parseClearKeys(rawKey);
                player.configure({
                    drm: {
                        clearKeys: clearKeys,
                        preferredKeySystems: ["org.w3.clearkey", "webkit-org.w3.clearkey"],
                        servers: {}
                    },
                    streaming: {
                        bufferingGoal: 15,
                        rebufferingGoal: 4,
                        bufferBehind: 60,
                        lowLatencyMode: false,
                        alwaysStreamFullSegments: true,
                        retryParameters: {
                            maxAttempts: 6,
                            baseDelay: 1000,
                            backoffFactor: 1.5,
                            fuzzFactor: 0.5,
                            timeout: 10000
                        }
                    },
                    manifest: {
                        dash: {
                            ignoreMinBufferTime: true
                        },
                        retryParameters: {
                            maxAttempts: 6,
                            baseDelay: 1000,
                            backoffFactor: 1.5,
                            fuzzFactor: 0.5,
                            timeout: 10000
                        }
                    },
                    abr: {
                        enabled: true
                    }
                });

                // Ascolta eventi player
                player.addEventListener("buffering", (ev) => {
                    setIsVideoBuffering(ev.buffering);
                });

                player.addEventListener("adaptation", () => {
                    refreshTracks(player);
                });

                player.addEventListener("trackschanged", () => {
                    refreshTracks(player);
                });

                player.addEventListener("error", (err) => {
                    console.error("Shaka error:", err);
                    if (playerRef.current && !err.detail?.severity) {
                        try { playerRef.current.retryStreaming(); } catch(e) {}
                    }
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
                        setNeedsUnmute(false);
                    } catch (playErr) {
                        if (videoRef.current) {
                            videoRef.current.muted = true;
                            setIsMuted(true);
                            setNeedsUnmute(true);
                            await videoRef.current.play().catch(() => {});
                        }
                    }
                }
            } catch (err) {
                console.error("Errore inizializzazione Shaka per Sky:", err);
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
    }, [selectedChannel, isMobile]);

    const handleUnmute = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (videoRef.current) {
            videoRef.current.muted = false;
            setIsMuted(false);
            setNeedsUnmute(false);
        }
    };

    const togglePlayPause = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
        } else {
            videoRef.current.pause();
        }
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        const newMuted = !videoRef.current.muted;
        videoRef.current.muted = newMuted;
        setIsMuted(newMuted);
        if (!newMuted) setNeedsUnmute(false);
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
            setIsMuted(val === 0);
            if (val > 0) setNeedsUnmute(false);
        }
    };

    const handleTimelineClick = (e) => {
        if (!timelineRef.current || !videoRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        if (seekRange.end > seekRange.start) {
            // Stream Live con timeshift DVR (es. 2 ore di buffer)
            const targetTime = seekRange.start + pos * (seekRange.end - seekRange.start);
            videoRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
            setIsAtLiveEdge(seekRange.end - targetTime < 15);
        } else if (!isLiveStream && duration > 0) {
            // Stream VOD tradizionale
            const seekTarget = pos * duration;
            videoRef.current.currentTime = seekTarget;
            setCurrentTime(seekTarget);
        }
    };

    const handleGoLive = () => {
        if (!videoRef.current) return;
        if (seekRange.end > seekRange.start) {
            // Cerca a 2 secondi prima della fine del seekRange per garantire stabilità
            const livePoint = Math.max(seekRange.start, seekRange.end - 3);
            videoRef.current.currentTime = livePoint;
            setCurrentTime(livePoint);
            setIsAtLiveEdge(true);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
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

                const targetKey = chParam || storedTarget;

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
                            if (prevSelected.url === stillExists.url && prevSelected.kid_key === stillExists.kid_key) {
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

    // Scorciatoie tastiera per cambiare canale su PC (Tasti Freccia Su e Freccia Giù)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === "ArrowUp") {
                e.preventDefault();
                handlePrevChannel();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                handleNextChannel();
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
                selectedChannel={selectedChannel}
                setSelectedChannel={setSelectedChannel}
                currentSource={currentSource}
                setCurrentSource={setCurrentSource}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                availableGroups={availableGroups}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
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
            className={`sky-app ${mounted ? "is-mounted" : "is-mounting"}`}
            onMouseMove={handleMouseMove}
            onClick={handleMouseMove}
        >
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

            {/* Layout Principale Fullscreen 100vw x 100vh */}
            <main className="sky-main">
                {/* 1. Fullscreen Native Player Shaka */}
                <div className="sky-native-player-container">
                    {/* Backdrop di preload per eliminare scatti prima dell'avvio: sparisce irreversibilmente al primo frame */}
                    {Boolean(transPoster || currentEpg?.immagine || selectedChannel?.image) && !hasStartedPlaying && (
                        <div className="sky-player-backdrop-preload">
                            <img
                                src={transPoster || currentEpg?.immagine || selectedChannel?.image}
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

                    {/* Elemento video controllato da Shaka Player */}
                    <video
                        ref={videoRef}
                        className="sky-native-video"
                        autoPlay
                        playsInline
                        onPlaying={() => {
                            setIsVideoPlaying(true);
                            setHasStartedPlaying(true);
                            setIsVideoBuffering(false);
                        }}
                        onWaiting={() => setIsVideoBuffering(true)}
                        onTimeUpdate={() => {
                            if (videoRef.current) {
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
                                    } catch (e) {}
                                } else {
                                    const d = videoRef.current.duration;
                                    if (d && !isNaN(d) && isFinite(d)) {
                                        setDuration(d);
                                        setIsLiveStream(false);
                                    } else {
                                        setIsLiveStream(true);
                                    }
                                }

                                if (videoRef.current.buffered && videoRef.current.buffered.length > 0) {
                                    setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
                                }
                            }
                        }}
                    />

                    {/* Overlay Vignetta cinematografica per contrasto UI */}
                    <div className={`sky-player-vignette ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`} />

                    {/* Spinner di caricamento centrale conforme allo screenshot */}
                    {(isVideoBuffering || loading || !hasStartedPlaying) && (
                        <div className="sky-native-loader">
                            <div className="sky-spinner" style={{ width: "52px", height: "52px", borderWidth: "3.5px" }} />
                        </div>
                    )}
                </div>

                {/* 2. Deck Overlay In Basso: Design pulito stile Sky Glass / Apple TV senza scatola ovale gigante */}
                <div className={`sky-player-overlay-bottom ${!isUserActive && !isSidebarOpen ? "idle-hidden" : ""}`}>
                    <div className="sky-player-modern-deck">
                        {/* Header Info: Logo con badge ad alto contrasto, Tag Live, Nome Canale Chiarissimo, Titolo e Scadenza */}
                        <div className="sky-player-info-row">
                            <div className="sky-player-meta-left">
                                <div className="sky-modern-logo-box">
                                    <img
                                        src={selectedChannel?.logo || "/logos/sksport.png"}
                                        className="sky-modern-logo"
                                        alt=""
                                    />
                                </div>
                                <div className="sky-player-meta-details">
                                    <div className="sky-player-tag-row">
                                        <div className="sky-channel-name-badge">
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
                                    <h2 className="sky-player-big-title">
                                        {currentEpg?.titolo || selectedChannel?.name || "Diretta TV"}
                                    </h2>
                                    <div className="sky-player-epg-subtitle">
                                        {currentEpg ? `${currentEpg.ora} ${currentEpg.next ? `• A seguire: ${currentEpg.next}` : ""}` : (selectedChannel?.group || "Diretta streaming")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Fluida e Cliccabile con supporto DVR Timeshift 2 Ore */}
                        {(() => {
                            const hasDvr = seekRange.end > seekRange.start;
                            const dvrDuration = hasDvr ? (seekRange.end - seekRange.start) : duration;
                            const dvrCurrent = hasDvr ? Math.max(0, currentTime - seekRange.start) : currentTime;
                            const pct = dvrDuration > 0 ? Math.min(100, Math.max(0, (dvrCurrent / dvrDuration) * 100)) : (currentEpg ? currentEpg.percent : 100);
                            
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
                                    ref={timelineRef}
                                    className="sky-player-timeline-wrapper"
                                    onClick={handleTimelineClick}
                                    title={hasDvr ? "Timeline DVR (indietro fino a 2 ore) - Clicca per spostarti nel tempo" : "Timeline"}
                                >
                                    <div className="sky-player-timeline-track">
                                        <div
                                            className="sky-player-timeline-buffer"
                                            style={{
                                                width: hasDvr ? "100%" : `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%`
                                            }}
                                        />
                                        <div
                                            className="sky-player-timeline-fill"
                                            style={{ width: `${pct}%` }}
                                        />
                                        <div
                                            className="sky-player-timeline-thumb"
                                            style={{ left: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="sky-player-timeline-labels">
                                        <span>
                                            {hasDvr ? (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                    <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: "0.75rem", color: "#00e59b" }}></i>
                                                    {isLiveNow ? "Inizio buffer (-2h)" : formatTimeshift(lagSeconds)}
                                                </span>
                                            ) : (
                                                currentEpg?.ora || "In onda ora"
                                            )}
                                        </span>
                                        <div>
                                            {hasDvr && !isLiveNow ? (
                                                <button
                                                    type="button"
                                                    className="sky-timeline-live-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleGoLive();
                                                    }}
                                                    title="Salta al momento in diretta"
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
                            );
                        })()}

                        {/* Barra dei Controlli Inferiori Integrati */}
                        <div className="sky-player-controls-bar">
                            {/* Gruppo Sinistra: Play/Pause, Mute/Volume */}
                            <div className="sky-controls-group-left">
                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={togglePlayPause}
                                    title={isVideoPlaying ? "Pausa" : "Riproduci"}
                                >
                                    <span className="material-symbols-rounded">
                                        {isVideoPlaying ? "pause" : "play_arrow"}
                                    </span>
                                </button>

                                <div className="sky-volume-control">
                                    <button
                                        type="button"
                                        className="sky-modern-btn icon-only"
                                        onClick={toggleMute}
                                        title={isMuted ? "Attiva audio" : "Muta audio"}
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
                                        className="sky-volume-slider"
                                        title="Regola volume"
                                    />
                                </div>
                            </div>

                            {/* Gruppo Destra: Guida TV, Impostazioni Video Stream, Impostazioni Tecniche, Canali, Zapping, Fullscreen */}
                            <div className="sky-controls-group-right">
                                <button
                                    type="button"
                                    className="sky-modern-btn"
                                    onClick={() => setIsGuidaOpen(true)}
                                    title="Apri Guida TV EPG"
                                >
                                    <span className="material-symbols-rounded">calendar_today</span>
                                    <span>Guida TV</span>
                                </button>

                                {/* Popup Impostazioni Video Stream (Qualità, Audio, Sottotitoli) */}
                                <div className="sky-settings-popover-wrapper">
                                    <button
                                        type="button"
                                        className={`sky-modern-btn icon-only ${isVideoSettingsOpen ? "active" : ""}`}
                                        onClick={() => {
                                            setIsVideoSettingsOpen(prev => !prev);
                                            refreshTracks();
                                        }}
                                        title="Impostazioni Video (Qualità, Audio, Sottotitoli)"
                                    >
                                        <span className="material-symbols-rounded">tune</span>
                                    </button>

                                    {isVideoSettingsOpen && (
                                        <div className="sky-video-settings-menu">
                                            <div className="sky-settings-menu-header">
                                                <span>Impostazioni Stream</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsVideoSettingsOpen(false)}
                                                    className="sky-settings-menu-close"
                                                >
                                                    <span className="material-symbols-rounded">close</span>
                                                </button>
                                            </div>

                                            {/* Sezione Qualità Video */}
                                            <div className="sky-settings-menu-section">
                                                <div className="sky-settings-section-title">
                                                    <span className="material-symbols-rounded">hd</span>
                                                    <span>Qualità Video</span>
                                                </div>
                                                <div className="sky-settings-options-list">
                                                    <button
                                                        type="button"
                                                        className={`sky-settings-option ${isAbrEnabled ? "selected" : ""}`}
                                                        onClick={() => handleSelectQuality("auto")}
                                                    >
                                                        <span>Auto (Adattiva)</span>
                                                        {isAbrEnabled && <span className="material-symbols-rounded check-icon">check</span>}
                                                    </button>
                                                    {videoQualities.map(q => (
                                                        <button
                                                            key={q.id || q.label}
                                                            type="button"
                                                            className={`sky-settings-option ${!isAbrEnabled && q.active ? "selected" : ""}`}
                                                            onClick={() => handleSelectQuality(q)}
                                                        >
                                                            <span>{q.label}</span>
                                                            {!isAbrEnabled && q.active && <span className="material-symbols-rounded check-icon">check</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Sezione Tracce Audio */}
                                            {audioTracks.length > 0 && (
                                                <div className="sky-settings-menu-section">
                                                    <div className="sky-settings-section-title">
                                                        <span className="material-symbols-rounded">audiotrack</span>
                                                        <span>Traccia Audio</span>
                                                    </div>
                                                    <div className="sky-settings-options-list">
                                                        {audioTracks.map(a => (
                                                            <button
                                                                key={a.id || a.language}
                                                                type="button"
                                                                className={`sky-settings-option ${selectedAudioLang === a.language ? "selected" : ""}`}
                                                                onClick={() => handleSelectAudio(a.language)}
                                                            >
                                                                <span>{a.language.toUpperCase()} {a.role ? `(${a.role})` : ""}</span>
                                                                {selectedAudioLang === a.language && <span className="material-symbols-rounded check-icon">check</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Sezione Sottotitoli */}
                                            {textTracks.length > 0 && (
                                                <div className="sky-settings-menu-section">
                                                    <div className="sky-settings-section-title">
                                                        <span className="material-symbols-rounded">subtitles</span>
                                                        <span>Sottotitoli</span>
                                                    </div>
                                                    <div className="sky-settings-options-list">
                                                        <button
                                                            type="button"
                                                            className={`sky-settings-option ${!isTextTrackEnabled ? "selected" : ""}`}
                                                            onClick={() => handleToggleSubtitles("off")}
                                                        >
                                                            <span>Disattivati</span>
                                                            {!isTextTrackEnabled && <span className="material-symbols-rounded check-icon">check</span>}
                                                        </button>
                                                        {textTracks.map(t => (
                                                            <button
                                                                key={t.id || t.language}
                                                                type="button"
                                                                className={`sky-settings-option ${isTextTrackEnabled && selectedTextLang === t.language ? "selected" : ""}`}
                                                                onClick={() => handleToggleSubtitles(t)}
                                                            >
                                                                <span>{t.language.toUpperCase()}</span>
                                                                {isTextTrackEnabled && selectedTextLang === t.language && <span className="material-symbols-rounded check-icon">check</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="sky-settings-menu-footer">
                                                <button
                                                    type="button"
                                                    className="sky-settings-ext-btn"
                                                    onClick={() => {
                                                        setIsVideoSettingsOpen(false);
                                                        setIsSettingsOpen(true);
                                                    }}
                                                >
                                                    <span className="material-symbols-rounded">settings</span>
                                                    <span>Impostazioni Tecniche Generali</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    className="sky-channels-trigger-btn"
                                    onClick={() => setIsSidebarOpen(true)}
                                    title="Apri Elenco Canali"
                                >
                                    <i className="fas fa-list-ul" />
                                    <span>Canali</span>
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

                                <button
                                    type="button"
                                    className="sky-modern-btn icon-only"
                                    onClick={toggleFullscreen}
                                    title="Schermo intero"
                                >
                                    <span className="material-symbols-rounded">fullscreen</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Backdrop e Drawer Popup Laterale a Destra (nel player) */}
                <div
                    className={`sky-sidebar-backdrop ${isSidebarOpen ? "is-open" : ""}`}
                    onClick={() => setIsSidebarOpen(false)}
                />

                <aside className={`sky-sidebar-popup ${isSidebarOpen ? "is-open" : ""}`}>
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
            </main>

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
