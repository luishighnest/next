"use client";
import React, { useState, useEffect, Suspense, useDeferredValue } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import SkeletonSection from "@/components/SkeletonSection";
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
    const deferredSearch = useDeferredValue(search);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exploreData, setExploreData] = useState(null);

    // SWR: Instant hydration da localStorage per caricamento istantaneo (0.0s)
    useEffect(() => {
        try {
            const cached = localStorage.getItem("nmdz_cached_sections");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCategories(parsed);
                    setLoading(false);
                }
            }
        } catch (e) {}
    }, []);

    useEffect(() => {
        if (tabParam && ["all", "sport", "intrattenimento", "eventi"].includes(tabParam)) {
            setFilter(tabParam);
        }
    }, [tabParam]);

    useEffect(() => {
        if (exploreData) {
            const origHtmlOverflow = document.documentElement.style.overflow;
            const origBodyOverflow = document.body.style.overflow;
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";

            const handleKeyDown = (e) => {
                if (e.key === "Escape") {
                    setExploreData(null);
                }
            };
            window.addEventListener("keydown", handleKeyDown);

            return () => {
                document.documentElement.style.overflow = origHtmlOverflow;
                document.body.style.overflow = origBodyOverflow;
                window.removeEventListener("keydown", handleKeyDown);
            };
        }
    }, [exploreData]);

    const handleFilterChange = (f) => {
        setFilter(f);
        const url = f === "all" ? "/" : `/?tab=${f}`;
        router.push(url, { scroll: false });
    };

    // Polling resiliente con Exponential Backoff e sincronizzazione all'evento online
    useEffect(() => {
        let isMounted = true;
        let pollTimeout = null;
        let failureCount = 0;

        async function loadData(isInitial = false) {
            if (isInitial && categories.length === 0) setLoading(true);
            try {
                const res = await fetch(`/api/canali?t=${Date.now()}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    failureCount = 0;
                    if (isMounted && data && Array.isArray(data.sections)) {
                        try {
                            localStorage.setItem("nmdz_cached_sections", JSON.stringify(data.sections));
                        } catch (e) {}
                        setCategories(prev => {
                            if (prev && prev.length === data.sections.length) {
                                try {
                                    if (JSON.stringify(prev) === JSON.stringify(data.sections)) {
                                        return prev;
                                    }
                                } catch (e) {}
                            }
                            return data.sections;
                        });
                    }
                } else {
                    failureCount++;
                }
            } catch(e) {
                failureCount++;
            } finally {
                if (isMounted && isInitial) {
                    setLoading(false);
                }
                if (isMounted) {
                    scheduleNextPoll();
                }
            }
        }

        function scheduleNextPoll() {
            if (!isMounted) return;
            clearTimeout(pollTimeout);
            const delay = failureCount === 0 ? 5000 : Math.min(30000, 5000 * Math.pow(1.5, failureCount));
            pollTimeout = setTimeout(() => {
                if (document.visibilityState === "visible") {
                    loadData(false);
                } else {
                    scheduleNextPoll();
                }
            }, delay);
        }

        loadData(true);

        const onOnlineOrFocus = () => {
            if (document.visibilityState === "visible") {
                failureCount = 0;
                loadData(false);
            }
        };

        window.addEventListener("focus", onOnlineOrFocus);
        window.addEventListener("online", onOnlineOrFocus);
        document.addEventListener("visibilitychange", onOnlineOrFocus);

        return () => {
            isMounted = false;
            clearTimeout(pollTimeout);
            window.removeEventListener("focus", onOnlineOrFocus);
            window.removeEventListener("online", onOnlineOrFocus);
            document.removeEventListener("visibilitychange", onOnlineOrFocus);
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

    // Ricerca globale avanzata: canali, gruppi, eventi e Guida TV completa (titoli programmi, orari, descrizioni)
    const matchesChannel = (c, q) => {
        if (!q) return true;
        if ((c.title || "").toLowerCase().includes(q)) return true;
        if ((c.name || "").toLowerCase().includes(q)) return true;
        if ((c.group || "").toLowerCase().includes(q)) return true;
        if ((c.desc || "").toLowerCase().includes(q)) return true;
        if ((c.descrizione || "").toLowerCase().includes(q)) return true;
        if ((c.ora || "").toLowerCase().includes(q)) return true;
        if (Array.isArray(c.epg)) {
            return c.epg.some(p => 
                (p?.titolo || "").toLowerCase().includes(q) ||
                (p?.desc || "").toLowerCase().includes(q) ||
                (p?.descrizione || "").toLowerCase().includes(q) ||
                (p?.ora || "").toLowerCase().includes(q)
            );
        }
        return false;
    };

    const filteredSections = categories.filter(sec => shouldShowGroup(sec, filter)).map(sec => {
        if (!deferredSearch.trim()) return sec;
        const q = deferredSearch.toLowerCase().trim();
        return {
            ...sec,
            channels: sec.channels.filter(c => matchesChannel(c, q))
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
                    <div className="skeleton-container" style={{ width: "100%" }}>
                        <SkeletonSection cardCount={6} />
                        <SkeletonSection cardCount={6} />
                        <SkeletonSection cardCount={6} />
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

