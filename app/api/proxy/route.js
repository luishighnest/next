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
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
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

        const contentType = res.headers.get("content-type") || "application/dash+xml";
        const body = await res.arrayBuffer();

        return new NextResponse(body, {
            status: res.status,
            headers: {
                "Content-Type": contentType,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        });
    } catch (err) {
        return new NextResponse("Proxy Error: " + err.message, { status: 500 });
    }
}
