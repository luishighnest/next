import { NextResponse } from "next/server";
import { getStoreData } from "@/lib/db";
import { isStreamWarp } from "@/lib/crypto";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";
import { runScrape24H } from "@/lib/scraper";

export const dynamic = "force-dynamic";

let memoryCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 8000;

let isBackgroundScraping = false;
let lastStaleCheckTime = 0;

function checkAndTriggerBackgroundGuidaUpdate() {
    const now = Date.now();
    // Non controllare piu di una volta ogni 15 minuti
    if (now - lastStaleCheckTime < 15 * 60 * 1000 || isBackgroundScraping) {
        return;
    }
    lastStaleCheckTime = now;

    // Esegui in background senza bloccare la risposta HTTP
    (async () => {
        try {
            const todayRome = new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
            const redisGuidaDate = await getStoreData("guida_date");
            if (redisGuidaDate && redisGuidaDate === todayRome) {
                return;
            }

            console.log(`[Auto-Update Guida] Guida non aggiornata per oggi (${redisGuidaDate} vs ${todayRome}). Avvio scraping in background...`);
            isBackgroundScraping = true;
            runScrape24H()
                .then((res) => {
                    console.log("[Auto-Update Guida] Scraping background completato con successo:", res);
                })
                .catch((err) => {
                    console.error("[Auto-Update Guida] Errore processo scraper:", err);
                })
                .finally(() => {
                    isBackgroundScraping = false;
                });
        } catch (err) {
            isBackgroundScraping = false;
            console.error("[Auto-Update Guida] Errore trigger:", err);
        }
    })();
}

function cidFromUrl(u) {
    if (!u) return "";
    const m = u.match(/channel\(([^)]+)\)/i);
    return m ? m[1] : "";
}

function normalizeEpg(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function GET(request) {
    checkAndTriggerBackgroundGuidaUpdate();
    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get("source") || "";
    const tabFilter = (searchParams.get("tab") || searchParams.get("filter") || "").toLowerCase().trim();
    const searchQuery = (searchParams.get("q") || searchParams.get("search") || "").toLowerCase().trim();
    const includeGuide = searchParams.get("guide") === "true" || searchParams.get("include_guide") === "1";

    const hasCustomFilters = Boolean(sourceParam || tabFilter || searchQuery || includeGuide);

    if (!hasCustomFilters && memoryCache && (Date.now() - lastCacheTime < CACHE_TTL_MS)) {
        return NextResponse.json(memoryCache, {
            headers: {
                "Cache-Control": "public, s-maxage=8, stale-while-revalidate=20",
                "X-Cache": "HIT"
            }
        });
    }

    try {
        const [eventiData, sky1Data, sky2Data, catData, guideData] = await Promise.all([
            getStoreData("eventi"),
            getStoreData("sky1"),
            getStoreData("sky2"),
            getStoreData("categorie"),
            getStoreData("guida")
        ]);

        // Helper per estrarre lista canali da un oggetto Sky
        const parseSkyList = (json, allowedGroups, sourceName) => {
            const list = [];
            if (!json) return list;
            const groups = allowedGroups || Object.keys(json);
            groups.forEach(g => {
                const items = json[g];
                if (!Array.isArray(items)) return;
                items.forEach(item => {
                    const url = item.mpd || item.url || "";
                    const cid = cidFromUrl(url) || (item.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    const rawLogo = item.logo || "";
                    const hasValidLogo = rawLogo && !rawLogo.includes("ui-avatars.com");
                    const channelLogo = hasValidLogo ? rawLogo : getChannelLogoUrl({ title: item.name || item.title, group: g });
                    const cleanName = item.name || item.title || "";

                    const channelSlug = createSlug(cleanName);

                    list.push({
                        id: channelSlug,
                        name: cleanName,
                        title: cleanName,
                        group: g,
                        url: url,
                        kid_key: item.key || item.kid_key || "",
                        logo: channelLogo,
                        image: item.image || "",
                        cid: cid,
                        slug: channelSlug,
                        skySource: sourceName,
                        provider: "SKY",
                        isSky: true
                    });
                });
            });
            return list;
        };

        const sky1Channels = parseSkyList(sky1Data, ["Sky Sport", "Sky Intrattenimento"], "sky.json");
        const sky2Channels = parseSkyList(sky2Data, null, "sky2.json");

        // Se è richiesta specificamente una sorgente (per la sezione /sky o per la guida)
        if (sourceParam === "sky1" || sourceParam === "sky.json") {
            return NextResponse.json({
                success: true,
                source: "sky1",
                total: sky1Channels.length,
                channels: sky1Channels,
                guide: guideData || [],
                updatedAt: Date.now()
            }, {
                headers: { "Cache-Control": "no-store, max-age=0" }
            });
        }
        if (sourceParam === "sky2" || sourceParam === "sky2.json") {
            return NextResponse.json({
                success: true,
                source: "sky2",
                total: sky2Channels.length,
                channels: sky2Channels,
                guide: guideData || [],
                updatedAt: Date.now()
            }, {
                headers: { "Cache-Control": "no-store, max-age=0" }
            });
        }
        if (sourceParam === "guida" || sourceParam === "epg") {
            return NextResponse.json({
                success: true,
                source: "guida",
                total: (guideData || []).length,
                guide: guideData || [],
                updatedAt: Date.now()
            }, {
                headers: { "Cache-Control": "no-store, max-age=0" }
            });
        }

        // COSTRUZIONE UNIFICATA PER LA HOME E SEZIONI GENERALI
        const orderedChannels = [];
        const customCategoriesList = [];

        // 1. Canali Sky 1
        sky1Channels.forEach(c => {
            let grp = c.group;
            const grpUpper = grp.toUpperCase();
            if (grpUpper === "NEWS") grp = "Sky Intrattenimento";
            else if (grpUpper.includes("SPORT")) grp = "Sky Sport";
            else grp = "Sky Intrattenimento";

            orderedChannels.push({
                ...c,
                group: grp,
                navbar: grp === "Sky Sport" ? "sport" : "intrattenimento"
            });
        });

        // 2. Canali Sky 2 (Cinema e Bambini per la Home)
        const SKY2_HOME_GROUPS = ["Sky Cinema", "Sky Bambini"];
        sky2Channels.forEach(c => {
            if (SKY2_HOME_GROUPS.includes(c.group)) {
                orderedChannels.push({
                    ...c,
                    navbar: "intrattenimento"
                });
            }
        });

        // 3. Categorie Fisse (Eurosport, SuperTennis, Digitale Terrestre)
        if (catData && Array.isArray(catData.categorie)) {
            catData.categorie.forEach(cat => {
                customCategoriesList.push(cat);
                if (!cat.canali || cat.canali.length === 0) return;
                cat.canali.forEach(c => {
                    if (!c.titolo) return;
                    const cleanTitle = c.titolo;
                    const channelSlug = createSlug(c.slug || cleanTitle);
                    orderedChannels.push({
                        id: channelSlug,
                        title: cleanTitle,
                        name: cleanTitle,
                        group: cat.nome,
                        navbar: cat.navbar || (cat.nome.toLowerCase().includes("sport") ? "sport" : "intrattenimento"),
                        url: c.mpd || c.url || "",
                        kid_key: c.kid_key || c.key || "",
                        provider: c.provider || cat.nome,
                        logo: c.logo ? (c.logo.startsWith("/") ? c.logo : `/logos/${c.logo}`) : "",
                        image: c.image || "",
                        isCustom: true,
                        slug: channelSlug
                    });
                });
            });
        }

        // 4. Eventi DAZN & Live (ex test.json) con deduplicazione WARP / Standard
        if (eventiData) {
            Object.keys(eventiData).forEach(groupName => {
                const items = eventiData[groupName];
                if (!Array.isArray(items) || items.length === 0) return;

                if (!customCategoriesList.some(c => c.nome === groupName)) {
                    customCategoriesList.push({
                        id: groupName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                        nome: groupName,
                        navbar: "eventi"
                    });
                }

                const groupedMap = new Map();
                items.forEach(ev => {
                    if (!ev.name && !ev.title) return;
                    const rawTitle = (ev.name || ev.title).trim();
                    const isWarp = isStreamWarp(rawTitle, ev.mpd || ev.url || "");
                    let cleanTitle = rawTitle.replace(/\s*\(WARP\)\s*/gi, " ")
                                               .replace(/\s*\(HLS\)\s*/gi, " ")
                                               .replace(/\s*\(\d+\)\s*$/g, " ")
                                               .trim();
                    if (cleanTitle.toUpperCase().replace(/\s+/g, "") === "DAZN") {
                        cleanTitle = "DAZN 1";
                    }

                    let timeStr = "";
                    const isDazn1 = cleanTitle.toUpperCase().replace(/\s+/g, "").includes("DAZN1") || (ev.end && ev.end.startsWith("3000"));
                    if (ev.start && !isDazn1) {
                        try {
                            const d = new Date(ev.start);
                            timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                        } catch(e) {}
                    }

                    const sourceItem = {
                        name: isWarp ? "WARP (Cloudflare)" : "Standard",
                        isWarp: isWarp,
                        url: ev.mpd || ev.url || "",
                        kid_key: ev.key || ev.kid_key || "",
                        ua: ev.ua || "",
                        dazn_token: ev.dazn_token || ""
                    };

                    const groupKey = groupName + ":::" + cleanTitle.toLowerCase();
                    if (groupedMap.has(groupKey)) {
                        const existing = groupedMap.get(groupKey);
                        existing.sources.push(sourceItem);
                        if (!isWarp && (!existing.url || existing.url.includes(".m3u8"))) {
                            existing.url = sourceItem.url;
                            existing.kid_key = sourceItem.kid_key;
                            existing.ua = sourceItem.ua;
                        }
                    } else {
                        const chObj = {
                            id: cleanTitle,
                            title: cleanTitle,
                            group: groupName,
                            navbar: "eventi",
                            url: ev.mpd || ev.url || "",
                            kid_key: ev.key || ev.kid_key || "",
                            provider: ev.provider || "DAZN",
                            logo: "/logos/dazn.png",
                            image: ev.image || "",
                            ora: timeStr,
                            sources: [sourceItem],
                            isCustom: true,
                            isTestJson: true,
                            slug: createSlug(cleanTitle)
                        };
                        groupedMap.set(groupKey, chObj);
                    }
                });

                const deduplicatedItems = Array.from(groupedMap.values());
                deduplicatedItems.forEach(c => {
                    const warps = c.sources.filter(s => s.isWarp);
                    const stds = c.sources.filter(s => !s.isWarp);
                    let stdCount = 0;
                    let warpCount = 0;
                    c.sources.forEach(s => {
                        if (s.isWarp) {
                            warpCount++;
                            s.name = warps.length > 1 ? `WARP ${warpCount}` : "WARP (Cloudflare)";
                        } else {
                            stdCount++;
                            s.name = stds.length > 1 ? `Standard ${stdCount}` : "Standard";
                        }
                    });
                    orderedChannels.push(c);
                });
            });
        }

        // 5. Inietta Guida TV (Match preciso prioritario, poi fallback senza HD)
        if (guideData && Array.isArray(guideData)) {
            const guideMap = new Map();
            guideData.forEach(epgGroup => {
                if (!epgGroup.canale || !Array.isArray(epgGroup.programmi) || epgGroup.programmi.length === 0) return;
                const norm = normalizeEpg(epgGroup.canale);
                if (!guideMap.has(norm)) {
                    guideMap.set(norm, epgGroup.programmi);
                }
            });

            orderedChannels.forEach(c => {
                if (!c.title) return;
                const cNorm = normalizeEpg(c.title);

                // 1. Corrispondenza esatta
                if (guideMap.has(cNorm)) {
                    c.epg = guideMap.get(cNorm);
                    return;
                }

                // 2. Corrispondenza base (esclude suffisso HD / FHD / 4K)
                const cBase = cNorm.replace(/fhd|uhd|4k|1080p|720p|hd/g, "");
                for (const [gNorm, progs] of guideMap.entries()) {
                    const gBase = gNorm.replace(/fhd|uhd|4k|1080p|720p|hd/g, "");
                    if (cBase === gBase && cBase.length > 2) {
                        c.epg = progs;
                        return;
                    }
                }
            });
        }

        // 6. Raggruppa e ordina le sezioni
        const groupMap = new Map();
        orderedChannels.forEach(ch => {
            const g = ch.group;
            if (!groupMap.has(g)) {
                groupMap.set(g, {
                    title: g,
                    navbar: ch.navbar || "sport",
                    channels: []
                });
            }
            groupMap.get(g).channels.push(ch);
        });

        const sportPriority = ["Sky Sport", "Eurosport", "SuperTennis"];
        const intrattenimentoPriority = ["Sky Intrattenimento", "Sky Cinema", "Digitale Terrestre", "Sky Bambini"];

        const sortedSections = Array.from(groupMap.values()).sort((secA, secB) => {
            const a = secA.title;
            const b = secB.title;
            const navA = secA.navbar;
            const navB = secB.navbar;

            const macroOrder = { "sport": 1, "intrattenimento": 2, "eventi": 3 };
            const ordA = macroOrder[navA] || 99;
            const ordB = macroOrder[navB] || 99;
            if (ordA !== ordB) return ordA - ordB;

            if (navA === "sport" && navB === "sport") {
                const idxA = sportPriority.indexOf(a);
                const idxB = sportPriority.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
            }

            if (navA === "intrattenimento" && navB === "intrattenimento") {
                const idxA = intrattenimentoPriority.indexOf(a);
                const idxB = intrattenimentoPriority.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
            }

            if (customCategoriesList.length > 0) {
                const idxA = customCategoriesList.findIndex(c => c.nome === a);
                const idxB = customCategoriesList.findIndex(c => c.nome === b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
            }

            return a.localeCompare(b);
        });

        let finalSections = sortedSections;
        if (tabFilter && tabFilter !== "all" && tabFilter !== "home") {
            finalSections = finalSections.filter(sec => {
                if (tabFilter === "eventi") {
                    return sec.navbar === "eventi" || (sec.channels && sec.channels.some(c => c.isTestJson));
                }
                return sec.navbar === tabFilter;
            });
        }

        if (searchQuery) {
            finalSections = finalSections.map(sec => ({
                ...sec,
                channels: (sec.channels || []).filter(c => {
                    if ((c.title || "").toLowerCase().includes(searchQuery)) return true;
                    if ((c.group || "").toLowerCase().includes(searchQuery)) return true;
                    if (Array.isArray(c.epg)) {
                        return c.epg.some(p => (p?.titolo || "").toLowerCase().includes(searchQuery));
                    }
                    return false;
                })
            })).filter(sec => sec.channels.length > 0);
        }

        const totalChannelsCount = finalSections.reduce((acc, sec) => acc + (sec.channels ? sec.channels.length : 0), 0);

        const payload = {
            success: true,
            totalSections: finalSections.length,
            totalChannels: totalChannelsCount,
            sections: finalSections,
            sky1: sky1Channels,
            sky2: sky2Channels,
            updatedAt: Date.now()
        };

        if (includeGuide) {
            payload.guide = guideData || [];
        }

        if (!hasCustomFilters) {
            memoryCache = payload;
            lastCacheTime = Date.now();
        }

        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": "public, s-maxage=8, stale-while-revalidate=20",
                "X-Cache": "MISS"
            }
        });
    } catch (e) {
        console.error("Errore API /api/canali:", e);
        return NextResponse.json({ success: false, error: "Errore caricamento canali", details: String(e) }, { status: 500 });
    }
}
