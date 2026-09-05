import { NextResponse } from "next/server";
import { getStoreData, setStoreData } from "@/lib/db";

const API_SECRET_KEY = process.env.API_SECRET_KEY || "zadonkais_secret_2026";

function checkAuth(request) {
    const key = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
    return key === API_SECRET_KEY;
}

export const dynamic = "force-dynamic";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || "sky1";
    try {
        const targetKey = source === "sky2" ? "sky2" : (source === "guida" ? "guida" : "sky1");
        const data = await getStoreData(targetKey) || (targetKey === "guida" ? [] : {});
        return NextResponse.json(data, {
            headers: { "Cache-Control": "no-store, max-age=0" }
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(request) {
    if (!checkAuth(request)) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const source = body.source === "sky2" ? "sky2" : (body.source === "guida" ? "guida" : "sky1");
        const channelData = body.data || body.channels || body.guida || body;

        if (!channelData) {
            return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
        }

        await setStoreData(source, channelData);

        return NextResponse.json({
            success: true,
            message: `Sorgente ${source} aggiornata con successo`,
            count: Array.isArray(channelData) ? channelData.length : Object.keys(channelData).length
        });
    } catch (e) {
        console.error("Errore POST /api/sky:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
