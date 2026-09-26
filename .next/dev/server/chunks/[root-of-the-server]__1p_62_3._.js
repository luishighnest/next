module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/app/api/proxy/route.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
const dynamic = "force-dynamic";
function resolveUrl(base, ref) {
    try {
        return new URL(ref, base).toString();
    } catch (e) {
        return ref;
    }
}
function isHlsManifestUrl(u) {
    const lo = (u || "").toLowerCase().split("?")[0];
    return lo.endsWith(".m3u8") || lo.endsWith(".m3u") || lo.includes("load-playlist") || lo.includes("/hls/");
}
async function GET(request) {
    try {
        const { searchParams, origin: appOrigin } = new URL(request.url);
        const targetUrl = searchParams.get("url");
        if (!targetUrl) {
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"]("Missing url parameter", {
                status: 400
            });
        }
        const isDazn = targetUrl.includes("dazn");
        const customUa = searchParams.get("ua");
        const customReferer = searchParams.get("referer");
        const customOrigin = searchParams.get("origin");
        const headers = {
            "User-Agent": customUa || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        };
        if (isDazn) {
            headers["Referer"] = customReferer || "https://www.dazn.com/";
            headers["Origin"] = customOrigin || "https://www.dazn.com";
            const daznToken = searchParams.get("dazn-token");
            if (daznToken) headers["dazn-token"] = daznToken;
        } else {
            headers["Referer"] = customReferer || "https://www.nowtv.it/";
            if (customOrigin) headers["Origin"] = customOrigin;
        }
        const res = await fetch(targetUrl, {
            headers,
            cache: "no-store",
            redirect: "follow"
        });
        let contentType = res.headers.get("content-type") || "";
        const urlLower = targetUrl.toLowerCase().split("?")[0];
        const isHlsManifest = isHlsManifestUrl(targetUrl);
        if (!contentType || contentType === "application/octet-stream") {
            if (urlLower.endsWith(".ts") || urlLower.endsWith(".m2ts")) {
                contentType = "video/mp2t";
            } else if (urlLower.endsWith(".m3u8") || urlLower.includes("m3u8") || isHlsManifest) {
                contentType = "application/vnd.apple.mpegurl";
            } else if (urlLower.endsWith(".mpd")) {
                contentType = "application/dash+xml";
            } else {
                contentType = "application/dash+xml";
            }
        }
        const isLiveStream = urlLower.endsWith(".ts") || urlLower.endsWith(".m2ts") || urlLower.includes(".ts?") || contentType.includes("mp2t");
        const responseHeaders = {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-cache, no-store"
        };
        // Segmenti .ts / HLS live: passthrough con ReadableStream (no buffering completo)
        if (isLiveStream && res.body) {
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](res.body, {
                status: res.status,
                headers: responseHeaders
            });
        }
        const bodyBuffer = await res.arrayBuffer();
        // Playlist HLS: riscrivi tutti gli URL relativi -> assoluti e proxied,
        // così anche i segmenti passano dal proxy (aggira CORS e aggiunge referer).
        const textCandidate = new TextDecoder("utf-8").decode(bodyBuffer.slice(0, 16));
        if ((isHlsManifest || contentType.includes("mpegurl") || textCandidate.startsWith("#EXTM")) && !contentType.includes("mp2t")) {
            try {
                let text = new TextDecoder("utf-8").decode(bodyBuffer);
                if (text.includes("#EXTM3U")) {
                    const base = targetUrl.split("?")[0];
                    const proxyBase = `${appOrigin}/api/proxy?url=__URL__`;
                    const extraParams = [];
                    if (customUa) extraParams.push(`ua=${encodeURIComponent(customUa)}`);
                    if (customReferer) extraParams.push(`referer=${encodeURIComponent(customReferer)}`);
                    if (customOrigin) extraParams.push(`origin=${encodeURIComponent(customOrigin)}`);
                    const suffix = extraParams.length ? "&" + extraParams.join("&") : "";
                    const wrap = (u)=>proxyBase.replace("__URL__", encodeURIComponent(resolveUrl(base, u.trim()))) + suffix;
                    text = text.split(/\r?\n/).map((line)=>{
                        const t = line.trimStart();
                        if (t.startsWith("#")) {
                            if (t.includes("URI=")) {
                                return line.replace(/URI="([^"]+)"/g, (m, uri)=>`URI="${wrap(uri)}"`);
                            }
                            return line;
                        }
                        if (!t || t.startsWith("#")) return line;
                        return wrap(t.replace(/^https?:/, (proto)=>proto));
                    }).join("\n");
                    responseHeaders["Content-Type"] = "application/vnd.apple.mpegurl; charset=utf-8";
                    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](text, {
                        status: res.status,
                        headers: responseHeaders
                    });
                }
            } catch (e) {}
        }
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](bodyBuffer, {
            status: res.status,
            headers: responseHeaders
        });
    } catch (err) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"]("Proxy Error: " + err.message, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1p_62_3._.js.map