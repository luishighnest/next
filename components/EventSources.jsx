"use client";
import React, { useRef, useState } from "react";
import { getNormalizedSources } from "@/lib/sources";

export default function EventSources({ channel, selectedSource, setSelectedSource, variant = "desktop" }) {
    const [open, setOpen] = useState(false);
    const scrollRef = useRef(null);

    const realSources = getNormalizedSources(channel).filter(s => Boolean(s && s.url));
    if (!realSources.length) return null;

    const selectedName = (() => {
        if (!selectedSource) return realSources[0]?.name || "";
        const match = realSources.find(s => s.url === selectedSource.url && s.isWarp === selectedSource.isWarp);
        return (match && match.name) || selectedSource.name || "";
    })();

    const scrollBy = (dir) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * 180, behavior: "smooth" });
    };

    return (
        <div className={`event-sources-widget ${variant === "mobile" ? "is-mobile" : ""}`}>
            <div className="event-sources-widget-head">
                <span className="event-sources-widget-label">
                    Sorgenti <b className="event-sources-widget-count">{realSources.length}</b>
                </span>
                <span className="event-sources-widget-current">{selectedName}</span>
            </div>

            {realSources.length <= 4 ? (
                <div className="event-sources-widget-pills">
                    {realSources.map((s, idx) => {
                        const isSelected = selectedSource?.url === s.url && selectedSource?.isWarp === s.isWarp;
                        return (
                            <button
                                key={s.name + idx}
                                type="button"
                                className={`event-sources-chip ${isSelected ? "active" : ""}`}
                                onClick={() => setSelectedSource(s)}
                            >
                                {s.isWarp ? (
                                    <i className="fa-solid fa-shield-halved" />
                                ) : (
                                    <i className="fa-solid fa-bolt" />
                                )}
                                <span>{s.name}</span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="event-sources-widget-drawer">
                    <button
                        type="button"
                        className={`event-sources-widget-toggle ${open ? "is-open" : ""}`}
                        onClick={() => setOpen(o => !o)}
                        aria-expanded={open}
                    >
                        <span className="event-sources-widget-toggle-icon">
                            <i className={`fa-solid ${sourcesIcons(selectedName)}`} />
                        </span>
                        <span className="event-sources-widget-toggle-label">{selectedName}</span>
                        <i className={`fa-solid fa-chevron-down event-sources-widget-arrow ${open ? "is-open" : ""}`} />
                    </button>

                    {open && (
                        <div className="event-sources-widget-scroller">
                            <button type="button" className="event-sources-widget-nav" onClick={() => scrollBy(-1)} aria-label="Indietro">
                                <i className="fa-solid fa-chevron-left" />
                            </button>
                            <div className="event-sources-widget-track" ref={scrollRef}>
                                {realSources.map((s, idx) => {
                                    const isSelected = selectedSource?.url === s.url && selectedSource?.isWarp === s.isWarp;
                                    return (
                                        <button
                                            key={s.name + idx}
                                            type="button"
                                            className={`event-sources-chip ${isSelected ? "active" : ""}`}
                                            onClick={() => { setSelectedSource(s); setOpen(false); }}
                                        >
                                            {s.isWarp ? (
                                                <i className="fa-solid fa-shield-halved" />
                                            ) : (
                                                <i className="fa-solid fa-bolt" />
                                            )}
                                            <span>{s.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <button type="button" className="event-sources-widget-nav" onClick={() => scrollBy(1)} aria-label="Avanti">
                                <i className="fa-solid fa-chevron-right" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function sourcesIcons(name) {
    const n = (name || "").toUpperCase();
    if (n.includes("SKY")) return "fa-satellite-dish";
    if (n.includes("APPLE")) return "fa-apple-whole";
    if (n.includes("SPORTSCAST")) return "fa-tower-broadcast";
    if (n.includes("RUSSIA")) return "fa-globe";
    if (n.includes("FANCODE") || n.includes("DUDE")) return "fa-users";
    return "fa-satellite-dish";
}