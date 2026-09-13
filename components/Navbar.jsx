"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SettingsModal from "./SettingsModal";
import SearchView from "./SearchView";
import GuidaTvModal from "./GuidaTvModal";

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
    const [isGuidaTvOpen, setIsGuidaTvOpen] = useState(false);
    const [isNavHidden, setIsNavHidden] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [siteTime, setSiteTime] = useState("");
    const searchWrapperRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        setMounted(true);
        function updateSiteClock() {
            setSiteTime(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        }
        updateSiteClock();
        const t = setInterval(updateSiteClock, 10000);
        return () => clearInterval(t);
    }, []);

    // La navbar ha la STESSA identica dimensione, struttura e posizione della Home su tutte le sezioni (Home, Sky, Evento)
    const isSkyPage = pathname ? pathname.startsWith("/sky") : false;
    const shouldHideSides = false;

    const lastScrollYRef = useRef(0);

    useEffect(() => {
        if (isSkyPage) {
            setIsNavHidden(false);
            setIsScrolled(false);
            return;
        }

        let ticking = false;

        function getScrollY() {
            return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || window.scrollY || 0;
        }

        function updateScroll() {
            if (isSkyPage) {
                setIsNavHidden(false);
                setIsScrolled(false);
                ticking = false;
                return;
            }

            const currentScrollY = getScrollY();
            const lastScrollY = lastScrollYRef.current;
            const delta = currentScrollY - lastScrollY;

            setIsScrolled(currentScrollY > 15);

            // Se siamo vicini alla cima della pagina, mostra sempre la navbar
            if (currentScrollY <= 25) {
                setIsNavHidden(false);
            } 
            // Se scrolliamo verso il BASSO (con almeno 4px di movimento effettivo)
            else if (delta > 4 && currentScrollY > 35) {
                setIsNavHidden(true);
            } 
            // Se scrolliamo verso l'ALTO (con almeno 4px di movimento effettivo)
            else if (delta < -4) {
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

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
        };
    }, [isSkyPage, pathname]);

    useEffect(() => {
        setIsNavHidden(false);
        setIsSearchOpen(false);
        const cur = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || window.scrollY || 0;
        lastScrollYRef.current = cur;
        setIsScrolled(cur > 15);
    }, [pathname, activeFilter, isSkyPage]);

    const handleNavClick = (filter) => {
        const cleanFilter = (filter === "home" || filter === "all") ? "all" : filter;
        let targetPath = "/home";
        if (cleanFilter === "sport") targetPath = "/sport";
        else if (cleanFilter === "intrattenimento") targetPath = "/intrattenimento";
        else if (cleanFilter === "eventi") targetPath = "/eventi";
        else if (cleanFilter === "vod") targetPath = "/vod";

        try {
            window.scrollTo({ top: 0, behavior: "instant" });
        } catch(e) {
            window.scrollTo(0, 0);
        }
        setIsNavHidden(false);
        setIsScrolled(false);
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

    const isStandaloneSearch = onSearch === undefined;

    useEffect(() => {
        if (isStandaloneSearch && isSearchOpen) {
            const originalHtmlOverflow = document.documentElement.style.overflow;
            const originalBodyOverflow = document.body.style.overflow;
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";
            return () => {
                document.documentElement.style.overflow = originalHtmlOverflow;
                document.body.style.overflow = originalBodyOverflow;
            };
        }
    }, [isStandaloneSearch, isSearchOpen]);

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
            <div className={`home-header-wrapper ${mounted ? "is-mounted" : "is-mounting"} ${isHidden ? "nav-hidden" : ""} ${isSearchOpen ? "search-mode-active" : ""} ${isScrolled ? "header-scrolled" : "header-top"}`} id="home-header-wrapper">
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
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        if (onSearch) {
                                            onSearch(searchVal);
                                        } else if (searchVal.trim()) {
                                            router.push(`/home?search=${encodeURIComponent(searchVal.trim())}`);
                                        }
                                    }
                                }}
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
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="home-header-dock-container">
                        <header className="home-header-dock" role="banner">
                            {/* SEZIONE 1: BRAND LOGO + OROLOGIO */}
                            <div className="dock-group dock-group-left">
                                <Link
                                    href="/home"
                                    className="dock-brand-link"
                                    title="NMDZ - Home"
                                    aria-label="NMDZ Home"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleCloseSearch();
                                        handleNavClick("all");
                                    }}
                                >
                                    <svg className="dock-brand-logo-svg" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <polygon points="3.67,166.42 67.08,220.26 67.08,459.18 3.67,511.97" />
                                        <polygon points="12.2,5.03 221.73,182.93 221.73,456.97 240.23,439.46 240.23,5.03 289.49,5.03 289.49,392.83 240.23,439.46 221.73,456.97 289.49,511.97 289.49,439.46 508.33,270.03 314.16,157.02 314.16,236.42 431.11,304.38 314.16,394.94 314.16,346.06 228.61,427.11 67.08,290.01 67.08,51.81" />
                                    </svg>
                                </Link>

                                <div className="dock-site-clock" title="Orario attuale" suppressHydrationWarning>
                                    {mounted ? siteTime : ""}
                                </div>
                            </div>

                            {/* SEZIONE 2: NAVIGAZIONE CON ICONE + TITOLO (Perfettamente centrata) */}
                            <nav className="dock-group dock-group-center" aria-label="Navigazione principale">
                                <Link
                                    href="/home"
                                    className={`dock-nav-link ${activeFilter === "all" ? "active" : ""}`}
                                    onClick={(e) => { e.preventDefault(); handleNavClick("all"); }}
                                >
                                    <i className="fas fa-house dock-icon"></i>
                                    <span className="dock-label">Home</span>
                                </Link>
                                <Link
                                    href="/sport"
                                    className={`dock-nav-link ${activeFilter === "sport" ? "active" : ""}`}
                                    onClick={(e) => { e.preventDefault(); handleNavClick("sport"); }}
                                >
                                    <i className="fas fa-trophy dock-icon"></i>
                                    <span className="dock-label">Sport</span>
                                </Link>
                                <Link
                                    href="/intrattenimento"
                                    className={`dock-nav-link ${activeFilter === "intrattenimento" ? "active" : ""}`}
                                    onClick={(e) => { e.preventDefault(); handleNavClick("intrattenimento"); }}
                                >
                                    <i className="fas fa-tv dock-icon"></i>
                                    <span className="dock-label">Intrattenimento</span>
                                </Link>
                                <Link
                                    href="/eventi"
                                    className={`dock-nav-link ${activeFilter === "eventi" ? "active" : ""}`}
                                    onClick={(e) => { e.preventDefault(); handleNavClick("eventi"); }}
                                >
                                    <i className="fas fa-bolt dock-icon"></i>
                                    <span className="dock-label">Eventi</span>
                                </Link>
                                <Link
                                    href="/vod"
                                    className={`dock-nav-link ${activeFilter === "vod" ? "active" : ""}`}
                                    onClick={(e) => { e.preventDefault(); handleNavClick("vod"); }}
                                >
                                    <i className="fas fa-clapperboard dock-icon"></i>
                                    <span className="dock-label">Vod</span>
                                </Link>
                            </nav>

                            {/* SEZIONE 3: AZIONI (CERCA, GUIDA TV, IMPOSTAZIONI) */}
                            <div className="dock-group dock-group-right">
                                <button
                                    type="button"
                                    className="dock-action-btn search-icon-btn"
                                    onClick={handleOpenSearch}
                                    aria-label="Cerca"
                                    title="Cerca canali, eventi, film..."
                                >
                                    <i className="fas fa-magnifying-glass"></i>
                                </button>

                                <button
                                    type="button"
                                    className={`dock-action-btn guidatv-icon-btn ${isGuidaTvOpen ? "active" : ""}`}
                                    onClick={() => setIsGuidaTvOpen(true)}
                                    aria-label="Guida TV"
                                    title="Guida TV EPG"
                                >
                                    <i className="fas fa-calendar-days"></i>
                                </button>

                                <button
                                    type="button"
                                    className="dock-action-btn settings-icon-btn"
                                    onClick={() => setIsSettingsOpen(true)}
                                    aria-label="Impostazioni"
                                    title="Impostazioni"
                                >
                                    <i className="fas fa-gear"></i>
                                </button>
                            </div>
                        </header>
                    </div>
                )}
            </div>
            
            {isStandaloneSearch && isSearchOpen && (
                <div 
                    className="global-search-modal-overlay" 
                    onClick={(e) => {
                        if (e.target.classList.contains("global-search-modal-overlay")) {
                            handleCloseSearch();
                        }
                    }}
                >
                    <SearchView
                        search={searchVal}
                        onSearchChange={handleSearchChange}
                        onClose={handleCloseSearch}
                        onSelectChannel={handleCloseSearch}
                    />
                </div>
            )}

            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
            <GuidaTvModal isOpen={isGuidaTvOpen} onClose={() => setIsGuidaTvOpen(false)} />
        </>
    );
}
