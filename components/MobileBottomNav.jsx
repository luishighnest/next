"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileBottomNav({ activeFilter, onFilterChange, onOpenSearch }) {
    const pathname = usePathname();

    const tabs = [
        { id: "all", path: "/home", label: "Home", icon: "fa-house" },
        { id: "sport", path: "/sport", label: "Sport", icon: "fa-trophy" },
        { id: "intrattenimento", path: "/intrattenimento", label: "Serie & TV", icon: "fa-tv" },
        { id: "eventi", path: "/eventi", label: "Dirette", icon: "fa-bolt" },
        { id: "vod", path: "/vod", label: "Cinema", icon: "fa-clapperboard" }
    ];

    const handleTabClick = (e, tab) => {
        if (onFilterChange) {
            e.preventDefault();
            onFilterChange(tab.id);
            try {
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (err) {}
        }
    };

    return (
        <nav className="nmdz-mobile-bottom-nav" role="navigation" aria-label="Navigazione Mobile">
            <div className="mobile-bottom-nav-inner">
                {tabs.map((tab) => {
                    const isTabActive = activeFilter === tab.id || (tab.id === "all" && pathname === "/home");
                    return (
                        <Link
                            key={tab.id}
                            href={tab.path}
                            className={`mobile-nav-item ${isTabActive ? "active" : ""}`}
                            onClick={(e) => handleTabClick(e, tab)}
                        >
                            <div className="mobile-nav-icon-wrap">
                                <i className={`fas ${tab.icon} mobile-nav-icon`} />
                                {tab.id === "eventi" && (
                                    <span className="mobile-nav-live-dot" />
                                )}
                            </div>
                            <span className="mobile-nav-label">{tab.label}</span>
                            {isTabActive && <span className="mobile-nav-active-bar" />}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
