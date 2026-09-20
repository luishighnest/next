import { NextResponse } from "next/server";
import { getStoreData } from "@/lib/db";
import { isStreamWarp } from "@/lib/crypto";
import { getChannelLogoUrl } from "@/lib/epg";
import { createSlug } from "@/lib/slug";
import { runScrape24H } from "@/lib/scraper";
import { syncDaznLiveEvents } from "@/lib/sync-dazn-live";

export const dynamic = "force-dynamic";

let memoryCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 8000;

let isBackgroundScraping = false;
let lastStaleCheckTime = 0;

let isDaznLiveSyncing = false;
let lastDaznLiveSyncTime = 0;

function checkAndTriggerBackgroundDaznLiveUpdate() {
    const now = Date.now();
    // Non controllare piu di una volta ogni 60 secondi
    if (now - lastDaznLiveSyncTime < 60 * 1000 || isDaznLiveSyncing) {
        return;
    }
    lastDaznLiveSyncTime = now;

    (async () => {
        isDaznLiveSyncing = true;
        try {
            await syncDaznLiveEvents();
        } catch (e) {
            console.error("[Auto-Sync DAZN Live] Errore sync:", e);
        } finally {
            isDaznLiveSyncing = false;
        }
    })();
}

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
    checkAndTriggerBackgroundDaznLiveUpdate();
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
        const skipGuideParam = searchParams.get("guide") === "0";
        if (sourceParam === "sky1" || sourceParam === "sky.json") {
            return NextResponse.json({
                success: true,
                source: "sky1",
                total: sky1Channels.length,
                channels: sky1Channels,
                guide: skipGuideParam ? [] : (guideData || []),
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
                guide: skipGuideParam ? [] : (guideData || []),
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
                    if (cleanTitle.toUpperCase().replace(/\s+/g, "") === "EUROSPORT") {
                        cleanTitle = "Eurosport 1";
                    }

                    let timeStr = "";
                    let dateStr = "";
                    let scheduleLabel = "";
                    let isLiveNow = false;

                    const isDazn1 = cleanTitle.toUpperCase().replace(/\s+/g, "").includes("DAZN1") || (ev.end && ev.end.startsWith("3000"));

                    if (ev.start && !isDazn1) {
                        try {
                            const startD = new Date(ev.start);
                            if (!isNaN(startD.getTime())) {
                                timeStr = startD.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
                                
                                const nowD = new Date();
                                const startRome = startD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });
                                const nowRome = nowD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });

                                const tomorrowD = new Date(nowD.getTime() + 24 * 60 * 60 * 1000);
                                const tomorrowRome = tomorrowD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });

                                const yesterdayD = new Date(nowD.getTime() - 24 * 60 * 60 * 1000);
                                const yesterdayRome = yesterdayD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' });

                                if (startRome === nowRome) {
                                    dateStr = "Oggi";
                                } else if (startRome === tomorrowRome) {
                                    dateStr = "Domani";
                                } else if (startRome === yesterdayRome) {
                                    dateStr = "Ieri";
                                } else {
                                    const dName = startD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short' });
                                    const mName = startD.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short' });
                                    dateStr = dName.charAt(0).toUpperCase() + dName.slice(1) + " " + mName;
                                }

                                scheduleLabel = dateStr ? `${dateStr} • ${timeStr}` : timeStr;

                                if (ev.end) {
                                    const endD = new Date(ev.end);
                                    if (!isNaN(endD.getTime())) {
                                        isLiveNow = (nowD >= startD && nowD <= endD);
                                    } else {
                                        isLiveNow = (nowD >= startD && (nowD.getTime() - startD.getTime()) <= 6 * 60 * 60 * 1000);
                                    }
                                } else {
                                    // Se manca end, l'evento è live per max 6 ore dall'orario di inizio
                                    isLiveNow = (nowD >= startD && (nowD.getTime() - startD.getTime()) <= 6 * 60 * 60 * 1000);
                                }
                            }
                        } catch(e) {}
                    }

                    const isVodEvent = Boolean(
                        ev.is_vod ||
                        (ev.type && ev.type.toLowerCase() === "vod") ||
                        (ev.tile_type && (ev.tile_type.toLowerCase() === "catchup" || ev.tile_type.toLowerCase() === "ondemand" || ev.tile_type.toLowerCase() === "vod")) ||
                        (groupName && groupName.toLowerCase().includes("vod")) ||
                        (ev.mpd && (ev.mpd.includes("-vod.") || ev.mpd.includes("/vod/"))) ||
                        (ev.url && (ev.url.includes("-vod.") || ev.url.includes("/vod/"))) ||
                        (ev.end && new Date(ev.end).getTime() < (Date.now() - 30 * 60 * 1000) && !isDazn1) ||
                        (!ev.end && ev.start && (Date.now() - new Date(ev.start).getTime()) > 6 * 60 * 60 * 1000 && !isDazn1)
                    );

                    let rawStreamUrl = (ev.mpd || ev.url || "").trim();
                    let rawKidKey = (ev.key || ev.kid_key || "").trim();
                    if (rawStreamUrl.includes("|")) {
                        const parts = rawStreamUrl.split("|");
                        rawStreamUrl = parts[0].trim();
                        if (!rawKidKey && parts[1]) {
                            rawKidKey = parts[1].trim();
                        }
                    }

                    const hasValidStream = Boolean(rawStreamUrl);
                    const sourceItem = hasValidStream ? {
                        name: "WARP (Cloudflare)",
                        isWarp: true,
                        url: rawStreamUrl,
                        kid_key: rawKidKey,
                        ua: ev.ua || "",
                        dazn_token: ev.dazn_token || ""
                    } : null;

                    const groupKey = groupName + ":::" + cleanTitle.toLowerCase();
                    if (groupedMap.has(groupKey)) {
                        const existing = groupedMap.get(groupKey);
                        if (sourceItem) {
                            existing.sources.push(sourceItem);
                            if (!existing.url || existing.url.includes(".m3u8")) {
                                existing.url = sourceItem.url;
                                existing.kid_key = sourceItem.kid_key;
                                existing.ua = sourceItem.ua;
                            }
                        }
                    } else {
                        const chObj = {
                            id: cleanTitle,
                            title: cleanTitle,
                            group: groupName,
                            navbar: "eventi",
                            url: rawStreamUrl,
                            kid_key: rawKidKey,
                            provider: ev.provider || "DAZN",
                            logo: ev.image || "/logos/dazn.png",
                            image: ev.image || "",
                            ora: timeStr,
                            data: dateStr,
                            schedule: scheduleLabel,
                            start: ev.start || "",
                            end: ev.end || "",
                            isLiveNow: isLiveNow,
                            isEventVod: isVodEvent,
                            tile_type: ev.tile_type || (isVodEvent ? "CatchUp" : "Live"),
                            ua: ev.ua || "",
                            dazn_token: ev.dazn_token || "",
                            sources: sourceItem ? [sourceItem] : [],
                            isCustom: true,
                            isTestJson: true,
                            slug: createSlug(cleanTitle)
                        };
                        groupedMap.set(groupKey, chObj);
                    }
                });

                const deduplicatedItems = Array.from(groupedMap.values());
                deduplicatedItems.forEach(c => {
                    let warpCount = 0;
                    c.sources.forEach(s => {
                        s.isWarp = true;
                        warpCount++;
                        s.name = c.sources.length > 1 ? `WARP ${warpCount}` : "WARP (Cloudflare)";
                    });
                    orderedChannels.push(c);
                });
            });
        }

        // 5. Inietta Guida TV (Match preciso prioritario, poi fallback senza HD e alias intelligenti)
        if (guideData && Array.isArray(guideData)) {
            const guideMap = new Map();
            guideData.forEach(epgGroup => {
                if (!epgGroup.canale || !Array.isArray(epgGroup.programmi) || epgGroup.programmi.length === 0) return;
                const norm = normalizeEpg(epgGroup.canale);
                if (!guideMap.has(norm)) {
                    guideMap.set(norm, epgGroup.programmi);
                }
            });

            // Tabella di alias per canali con diciture leggermente differenti
            const ALIAS_MAP = {
                "skysportmotogp": "skysportmotogp",
                "skymotogp": "skysportmotogp",
                "skysportf1": "skysportf1",
                "skysportuno": "skysportuno",
                "skysport1": "skysportuno",
                "skysportcalcio": "skysportcalcio",
                "skysporttennis": "skysporttennis",
                "skysport24": "skysport24",
                "skytg24": "skytg24",
                "skycollection": "skycinemacollection",
                "skymtv": "mtv",
                "mtvhd": "mtv",
                "skyarte": "skyarte",
                "skyuno": "skyuno",
                "skyunoplus": "skyunoplus",
                "skyunopiu": "skyunoplus"
            };

            orderedChannels.forEach(c => {
                if (!c.title) return;
                const cNorm = normalizeEpg(c.title);

                // 1. Corrispondenza esatta
                if (guideMap.has(cNorm)) {
                    c.epg = guideMap.get(cNorm);
                    return;
                }

                // 2. Corrispondenza tramite tabella di alias
                if (ALIAS_MAP[cNorm] && guideMap.has(ALIAS_MAP[cNorm])) {
                    c.epg = guideMap.get(ALIAS_MAP[cNorm]);
                    return;
                }

                // 3. Corrispondenza base (esclude suffisso HD / FHD / 4K / numeri canale secondari)
                const cBase = cNorm.replace(/fhd|uhd|4k|1080p|720p|hd/g, "");
                for (const [gNorm, progs] of guideMap.entries()) {
                    const gBase = gNorm.replace(/fhd|uhd|4k|1080p|720p|hd/g, "");
                    if (cBase === gBase && cBase.length > 2) {
                        c.epg = progs;
                        return;
                    }
                    if (ALIAS_MAP[cBase] === gBase) {
                        c.epg = progs;
                        return;
                    }
                }

                // 4. Corrispondenza contenimento (es. "Sky Sport F1 HD" vs "Sky Sport F1")
                for (const [gNorm, progs] of guideMap.entries()) {
                    if (cNorm.length >= 6 && gNorm.length >= 6) {
                        if (cNorm.includes(gNorm) || gNorm.includes(cNorm)) {
                            c.epg = progs;
                            return;
                        }
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
