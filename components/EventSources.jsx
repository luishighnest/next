"use client";
import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getNormalizedSources } from "@/lib/sources";

const MAX_HEIGHT = 320;
const GAP = 8;

export default function EventSources({ channel, selectedSource, setSelectedSource, variant = "desktop" }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0, openUp: false, openRight: false });
    const toggleRef = useRef(null);

    const realSources = getNormalizedSources(channel).filter(s => Boolean(s && s.url));
    if (!realSources.length) return null;

    const selectedName = (() => {
        if (!selectedSource) return realSources[0]?.name || "";
        const match = realSources.find(s => s.url === selectedSource.url && s.isWarp === selectedSource.isWarp);
        return (match && match.name) || selectedSource.name || "";
    })();

    const updatePosition = () => {
        const el = toggleRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const panelHeight = Math.min(MAX_HEIGHT, 40 + realSources.length * 46);
        const spaceBelow = vh - (r.bottom + GAP);
        const spaceAbove = r.top - GAP;
        const openUp = spaceBelow < panelHeight && spaceAbove > spaceBelow;
        const openRight = r.right > vw - 20;
        setPos({
            top: openUp ? r.top - GAP : r.bottom + GAP,
            left: r.left,
            width: Math.min(r.width, vw - 32),
            openUp,
            openRight: openRight
        });
    };

    const openDropdown = () => {
        updatePosition();
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            const el = toggleRef.current;
            if (el && el.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
        const onResizeOrScroll = () => { updatePosition(); };
        document.addEventListener("click", onDocClick);
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", onResizeOrScroll);
        window.addEventListener("scroll", onResizeOrScroll, true);
        document.body.style.overflow = "";
        return () => {
            document.removeEventListener("click", onDocClick);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", onResizeOrScroll);
            window.removeEventListener("scroll", onResizeOrScroll, true);
        };
    }, [open]);

    const portalRoot = typeof document !== "undefined" ? document.body : null;

    return (
        <>
            <div className="event-sources-widget">
                <button
                    type="button"
                    ref={toggleRef}
                    className={`event-sources-dropdown-toggle ${open ? "is-open" : ""}`}
                    onClick={() => { if (open) setOpen(false); else openDropdown(); }}
                    aria-expanded={open}
                    aria-haspopup="listbox"
                >
                    <span className="event-sources-dropdown-toggle-icon">
                        <i className={`fa-solid ${sourcesIcons(selectedName)}`} />
                    </span>
                    <span className="event-sources-dropdown-toggle-label">{selectedName}</span>
                    <span className="event-sources-dropdown-count">{realSources.length}</span>
                    <i className={`fa-solid fa-chevron-down event-sources-dropdown-arrow ${open ? "is-open" : ""}`} />
                </button>
            </div>

            {open && portalRoot && createPortal(
                <div
                    className={`event-sources-dropdown ${open ? "is-open" : ""} ${pos.openUp ? "open-up" : ""} ${pos.openRight ? "open-right" : ""} ${variant === "mobile" ? "is-mobile" : ""}`}
                    style={{ top: pos.top, left: pos.left, width: pos.width }}
                    role="listbox"
                >
                    <ul className="event-sources-dropdown-list">
                        {realSources.map((s, idx) => {
                            const isSelected = selectedSource?.url === s.url && selectedSource?.isWarp === s.isWarp;
                            return (
                                <li key={s.name + idx}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`event-sources-dropdown-item ${isSelected ? "active" : ""}`}
                                        onClick={() => { setSelectedSource(s); setOpen(false); }}
                                    >
                                        <span className="event-sources-dropdown-item-icon">
                                            <i className={`fa-solid ${sourcesIcons(s.name)}`} />
                                        </span>
                                        <span className="event-sources-dropdown-item-name">{s.name}</span>
                                        {isSelected && <i className="fa-solid fa-check event-sources-dropdown-item-check" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>,
                portalRoot
            )}
        </>
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