"use client";
import { useRef } from "react";

export default function SubCategoryChips({
    items = [],
    activeSubFilter = "all",
    onSelectSubFilter,
    allLabel = "Tutti"
}) {
    const scrollRef = useRef(null);

    if (!items || items.length === 0) return null;

    const allItems = [
        { id: "all", label: allLabel },
        ...items
    ];

    const handleSelect = (id) => {
        if (onSelectSubFilter) {
            onSelectSubFilter(id);
        }
    };

    return (
        <div className="subnav-chips-wrapper">
            <div className="subnav-chips-container" ref={scrollRef}>
                {allItems.map((item) => {
                    const isActive = activeSubFilter === item.id;
                    let iconClass = "fas fa-circle-dot";
                    if (item.id === "all") iconClass = "fas fa-layer-group";
                    else if (item.id === "movie") iconClass = "fas fa-film";
                    else if (item.id === "tv") iconClass = "fas fa-tv";
                    else if (item.id.includes("sky") || item.id.includes("sport") || item.id.includes("calcio")) iconClass = "fas fa-trophy";
                    else if (item.id.includes("tennis")) iconClass = "fas fa-baseball-bat-ball";
                    else if (item.id.includes("f1") || item.id.includes("motori")) iconClass = "fas fa-flag-checkered";

                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`subnav-chip ${isActive ? "active" : ""}`}
                            onClick={() => handleSelect(item.id)}
                        >
                            <i className={`${iconClass} subnav-chip-icon`} aria-hidden="true"></i>
                            <span className="subnav-chip-label">{item.label}</span>
                            {typeof item.count === "number" && item.count > 0 && (
                                <span className="subnav-chip-count">{item.count}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
