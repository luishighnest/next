"use client";
import React, { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

/* NOTA CRITICA: qui NON si usa useSearchParams() di proposito.
   next/navigation lo risolve solo sul client: se la navbar globale (che sta
   nel layout root) chiama quell'hook, Next butta fuori l'intero albero dal
   rendering statico e spedisce una pagina con <div> vuoti + <template
   BAILOUT_TO_CLIENT_SIDE_RENDERING>. Il sito risultava completamente vuoto
   fino al download e all'esecuzione del bundle JS, su ogni pagina tranne
   quelle dinamiche (/eventi/[slug]), che invece venivano renderizzate server.
   Leggiamo la query string direttamente dal browser: la navbar resta
   renderizzabile lato server e identica su tutte le route. */
function readParam(name) {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(name);
}

export default function GlobalNavbarInner() {
    const pathname = usePathname();
    const router = useRouter();

    const [searchVal, setSearchVal] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isClosingSearch, setIsClosingSearch] = useState(false);
    const [subParam, setSubParam] = useState("all");

    // Sincronizza i parametri URL -> stato. `usePathname` non cambia quando
    // cambia solo la query string, quindi si ascolta anche popstate per il
    // back/forward del browser.
    useEffect(() => {
        const sync = () => {
            const q = readParam("search");
            if (q !== null && q !== undefined) {
                if (q === "open" || q === "focus" || q === "") {
                    setSearchVal("");
                    setIsSearchOpen(true);
                } else {
                    setSearchVal(q);
                    setIsSearchOpen(true);
                }
            }
            setSubParam(readParam("sub") || "all");
        };
        sync();
        window.addEventListener("popstate", sync);
        return () => window.removeEventListener("popstate", sync);
    }, [pathname]);

    const getActiveFilter = () => {
        if (!pathname) return "all";
        if (pathname === "/sport") return "sport";
        if (pathname.startsWith("/sport/")) return null;
        if (pathname === "/intrattenimento") return "intrattenimento";
        if (pathname === "/eventi") return "eventi";
        if (pathname.startsWith("/eventi/")) return null;
        if (pathname.startsWith("/vod")) return "vod";
        if (pathname === "/home" || pathname === "/") return "all";
        return null;
    };

    const activeFilter = getActiveFilter();
    const activeSubFilter = subParam;

    const go = useCallback((target, cleanFilter, subId) => {
        // Aggiorna lo stato locale insieme alla navigazione: con usePathname
        // da solo la sottocategoria non si aggiornerebbe cambiando solo la query.
        setSubParam(subId || "all");
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("nmdz:change_tab", { detail: { tab: cleanFilter, sub: subId || "all" } }));
        }
        router.push(target);
    }, [router]);

    const handleFilterChange = (cleanFilter) => {
        let target = "/home";
        if (cleanFilter === "sport") target = "/sport";
        else if (cleanFilter === "intrattenimento") target = "/intrattenimento";
        else if (cleanFilter === "eventi") target = "/eventi";
        else if (cleanFilter === "vod") target = "/vod";

        go(target, cleanFilter, "all");
    };

    const handleSubFilterChange = (subId) => {
        const currentFilter = getActiveFilter();
        const base = currentFilter === "all" ? "/home" : `/${currentFilter}`;
        const target = subId && subId !== "all" ? `${base}?sub=${encodeURIComponent(subId)}` : base;

        go(target, currentFilter, subId || "all");
    };

    const handleSelectCategoryAndSub = (macroTab, subId) => {
        const cleanMacro = (macroTab === "home" || macroTab === "all") ? "all" : macroTab;
        const base = cleanMacro === "all" ? "/home" : `/${cleanMacro}`;
        const target = subId && subId !== "all" ? `${base}?sub=${encodeURIComponent(subId)}` : base;

        go(target, cleanMacro, subId || "all");
    };

    const handleCloseSearch = () => {
        if (isClosingSearch) return;
        setIsClosingSearch(true);
        setTimeout(() => {
            setIsSearchOpen(false);
            setIsClosingSearch(false);
            setSearchVal("");
        }, 180);
    };

    return (
        <Navbar
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            activeSubFilter={activeSubFilter}
            onSubFilterChange={handleSubFilterChange}
            onSelectCategoryAndSub={handleSelectCategoryAndSub}
            isSearchOpen={isSearchOpen}
            setIsSearchOpen={setIsSearchOpen}
            searchVal={searchVal}
            setSearchVal={setSearchVal}
            isClosingSearch={isClosingSearch}
            onCloseSearch={handleCloseSearch}
        />
    );
}
