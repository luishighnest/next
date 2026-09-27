"use client";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function GlobalNavbarInner() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [searchVal, setSearchVal] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isClosingSearch, setIsClosingSearch] = useState(false);

    useEffect(() => {
        const q = searchParams ? searchParams.get("search") : null;
        if (q !== null && q !== undefined) {
            if (q === "open" || q === "focus" || q === "") {
                setSearchVal("");
                setIsSearchOpen(true);
            } else {
                setSearchVal(q);
                setIsSearchOpen(true);
            }
        }
    }, [searchParams]);

    const getActiveFilter = () => {
        if (!pathname) return "all";
        if (pathname === "/sport" || pathname.startsWith("/sport/")) return null;
        if (pathname === "/intrattenimento") return "intrattenimento";
        if (pathname === "/eventi" || pathname.startsWith("/eventi/")) return null;
        if (pathname.startsWith("/vod")) return "vod";
        if (pathname === "/home" || pathname === "/") return "all";
        return null;
    };

    const activeFilter = getActiveFilter();
    const activeSubFilter = searchParams ? searchParams.get("sub") || "all" : "all";

    const handleFilterChange = (cleanFilter) => {
        let target = "/home";
        if (cleanFilter === "sport") target = "/sport";
        else if (cleanFilter === "intrattenimento") target = "/intrattenimento";
        else if (cleanFilter === "eventi") target = "/eventi";
        else if (cleanFilter === "vod") target = "/vod";

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("nmdz:change_tab", { detail: { tab: cleanFilter, sub: "all" } }));
        }
        router.push(target);
    };

    const handleSubFilterChange = (subId) => {
        const currentFilter = getActiveFilter();
        const base = currentFilter === "all" ? "/home" : `/${currentFilter}`;
        const target = subId && subId !== "all" ? `${base}?sub=${encodeURIComponent(subId)}` : base;

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("nmdz:change_tab", { detail: { tab: currentFilter, sub: subId || "all" } }));
        }
        router.push(target);
    };

    const handleSelectCategoryAndSub = (macroTab, subId) => {
        const cleanMacro = (macroTab === "home" || macroTab === "all") ? "all" : macroTab;
        const base = cleanMacro === "all" ? "/home" : `/${cleanMacro}`;
        const target = subId && subId !== "all" ? `${base}?sub=${encodeURIComponent(subId)}` : base;

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("nmdz:change_tab", { detail: { tab: cleanMacro, sub: subId || "all" } }));
        }
        router.push(target);
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
