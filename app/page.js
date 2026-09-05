"use client";
import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import { fetchSecureJson, isStreamWarp } from "@/lib/crypto";

export default function HomePage() {
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                // Fetch parallelo da test.json, sky.json, categorie.json
                const [testData, skyData, catData] = await Promise.allSettled([
                    fetchSecureJson("/test.json").catch(() => null),
                    fetchSecureJson("/sky.json").catch(() => null),
                    fetch("/categorie.json").then(r => r.json()).catch(() => null)
                ]);

                const sections = [];

                // 1. Dati DAZN da test.json
                if (testData.status === "fulfilled" && testData.value) {
                    const daznObj = testData.value;
                    Object.keys(daznObj).forEach(groupName => {
                        const items = daznObj[groupName];
                        if (!Array.isArray(items) || items.length === 0) return;

                        const groupedMap = new Map();
                        items.forEach(ev => {
                            if (!ev.name && !ev.title) return;
                            const rawTitle = (ev.name || ev.title).trim();
                            const isWarp = isStreamWarp(rawTitle, ev.mpd || ev.url || "");
                            const cleanTitle = rawTitle.replace(/\s*\(WARP\)\s*/gi, " ")
                                                       .replace(/\s*\(HLS\)\s*/gi, " ")
                                                       .replace(/\s*\(\d+\)\s*$/g, " ")
                                                       .trim();

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
                                if (!isWarp && !existing.url) {
                                    existing.url = sourceItem.url;
                                    existing.kid_key = sourceItem.kid_key;
                                }
                            } else {
                                const chObj = {
                                    id: cleanTitle,
                                    title: cleanTitle,
                                    group: groupName,
                                    navbar: "eventi",
                                    url: ev.mpd || ev.url || "",
                                    kid_key: ev.key || ev.kid_key || "",
                                    provider: groupName === "EVENTI" ? "SKY SPORT" : "DAZN",
                                    logo: "/logos/dazn.png",
                                    image: ev.image || "",
                                    ora: timeStr,
                                    sources: [sourceItem],
                                    slug: cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")
                                };
                                groupedMap.set(groupKey, chObj);
                            }
                        });

                        const chList = Array.from(groupedMap.values());
                        // Ordina i sources di ciascun canale (Standard prima, poi WARP)
                        chList.forEach(c => {
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
                        });

                        sections.push({
                            title: groupName,
                            navbar: "eventi",
                            channels: chList
                        });
                    });
                }

                // 2. Canali Sky da sky.json
                if (skyData.status === "fulfilled" && skyData.value) {
                    const sData = skyData.value;
                    Object.keys(sData).forEach(grpName => {
                        const items = sData[grpName];
                        if (!Array.isArray(items) || items.length === 0) return;
                        const isSport = grpName.toLowerCase().includes("sport");
                        sections.push({
                            title: grpName,
                            navbar: isSport ? "sport" : "intrattenimento",
                            channels: items.map(c => ({
                                id: c.name,
                                title: c.name,
                                group: grpName,
                                navbar: isSport ? "sport" : "intrattenimento",
                                url: c.mpd || "",
                                kid_key: c.key || "",
                                provider: "SKY",
                                logo: c.logo || "/logos/sksport.png",
                                slug: (c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "-"),
                                sources: [{
                                    name: "Standard",
                                    isWarp: false,
                                    url: c.mpd || "",
                                    kid_key: c.key || ""
                                }]
                            }))
                        });
                    });
                }

                // 3. Categorie da categorie.json
                if (catData.status === "fulfilled" && catData.value && catData.value.categorie) {
                    catData.value.categorie.forEach(cat => {
                        if (!cat.canali || cat.canali.length === 0) return;
                        sections.push({
                            title: cat.nome,
                            navbar: cat.navbar || "intrattenimento",
                            channels: cat.canali.map(c => ({
                                id: c.titolo,
                                title: c.titolo,
                                group: cat.nome,
                                navbar: cat.navbar || "intrattenimento",
                                url: c.mpd || c.url || "",
                                kid_key: c.kid_key || c.key || "",
                                provider: cat.nome,
                                logo: c.logo ? `/logos/${c.logo}` : "/logos/premium_logo_dark.jpg",
                                slug: (c.slug || c.titolo).toLowerCase().replace(/[^a-z0-9]/g, "-"),
                                sources: [{
                                    name: "Standard",
                                    isWarp: false,
                                    url: c.mpd || c.url || "",
                                    kid_key: c.kid_key || c.key || ""
                                }]
                            }))
                        });
                    });
                }

                setCategories(sections);
            } catch(e) {
                console.error("Errore caricamento categorie", e);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    const filteredSections = categories.filter(sec => {
        if (filter !== "all" && sec.navbar !== filter) return false;
        return true;
    }).map(sec => {
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
        <div className="desktop-home" style={{ display: "block", minHeight: "100vh", backgroundColor: "#000000" }}>
            <Navbar
                activeFilter={filter}
                onFilterChange={(f) => setFilter(f)}
                onSearch={(s) => setSearch(s)}
            />

            <main className="home-content" style={{ maxWidth: "1600px", margin: "0 auto", padding: "20px 8vw 80px" }}>
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
                        />
                    ))
                )}
            </main>
        </div>
    );
}
