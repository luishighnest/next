"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SettingsModal from "./SettingsModal";

export default function Navbar({ activeFilter, onFilterChange, onSearch }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchVal, setSearchVal] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isNavHidden, setIsNavHidden] = useState(false);

    useEffect(() => {
        let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

        function handleScroll() {
            const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
            if (currentScrollY <= 10) {
                setIsNavHidden(false);
            } else if (currentScrollY > lastScrollY && currentScrollY > 25) {
                setIsNavHidden(true);
            } else if (currentScrollY < lastScrollY) {
                setIsNavHidden(false);
            }
            lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
        }

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("touchmove", handleScroll, { passive: true });
        window.addEventListener("wheel", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("touchmove", handleScroll);
            window.removeEventListener("wheel", handleScroll);
        };
    }, []);

    const handleNavClick = (filter) => {
        if (onFilterChange) {
            onFilterChange(filter);
        } else {
            router.push(filter === "all" ? "/" : `/?tab=${filter}`);
        }
    };

    const handleSearchInput = (e) => {
        const val = e.target.value;
        setSearchVal(val);
        if (onSearch) onSearch(val);
    };

    const handleCloseSearch = () => {
        setIsSearchOpen(false);
        setSearchVal("");
        if (onSearch) onSearch("");
    };

    return (
        <>
            <div className={`home-header-wrapper ${isNavHidden ? "nav-hidden" : ""}`} id="home-header-wrapper">
                <div className="home-header">
                    <div className="header-left">
                        <Link href="/">
                            <img src="/logos/premium_logo_dark.jpg" alt="Logo" className="home-brand-logo" />
                        </Link>
                        <nav className="home-nav">
                            <button
                                type="button"
                                className={`nav-link ${activeFilter === "all" ? "active" : ""}`}
                                onClick={() => handleNavClick("all")}
                            >
                                <i className="fas fa-house" style={{ marginRight: "6px" }}></i>Home
                            </button>
                            <button
                                type="button"
                                className={`nav-link ${activeFilter === "sport" ? "active" : ""}`}
                                onClick={() => handleNavClick("sport")}
                            >
                                <i className="fas fa-trophy" style={{ marginRight: "6px" }}></i>Sport
                            </button>
                            <button
                                type="button"
                                className={`nav-link ${activeFilter === "intrattenimento" ? "active" : ""}`}
                                onClick={() => handleNavClick("intrattenimento")}
                            >
                                <i className="fas fa-masks-theater" style={{ marginRight: "6px" }}></i>Intrattenimento
                            </button>
                            <button
                                type="button"
                                className={`nav-link ${activeFilter === "eventi" ? "active" : ""}`}
                                onClick={() => handleNavClick("eventi")}
                            >
                                <i className="fas fa-ticket" style={{ marginRight: "6px" }}></i>Eventi
                            </button>
                        </nav>
                        <div className="nav-separator"></div>
                        <button
                            type="button"
                            className="settings-icon-btn"
                            onClick={() => setIsSettingsOpen(true)}
                            aria-label="Impostazioni"
                            title="Impostazioni"
                        >
                            <i className="fas fa-gear"></i>
                        </button>
                    </div>

                    <div className={`header-search-wrapper ${isSearchOpen ? "active" : ""}`} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        {!isSearchOpen && (
                            <button
                                type="button"
                                className="search-icon-btn"
                                onClick={() => setIsSearchOpen(true)}
                                aria-label="Cerca"
                                title="Cerca canali, eventi, guida TV"
                            >
                                <i className="fas fa-magnifying-glass"></i>
                            </button>
                        )}
                        {isSearchOpen && (
                            <div className="header-search-container open" style={{ display: "flex", width: "270px", opacity: 1, pointerEvents: "all", padding: "6px 10px 6px 14px", background: "rgba(20, 20, 20, 0.95)", border: "1px solid rgba(255, 255, 255, 0.25)", borderRadius: "99px" }}>
                                <span className="material-symbols-rounded search-icon" style={{ fontSize: "1.2rem", color: "rgba(255, 255, 255, 0.6)", marginRight: "8px", alignSelf: "center" }}>search</span>
                                <input
                                    type="text"
                                    className="home-search-input"
                                    placeholder="Cerca canali, eventi, guida TV..."
                                    value={searchVal}
                                    onChange={handleSearchInput}
                                    onKeyDown={(e) => { if (e.key === "Escape") handleCloseSearch(); }}
                                    autoFocus
                                    style={{ flex: 1, background: "transparent", border: "none", color: "#fff", outline: "none", fontSize: "0.88rem" }}
                                />
                                <button
                                    type="button"
                                    className="search-close-btn"
                                    onClick={handleCloseSearch}
                                    style={{ background: "transparent", border: "none", color: "rgba(255, 255, 255, 0.7)", cursor: "pointer", display: "flex", alignItems: "center", padding: "2px" }}
                                    title="Chiudi ricerca (Esc)"
                                >
                                    <span className="material-symbols-rounded" style={{ fontSize: "1.2rem" }}>close</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </>
    );
}
