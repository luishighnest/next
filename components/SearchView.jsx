"use client";
import React, { useState, useEffect, useDeferredValue, useMemo } from "react";
import ChannelCard from "./ChannelCard";

export function matchesChannel(c, q) {
    if (!q) return true;
    const query = q.toLowerCase();
    if ((c.title || "").toLowerCase().includes(query)) return true;
    if ((c.name || "").toLowerCase().includes(query)) return true;
    if ((c.group || "").toLowerCase().includes(query)) return true;
    if ((c.desc || "").toLowerCase().includes(query)) return true;
    if ((c.descrizione || "").toLowerCase().includes(query)) return true;
    if ((c.ora || "").toLowerCase().includes(query)) return true;
    if (Array.isArray(c.epg)) {
        return c.epg.some(p => 
            (p?.titolo || "").toLowerCase().includes(query) ||
            (p?.desc || "").toLowerCase().includes(query) ||
            (p?.descrizione || "").toLowerCase().includes(query) ||
            (p?.ora || "").toLowerCase().includes(query)
        );
    }
    return false;
}

export default function SearchView({
    search = "",
    onSearchChange,
    categories: propCategories,
    onClose,
    onSelectChannel
}) {
    const [localCategories, setLocalCategories] = useState([]);
    const categories = (propCategories && propCategories.length > 0) ? propCategories : localCategories;

    useEffect(() => {
        if (!propCategories || propCategories.length === 0) {
            let loaded = false;
            try {
                const stored = localStorage.getItem("nmdz_cached_sections");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setLocalCategories(parsed);
                        loaded = true;
                    }
                }
            } catch (e) {}

            if (!loaded) {
                fetch(`/api/canali?t=${Date.now()}`, { cache: "no-store" })
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data && Array.isArray(data.sections) && data.sections.length > 0) {
                            setLocalCategories(data.sections);
                            try {
                                localStorage.setItem("nmdz_cached_sections", JSON.stringify(data.sections));
                            } catch(e) {}
                        }
                    })
                    .catch(() => {});
            }
        }
    }, [propCategories]);

    const deferredSearch = useDeferredValue(search);

    const searchResultsChannels = useMemo(() => {
        const q = (deferredSearch || "").trim().toLowerCase();
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

    const handleChipClick = (chip) => {
        if (onSearchChange) onSearchChange(chip);
    };

    const handleReset = () => {
        if (onSearchChange) onSearchChange("");
    };

    return (
        <div className="search-view-container">
            {!deferredSearch.trim() ? (
                <div className="search-empty-prompt">
                    <div className="search-prompt-icon">
                        <i className="fas fa-magnifying-glass"></i>
                    </div>
                    <h2>Cosa vuoi guardare?</h2>
                    <p>Cerca canali, eventi sportivi, serie TV, film o programmazione TV</p>
                    <div className="search-suggestions-chips">
                        <span className="suggestions-label">Suggeriti:</span>
                        {["Sky Sport", "Serie A", "Formula 1", "MotoGP", "Cinema", "DAZN", "Canale 5"].map(chip => (
                            <button
                                key={chip}
                                type="button"
                                className="search-chip-btn"
                                onClick={() => handleChipClick(chip)}
                            >
                                {chip}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="search-results-section">
                    <div className="search-results-header">
                        <h2>
                            Risultati per <span className="search-highlight">&ldquo;{search}&rdquo;</span>
                        </h2>
                        <span className="search-results-count">
                            {searchResultsChannels.length} {searchResultsChannels.length === 1 ? "canale trovato" : "canali ed eventi trovati"}
                        </span>
                    </div>

                    {searchResultsChannels.length > 0 ? (
                        <div className="explore-channels-grid">
                            {searchResultsChannels.map((ch, idx) => (
                                <ChannelCard
                                    key={ch.id || (ch.title + idx)}
                                    channel={ch}
                                    onCardClick={onSelectChannel}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="search-no-results">
                            <i className="fas fa-film"></i>
                            <h3>Nessun risultato trovato</h3>
                            <p>Nessun canale o evento corrisponde alla ricerca per <strong>&ldquo;{search}&rdquo;</strong>.</p>
                            <button
                                type="button"
                                className="search-reset-btn"
                                onClick={handleReset}
                            >
                                Cancella ricerca
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
