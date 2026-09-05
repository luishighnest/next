"use client";
import React, { useRef } from "react";
import ChannelCard from "./ChannelCard";

export default function CarouselSection({ title, channels }) {
    const scrollRef = useRef(null);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = direction === "left" ? -600 : 600;
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
        }
    };

    if (!channels || channels.length === 0) return null;

    return (
        <div className="home-section" style={{ marginBottom: "36px" }}>
            <div className="category-header-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h2 className="related-title" style={{ margin: 0 }}>{title}</h2>
                <div className="category-header-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="carousel-top-nav" style={{ display: "flex", gap: "6px" }}>
                        <button type="button" className="top-nav-btn left" onClick={() => scroll("left")}>
                            <span className="material-symbols-rounded">chevron_left</span>
                        </button>
                        <button type="button" className="top-nav-btn right" onClick={() => scroll("right")}>
                            <span className="material-symbols-rounded">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="carousel-wrapper">
                <div className="home-carousel" ref={scrollRef} style={{ display: "flex", gap: "16px", overflowX: "auto", scrollBehavior: "smooth", paddingBottom: "10px" }}>
                    {channels.map((ch, idx) => (
                        <ChannelCard key={ch.id || ch.title + idx} channel={ch} />
                    ))}
                </div>
            </div>
        </div>
    );
}
