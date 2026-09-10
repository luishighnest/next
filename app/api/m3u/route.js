import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const streamUrl = searchParams.get("url") || "http://webdisk.prof777.xyz/live/siena3/150323/4497.ts";
        const title = searchParams.get("title") || "Sky Sport F1";

        const m3uContent = `#EXTM3U\n#EXTINF:-1 tvg-id="" tvg-name="${title}" tvg-logo="https://pixel.disco.nowtv.it/logo/skychb_478_darknow/LOGO_CHANNEL_LIGHT/4000?language=it-IT&proposition=NOWOTT" group-title="Sky Sport",${title}\n${streamUrl}\n`;

        return new NextResponse(m3uContent, {
            status: 200,
            headers: {
                "Content-Type": "application/x-mpegurl; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store, no-cache, must-revalidate",
            }
        });
    } catch (e) {
        return new NextResponse("#EXTM3U\n", { status: 500 });
    }
}
