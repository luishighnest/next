import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Topic ntfy predefinito configurabile via variabile d'ambiente o fallback sicuro
const NTFY_TOPIC = process.env.NTFY_TOPIC || "nmdz_live_richieste";

export async function POST(request) {
    try {
        const body = await request.json().catch(() => ({}));
        const title = (body.title || "Evento Sconosciuto").trim();
        const category = (body.category || body.group || "Live TV / Sport").trim();
        const time = (body.time || body.ora || "").trim();

        const ntfyUrl = `https://ntfy.sh/${NTFY_TOPIC}`;

        const message = `Richiesta estrazione stream per:\n${title}\nCategoria: ${category}${time ? `\nInizio: Ore ${time}` : ""}`;

        const resp = await fetch(ntfyUrl, {
            method: "POST",
            body: message,
            headers: {
                "Title": `Richiesta: ${title}`,
                "Priority": "high",
                "Tags": "tv,bell,rotating_light"
            }
        });

        if (resp.ok) {
            return NextResponse.json({ ok: true, topic: NTFY_TOPIC });
        } else {
            console.error(`[ntfy] Errore risposta HTTP ${resp.status}`);
            return NextResponse.json({ ok: false, error: `HTTP ${resp.status}` }, { status: 502 });
        }
    } catch (e) {
        console.error("[ntfy] Errore richiesta:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
