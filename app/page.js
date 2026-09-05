"use client";
import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import { fetchSecureJson, isStreamWarp } from "@/lib/crypto";

import ChannelCard from "@/components/ChannelCard";

function normalizeEpg(s) {
    return (s || "").toLowerCase().replace(/fhd|uhd|4k|1080p|720p/g, "").replace(/[^a-z0-9]/g, "");
}

export default function HomePage() {
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exploreData, setExploreData] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function loadData(isInitial = false) {
            if (isInitial) setLoading(true);
            try {
                // Fetch parallelo con cache: "no-store" e timestamp anti-cache
                const ts = Date.now();
                const [testRes, skyRes, sky2Res, catRes, guideRes] = await Promise.allSettled([
                    fetchSecureJson(`/test.json?t=${ts}`).catch(() => null),
                    fetchSecureJson(`/sky.json?t=${ts}`).catch(() => null),
                    fetchSecureJson(`/sky2.json?t=${ts}`).catch(() => null),
                    fetch(`/categorie.json?t=${ts}`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
                    fetch(`/guida_tv_sky.json?t=${ts}`, { cache: "no-store" }).then(r => r.json()).catch(() => null)
                ]);

                if (!isMounted) return;

                const testData = testRes.status === "fulfilled" ? testRes.value : null;
                const skyData = skyRes.status === "fulfilled" ? skyRes.value : null;
                const sky2Data = sky2Res.status === "fulfilled" ? sky2Res.value : null;
                const catData = catRes.status === "fulfilled" ? catRes.value : null;
                const guideData = guideRes.status === "fulfilled" ? guideRes.value : null;

                const orderedChannels = [];
                const customCategoriesList = [];

                // 1. Processa Sky 1 (sky.json)
                if (skyData) {
                    Object.keys(skyData).forEach(groupName => {
                        const items = skyData[groupName];
                        if (!Array.isArray(items)) return;
                        items.forEach(c => {
                            let grp = groupName;
                            const grpUpper = grp.toUpperCase();
                            if (grpUpper === "NEWS") grp = "Sky Intrattenimento";
                            else if (grpUpper.includes("SPORT")) grp = "Sky Sport";
                            else grp = "Sky Intrattenimento";

                            orderedChannels.push({
                                title: c.name || c.title || "",
                                group: grp,
                                navbar: grp === "Sky Sport" ? "sport" : "intrattenimento",
                                url: c.mpd || c.url || "",
                                kid_key: c.key || c.kid_key || "",
                                logo: c.logo || "",
                                provider: "SKY",
                                skySource: "sky.json",
                                slug: (c.name || c.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
                                isSky: true
                            });
                        });
                    });
                }

                // 2. Processa Sky 2 (sky2.json) per Cinema e Bambini SOLO gruppi Sky
                // I gruppi non-Sky (Rai, Mediaset, Altro ecc.) vengono saltati nella home — appaiono solo in /sky
                const SKY2_HOME_GROUPS = ["Sky Cinema", "Sky Bambini"];
                if (sky2Data) {
                    Object.keys(sky2Data).forEach(groupName => {
                        // Nella HOME mostra SOLO i gruppi Sky noti — salta tutti gli altri (Rai, Mediaset, Altro...)
                        if (!SKY2_HOME_GROUPS.includes(groupName)) return;
                        const items = sky2Data[groupName];
                        if (!Array.isArray(items)) return;
                        items.forEach(c => {
                            orderedChannels.push({
                                title: c.name || c.title || "",
                                group: groupName,
                                navbar: "intrattenimento",
                                url: c.mpd || c.url || "",
                                kid_key: c.key || c.kid_key || "",
                                logo: c.logo || "",
                                provider: "SKY",
                                skySource: "sky2.json",
                                slug: (c.name || c.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
                                isSky: true
                            });
                        });
                    });
                }

                // 3. Processa canali da categorie.json (Eurosport, SuperTennis, Digitale Terrestre, ecc.)
                if (catData && Array.isArray(catData.categorie)) {
                    catData.categorie.forEach(cat => {
                        customCategoriesList.push(cat);
                        if (!cat.canali || cat.canali.length === 0) return;
                        cat.canali.forEach(c => {
                            if (!c.titolo) return;
                            orderedChannels.push({
                                title: c.titolo,
                                group: cat.nome,
                                navbar: cat.navbar || (cat.nome.toLowerCase().includes("sport") ? "sport" : "intrattenimento"),
                                url: c.mpd || c.url || "",
                                kid_key: c.kid_key || c.key || "",
                                provider: c.provider || cat.nome,
                                logo: c.logo ? `/logos/${c.logo}` : "",
                                isCustom: true,
                                slug: (c.slug || c.titolo).toLowerCase().replace(/[^a-z0-9]/g, "-")
                            });
                        });
                    });
                }

                // 4. Dati DAZN da test.json con DEDUPLICAZIONE RIGOROSA
                if (testData) {
                    Object.keys(testData).forEach(groupName => {
                        const items = testData[groupName];
                        if (!Array.isArray(items) || items.length === 0) return;

                        if (!customCategoriesList.some(c => c.nome === groupName)) {
                            customCategoriesList.push({
                                id: groupName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                                nome: groupName,
                                navbar: "eventi"
                            });
                        }

                        const groupedMap = new Map();
                        items.forEach(ev => {
                            if (!ev.name && !ev.title) return;
                            const rawTitle = (ev.name || ev.title).trim();
                            const isWarp = isStreamWarp(rawTitle, ev.mpd || ev.url || "");
                            let cleanTitle = rawTitle.replace(/\s*\(WARP\)\s*/gi, " ")
                                                       .replace(/\s*\(HLS\)\s*/gi, " ")
                                                       .replace(/\s*\(\d+\)\s*$/g, " ")
                                                       .trim();
                            if (cleanTitle.toUpperCase().replace(/\s+/g, "") === "DAZN") {
                                cleanTitle = "DAZN 1";
                            }

                            let timeStr = "";
                            const isDazn1 = cleanTitle.toUpperCase().replace(/\s+/g, "").includes("DAZN1") || (ev.end && ev.end.startsWith("3000"));
                            if (ev.start && !isDazn1) {
                                try {
                                    const d = new Date(ev.start);
                                    timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                                } catch(e) {}
                            }

                            const sourceItem = {
                                name: isWarp ? "WARP (Cloudflare)" : "Standard",
                                isWarp: isWarp,
                                url: ev.mpd || ev.url || "",
                                kid_key: ev.key || ev.kid_key || "",
                                ua: ev.ua || "",
                                dazn_token: ev.dazn_token || ""
                            };

                            const groupKey = groupName + ":::" + cleanTitle.toLowerCase();
                            if (groupedMap.has(groupKey)) {
                                const existing = groupedMap.get(groupKey);
                                existing.sources.push(sourceItem);
                                if (!isWarp && (!existing.url || existing.url.includes(".m3u8"))) {
                                    existing.url = sourceItem.url;
                                    existing.kid_key = sourceItem.kid_key;
                                    existing.ua = sourceItem.ua;
                                }
                            } else {
                                const isSkyGroup = groupName.toUpperCase().replace(/\s+/g, "").includes("EVENTI");
                                const chObj = {
                                    id: cleanTitle,
                                    title: cleanTitle,
                                    group: groupName,
                                    navbar: "eventi",
                                    url: ev.mpd || ev.url || "",
                                    kid_key: ev.key || ev.kid_key || "",
                                    provider: isSkyGroup ? "SKY SPORT" : "DAZN",
                                    logo: "/logos/dazn.png",
                                    image: ev.image || "",
                                    ora: timeStr,
                                    sources: [sourceItem],
                                    isCustom: true,
                                    isTestJson: true,
                                    slug: cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")
                                };
                                groupedMap.set(groupKey, chObj);
                            }
                        });

                        const deduplicatedItems = Array.from(groupedMap.values());
                        deduplicatedItems.forEach(c => {
                            const warps = c.sources.filter(s => s.isWarp);
                            const stds = c.sources.filter(s => !s.isWarp);
                            let stdCount = 0;
                            let warpCount = 0;
                            c.sources.forEach(s => {
                                if (s.isWarp) {
                                    warpCount++;
                                    s.name = warps.length > 1 ? `WARP ${warpCount}` : "WARP (Cloudflare)";
                                } else {
                                    stdCount++;
                                    s.name = stds.length > 1 ? `Standard ${stdCount}` : "Standard";
                                }
                            });
                            orderedChannels.push(c);
                        });
                    });
                }

                // 5. Inietta la Guida TV Sky
                if (guideData && Array.isArray(guideData)) {
                    guideData.forEach(epgGroup => {
                        if (!epgGroup.canale) return;
                        const epgName = normalizeEpg(epgGroup.canale);
                        const target = orderedChannels.find(c => {
                            if (!c.title) return false;
                            const cName = normalizeEpg(c.title);
                            return cName === epgName || cName.includes(epgName) || epgName.includes(cName);
                        });
                        if (target && epgGroup.programmi && epgGroup.programmi.length > 0) {
                            target.epg = epgGroup.programmi;
                        }
                    });
                }

                // 6. Raggruppa e ordina le sezioni IDENTICAMENTE ad app.js
                const groupMap = new Map();
                orderedChannels.forEach(ch => {
                    const g = ch.group;
                    if (!groupMap.has(g)) {
                        groupMap.set(g, {
                            title: g,
                            navbar: ch.navbar || "sport",
                            channels: []
                        });
                    }
                    groupMap.get(g).channels.push(ch);
                });

                const sportPriority = ["Sky Sport", "Eurosport", "SuperTennis"];
                const intrattenimentoPriority = ["Sky Intrattenimento", "Sky Cinema", "Digitale Terrestre", "Sky Bambini"];

                const sortedSections = Array.from(groupMap.values()).sort((secA, secB) => {
                    const a = secA.title;
                    const b = secB.title;
                    const navA = secA.navbar;
                    const navB = secB.navbar;

                    const macroOrder = { "sport": 1, "intrattenimento": 2, "eventi": 3 };
                    const ordA = macroOrder[navA] || 99;
                    const ordB = macroOrder[navB] || 99;
                    if (ordA !== ordB) return ordA - ordB;

                    if (navA === "sport" && navB === "sport") {
                        const idxA = sportPriority.indexOf(a);
                        const idxB = sportPriority.indexOf(b);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                    }

                    if (navA === "intrattenimento" && navB === "intrattenimento") {
                        const idxA = intrattenimentoPriority.indexOf(a);
                        const idxB = intrattenimentoPriority.indexOf(b);
                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                    }

                    const cIdxA = customCategoriesList.findIndex(c => c.nome === a);
                    const cIdxB = customCategoriesList.findIndex(c => c.nome === b);
                    if (cIdxA !== -1 && cIdxB !== -1) return cIdxA - cIdxB;
                    if (cIdxA !== -1) return -1;
                    if (cIdxB !== -1) return 1;

                    return a.localeCompare(b);
                });

                if (isMounted) {
                    setCategories(sortedSections);
                }
            } catch(e) {
                console.error("Errore caricamento categorie", e);
            } finally {
                if (isMounted && isInitial) {
                    setLoading(false);
                }
            }
        }

        // Caricamento iniziale con spinner
        loadData(true);

        // Auto-polling silenzioso ogni 5 secondi (in background senza refresh o flicker)
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                loadData(false);
            }
        }, 5000);

        // Aggiorna istantaneamente appena torni sulla scheda del browser
        const onVisibilityOrFocus = () => {
            if (document.visibilityState === "visible") {
                loadData(false);
            }
        };
        window.addEventListener("focus", onVisibilityOrFocus);
        document.addEventListener("visibilitychange", onVisibilityOrFocus);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            window.removeEventListener("focus", onVisibilityOrFocus);
            document.removeEventListener("visibilitychange", onVisibilityOrFocus);
        };
    }, []);

    const shouldShowGroup = (sec, f) => {
        if (f === "all") return true;
        const isTestJson = sec.navbar === "eventi" || sec.channels.some(c => c.isTestJson);
        if (isTestJson) {
            const normName = (sec.title || "").toUpperCase().replace(/\s+/g, "");
            if (normName === "LIVETV" && f === "eventi") {
                return false;
            }
            return f !== "intrattenimento";
        }
        return sec.navbar === f;
    };

    const filteredSections = categories.filter(sec => shouldShowGroup(sec, filter)).map(sec => {
        if (!search.trim()) return sec;
        const q = search.toLowerCase();
        return {
            ...sec,
            channels: sec.channels.filter(c =>
                (c.title || "").toLowerCase().includes(q) ||
                (c.group || "").toLowerCase().includes(q)
            )
        };
    }).filter(sec => sec.channels.length > 0);

    return (
        <div className="desktop-home" style={{ display: "block", minHeight: "100vh" }}>
            <Navbar
                activeFilter={filter}
                onFilterChange={(f) => setFilter(f)}
                onSearch={(s) => setSearch(s)}
            />

            <main className="home-content">
                {loading ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
                        <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#e30a17", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
                    </div>
                ) : (
                    filteredSections.map(sec => (
                        <CarouselSection
                            key={sec.title}
                            title={sec.title}
                            channels={sec.channels}
                            onExplore={(title, chs) => setExploreData({ title, channels: chs })}
                        />
                    ))
                )}
            </main>

            {/* Explore All Full-Screen Overlay 1:1 con index.html / app.js */}
            {exploreData && (
                <div id="explore-all-overlay" className="explore-all-overlay" style={{ display: "flex" }}>
                    <div className="explore-header">
                        <h1 id="explore-category-title">{exploreData.title}</h1>
                        <button
                            id="explore-close"
                            className="explore-close"
                            onClick={() => setExploreData(null)}
                            aria-label="Chiudi"
                        >
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <div className="explore-content-wrapper">
                        <div id="explore-channels-grid" className="explore-channels-grid">
                            {exploreData.channels.map((ch, idx) => (
                                <ChannelCard key={ch.id || (ch.title + idx)} channel={ch} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
