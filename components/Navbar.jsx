"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SettingsModal from "./SettingsModal";

export default function Navbar({ activeFilter, onFilterChange, onSearch, hideSideIslands }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchVal, setSearchVal] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isNavHidden, setIsNavHidden] = useState(false);
    const searchWrapperRef = useRef(null);
    const searchInputRef = useRef(null);

    // Su /sky e singole pagine evento (/eventi/[slug], /evento/[slug]), logo e cerca/impostazioni scompaiono
    const isEventDetailPage = pathname ? (
        (pathname.startsWith("/eventi/") && pathname !== "/eventi") ||
        pathname.startsWith("/evento/")
    ) : false;
    const isSkyPage = pathname ? pathname.startsWith("/sky") : false;
    const shouldHideSides = hideSideIslands !== undefined
        ? hideSideIslands
        : (isSkyPage || isEventDetailPage);

    useEffect(() => {
        let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        let ticking = false;

        function updateScroll() {
            const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
            if (currentScrollY <= 10) {
                setIsNavHidden(false);
            } else if (currentScrollY > lastScrollY && currentScrollY > 15) {
                setIsNavHidden(true);
            } else if (currentScrollY < lastScrollY) {
                setIsNavHidden(false);
            }
            lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
            ticking = false;
        }

        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(updateScroll);
                ticking = true;
            }
        }

        function onWheel(e) {
            const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
            if (e.deltaY > 10 && currentScrollY > 15) {
                setIsNavHidden(true);
            } else if (e.deltaY < -8) {
                setIsNavHidden(false);
            }
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("wheel", onWheel, { passive: true });
        window.addEventListener("touchmove", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("touchmove", onScroll);
        };
    }, []);

    useEffect(() => {
        setIsNavHidden(false);
    }, [pathname, activeFilter]);

    const handleNavClick = (filter) => {
        const cleanFilter = (filter === "home" || filter === "all") ? "all" : filter;
        let targetPath = "/home";
        if (cleanFilter === "sport") targetPath = "/sport";
        else if (cleanFilter === "intrattenimento") targetPath = "/intrattenimento";
        else if (cleanFilter === "eventi") targetPath = "/eventi";

        if (onFilterChange) {
            onFilterChange(cleanFilter);
        } else {
            router.push(targetPath);
        }
    };

    useEffect(() => {
        if (!isSearchOpen) return;

        function handleClickOutside(e) {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
                handleCloseSearch();
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside, { passive: true });

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [isSearchOpen]);

    const handleSearchInput = (e) => {
        const val = e.target.value;
        setSearchVal(val);
        if (onSearch) onSearch(val);
    };

    const handleOpenSearch = () => {
        setIsSearchOpen(true);
        setTimeout(() => {
            if (searchInputRef.current) searchInputRef.current.focus();
        }, 80);
    };

    const handleCloseSearch = () => {
        setIsSearchOpen(false);
        setSearchVal("");
        if (onSearch) onSearch("");
    };

    return (
        <>
            <div className={`home-header-wrapper ${isNavHidden ? "nav-hidden" : ""}`} id="home-header-wrapper">
                <div className={`home-header-islands ${shouldHideSides ? "nav-single-island" : ""}`}>
                    {/* ISOLA 1: Logo Brand Autonomo (Scompare su /sky e su /eventi/[slug]) */}
                    {!shouldHideSides && (
                        <div className="nav-island nav-island-left">
                            <Link href="/home" className="brand-island-link" title="NMDZ - Home" aria-label="NMDZ Home">
                                <img src="/logos/premium_logo_dark.jpg" alt="Logo" className="home-brand-logo" />
                            </Link>
                        </div>
                    )}

                    {/* ISOLA 2: Navigazione Principale a Capsule al Centro */}
                    <nav className="nav-island nav-island-center" aria-label="Navigazione principale">
                        <Link
                            href="/home"
                            className={`nav-link ${activeFilter === "all" ? "active" : ""}`}
                            onClick={(e) => { e.preventDefault(); handleNavClick("all"); }}
                        >
                            <i className="fas fa-house"></i>
                            <span className="nav-label">Home</span>
                        </Link>
                        <Link
                            href="/sport"
                            className={`nav-link ${activeFilter === "sport" ? "active" : ""}`}
                            onClick={(e) => { e.preventDefault(); handleNavClick("sport"); }}
                        >
                            <i className="fas fa-trophy"></i>
                            <span className="nav-label">Sport</span>
                        </Link>
                        <Link
                            href="/intrattenimento"
                            className={`nav-link ${activeFilter === "intrattenimento" ? "active" : ""}`}
                            onClick={(e) => { e.preventDefault(); handleNavClick("intrattenimento"); }}
                        >
                            <i className="fas fa-masks-theater"></i>
                            <span className="nav-label">Intrattenimento</span>
                        </Link>
                        <Link
                            href="/eventi"
                            className={`nav-link ${activeFilter === "eventi" ? "active" : ""}`}
                            onClick={(e) => { e.preventDefault(); handleNavClick("eventi"); }}
                        >
                            <i className="fas fa-ticket"></i>
                            <span className="nav-label">Eventi</span>
                        </Link>
                    </nav>

                    {/* ISOLA 3: Azioni Interattive (Cerca + Impostazioni) (Scompare su /sky e su /eventi/[slug]) */}
                    {!shouldHideSides && (
                        <div className="nav-island nav-island-right">
                            <div className={`header-search-wrapper ${isSearchOpen ? "active" : ""}`} ref={searchWrapperRef}>
                                <button
                                    type="button"
                                    className={`search-icon-btn ${isSearchOpen ? "hidden" : ""}`}
                                    onClick={handleOpenSearch}
                                    aria-label="Cerca"
                                    title="Cerca canali, eventi, guida TV"
                                >
                                    <i className="fas fa-magnifying-glass"></i>
                                </button>

                                <div className={`header-search-container ${isSearchOpen ? "open" : ""}`}>
                                    <span className="material-symbols-rounded search-icon">search</span>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        className="home-search-input"
                                        placeholder="Cerca canali, eventi..."
                                        value={searchVal}
                                        onChange={handleSearchInput}
                                        onKeyDown={(e) => {
                                            if (e.key === "Escape") handleCloseSearch();
                                            if (e.key === "Enter" && !onSearch && searchVal.trim()) {
                                                router.push(`/home?search=${encodeURIComponent(searchVal.trim())}`);
                                            }
                                        }}
                                    />
                                    {isSearchOpen && (
                                        <button
                                            type="button"
                                            className="search-close-btn"
                                            onClick={handleCloseSearch}
                                            style={{ background: "transparent", border: "none", color: "rgba(255, 255, 255, 0.7)", cursor: "pointer", display: "flex", alignItems: "center", padding: "2px" }}
                                            title="Chiudi ricerca (Esc)"
                                            aria-label="Chiudi ricerca"
                                        >
                                            <span className="material-symbols-rounded" style={{ fontSize: "1.2rem" }}>close</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="island-separator"></div>

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
                    )}
                </div>
            </div>

            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </>
    );
}
