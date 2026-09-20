import { NextResponse } from "next/server";
import { getStoreData, setStoreData } from "@/lib/db";
import { createSlug, matchSlug } from "@/lib/slug";

const API_SECRET_KEY = process.env.API_SECRET_KEY || "zadonkais_secret_2026";

function checkAuth(request) {
    const key = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
    return key === API_SECRET_KEY;
}

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");
        const query = (searchParams.get("q") || searchParams.get("search") || "").toLowerCase().trim();
        const format = searchParams.get("format");
        const eventi = await getStoreData("eventi_mpd") || {};

        if (category) {
            const list = eventi[category] || [];
            const filtered = query ? list.filter(e => (e.name || e.title || "").toLowerCase().includes(query)) : list;
            return NextResponse.json({
                success: true,
                category,
                count: filtered.length,
                events: filtered
            }, {
                headers: { "Cache-Control": "no-store, max-age=0" }
            });
        }

        if (query) {
            const results = {};
            let total = 0;
            Object.keys(eventi).forEach(cat => {
                const matched = (eventi[cat] || []).filter(e => (e.name || e.title || "").toLowerCase().includes(query));
                if (matched.length > 0) {
                    results[cat] = matched;
                    total += matched.length;
                }
            });
            return NextResponse.json({
                success: true,
                query,
                total,
                events: results
            }, {
                headers: { "Cache-Control": "no-store, max-age=0" }
            });
        }

        if (format === "clean" || format === "metadata") {
            const categories = Object.keys(eventi);
            const total = categories.reduce((acc, cat) => acc + (Array.isArray(eventi[cat]) ? eventi[cat].length : 0), 0);
            return NextResponse.json({
                success: true,
                total,
                categories,
                events: eventi
            }, {
                headers: { "Cache-Control": "no-store, max-age=0" }
            });
        }

        return NextResponse.json(eventi, {
            headers: { "Cache-Control": "no-store, max-age=0" }
        });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}

export async function POST(request) {
    if (!checkAuth(request)) {
        return NextResponse.json({ success: false, error: "Non autorizzato (x-api-key non valida)" }, { status: 401 });
    }

    try {
        const body = await request.json();

        // Supporto sincronizzazione completa (da _save() di eventi_cmds.py)
        if (body.all || (body.data && typeof body.data === "object" && !body.event)) {
            const allData = body.all || body.data;
            await setStoreData("eventi", allData);
            return NextResponse.json({
                success: true,
                message: "Intero archivio eventi sincronizzato con successo",
                categories: Object.keys(allData)
            });
        }

        const category = body.category || "EVENTI";
        const newEvent = body.event || body;

        if (!newEvent || (!newEvent.name && !newEvent.title)) {
            return NextResponse.json({ success: false, error: "Titolo evento obbligatorio" }, { status: 400 });
        }

        const eventi = await getStoreData("eventi") || {};
        if (!Array.isArray(eventi[category])) {
            eventi[category] = [];
        }

        const evName = (newEvent.name || newEvent.title).trim();
        const evUrl = (newEvent.mpd || newEvent.url || "").trim();
        const evKey = (newEvent.key || newEvent.kid_key || "").trim();

        // Normalizzazione avanzata per il confronto del titolo
        const normalizeEv = (s) => {
            if (!s) return "";
            return s.toLowerCase()
                .replace(/[\(\[\{].*?[\)\]\}]/g, " ")
                .replace(/\s*\(WARP\)\s*/gi, " ")
                .replace(/\s*\(HLS\)\s*/gi, " ")
                .replace(/\s*\(\d+\)\s*$/g, " ")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "")
                .trim();
        };

        const targetNorm = normalizeEv(evName);

        // Cerca se esiste un evento corrispondente nella categoria richiesta o in qualsiasi categoria
        let targetCat = category;
        let existingIdx = -1;

        // 1. Cerca prima nella categoria specificata
        if (Array.isArray(eventi[category])) {
            existingIdx = eventi[category].findIndex(e => {
                const eName = (e.name || e.title || "").trim();
                const eNorm = normalizeEv(eName);
                if (targetNorm && eNorm === targetNorm) return true;
                const eUrl = (e.mpd || e.url || "").trim();
                return (eName === evName && eUrl === evUrl) || (eName === evName);
            });
        }

        // 2. Se non trovato nella categoria, cerca in tutte le altre categorie di eventi
        if (existingIdx === -1) {
            for (const cat of Object.keys(eventi)) {
                if (cat === category || !Array.isArray(eventi[cat])) continue;
                const idx = eventi[cat].findIndex(e => {
                    const eName = (e.name || e.title || "").trim();
                    const eNorm = normalizeEv(eName);
                    return Boolean(targetNorm && eNorm === targetNorm);
                });
                if (idx !== -1) {
                    targetCat = cat;
                    existingIdx = idx;
                    break;
                }
            }
        }

        const existingEvent = (existingIdx !== -1 && eventi[targetCat]) ? eventi[targetCat][existingIdx] : null;

        const isVodDetected = Boolean(
            newEvent.is_vod ||
            (newEvent.type && newEvent.type.toLowerCase() === "vod") ||
            (newEvent.tile_type && (newEvent.tile_type.toLowerCase() === "catchup" || newEvent.tile_type.toLowerCase() === "ondemand" || newEvent.tile_type.toLowerCase() === "vod")) ||
            (targetCat && targetCat.toLowerCase().includes("vod")) ||
            (evUrl && (evUrl.includes("-vod.") || evUrl.includes("/vod/"))) ||
            (existingEvent && (existingEvent.is_vod || (existingEvent.type && existingEvent.type.toLowerCase() === "vod") || (existingEvent.tile_type && existingEvent.tile_type.toLowerCase() === "catchup")))
        );

        const entryToSave = {
            name: evName,
            title: evName,
            mpd: evUrl || existingEvent?.mpd || existingEvent?.url || "",
            url: evUrl || existingEvent?.mpd || existingEvent?.url || "",
            key: evKey || existingEvent?.key || existingEvent?.kid_key || "",
            kid_key: evKey || existingEvent?.key || existingEvent?.kid_key || "",
            image: newEvent.image || existingEvent?.image || "",
            start: newEvent.start || existingEvent?.start || "",
            end: newEvent.end || existingEvent?.end || "",
            ora: newEvent.ora || existingEvent?.ora || "",
            ua: newEvent.ua || existingEvent?.ua || "",
            dazn_token: newEvent.dazn_token || existingEvent?.dazn_token || "",
            type: isVodDetected ? "vod" : (newEvent.type || existingEvent?.type || "evento"),
            is_vod: isVodDetected,
            tile_type: isVodDetected ? "CatchUp" : (newEvent.tile_type || existingEvent?.tile_type || "Live"),
            provider: newEvent.provider || existingEvent?.provider || "DAZN",
            slug: createSlug(evName)
        };

        if (existingIdx !== -1 && eventi[targetCat]) {
            // Aggiorna l'evento esistente completando i parametri reali
            eventi[targetCat][existingIdx] = {
                ...existingEvent,
                ...entryToSave
            };
        } else {
            if (!Array.isArray(eventi[category])) {
                eventi[category] = [];
            }
            eventi[category].push(entryToSave);
        }

        await setStoreData("eventi", eventi);

        return NextResponse.json({
            success: true,
            message: `Evento "${evName}" salvato in "${category}"`,
            category: category,
            totalEvents: eventi[category].length
        });
    } catch (e) {
        console.error("Errore POST /api/eventi:", e);
        return NextResponse.json({ success: false, error: "Errore salvataggio evento", details: String(e) }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!checkAuth(request)) {
        return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const target = body.slug || body.title || body.name || "";
        if (!target) {
            return NextResponse.json({ success: false, error: "Specificare title o slug da eliminare" }, { status: 400 });
        }

        const eventi = await getStoreData("eventi") || {};
        let removedTotal = 0;

        Object.keys(eventi).forEach(cat => {
            if (!Array.isArray(eventi[cat])) return;
            const initialLen = eventi[cat].length;
            eventi[cat] = eventi[cat].filter(e => !matchSlug(e, target));
            removedTotal += (initialLen - eventi[cat].length);
        });

        await setStoreData("eventi", eventi);

        return NextResponse.json({
            success: true,
            removedCount: removedTotal,
            message: `Rimossi ${removedTotal} eventi corrispondenti`
        });
    } catch (e) {
        console.error("Errore DELETE /api/eventi:", e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
