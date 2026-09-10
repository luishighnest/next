import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetUrl = searchParams.get("url");

        if (!targetUrl) {
            return new NextResponse("Missing url parameter", { status: 400 });
        }

        const isDazn = targetUrl.includes("dazn");
        const customUa = searchParams.get("ua");
        const headers = {
            "User-Agent": customUa || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        };

        if (isDazn) {
            headers["Referer"] = "https://www.dazn.com/";
            headers["Origin"] = "https://www.dazn.com";
            const daznToken = searchParams.get("dazn-token");
            if (daznToken) {
                headers["dazn-token"] = daznToken;
            }
        } else {
            headers["Referer"] = "https://www.nowtv.it/";
            headers["Origin"] = "https://www.nowtv.it";
        }

        const res = await fetch(targetUrl, {
            headers,
            cache: "no-store"
        });

        // Determina il content-type corretto
        let contentType = res.headers.get("content-type") || "";
        const urlLower = targetUrl.toLowerCase().split("?")[0];

        if (!contentType || contentType === "application/octet-stream") {
            if (urlLower.endsWith(".ts") || urlLower.endsWith(".m2ts")) {
                contentType = "video/mp2t";
            } else if (urlLower.endsWith(".m3u8") || urlLower.includes("m3u8")) {
                contentType = "application/vnd.apple.mpegurl";
            } else if (urlLower.endsWith(".mpd")) {
                contentType = "application/dash+xml";
            } else {
                contentType = "application/dash+xml";
            }
        }

        const isLiveStream =
            urlLower.endsWith(".ts") || urlLower.endsWith(".m2ts") ||
            urlLower.includes(".ts?") || contentType.includes("mp2t") ||
            contentType.includes("mpegurl");

        const responseHeaders = {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-cache, no-store"
        };

        // Per stream .ts / HLS live: passthrough con ReadableStream (no buffering completo)
        if (isLiveStream && res.body) {
            return new NextResponse(res.body, {
                status: res.status,
                headers: responseHeaders
            });
        }

        // Per manifest / altri file: buffering normale
        const body = await res.arrayBuffer();
        return new NextResponse(body, {
            status: res.status,
            headers: responseHeaders
        });

    } catch (err) {
        return new NextResponse("Proxy Error: " + err.message, { status: 500 });
    }
}
