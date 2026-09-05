"use client";
import React, { useState, useRef, useEffect } from "react";
import ChannelCard from "./ChannelCard";

export default function CarouselSection({ title, channels, onExplore, isRelated = false }) {
    const wrapperRef = useRef(null);
    const scrollRef = useRef(null);
    const btnLeftRef = useRef(null);
    const btnRightRef = useRef(null);

    const updateArrows = () => {
        const grid = scrollRef.current;
        if (!grid) return;
        if (btnLeftRef.current) {
            if (grid.scrollLeft <= 5) {
                btnLeftRef.current.classList.add("arrow-disabled");
            } else {
                btnLeftRef.current.classList.remove("arrow-disabled");
            }
        }
        if (btnRightRef.current) {
            if (Math.ceil(grid.scrollLeft + grid.clientWidth) >= grid.scrollWidth - 5) {
                btnRightRef.current.classList.add("arrow-disabled");
            } else {
                btnRightRef.current.classList.remove("arrow-disabled");
            }
        }
    };

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const updateCardWidth = () => {
            const w = wrapper.clientWidth;
            if (w > 0) {
                let numCards = 5;
                if (window.innerWidth <= 768) {
                    numCards = 2;
                } else if (window.innerWidth <= 1100) {
                    numCards = 3;
                } else if (window.innerWidth <= 1350) {
                    numCards = 4;
                }
                const gapCount = numCards - 1;
                const totalGapSpace = gapCount * 16;
                const cardW = (w - totalGapSpace) / numCards;
                wrapper.style.setProperty("--card-width", `${cardW}px`);
                wrapper.dataset.cardsPerView = numCards;
                updateArrows();
            }
        };

        const resizeObserver = new ResizeObserver(updateCardWidth);
        resizeObserver.observe(wrapper);
        updateCardWidth();

        const grid = scrollRef.current;
        if (grid) {
            grid.addEventListener("scroll", updateArrows, { passive: true });
        }

        return () => {
            resizeObserver.disconnect();
            if (grid) {
                grid.removeEventListener("scroll", updateArrows);
            }
        };
    }, []);

    const scroll = (direction) => {
        const wrapper = wrapperRef.current;
        const grid = scrollRef.current;
        if (wrapper && grid) {
            const scrollAmount = wrapper.clientWidth + 16;
            const targetLeft = direction === "left" ? grid.scrollLeft - scrollAmount : grid.scrollLeft + scrollAmount;
            grid.scrollTo({ left: targetLeft, behavior: "smooth" });
        }
    };

    if (!channels || channels.length === 0) return null;

    const count = channels.length;
    const isTestJsonGroup = channels.some(c => c.isTestJson || (c.group && c.group.toUpperCase().replace(/\s+/g, "").includes("EVENTI")));
    const badgeLabel = isTestJsonGroup
        ? `${count} ${count === 1 ? "evento" : "eventi"}`
        : `${count} ${count === 1 ? "canale" : "canali"}`;

    return (
        <div className={isRelated ? "" : "home-section"}>
            <div className="category-header-container" style={isRelated ? { marginBottom: "16px", marginTop: "28px" } : {}}>
                <div className="category-header-left">
                    {isRelated ? (
                        <h2 className="related-title" style={{ margin: 0 }}>{title}</h2>
                    ) : (
                        <h2>{title}</h2>
                    )}
                    <span className="category-count-badge">
                        {badgeLabel}
                    </span>
                </div>
                <div className="category-header-right" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    {!isRelated && onExplore && (
                        <button
                            type="button"
                            className="explore-all-btn"
                            onClick={() => onExplore(title, channels)}
                        >
                            Esplora tutti
                            <span className="material-symbols-rounded" style={{ fontSize: "1.1rem", marginLeft: "2px" }}>
                                arrow_forward
                            </span>
                        </button>
                    )}
                    <div className="carousel-top-nav">
                        <button
                            ref={btnLeftRef}
                            type="button"
                            className="top-nav-btn left"
                            onClick={() => scroll("left")}
                            aria-label="Precedente"
                        >
                            <span className="material-symbols-rounded">chevron_left</span>
                        </button>
                        <button
                            ref={btnRightRef}
                            type="button"
                            className="top-nav-btn right"
                            onClick={() => scroll("right")}
                            aria-label="Successivo"
                        >
                            <span className="material-symbols-rounded">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="carousel-wrapper" ref={wrapperRef}>
                <div className="home-carousel" ref={scrollRef}>
                    {channels.map((ch, idx) => (
                        <ChannelCard key={ch.id || (ch.title + idx)} channel={ch} />
                    ))}
                </div>
            </div>
        </div>
    );
}
