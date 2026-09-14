"use client";
import React, { useState, useEffect, useDeferredValue } from "react";
import MobileHeader from "./MobileHeader";
import MobileBottomNav from "./MobileBottomNav";
import MobileHomeHero from "./MobileHomeHero";
import SubCategoryChips from "./SubCategoryChips";
import SearchView from "./SearchView";
import ChannelCard from "./ChannelCard";
import SkeletonSection from "./SkeletonSection";

export default function MobileHomeView({
    filter,
    onFilterChange,
    subFilter,
    onSubFilterChange,
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

    // Filtra sezioni e canali per il mobile
    const filteredSections = categories
        .filter(sec => {
            if (filter === "all") return true;
            const secGroup = (sec.group || "").toLowerCase();
            const secTitle = (sec.title || "").toLowerCase();
            if (filter === "sport") return secGroup.includes("sport") || secTitle.includes("sport") || secGroup.includes("calcio") || secTitle.includes("calcio");
            if (filter === "intrattenimento") return secGroup.includes("intrattenimento") || secTitle.includes("intrattenimento") || secGroup.includes("serie") || secGroup.includes("cinema");
            if (filter === "eventi") return secGroup.includes("eventi") || secTitle.includes("eventi") || secGroup.includes("dazn");
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

            {/* 2. Hero Ottimizzata per Mobile (solo su tab all/home e senza ricerca aperta) */}
            {!isSearchOpen && filter === "all" && (
                <MobileHomeHero categories={categories} />
            )}

            {/* 3. Contenuto Principale con Sottocategorie & Sezioni Streaming */}
            <main className="mobile-main-content">
                {/* Chip sottocategorie con scorrimento orizzontale touch fluido */}
                {!isSearchOpen && filter !== "all" && currentSubCategories.length > 0 && (
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
