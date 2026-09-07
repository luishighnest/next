import { NextResponse } from "next/server";
import { runScrape24H } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

let isScrapingInProgress = false;
let lastScrapeTime = 0;

export async function GET(request) {
    return handleUpdate(request);
}

export async function POST(request) {
    return handleUpdate(request);
}

async function handleUpdate(request) {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const runAsync = searchParams.get("async") === "true";
    const secret = searchParams.get("secret");

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isScrapingInProgress) {
        return NextResponse.json({
            success: true,
            status: "in_progress",
            message: "Aggiornamento guida TV gia in corso..."
        });
    }

    const now = Date.now();
    if (!force && now - lastScrapeTime < 10 * 60 * 1000) {
        return NextResponse.json({
            success: true,
            status: "skipped",
            message: "Guida TV gia aggiornata recentemente. Usa ?force=true per forzare.",
            lastScrapeTime
        });
    }

    isScrapingInProgress = true;

    if (runAsync) {
        runScrape24H()
            .then((res) => {
                lastScrapeTime = Date.now();
                console.log("[CRON] Scraping guida TV completato con successo (async):", res);
            })
            .catch((err) => {
                console.error("[CRON] Errore nello scraping guida TV (async):", err);
            })
            .finally(() => {
                isScrapingInProgress = false;
            });

        return NextResponse.json({
            success: true,
            status: "started_async",
            message: "Aggiornamento Guida TV avviato in background."
        });
    }

    try {
        const result = await runScrape24H();
        lastScrapeTime = Date.now();
        isScrapingInProgress = false;
        return NextResponse.json({
            success: true,
            status: "completed",
            message: "Guida TV aggiornata e sincronizzata su Upstash Redis Cloud!",
            result,
            timestamp: lastScrapeTime
        });
    } catch (err) {
        isScrapingInProgress = false;
        return NextResponse.json({
            success: false,
            error: "Errore durante aggiornamento guida TV",
            details: err.message
        }, { status: 500 });
    }
}
