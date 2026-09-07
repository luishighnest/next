"use client";
import React, { useState, useEffect, Suspense, useDeferredValue } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import SkeletonSection from "@/components/SkeletonSection";
import ChannelCard from "@/components/ChannelCard";
import SearchView from "@/components/SearchView";
import { getTechSettings } from "@/lib/settings";

const VALID_TABS = ["sport", "intrattenimento", "eventi"];

// Cache in memoria a livello di modulo: persiste tra le navigazioni dell'app cliente (0ms overhead)
let memorySections = null;

function getCachedSections() {
    if (memorySections && Array.isArray(memorySections) && memorySections.length > 0) {
        return memorySections;
    }
    if (typeof window !== "undefined") {
        try {
            const stored = localStorage.getItem("nmdz_cached_sections");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    memorySections = parsed;
                    return parsed;
                }
            }
        } catch (e) {}
    }
    return [];
}

function HomeViewContent({ defaultTab = "all" }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Determina il tab iniziale in base a pathname, defaultTab o searchParams legacy
    const getInitialFilter = () => {
        if (pathname === "/sport") return "sport";
        if (pathname === "/intrattenimento") return "intrattenimento";
        if (pathname === "/eventi") return "eventi";
        if (pathname === "/home" || pathname === "/") return "all";

        const rawTab = (searchParams.get("tab") || searchParams.get("filter") || "").toLowerCase().trim();
        if (VALID_TABS.includes(rawTab)) return rawTab;
        if (VALID_TABS.includes(defaultTab)) return defaultTab;
        return "all";
    };

    const initialSections = getCachedSections();
    const [categories, setCategories] = useState(initialSections);
    const [loading, setLoading] = useState(() => initialSections.length === 0);
    const [filter, setFilter] = useState(getInitialFilter);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [exploreData, setExploreData] = useState(null);

    // Se la query string contiene ?search=, apre subito la ricerca
    useEffect(() => {
        const q = searchParams.get("search");
        if (q !== null && q !== undefined) {
            if (q === "open" || q === "focus" || q === "") {
                setSearch("");
                setIsSearchOpen(true);
            } else {
                setSearch(q);
                setIsSearchOpen(true);
            }
        }
    }, [searchParams]);

    // Idratazione istantanea da memoria / localStorage all'avvio se ancora non presente
    useEffect(() => {
        if (categories.length === 0) {
            const cached = getCachedSections();
            if (cached && cached.length > 0) {
                setCategories(cached);
                setLoading(false);
            }
        }
    }, [categories.length]);

    // Sincronizza il filtro istantaneamente sui pulsanti back/forward del browser
    useEffect(() => {
        const handlePopState = () => {
            const p = window.location.pathname;
            if (p === "/sport") setFilter("sport");
            else if (p === "/intrattenimento") setFilter("intrattenimento");
            else if (p === "/eventi") setFilter("eventi");
            else if (p === "/home" || p === "/") setFilter("all");
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Sincronizza il filtro al variare del pathname Next.js
    useEffect(() => {
        if (pathname === "/sport") setFilter("sport");
        else if (pathname === "/intrattenimento") setFilter("intrattenimento");
        else if (pathname === "/eventi") setFilter("eventi");
        else if (pathname === "/home" || pathname === "/") setFilter("all");
    }, [pathname]);

    // Pulizia e reindirizzamento dei vecchi endpoint con query string (es. /?tab=sport -> /sport)
    useEffect(() => {
        const hasTabParam = searchParams.has("tab") || searchParams.has("filter");
        if (hasTabParam) {
            const currentTab = (searchParams.get("tab") || searchParams.get("filter") || "").toLowerCase().trim();
            if (currentTab === "sport") {
                router.replace("/sport", { scroll: false });
                setFilter("sport");
            } else if (currentTab === "intrattenimento") {
                router.replace("/intrattenimento", { scroll: false });
                setFilter("intrattenimento");
            } else if (currentTab === "eventi") {
                router.replace("/eventi", { scroll: false });
                setFilter("eventi");
            } else {
                router.replace("/home", { scroll: false });
                setFilter("all");
            }
        }
    }, [searchParams, router]);

    // Gestione blocco scroll modale "Esplora tutti"
    useEffect(() => {
        if (exploreData) {
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";

            const handleKeyDown = (e) => {
                if (e.key === "Escape") {
                    setExploreData(null);
                }
            };
            window.addEventListener("keydown", handleKeyDown);

            return () => {
                document.documentElement.style.overflow = "";
                document.body.style.overflow = "";
                window.removeEventListener("keydown", handleKeyDown);
            };
        } else {
            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";
        }
    }, [exploreData]);

    // Cambio tab ultra-fluido: aggiorna lo stato a 0ms e sincronizza l'URL senza smontare la pagina
    const handleFilterChange = (targetTab) => {
        const cleanTab = (targetTab === "home" || targetTab === "all") ? "all" : targetTab;
        setFilter(cleanTab);
        try {
            window.scrollTo({ top: 0, behavior: "instant" });
        } catch(e) {
            window.scrollTo(0, 0);
        }
        
        let targetPath = "/home";
        if (cleanTab === "sport") targetPath = "/sport";
        else if (cleanTab === "intrattenimento") targetPath = "/intrattenimento";
        else if (cleanTab === "eventi") targetPath = "/eventi";

        if (pathname !== targetPath) {
            window.history.pushState(null, "", targetPath);
        }
    };

    // Caricamento resiliente in background (Stale-While-Revalidate): MAI rimettere loading=true se ci sono già dati
    useEffect(() => {
        let isMounted = true;
        let pollTimeout = null;
        let failureCount = 0;

        async function loadData() {
            // Mostra lo skeleton SOLO ed ESCLUSIVAMENTE se la memoria e la cache locale sono completamente vuote
            if (categories.length === 0 && (!memorySections || memorySections.length === 0)) {
                setLoading(true);
            }

            try {
                const res = await fetch(`/api/canali?t=${Date.now()}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    failureCount = 0;
                    if (isMounted && data && Array.isArray(data.sections)) {
                        memorySections = data.sections;
                        try {
                            localStorage.setItem("nmdz_cached_sections", JSON.stringify(data.sections));
                        } catch (e) {}

                        React.startTransition(() => {
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
                        });
                        setLoading(false);
                    }
                } else {
                    failureCount++;
                }
            } catch(e) {
                failureCount++;
            } finally {
                if (isMounted) {
                    setLoading(false);
                    scheduleNextPoll();
                }
            }
        }

        function scheduleNextPoll() {
            if (!isMounted) return;
            clearTimeout(pollTimeout);
            const tech = getTechSettings();
            // Ottimizzazione intervallo di polling minimo a 15s per evitare frame-drop durante l'uso
            const configuredInterval = tech.pollIntervalSec || 15;
            const baseInterval = Math.max(10, configuredInterval) * 1000;
            const delay = failureCount === 0 ? baseInterval : Math.min(45000, baseInterval * Math.pow(1.5, failureCount));
            pollTimeout = setTimeout(() => {
                if (document.visibilityState === "visible") {
                    loadData();
                } else {
                    scheduleNextPoll();
                }
            }, delay);
        }

        loadData();

        const onOnlineOrFocus = () => {
            if (document.visibilityState === "visible") {
                failureCount = 0;
                loadData();
            }
        };

        const onBeforeUnload = () => {
            const tech = getTechSettings();
            if (tech.wipeCacheOnExit) {
                try {
                    localStorage.removeItem("nmdz_cached_sections");
                } catch(e) {}
            }
        };

        const onCacheCleared = () => {
            memorySections = null;
            loadData();
        };

        window.addEventListener("focus", onOnlineOrFocus);
        window.addEventListener("online", onOnlineOrFocus);
        document.addEventListener("visibilitychange", onOnlineOrFocus);
        window.addEventListener("beforeunload", onBeforeUnload);
        window.addEventListener("nmdz:cache_cleared", onCacheCleared);

        return () => {
            isMounted = false;
            clearTimeout(pollTimeout);
            window.removeEventListener("focus", onOnlineOrFocus);
            window.removeEventListener("online", onOnlineOrFocus);
            document.removeEventListener("visibilitychange", onOnlineOrFocus);
            window.removeEventListener("beforeunload", onBeforeUnload);
            window.removeEventListener("nmdz:cache_cleared", onCacheCleared);
        };
    }, []);

    const shouldShowGroup = (sec, f) => {
        if (f === "all" || f === "home") return true;
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

    // Ricerca globale avanzata: canali, gruppi, eventi e Guida TV completa
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

    const searchResultsChannels = React.useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        if (!q) return [];
        const seen = new Set();
        const list = [];
        for (const sec of categories) {
            for (const ch of (sec.channels || [])) {
                const idKey = ch.id || ch.url || (ch.title + (ch.ora || ""));
                if (!seen.has(idKey) && matchesChannel(ch, q)) {
                    seen.add(idKey);
                    list.push({
                        ...ch,
                        group: ch.group || sec.title
                    });
                }
            }
        }
        return list;
    }, [categories, deferredSearch]);

    const filteredSections = categories.filter(sec => shouldShowGroup(sec, filter)).map(sec => {
        if (!deferredSearch.trim()) return sec;
        const q = deferredSearch.toLowerCase().trim();
        return {
            ...sec,
            channels: sec.channels.filter(c => matchesChannel(c, q))
        };
    }).filter(sec => sec.channels.length > 0);

    return (
        <div className="desktop-home" style={{ display: "block", minHeight: "140vh" }}>
            <Navbar
                activeFilter={filter}
                onFilterChange={handleFilterChange}
                isSearchOpen={isSearchOpen}
                setIsSearchOpen={setIsSearchOpen}
                searchVal={search}
                setSearchVal={setSearch}
                onSearch={(s) => setSearch(s)}
            />

            <main className="home-content">
                {isSearchOpen ? (
                    <SearchView
                        search={search}
                        onSearchChange={(s) => setSearch(s)}
                        categories={categories}
                    />
                ) : (
                    loading ? (
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
                    )
                )}
            </main>

            {/* Explore All Full-Screen Overlay */}
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

export default function HomeView({ defaultTab = "all" }) {
    return (
        <Suspense fallback={<div className="desktop-home" style={{ display: "block", minHeight: "140vh" }} />}>
            <HomeViewContent defaultTab={defaultTab} />
        </Suspense>
    );
}
