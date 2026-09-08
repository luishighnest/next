"use client";
import React, { useState, useEffect, Suspense, useDeferredValue } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import SkeletonSection from "@/components/SkeletonSection";
import ChannelCard from "@/components/ChannelCard";

let memoryVodSections = null;

function getCachedVod() {
    if (memoryVodSections && Array.isArray(memoryVodSections) && memoryVodSections.length > 0) {
        return memoryVodSections;
    }
    if (typeof window !== "undefined") {
        try {
            const stored = localStorage.getItem("nmdz_cached_vod");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    memoryVodSections = parsed;
                    return parsed;
                }
            }
        } catch (e) {}
    }
    return [];
}

function VodContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const initialSections = getCachedVod();
    const [sections, setSections] = useState(initialSections);
    const [loading, setLoading] = useState(() => initialSections.length === 0);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [exploreData, setExploreData] = useState(null);

    // Carica sezioni VOD da /api/vod
    useEffect(() => {
        let isMounted = true;
        async function fetchVodCatalog() {
            if (sections.length === 0) {
                setLoading(true);
            }
            try {
                const res = await fetch("/api/vod", { cache: "default" });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && data && Array.isArray(data.sections)) {
                        memoryVodSections = data.sections;
                        try {
                            localStorage.setItem("nmdz_cached_vod", JSON.stringify(data.sections));
                        } catch (e) {}
                        setSections(data.sections);
                    }
                }
            } catch (err) {
                console.error("Errore fetch VOD catalog:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchVodCatalog();
        return () => { isMounted = false; };
    }, []);

    const handleFilterChange = (tab) => {
        if (tab === "vod") return;
        if (tab === "home" || tab === "all") router.push("/home");
        else router.push(`/${tab}`);
    };

    // Ricerca VOD locale reattiva
    const filteredSections = React.useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        if (!q) return sections;
        return sections.map(sec => ({
            ...sec,
            channels: (sec.channels || []).filter(c => {
                return (c.title || "").toLowerCase().includes(q) ||
                       (c.name || "").toLowerCase().includes(q) ||
                       (c.desc || "").toLowerCase().includes(q) ||
                       (c.group || "").toLowerCase().includes(q);
            })
        })).filter(sec => sec.channels.length > 0);
    }, [sections, deferredSearch]);

    return (
        <div className="desktop-home vod-page-container" style={{ display: "block", minHeight: "140vh" }}>
            <Navbar
                activeFilter="vod"
                onFilterChange={handleFilterChange}
                isSearchOpen={isSearchOpen}
                setIsSearchOpen={setIsSearchOpen}
                searchVal={search}
                setSearchVal={setSearch}
                onSearch={(s) => setSearch(s)}
            />

            <main className="home-content">
                {loading ? (
                    <div className="skeleton-container" style={{ width: "100%" }}>
                        <SkeletonSection cardCount={6} />
                        <SkeletonSection cardCount={6} />
                        <SkeletonSection cardCount={6} />
                    </div>
                ) : filteredSections.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "100px 20px", color: "rgba(255,255,255,0.5)" }}>
                        <span className="material-symbols-rounded" style={{ fontSize: "3rem", marginBottom: "12px", opacity: 0.7 }}>movie</span>
                        <h2 style={{ fontSize: "1.3rem", fontWeight: 600, color: "#fff" }}>Nessun titolo trovato</h2>
                        <p style={{ marginTop: "6px" }}>Prova a cercare con un altro termine.</p>
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

            {/* Modale Esplora Tutti per VOD */}
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
                                <ChannelCard
                                    key={ch.id || (ch.title + idx)}
                                    channel={ch}
                                    categoryName={exploreData.title}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function VodView() {
    return (
        <Suspense fallback={<div className="desktop-home" style={{ display: "block", minHeight: "140vh" }} />}>
            <VodContent />
        </Suspense>
    );
}
