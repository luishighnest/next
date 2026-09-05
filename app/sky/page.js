"use client";
import React, { useState, useEffect, useRef, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchSecureJson } from "@/lib/crypto";
import { getChannelLogoUrl } from "@/lib/epg";

const EXT = "chrome-extension://opmeopcambhfimffbomjgemehjkbbmji/pages/player.html#";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

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
    return (s || "").toLowerCase().replace(/fhd|uhd|4k|1080p|720p/g, "").replace(/[^a-z0-9]/g, "");
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
    try { parts.push("headers=" + btoa(JSON.stringify({ "User-Agent": UA }))); } catch(e) {}
    const sep = baseUrl.includes("?") ? "&" : "?";
    return EXT + baseUrl + sep + parts.join("&");
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
                slug: (item.name || item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
                skySource: sourceName
            });
        });
    });
    return list;
}

function SkyContent() {
    const searchParams = useSearchParams();
    const chParam = searchParams.get("ch") || "";
    const srcParam = searchParams.get("src") || "";

    const [currentSource, setCurrentSource] = useState(() => {
        if (srcParam === "sky2.json" || srcParam === "sky.json") return srcParam;
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem("nmdz_skyChannel");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.skySource === "sky2.json" || parsed.skySource === "sky.json") {
                        return parsed.skySource;
                    }
                }
            } catch(e) {}
        }
        return "sky.json";
    });
    const [channels, setChannels] = useState([]);
    const [guideData, setGuideData] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [loading, setLoading] = useState(true);

    const playerWrapRef = useRef(null);
    const playerZoneRef = useRef(null);
    const nowRowRef = useRef(null);

    // Carica canali e guida tv con aggiornamento automatico silenzioso
    useEffect(() => {
        let isMounted = true;
        async function loadSourceChannels(isInitial = false) {
            if (isInitial) setLoading(true);
            try {
                const ts = Date.now();
                const [srcData, guideRes] = await Promise.allSettled([
                    fetchSecureJson(`/${currentSource}?t=${ts}`).catch(() => null),
                    fetch(`/guida_tv_sky.json?t=${ts}`, { cache: "no-store" }).then(r => r.json()).catch(() => null)
                ]);

                if (!isMounted) return;

                const json = srcData.status === "fulfilled" ? srcData.value : null;
                const gData = guideRes.status === "fulfilled" ? guideRes.value : [];
                if (Array.isArray(gData)) setGuideData(gData);

                const channelList = parseChannelList(json, currentSource);
                setChannels(channelList);

                // Calcola target da chParam o da sessionStorage
                const cleanTarget = (chParam || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                let storedTarget = "";
                try {
                    const stored = sessionStorage.getItem("nmdz_skyChannel");
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        storedTarget = (parsed.slug || parsed.title || parsed.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    }
                } catch(e) {}

                const targetKey = cleanTarget || storedTarget;

                // 1. Cerca il canale nella sorgente attiva
                let found = null;
                if (targetKey) {
                    found = channelList.find(c => {
                        const cSlug = c.slug.replace(/[^a-z0-9]/g, "");
                        return cSlug === targetKey || cSlug.includes(targetKey) || targetKey.includes(cSlug);
                    });
                }

                // 2. Se NON esiste nella sorgente attiva, cerca automaticamente nell'altra sorgente (sky.json <-> sky2.json)
                if (!found && targetKey) {
                    const otherSource = currentSource === "sky.json" ? "sky2.json" : "sky.json";
                    try {
                        const otherData = await fetchSecureJson(`/${otherSource}?t=${ts}`).catch(() => null);
                        if (otherData) {
                            const otherList = parseChannelList(otherData, otherSource);
                            const foundInOther = otherList.find(c => {
                                const cSlug = c.slug.replace(/[^a-z0-9]/g, "");
                                return cSlug === targetKey || cSlug.includes(targetKey) || targetKey.includes(cSlug);
                            });
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

                // 3. Seleziona canale
                setSelectedChannel(prevSelected => {
                    if (prevSelected) {
                        const stillExists = channelList.find(c => c.slug === prevSelected.slug || c.name === prevSelected.name);
                        if (stillExists) return stillExists;
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

    // Fit player 16:9
    useEffect(() => {
        function fitPlayer() {
            const z = playerZoneRef.current;
            const wWrap = playerWrapRef.current;
            const nRow = nowRowRef.current;
            if (!z || !wWrap) return;
            const w = z.clientWidth;
            const h = z.clientHeight;
            if (!w || !h) return;
            const r = 16 / 9;
            let targetW = w;
            let targetH = w / r;
            if (targetH > h) {
                targetH = h;
                targetW = h * r;
            }
            const finalWidth = Math.floor(targetW) + "px";
            const finalHeight = Math.floor(targetH) + "px";
            wWrap.style.width = finalWidth;
            wWrap.style.height = finalHeight;
            if (nRow) nRow.style.width = finalWidth;
        }

        fitPlayer();
        window.addEventListener("resize", fitPlayer);
        return () => window.removeEventListener("resize", fitPlayer);
    }, [selectedChannel]);

    // Trova programma EPG
    const getCurrentProgram = (channelName) => {
        if (!guideData || !Array.isArray(guideData)) return null;
        const wanted = normalizeName(channelName);
        const group = guideData.find(g => {
            if (!g || !g.canale) return false;
            const gn = normalizeName(g.canale);
            return gn === wanted || gn.includes(wanted) || wanted.includes(gn);
        });
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

    const handleNextChannel = () => {
        if (filteredChannels.length === 0) return;
        const curIdx = filteredChannels.findIndex(c => c.slug === selectedChannel?.slug);
        const nextIdx = (curIdx + 1) % filteredChannels.length;
        setSelectedChannel(filteredChannels[nextIdx]);
    };

    const handlePrevChannel = () => {
        if (filteredChannels.length === 0) return;
        const curIdx = filteredChannels.findIndex(c => c.slug === selectedChannel?.slug);
        const prevIdx = (curIdx - 1 + filteredChannels.length) % filteredChannels.length;
        setSelectedChannel(filteredChannels[prevIdx]);
    };

    return (
        <div className="sky-app">
            {/* Header / Navbar */}
            <div className="home-header-wrapper" style={{ position: "relative", top: "14px", marginBottom: "20px" }}>
                <div className="home-header">
                    <Link href="/">
                        <img src="/logos/premium_logo_dark.jpg" alt="Logo" className="brand-logo" />
                    </Link>
                    <nav className="sky-nav-links">
                        <Link href="/" className="nav-link"><i className="fas fa-house"></i>Home</Link>
                        <Link href="/?tab=sport" className="nav-link active"><i className="fas fa-trophy"></i>Sport</Link>
                        <Link href="/?tab=intrattenimento" className="nav-link"><i className="fas fa-masks-theater"></i>Intrattenimento</Link>
                        <Link href="/?tab=eventi" className="nav-link"><i className="fas fa-ticket"></i>Eventi</Link>
                    </nav>
                </div>
            </div>

            {/* Layout Principale Sky Glass */}
            <main className="sky-main">
                {/* Sidebar Canali */}
                <aside className="sky-sidebar">
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
                                        onClick={() => setSelectedChannel(ch)}
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

                {/* Sezione Destra: Player + Info Deck */}
                <section className="sky-right">
                    <div className="sky-player-zone" ref={playerZoneRef}>
                        <div className="sky-player-wrap" ref={playerWrapRef}>
                            {loading ? (
                                <div className="sky-loader">
                                    <div className="sky-spinner"></div>
                                    <span className="sky-loader-text">Caricamento canali Sky...</span>
                                </div>
                            ) : (
                                <iframe
                                    id="player-frame"
                                    src={playerSrc}
                                    allow="autoplay; encrypted-media; fullscreen"
                                    allowFullScreen
                                    title="Sky Player"
                                />
                            )}
                        </div>
                    </div>

                    {/* Now Row / Deck Info */}
                    <div className="now-row" ref={nowRowRef}>
                        <div className="now-poster-box">
                            {currentEpg?.immagine ? (
                                <img src={currentEpg.immagine} className="now-poster-img" alt="" />
                            ) : null}
                            <img
                                src={selectedChannel?.logo || "/logos/sksport.png"}
                                className="now-logo"
                                alt=""
                            />
                        </div>

                        <div className="now-info">
                            <div className="now-title-row">
                                <h2 className="now-title">{selectedChannel?.name || "Seleziona un canale"}</h2>
                            </div>
                            <div className="now-meta-row">
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
                                    let dateStr = "";
                                    if (expDate.getDate() !== now.getDate()) {
                                        dateStr = String(expDate.getDate()).padStart(2, "0") + "/" + String(expDate.getMonth() + 1).padStart(2, "0") + " ";
                                    }
                                    const isExpired = diffMin <= 0;
                                    let expiryText = "";
                                    if (isExpired) {
                                        expiryText = "Scaduto alle " + timeStr;
                                    } else if (diffMin < 60) {
                                        expiryText = "Scade tra " + diffMin + " min (" + timeStr + ")";
                                    } else {
                                        expiryText = "Scadenza: " + dateStr + timeStr;
                                    }
                                    return (
                                        <span className={`now-expiry-badge ${isExpired ? "expired" : ""}`} id="nowExpiry" style={{ display: "inline-flex" }}>
                                            <i className="fa-regular fa-clock" style={{ marginRight: "4px" }}></i>
                                            <span id="nowExpiryText">{expiryText}</span>
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="now-epg-text">
                                {currentEpg ? `${currentEpg.ora} - ${currentEpg.titolo} ${currentEpg.next ? `(Succ: ${currentEpg.next})` : ""}` : "Trasmissione in diretta"}
                            </div>
                            <div className="now-progress-container">
                                <div className="now-progress-bar" style={{ width: `${currentEpg ? currentEpg.percent : 10}%` }}></div>
                            </div>
                        </div>

                        {/* Zapping Controls */}
                        <div className="zap-controls">
                            <button
                                type="button"
                                className="zap-btn"
                                onClick={handlePrevChannel}
                                title="Canale precedente"
                            >
                                <span className="material-symbols-rounded">skip_previous</span>
                            </button>
                            <button
                                type="button"
                                className="zap-btn"
                                onClick={handleNextChannel}
                                title="Canale successivo"
                            >
                                <span className="material-symbols-rounded">skip_next</span>
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default function SkyPage() {
    return (
        <Suspense fallback={
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#000000" }}>
                <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#e30a17", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
            </div>
        }>
            <SkyContent />
        </Suspense>
    );
}
