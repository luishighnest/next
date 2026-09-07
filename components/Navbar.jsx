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

    // La navbar ha la STESSA identica dimensione, struttura e posizione della Home su tutte le sezioni (Home, Sky, Evento)
    const isSkyPage = pathname ? pathname.startsWith("/sky") : false;
    const shouldHideSides = false;

    const lastScrollYRef = useRef(0);

    useEffect(() => {
        if (isSkyPage) {
            setIsNavHidden(false);
            return;
        }

        let ticking = false;

        function getScrollY() {
            return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || window.scrollY || 0;
        }

        function updateScroll() {
            if (isSkyPage) {
                setIsNavHidden(false);
                ticking = false;
                return;
            }

            const currentScrollY = getScrollY();
            const lastScrollY = lastScrollYRef.current;
            const delta = currentScrollY - lastScrollY;

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

        function onWheel(e) {
            if (isSkyPage) return;
            const currentScrollY = getScrollY();
            if (e.deltaY > 8) {
                if (currentScrollY > 35) {
                    setIsNavHidden(true);
                }
            } else if (e.deltaY < -8) {
                setIsNavHidden(false);
            }
        }

        let touchStartY = 0;
        function onTouchStart(e) {
            if (e.touches && e.touches[0]) {
                touchStartY = e.touches[0].clientY;
            }
        }

        function onTouchMove(e) {
            if (isSkyPage) return;
            if (!e.touches || !e.touches[0]) return;
            const currentTouchY = e.touches[0].clientY;
            const diff = touchStartY - currentTouchY;
            const currentScrollY = getScrollY();

            if (currentScrollY <= 25) {
                setIsNavHidden(false);
            } else if (diff > 8 && currentScrollY > 35) {
                setIsNavHidden(true);
            } else if (diff < -8) {
                setIsNavHidden(false);
            }
        }

        window.addEventListener("scroll", onScroll, { passive: true, capture: true });
        document.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("wheel", onWheel, { passive: true, capture: true });
        document.addEventListener("wheel", onWheel, { passive: true });
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });

        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true });
            document.removeEventListener("scroll", onScroll);
            window.removeEventListener("wheel", onWheel, { capture: true });
            document.removeEventListener("wheel", onWheel);
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove, { capture: true });
        };
    }, [isSkyPage, pathname]);

    useEffect(() => {
        setIsNavHidden(false);
        setIsSearchOpen(false);
        const cur = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || window.scrollY || 0;
        lastScrollYRef.current = cur;
    }, [pathname, activeFilter, isSkyPage]);

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
                                <span className="close-text">Chiudi</span>
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Wordmark Vettoriale Stile tv.apple.com (Trasparente, a filo sinistro, senza cornice o pallino) */}
                        {!shouldHideSides && (
                            <Link href="/home" className="apple-tv-brand-wordmark" title="NMDZ - Home" aria-label="NMDZ Home">
                                <img src="/logos/nmdz_monogram.png" alt="NMDZ" className="brand-wordmark-symbol" />
                                <span className="brand-wordmark-text">NMDZ</span>
                            </Link>
                        )}

                        <div className={`home-header-islands ${shouldHideSides ? "nav-single-island" : ""}`}>

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
                </>
                )}
            </div>

            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </>
    );
}
