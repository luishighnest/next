import { NextResponse } from "next/server";
import { getStoreData, setStoreData } from "@/lib/db";

const API_SECRET_KEY = process.env.API_SECRET_KEY || "zadonkais_secret_2026";

function checkAuth(request) {
    const key = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
    return key === API_SECRET_KEY;
}

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const eventi = await getStoreData("eventi") || {};
        return NextResponse.json(eventi, {
            headers: { "Cache-Control": "no-store, max-age=0" }
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(request) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: "Non autorizzato (x-api-key non valida)" }, { status: 401 });
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
            return NextResponse.json({ error: "Titolo evento obbligatorio" }, { status: 400 });
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
            provider: newEvent.provider || "DAZN"
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
        return NextResponse.json({ error: "Errore salvataggio evento", details: String(e) }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const targetTitle = (body.title || body.name || "").toLowerCase().trim();
        const targetSlug = (body.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");

        if (!targetTitle && !targetSlug) {
            return NextResponse.json({ error: "Specificare title o slug da eliminare" }, { status: 400 });
        }

        const eventi = await getStoreData("eventi") || {};
        let removedTotal = 0;

        Object.keys(eventi).forEach(cat => {
            if (!Array.isArray(eventi[cat])) return;
            const initialLen = eventi[cat].length;
            eventi[cat] = eventi[cat].filter(e => {
                const name = (e.name || e.title || "").toLowerCase().trim();
                const slug = name.replace(/[^a-z0-9]/g, "");
                if (targetTitle && name === targetTitle) return false;
                if (targetSlug && slug === targetSlug) return false;
                return true;
            });
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
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
