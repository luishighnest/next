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
        const eventi = await getStoreData("eventi") || {};

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

        // Controlla se esiste già un evento identico (stesso titolo e stesso url) per aggiornarlo
        const existingIdx = eventi[category].findIndex(e => {
            const eName = (e.name || e.title || "").trim();
            const eUrl = (e.mpd || e.url || "").trim();
            return (eName === evName && eUrl === evUrl) || (eName === evName && e.isWarp === newEvent.isWarp);
        });

        const entryToSave = {
            name: evName,
            title: evName,
            mpd: newEvent.mpd || newEvent.url || "",
            url: newEvent.mpd || newEvent.url || "",
            key: newEvent.key || newEvent.kid_key || "",
            kid_key: newEvent.key || newEvent.kid_key || "",
            image: newEvent.image || "",
            start: newEvent.start || "",
            end: newEvent.end || "",
            ora: newEvent.ora || "",
            ua: newEvent.ua || "",
            dazn_token: newEvent.dazn_token || "",
            type: newEvent.type || "evento",
            provider: newEvent.provider || "DAZN",
            slug: createSlug(evName)
        };

        if (existingIdx !== -1) {
            eventi[category][existingIdx] = entryToSave;
        } else {
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
