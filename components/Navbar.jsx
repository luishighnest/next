"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SettingsModal from "./SettingsModal";

export default function Navbar({
    activeFilter,
    onFilterChange,
    onSearch,
    hideSideIslands,
    isSearchOpen: propIsSearchOpen,
    setIsSearchOpen: propSetIsSearchOpen,
    searchVal: propSearchVal,
    setSearchVal: propSetSearchVal
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [localIsSearchOpen, setLocalIsSearchOpen] = useState(false);
    const [localSearchVal, setLocalSearchVal] = useState("");

    const isSearchOpen = propIsSearchOpen !== undefined ? propIsSearchOpen : localIsSearchOpen;
    const setIsSearchOpen = propSetIsSearchOpen || setLocalIsSearchOpen;
    const searchVal = propSearchVal !== undefined ? propSearchVal : localSearchVal;
    const setSearchVal = propSetSearchVal || setLocalSearchVal;

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

    const lastScrollYRef = useRef(0);

    useEffect(() => {
        let ticking = false;

        function getScrollY() {
            return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || window.scrollY || 0;
        }

        function updateScroll() {
            const currentScrollY = getScrollY();
            const lastScrollY = lastScrollYRef.current;

            if (currentScrollY <= 8) {
                setIsNavHidden(false);
            } else if (currentScrollY > lastScrollY && currentScrollY > 8) {
                setIsNavHidden(true);
            } else if (currentScrollY < lastScrollY) {
                setIsNavHidden(false);
            }

            lastScrollYRef.current = currentScrollY <= 0 ? 0 : currentScrollY;
            ticking = false;
        }

        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(updateScroll);
                ticking = true;
            }
        }

        function onWheel(e) {
            const currentScrollY = getScrollY();
            if (e.deltaY > 6) {
                if (currentScrollY > 6 || e.deltaY > 15) {
                    setIsNavHidden(true);
                }
            } else if (e.deltaY < -6) {
                setIsNavHidden(false);
            }
        }

        window.addEventListener("scroll", onScroll, { passive: true, capture: true });
        document.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("wheel", onWheel, { passive: true, capture: true });
        document.addEventListener("wheel", onWheel, { passive: true });
        window.addEventListener("touchmove", onScroll, { passive: true, capture: true });
        document.addEventListener("touchmove", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true });
            document.removeEventListener("scroll", onScroll);
            window.removeEventListener("wheel", onWheel, { capture: true });
            document.removeEventListener("wheel", onWheel);
            window.removeEventListener("touchmove", onScroll, { capture: true });
            document.removeEventListener("touchmove", onScroll);
        };
    }, []);

    useEffect(() => {
        setIsNavHidden(false);
        setIsSearchOpen(false);
        const cur = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || window.scrollY || 0;
        lastScrollYRef.current = cur;
    }, [pathname, activeFilter]);

    const handleNavClick = (filter) => {
        const cleanFilter = (filter === "home" || filter === "all") ? "all" : filter;
        let targetPath = "/home";
        if (cleanFilter === "sport") targetPath = "/sport";
        else if (cleanFilter === "intrattenimento") targetPath = "/intrattenimento";
        else if (cleanFilter === "eventi") targetPath = "/eventi";

        try {
            window.scrollTo({ top: 0, behavior: "instant" });
        } catch(e) {
            window.scrollTo(0, 0);
        }
        setIsNavHidden(false);
        lastScrollYRef.current = 0;

        if (onFilterChange) {
            onFilterChange(cleanFilter);
        } else {
            router.push(targetPath);
        }
    };

    useEffect(() => {
        if (!isSearchOpen) return;

        function handleKeyDown(e) {
            if (e.key === "Escape") {
                handleCloseSearch();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isSearchOpen]);

    const handleSearchChange = (val) => {
        setSearchVal(val);
        if (onSearch) onSearch(val);
    };

    const handleOpenSearch = () => {
        setIsSearchOpen(true);
        setTimeout(() => {
            if (searchInputRef.current) searchInputRef.current.focus();
        }, 60);
    };

    const handleCloseSearch = () => {
        setIsSearchOpen(false);
        setSearchVal("");
        if (onSearch) onSearch("");
    };

    const isHidden = isNavHidden && !isSearchOpen;

    return (
        <>
            <div className={`home-header-wrapper ${isHidden ? "nav-hidden" : ""} ${isSearchOpen ? "search-mode-active" : ""}`} id="home-header-wrapper">
                {isSearchOpen ? (
                    <div className="home-search-fullbar-container" ref={searchWrapperRef}>
                        <div className="home-search-fullbar">
                            <i className="fas fa-magnifying-glass search-fullbar-icon"></i>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="search-fullbar-input"
                                placeholder="Cerca film, serie TV, eventi sportivi, canali..."
                                value={searchVal}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                autoFocus
                            />
                            {searchVal && (
                                <button
                                    type="button"
                                    className="search-fullbar-clear-btn"
                                    onClick={() => handleSearchChange("")}
                                    aria-label="Cancella testo"
                                    title="Cancella testo"
                                >
                                    <i className="fas fa-circle-xmark"></i>
                                </button>
                            )}
                            <button
                                type="button"
                                className="search-fullbar-close-btn"
                                onClick={handleCloseSearch}
                                aria-label="Chiudi ricerca"
                                title="Chiudi ricerca (Esc)"
                            >
                                <span className="close-text">Chiudi</span>
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                ) : (
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
                                <button
                                    type="button"
                                    className="search-icon-btn"
                                    onClick={handleOpenSearch}
                                    aria-label="Cerca"
                                    title="Cerca canali, eventi, film..."
                                >
                                    <i className="fas fa-magnifying-glass"></i>
                                </button>

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
                )}
            </div>

            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </>
    );
}
