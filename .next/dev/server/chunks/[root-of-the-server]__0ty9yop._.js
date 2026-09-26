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
"[project]/app/api/img/route.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {
__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__ = __turbopack_context__.i("[externals]/sharp [external] (sharp, esm_import, [project]/node_modules/sharp)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
const dynamic = "force-dynamic";
const MEMO_TTL_MS = 3600 * 1000;
const memo = new Map();
async function digest(src) {
    try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(src));
        return Array.from(new Uint8Array(buf)).map((b)=>b.toString(16).padStart(2, "0")).join("").slice(0, 24);
    } catch (e) {
        return String(src.length);
    }
}
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const src = searchParams.get("src");
        const title = (searchParams.get("title") || "").trim();
        if (!src) return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"]("Missing src parameter", {
            status: 400
        });
        const key = await digest(src);
        const cached = memo.get(key);
        if (cached && Date.now() - cached.t < MEMO_TTL_MS) {
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](cached.data, {
                headers: {
                    "Content-Type": "image/webp",
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }
        // Scarica l'immagine sorgente senza referer (evita 403 di sofascore e altri CDN).
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), 12000);
        let res;
        try {
            res = await fetch(src, {
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                }
            });
        } finally{
            clearTimeout(timer);
        }
        if (!res.ok) throw new Error("fetch " + res.status);
        const buf = new Uint8Array(await res.arrayBuffer());
        const meta = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__["default"])(buf).metadata();
        const w = meta.width || 0;
        const h = meta.height || 0;
        const W = 960;
        const H = 540;
        let output;
        if (w >= 700 && h >= 380) {
            // Già abbastanza grande: upscale/pad a 16:9 con crop morbido.
            output = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__["default"])(buf).resize(W, H, {
                fit: "cover",
                position: "centre",
                withoutEnlargement: false
            }).webp({
                quality: 82,
                effort: 4
            }).toBuffer();
        } else {
            // Logo/icona piccola: composizione su gradiente brand + logo nitido e centrato.
            const logoSize = Math.min(W * 0.5, Math.max(220, w * 3));
            const logo = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__["default"])(buf).resize(Math.round(logoSize), Math.round(logoSize * (h / (w || 1))), {
                fit: "inside",
                withoutEnlargement: false,
                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 0
                }
            }).png().toBuffer();
            const titleEsc = String(title).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="0.55" stop-color="#101a2e"/>
      <stop offset="1" stop-color="#0a0d14"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="#00d586" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#00d586" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="${W}" cy="0" r="220" fill="#00d586" opacity="0.08"/>
  <circle cx="0" cy="${H}" r="180" fill="#00d586" opacity="0.05"/>
</svg>`;
            const bg = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__["default"])(Buffer.from(svg)).png().toBuffer();
            const titleBuffer = titleEsc ? await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__["default"])(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="90">
  <text x="${W / 2}" y="40" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#ffffff" text-anchor="middle" textLength="${Math.max(100, W - 120)}" lengthAdjust="spacingAndGlyphs">${titleEsc}</text>
  <text x="${W / 2}" y="72" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#00d586" text-anchor="middle" letter-spacing="4">LIVE</text>
</svg>`)).png().toBuffer() : null;
            const composites = [
                {
                    input: bg,
                    top: 0,
                    left: 0
                },
                {
                    input: logo,
                    top: titleBuffer ? Math.round((H - 300) / 2 - 10) : Math.round((H - logoSize * (h / (w || 1))) / 2),
                    left: Math.round((W - logoSize) / 2)
                }
            ];
            if (titleBuffer) composites.push({
                input: titleBuffer,
                left: 0,
                top: H - 150
            });
            output = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$sharp__$5b$external$5d$__$28$sharp$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$sharp$29$__["default"])({
                create: {
                    width: W,
                    height: H,
                    channels: 4,
                    background: "#0b1220"
                }
            }).composite(composites).webp({
                quality: 82,
                effort: 4
            }).toBuffer();
        }
        memo.set(key, {
            t: Date.now(),
            data: output
        });
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](output, {
            headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (err) {
        // Fallback: reindirizza all'originale se qualcosa va storto.
        const src = new URL(request.url).searchParams.get("src");
        if (src) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(src, 302);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"]("Image Error: " + err.message, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0ty9yop._.js.map