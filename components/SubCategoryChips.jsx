"use client";
import React, { useRef } from "react";

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
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`subnav-chip ${isActive ? "active" : ""}`}
                            onClick={() => handleSelect(item.id)}
                        >
                            {item.icon && <span className="material-symbols-rounded subnav-chip-icon">{item.icon}</span>}
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
