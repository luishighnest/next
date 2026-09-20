"use client";
import React, { useState, useEffect, Suspense, useDeferredValue } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import CarouselSection from "@/components/CarouselSection";
import SkeletonSection from "@/components/SkeletonSection";
import ChannelCard from "@/components/ChannelCard";
import SearchView from "@/components/SearchView";
import SubCategoryChips from "@/components/SubCategoryChips";
import HomeHero from "@/components/HomeHero";
import MobileHomeView from "@/components/MobileHomeView";
import { useDeviceState } from "@/components/DeviceProvider";
import { extractSubCategories, extractVodSubCategories } from "@/lib/subcategories";
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
    const [mounted, setMounted] = useState(false);
    const [filter, setFilter] = useState(getInitialFilter);
    const [subFilter, setSubFilter] = useState(() => {
        return searchParams.get("sub") || "all";
    });
    const [eventiLiveSubFilter, setEventiLiveSubFilter] = useState("all");
    const [eventiVodSubFilter, setEventiVodSubFilter] = useState("all");
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isClosingSearch, setIsClosingSearch] = useState(false);
    const [exploreData, setExploreData] = useState(null);

    // Chiude la ricerca con animazione coordinata: barra + overlay spariscono insieme
    const handleCloseSearch = () => {
        if (isClosingSearch) return;
        setIsClosingSearch(true);
        setTimeout(() => {
            setIsSearchOpen(false);
            setIsClosingSearch(false);
            setSearch("");
        }, 200);
    };

    // Rilevamento Device Deterministico
    const { isMobile } = useDeviceState();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sincronizza sub-filter se la query string cambia
    useEffect(() => {
        const s = searchParams.get("sub");
        if (s !== null && s !== undefined) {
            setSubFilter(s || "all");
        }
    }, [searchParams]);

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

    // Gestione popstate (tasti Indietro/Avanti del browser) con sincronizzazione atomica di tab e sub-filter
    useEffect(() => {
        const handlePopState = () => {
            const p = window.location.pathname;
            if (p === "/sport") setFilter("sport");
            else if (p === "/intrattenimento") setFilter("intrattenimento");
            else if (p === "/eventi") setFilter("eventi");
            else if (p === "/home" || p === "/") setFilter("all");
            else if (p === "/vod") {
                router.push("/vod");
                return;
            }
            const params = new URLSearchParams(window.location.search);
            setSubFilter(params.get("sub") || "all");
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Selezione atomica a 0ms: illumina il tasto navbar, seleziona la sottocategoria e filtra i caroselli senza scatti
    const handleSelectCategoryAndSub = (macroTab, subId = "all") => {
        const cleanTab = (macroTab === "home" || macroTab === "all") ? "all" : macroTab;

        if (cleanTab === "vod") {
            setMounted(false);
            const target = subId && subId !== "all" ? `/vod?sub=${encodeURIComponent(subId)}` : "/vod";
            router.push(target);
            return;
        }

        setFilter(cleanTab);
        setSubFilter(subId);

        try {
            window.scrollTo({ top: 0, behavior: "instant" });
        } catch(e) {
            window.scrollTo(0, 0);
        }

        let targetPath = cleanTab === "all" ? "/home" : `/${cleanTab}`;
        if (subId && subId !== "all") {
            targetPath += `?sub=${encodeURIComponent(subId)}`;
        }
        if (typeof window !== "undefined" && window.location.pathname + window.location.search !== targetPath) {
            window.history.pushState({ tab: cleanTab, sub: subId }, "", targetPath);
        }
    };

    const handleFilterChange = (targetTab) => {
        handleSelectCategoryAndSub(targetTab, "all");
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
                            window.dispatchEvent(new CustomEvent("nmdz:sections_updated"));
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
        const isEventSec = sec.navbar === "eventi" || sec.channels.some(c => c.isTestJson);
        if (isEventSec) {
            return f === "eventi" || f === "sport";
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

    const currentSubCategories = React.useMemo(() => {
        return extractSubCategories(categories, filter);
    }, [categories, filter]);

    const dynamicSubCategories = React.useMemo(() => {
        let cachedVod = [];
        try {
            const stored = localStorage.getItem("nmdz_cached_vod");
            if (stored) cachedVod = JSON.parse(stored);
        } catch(e) {}
        return {
            sport: extractSubCategories(categories, "sport"),
            intrattenimento: extractSubCategories(categories, "intrattenimento"),
            eventi: extractSubCategories(categories, "eventi"),
            vod: extractVodSubCategories(cachedVod)
        };
    }, [categories]);

    const handleSelectSubFilter = (subId) => {
        if (subFilter === subId) return;

        setSubFilter(subId);

        // Se l'utente era sceso in basso, scroll morbido e fluido verso la cima
        if (typeof window !== "undefined" && window.scrollY > 200) {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        const targetBase = filter === "all" ? "/home" : `/${filter}`;
        const newUrl = subId === "all" ? targetBase : `${targetBase}?sub=${encodeURIComponent(subId)}`;
        try {
            window.history.replaceState(null, "", newUrl);
        } catch(e) {}
    };

    const shouldShowSubCategory = (sec, sub) => {
        if (!sub || sub === "all") return true;
        const normSec = (sec.title || "").toLowerCase().trim();
        const normSub = sub.toLowerCase().trim();
        return normSec === normSub || normSec.includes(normSub) || normSub.includes(normSec);
    };

    // Helper per determinare se un canale evento è VOD/Replay
    const isChannelVod = (c) => {
        const isDazn1 = (c?.title || "").toUpperCase().replace(/\s+/g, "").includes("DAZN1");
        const tileTypeLower = (c?.tile_type || "").toLowerCase();
        // tile_type "live" → mai VOD (anche se end scaduto)
        if (tileTypeLower === "live") return false;
        // tile_type "catchup"/"ondemand"/"vod" → sempre VOD
        if (tileTypeLower === "catchup" || tileTypeLower === "ondemand" || tileTypeLower === "vod") return true;
        // fallback ai controlli originali
        return Boolean(
            c?.isEventVod ||
            (c?.type && c.type.toLowerCase() === "vod") ||
            (c?.group && c.group.toLowerCase().includes("vod")) ||
            (c?.url && (c.url.includes("-vod.") || c.url.includes("/vod/"))) ||
            (c?.end && new Date(c.end).getTime() < (Date.now() - 30 * 60 * 1000) && !isDazn1) ||
            (!c?.end && c?.start && (Date.now() - new Date(c.start).getTime()) > 6 * 60 * 60 * 1000 && !isDazn1)
        );
    };

    // Estrazione sezioni e categorie separate per tab EVENTI (LIVE sopra, VOD sotto)
    const { eventiLiveSections, eventiVodSections, eventiLiveSubCategories, eventiVodSubCategories } = React.useMemo(() => {
        if (filter !== "eventi") {
            return { eventiLiveSections: [], eventiVodSections: [], eventiLiveSubCategories: [], eventiVodSubCategories: [] };
        }

        const rawEventSecs = categories.filter(sec => shouldShowGroup(sec, "eventi"));
        const q = deferredSearch.trim().toLowerCase();

        const liveSecs = [];
        const vodSecs = [];

        rawEventSecs.forEach(sec => {
            let chs = sec.channels || [];
            if (q) {
                chs = chs.filter(c => matchesChannel(c, q));
            }
            const liveChs = chs;
            const vodChs = [];

            if (liveChs.length > 0) {
                liveSecs.push({
                    ...sec,
                    channels: liveChs
                });
            }
            if (vodChs.length > 0) {
                vodSecs.push({
                    ...sec,
                    channels: vodChs
                });
            }
        });

        // Categorie / chips disponibili per LIVE
        const liveChips = liveSecs.map(sec => ({
            id: sec.title.toLowerCase().trim(),
            label: sec.title,
            count: sec.channels.length
        }));

        // Categorie / chips disponibili per VOD
        const vodChips = vodSecs.map(sec => ({
            id: sec.title.toLowerCase().trim(),
            label: sec.title,
            count: sec.channels.length
        }));

        return {
            eventiLiveSections: liveSecs,
            eventiVodSections: vodSecs,
            eventiLiveSubCategories: liveChips,
            eventiVodSubCategories: vodChips
        };
    }, [categories, filter, deferredSearch]);

    // Sezioni filtrate LIVE per Eventi
    const filteredEventiLiveSections = React.useMemo(() => {
        if (filter !== "eventi") return [];
        return eventiLiveSections.filter(sec => shouldShowSubCategory(sec, eventiLiveSubFilter));
    }, [eventiLiveSections, filter, eventiLiveSubFilter]);

    // Sezioni filtrate VOD per Eventi
    const filteredEventiVodSections = React.useMemo(() => {
        if (filter !== "eventi") return [];
        return eventiVodSections.filter(sec => shouldShowSubCategory(sec, eventiVodSubFilter));
    }, [eventiVodSections, filter, eventiVodSubFilter]);

    const filteredSections = categories
        .filter(sec => shouldShowGroup(sec, filter))
        .filter(sec => shouldShowSubCategory(sec, subFilter))
        .map(sec => {
            if (!deferredSearch.trim()) return sec;
            const q = deferredSearch.toLowerCase().trim();
            return {
                ...sec,
                channels: sec.channels.filter(c => matchesChannel(c, q))
            };
        }).filter(sec => sec.channels.length > 0);

    // Se l'utente e' su dispositivo Mobile (rilevato in modo deterministico), renderizza la versione Mobile nativa
    if (isMobile) {
        return (
            <MobileHomeView
                filter={filter}
                onFilterChange={handleFilterChange}
                subFilter={subFilter}
                onSubFilterChange={handleSelectSubFilter}
                eventiLiveSubFilter={eventiLiveSubFilter}
                onEventiLiveSubFilterChange={setEventiLiveSubFilter}
                eventiVodSubFilter={eventiVodSubFilter}
                onEventiVodSubFilterChange={setEventiVodSubFilter}
                eventiLiveSections={filteredEventiLiveSections}
                eventiVodSections={filteredEventiVodSections}
                eventiLiveSubCategories={eventiLiveSubCategories}
                eventiVodSubCategories={eventiVodSubCategories}
                categories={categories}
                loading={loading}
                dynamicSubCategories={dynamicSubCategories}
                search={search}
                setSearch={setSearch}
                isSearchOpen={isSearchOpen}
                setIsSearchOpen={setIsSearchOpen}
            />
        );
    }

    return (
        <div className={`desktop-home ${mounted ? "is-mounted" : "is-mounting"}`} style={{ display: "block", minHeight: "140vh" }}>
            <Navbar
                activeFilter={filter}
                onFilterChange={handleFilterChange}
                activeSubFilter={subFilter}
                onSubFilterChange={handleSelectSubFilter}
                onSelectCategoryAndSub={handleSelectCategoryAndSub}
                dynamicSubCategories={dynamicSubCategories}
                isSearchOpen={isSearchOpen}
                setIsSearchOpen={setIsSearchOpen}
                searchVal={search}
                setSearchVal={setSearch}
                onSearch={(s) => setSearch(s)}
                isClosingSearch={isClosingSearch}
                onCloseSearch={handleCloseSearch}
            />

            {/* HERO NOW A TUTTO SCHERMO (SOLO NEL TAB HOME/ALL E SE LA RICERCA NON È APERTA) */}
            {!isSearchOpen && !isClosingSearch && filter === "all" && (
                <HomeHero categories={categories} />
            )}

            <main className={`home-content ${!isSearchOpen && !isClosingSearch && filter === "all" ? "has-hero" : ""}`}>
                {!isSearchOpen && !isClosingSearch && filter !== "all" && filter !== "eventi" && currentSubCategories.length > 0 && (
                    <SubCategoryChips
                        items={currentSubCategories}
                        activeSubFilter={subFilter}
                        onSelectSubFilter={handleSelectSubFilter}
                    />
                )}

                {(isSearchOpen || isClosingSearch) ? (
                    <SearchView
                        search={search}
                        onSearchChange={(s) => setSearch(s)}
                        categories={categories}
                        isClosing={isClosingSearch}
                    />
                ) : (
                    loading ? (
                        <div className="skeleton-container" style={{ width: "100%" }}>
                            <SkeletonSection cardCount={6} />
                            <SkeletonSection cardCount={6} />
                            <SkeletonSection cardCount={6} />
                        </div>
                    ) : filter === "eventi" ? (
                        /* =======================================================
                           SEPARAZIONE COMPLETA: EVENTI LIVE (SOPRA) & VOD (SOTTO)
                           ======================================================= */
                        <div className="eventi-split-container" style={{ width: "100%" }}>
                            {/* --- BLOCCO 1: EVENTI LIVE (DIRETTA) --- */}
                            <section className="eventi-block live-block">
                                <div className="eventi-block-header">
                                    <div className="eventi-block-title-group">
                                        <span className="eventi-block-badge live">
                                            <span className="eventi-live-pulse-dot"></span>
                                            DIRETTA LIVE
                                        </span>
                                        <h2 className="eventi-block-title">Eventi in Diretta</h2>
                                    </div>
                                </div>

                                {/* Barra Categorie Esclusiva per LIVE */}
                                {eventiLiveSubCategories.length > 0 && (
                                    <div style={{ marginBottom: "20px" }}>
                                        <SubCategoryChips
                                            items={eventiLiveSubCategories}
                                            activeSubFilter={eventiLiveSubFilter}
                                            onSelectSubFilter={(id) => setEventiLiveSubFilter(id)}
                                            allLabel="Tutti i Live"
                                        />
                                    </div>
                                )}

                                {filteredEventiLiveSections.length === 0 ? (
                                    <div className="empty-subfilter-state" style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.4)" }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: "2.4rem", marginBottom: "8px", opacity: 0.7 }}>live_tv</span>
                                        <h3 style={{ fontSize: "1.05rem", color: "#fff", fontWeight: 600 }}>Nessun evento Live disponibile per questa selezione</h3>
                                        {eventiLiveSubFilter !== "all" && (
                                            <button
                                                type="button"
                                                onClick={() => setEventiLiveSubFilter("all")}
                                                style={{ marginTop: "12px", padding: "6px 16px", borderRadius: "999px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                                            >
                                                Mostra tutti i live
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="home-sections-grid">
                                        {filteredEventiLiveSections.map(sec => (
                                            <CarouselSection
                                                key={`live_${sec.title}`}
                                                title={sec.title}
                                                channels={sec.channels}
                                                onExplore={(title, chs) => setExploreData({ title: `${title} (Live)`, channels: chs })}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>

                            {filteredEventiVodSections.length > 0 && (
                            <>
                            {/* Separatore visivo pulito ed elegante */}
                            <div className="eventi-block-divider"></div>

                            {/* --- BLOCCO 2: REPLAY & ON DEMAND (VOD) --- */}
                            <section className="eventi-block vod-block">
                                <div className="eventi-block-header">
                                    <div className="eventi-block-title-group">
                                        <span className="eventi-block-badge vod">
                                            <i className="fas fa-rotate-left" style={{ fontSize: "0.75rem" }}></i>
                                            REPLAY & VOD
                                        </span>
                                        <h2 className="eventi-block-title">Eventi On Demand & Replay</h2>
                                    </div>
                                </div>

                                {/* Barra Categorie Esclusiva per VOD */}
                                {eventiVodSubCategories.length > 0 && (
                                    <div style={{ marginBottom: "20px" }}>
                                        <SubCategoryChips
                                            items={eventiVodSubCategories}
                                            activeSubFilter={eventiVodSubFilter}
                                            onSelectSubFilter={(id) => setEventiVodSubFilter(id)}
                                            allLabel="Tutti i Replay"
                                        />
                                    </div>
                                )}

                                {filteredEventiVodSections.length === 0 ? (
                                    <div className="empty-subfilter-state" style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.4)" }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: "2.4rem", marginBottom: "8px", opacity: 0.7 }}>replay</span>
                                        <h3 style={{ fontSize: "1.05rem", color: "#fff", fontWeight: 600 }}>Nessun evento On Demand disponibile per questa selezione</h3>
                                        {eventiVodSubFilter !== "all" && (
                                            <button
                                                type="button"
                                                onClick={() => setEventiVodSubFilter("all")}
                                                style={{ marginTop: "12px", padding: "6px 16px", borderRadius: "999px", background: "rgba(0,229,155,0.12)", border: "1px solid rgba(0,229,155,0.4)", color: "#00e59b", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                                            >
                                                Mostra tutti i replay
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="home-sections-grid">
                                        {filteredEventiVodSections.map(sec => (
                                            <CarouselSection
                                                key={`vod_${sec.title}`}
                                                title={sec.title}
                                                channels={sec.channels}
                                                onExplore={(title, chs) => setExploreData({ title: `${title} (Replay)`, channels: chs })}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                            </>
                            )}
                        </div>
                    ) : (
                        filteredSections.length === 0 ? (
                            <div className="empty-subfilter-state" style={{ textAlign: "center", padding: "80px 20px", color: "rgba(255,255,255,0.4)" }}>
                                <span className="material-symbols-rounded" style={{ fontSize: "2.8rem", marginBottom: "8px", opacity: 0.7 }}>filter_list_off</span>
                                <h3 style={{ fontSize: "1.15rem", color: "#fff", fontWeight: 600 }}>Nessun evento o canale in questa sottocategoria al momento</h3>
                                <button
                                    type="button"
                                    onClick={() => handleSelectSubFilter("all")}
                                    style={{ marginTop: "14px", padding: "8px 18px", borderRadius: "999px", background: "rgba(0,229,155,0.12)", border: "1px solid rgba(0,229,155,0.4)", color: "#00e59b", fontWeight: 600, cursor: "pointer" }}
                                >
                                    Mostra tutti
                                </button>
                            </div>
                        ) : (
                            <div className="home-sections-grid">
                                {filteredSections.map(sec => (
                                    <CarouselSection
                                        key={sec.title}
                                        title={sec.title}
                                        channels={sec.channels}
                                        onExplore={(title, chs) => setExploreData({ title, channels: chs })}
                                    />
                                ))}
                            </div>
                        )
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
