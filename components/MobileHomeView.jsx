"use client";
import { useDeferredValue } from "react";
import MobileHeader from "./MobileHeader";
import MobileBottomNav from "./MobileBottomNav";
import SubCategoryChips from "./SubCategoryChips";
import SearchView from "./SearchView";
import ChannelCard from "./ChannelCard";
import SkeletonSection from "./SkeletonSection";

export default function MobileHomeView({
    filter,
    onFilterChange,
    subFilter,
    onSubFilterChange,
    eventiLiveSubFilter = "all",
    onEventiLiveSubFilterChange,
    eventiVodSubFilter = "all",
    onEventiVodSubFilterChange,
    eventiLiveSections = [],
    eventiVodSections = [],
    eventiLiveSubCategories = [],
    eventiVodSubCategories = [],
    categories = [],
    loading = false,
    dynamicSubCategories = {},
    search = "",
    setSearch,
    isSearchOpen = false,
    setIsSearchOpen
}) {
    const deferredSearch = useDeferredValue(search);

    const currentSubCategories = dynamicSubCategories[filter] || [];

    // Filtra sezioni e canali per il mobile (per tab generici diversi da eventi)
    const filteredSections = categories
        .filter(sec => {
            if (filter === "all") return true;
            const secGroup = (sec.group || "").toLowerCase();
            const secTitle = (sec.title || "").toLowerCase();
            if (filter === "sport") return secGroup.includes("sport") || secTitle.includes("sport") || secGroup.includes("calcio") || secTitle.includes("calcio");
            if (filter === "intrattenimento") return secGroup.includes("intrattenimento") || secTitle.includes("intrattenimento") || secGroup.includes("serie") || secGroup.includes("cinema");
            return true;
        })
        .map(sec => {
            if (!deferredSearch.trim()) return sec;
            const q = deferredSearch.toLowerCase().trim();
            return {
                ...sec,
                channels: sec.channels.filter(c => (c.title || c.name || "").toLowerCase().includes(q))
            };
        })
        .filter(sec => sec.channels.length > 0);

    return (
        <div className="nmdz-mobile-view-container">
            {/* 1. Header Nativo Mobile Superiore */}
            <MobileHeader
                onOpenSearch={() => setIsSearchOpen(true)}
                isSearchOpen={isSearchOpen}
            />

            {/* 2. Contenuto Principale con Sottocategorie & Sezioni Streaming */}
            <main className="mobile-main-content">
                {/* Chip sottocategorie con scorrimento orizzontale touch fluido (solo per tab NON eventi) */}
                {!isSearchOpen && filter !== "all" && filter !== "eventi" && currentSubCategories.length > 0 && (
                    <div className="mobile-chips-wrapper">
                        <SubCategoryChips
                            items={currentSubCategories}
                            activeSubFilter={subFilter}
                            onSelectSubFilter={onSubFilterChange}
                        />
                    </div>
                )}

                {isSearchOpen ? (
                    <div className="mobile-search-area">
                        <SearchView
                            search={search}
                            onSearchChange={(s) => setSearch(s)}
                            categories={categories}
                        />
                    </div>
                ) : loading ? (
                    <div className="mobile-skeleton-wrap">
                        <SkeletonSection cardCount={4} />
                        <SkeletonSection cardCount={4} />
                    </div>
                ) : filter === "eventi" ? (
                    /* =======================================================
                       MOBILE EVENTI: LIVE (SOPRA) & VOD (SOTTO) SEPARATI
                       ======================================================= */
                    <div className="mobile-eventi-split">
                        {/* --- BLOCCO LIVE MOBILE --- */}
                        <div className="mobile-eventi-live-section" style={{ marginBottom: "32px" }}>
                            <div className="mobile-section-header" style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className="eventi-block-badge live" style={{ fontSize: "0.72rem", padding: "3px 10px" }}>
                                    <span className="eventi-live-pulse-dot"></span>
                                    DIRETTA LIVE
                                </span>
                                <h2 className="mobile-section-title" style={{ margin: 0, fontSize: "1.1rem" }}>Eventi Live</h2>
                            </div>

                            {/* Categorie Live */}
                            {eventiLiveSubCategories.length > 0 && (
                                <div className="mobile-chips-wrapper" style={{ marginBottom: "14px" }}>
                                    <SubCategoryChips
                                        items={eventiLiveSubCategories}
                                        activeSubFilter={eventiLiveSubFilter}
                                        onSelectSubFilter={onEventiLiveSubFilterChange}
                                        allLabel="Tutti i Live"
                                    />
                                </div>
                            )}

                            {eventiLiveSections.length === 0 ? (
                                <div className="mobile-empty-state" style={{ padding: "30px 16px" }}>
                                    <span className="material-symbols-rounded">live_tv</span>
                                    <p>Nessun evento Live per questa categoria</p>
                                    {eventiLiveSubFilter !== "all" && (
                                        <button
                                            type="button"
                                            onClick={() => onEventiLiveSubFilterChange && onEventiLiveSubFilterChange("all")}
                                            style={{ marginTop: "10px", padding: "6px 14px", borderRadius: "999px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", fontSize: "0.8rem", fontWeight: 600 }}
                                        >
                                            Mostra tutti
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="mobile-sections-flow">
                                    {eventiLiveSections.map((sec) => (
                                        <section key={`live_m_${sec.title}`} className="mobile-section-block">
                                            <div className="mobile-section-header">
                                                <h2 className="mobile-section-title">{sec.title}</h2>
                                                <span className="mobile-section-count">{sec.channels.length}</span>
                                            </div>
                                            <div className="mobile-horizontal-scroll">
                                                {sec.channels.map((channel, i) => (
                                                    <div key={(channel.id || channel.title) + i} className="mobile-card-slot">
                                                        <ChannelCard
                                                            channel={channel}
                                                            categoryName={sec.title}
                                                            priority={i < 2}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Divisore elegante */}
                        <div className="eventi-block-divider" style={{ margin: "24px 0" }}></div>

                        {/* --- BLOCCO VOD MOBILE --- */}
                        <div className="mobile-eventi-vod-section">
                            <div className="mobile-section-header" style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className="eventi-block-badge vod" style={{ fontSize: "0.72rem", padding: "3px 10px" }}>
                                    <i className="fas fa-rotate-left" style={{ fontSize: "0.7rem" }}></i>
                                    REPLAY & VOD
                                </span>
                                <h2 className="mobile-section-title" style={{ margin: 0, fontSize: "1.1rem" }}>Replay & On Demand</h2>
                            </div>

                            {/* Categorie VOD */}
                            {eventiVodSubCategories.length > 0 && (
                                <div className="mobile-chips-wrapper" style={{ marginBottom: "14px" }}>
                                    <SubCategoryChips
                                        items={eventiVodSubCategories}
                                        activeSubFilter={eventiVodSubFilter}
                                        onSelectSubFilter={onEventiVodSubFilterChange}
                                        allLabel="Tutti i Replay"
                                    />
                                </div>
                            )}

                            {eventiVodSections.length === 0 ? (
                                <div className="mobile-empty-state" style={{ padding: "30px 16px" }}>
                                    <span className="material-symbols-rounded">replay</span>
                                    <p>Nessun evento On Demand per questa categoria</p>
                                    {eventiVodSubFilter !== "all" && (
                                        <button
                                            type="button"
                                            onClick={() => onEventiVodSubFilterChange && onEventiVodSubFilterChange("all")}
                                            style={{ marginTop: "10px", padding: "6px 14px", borderRadius: "999px", background: "rgba(0,229,155,0.12)", border: "1px solid rgba(0,229,155,0.4)", color: "#00e59b", fontSize: "0.8rem", fontWeight: 600 }}
                                        >
                                            Mostra tutti
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="mobile-sections-flow">
                                    {eventiVodSections.map((sec) => (
                                        <section key={`vod_m_${sec.title}`} className="mobile-section-block">
                                            <div className="mobile-section-header">
                                                <h2 className="mobile-section-title">{sec.title}</h2>
                                                <span className="mobile-section-count">{sec.channels.length}</span>
                                            </div>
                                            <div className="mobile-horizontal-scroll">
                                                {sec.channels.map((channel, i) => (
                                                    <div key={(channel.id || channel.title) + i} className="mobile-card-slot">
                                                        <ChannelCard
                                                            channel={channel}
                                                            categoryName={sec.title}
                                                            priority={i < 2}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : filteredSections.length === 0 ? (
                    <div className="mobile-empty-state">
                        <span className="material-symbols-rounded">tv_off</span>
                        <p>Nessun canale disponibile in questa categoria</p>
                    </div>
                ) : (
                    <div className="mobile-sections-flow">
                        {filteredSections.map((sec) => (
                            <section key={sec.title} className="mobile-section-block">
                                <div className="mobile-section-header">
                                    <h2 className="mobile-section-title">{sec.title}</h2>
                                    <span className="mobile-section-count">{sec.channels.length}</span>
                                </div>
                                <div className="mobile-horizontal-scroll">
                                    {sec.channels.map((channel, i) => (
                                        <div key={(channel.id || channel.title) + i} className="mobile-card-slot">
                                            <ChannelCard
                                                channel={channel}
                                                categoryName={sec.title}
                                                priority={i < 2}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* 4. Bottom Navigation Bar Stile Native Streaming App */}
            <MobileBottomNav
                activeFilter={filter}
                onFilterChange={onFilterChange}
                onOpenSearch={() => setIsSearchOpen(true)}
            />
        </div>
    );
}
