"use client";
import React, { useRef, useEffect } from "react";

export default function SkeletonSection({ cardCount = 6 }) {
    const wrapperRef = useRef(null);

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
                const cardW = Math.floor((w - totalGapSpace) / numCards);
                wrapper.style.setProperty("--card-width", `${cardW}px`);
            }
        };

        const resizeObserver = new ResizeObserver(updateCardWidth);
        resizeObserver.observe(wrapper);
        updateCardWidth();

        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div className="home-section skeleton-section" aria-hidden="true">
            <div className="category-header-container">
                <div className="category-header-left" style={{ display: "flex", alignItems: "center" }}>
                    <div className="skeleton-item skeleton-shimmer" style={{ width: "160px", height: "26px", borderRadius: "6px" }} />
                    <div className="skeleton-item skeleton-shimmer" style={{ width: "75px", height: "20px", borderRadius: "10px", marginLeft: "14px" }} />
                </div>
                <div className="category-header-right">
                    <div className="carousel-top-nav" style={{ display: "flex", gap: "8px" }}>
                        <div className="skeleton-item skeleton-shimmer" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                        <div className="skeleton-item skeleton-shimmer" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                    </div>
                </div>
            </div>

            <div className="carousel-wrapper" ref={wrapperRef}>
                <div className="home-carousel" style={{ overflow: "hidden" }}>
                    {Array.from({ length: cardCount }).map((_, idx) => (
                        <div key={idx} className="now-card-wrapper skeleton-card-wrapper">
                            <div className="now-card skeleton-card skeleton-shimmer"></div>
                            <div className="now-card-info-external" style={{ marginTop: "10px" }}>
                                <div className="skeleton-item skeleton-shimmer" style={{ width: "60px", height: "12px", borderRadius: "4px", marginBottom: "8px" }} />
                                <div className="skeleton-item skeleton-shimmer" style={{ width: "78%", height: "15px", borderRadius: "4px" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
