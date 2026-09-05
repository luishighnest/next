"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import { fetchSecureJson, isStreamWarp } from "@/lib/crypto";

import ChannelCard from "@/components/ChannelCard";

function normalizeEpg(s) {
    return (s || "").toLowerCase().replace(/fhd|uhd|4k|1080p|720p/g, "").replace(/[^a-z0-9]/g, "");
}

function HomePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabParam = searchParams.get("tab") || searchParams.get("filter") || "all";
    const [filter, setFilter] = useState(tabParam);
    const [search, setSearch] = useState("");
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exploreData, setExploreData] = useState(null);

    useEffect(() => {
        if (tabParam && ["all", "sport", "intrattenimento", "eventi"].includes(tabParam)) {
            setFilter(tabParam);
        }
    }, [tabParam]);

    const handleFilterChange = (f) => {
        setFilter(f);
        const url = f === "all" ? "/" : `/?tab=${f}`;
        router.push(url, { scroll: false });
    };

    useEffect(() => {
        let isMounted = true;

        async function loadData(isInitial = false) {
            if (isInitial) setLoading(true);
            try {
                const res = await fetch(`/api/canali?t=${Date.now()}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && data && Array.isArray(data.sections)) {
                        setCategories(data.sections);
                    }
                }
            } catch(e) {
                console.error("Errore caricamento canali via API", e);
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
                onFilterChange={handleFilterChange}
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

export default function HomePage() {
    return (
        <Suspense fallback={<div className="desktop-home" style={{ display: "block", minHeight: "100vh" }} />}>
            <HomePageContent />
        </Suspense>
    );
}

