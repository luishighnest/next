import { NextResponse } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const MEMO_TTL_MS = 3600 * 1000;
const memo = new Map();

async function digest(src) {
    try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(src));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
    } catch (e) {
        return String(src.length);
    }
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const src = searchParams.get("src");
        const title = (searchParams.get("title") || "").trim();
        if (!src) return new NextResponse("Missing src parameter", { status: 400 });

        const key = await digest(src);
        const cached = memo.get(key);
        if (cached && (Date.now() - cached.t) < MEMO_TTL_MS) {
            return new NextResponse(cached.data, {
                headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" }
            });
        }

        // Scarica l'immagine sorgente senza referer (evita 403 di sofascore e altri CDN).
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        let res;
        try {
            res = await fetch(src, {
                cache: "no-store",
                signal: controller.signal,
                headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" }
            });
        } finally {
            clearTimeout(timer);
        }
        if (!res.ok) throw new Error("fetch " + res.status);
        const buf = new Uint8Array(await res.arrayBuffer());

        const meta = await sharp(buf).metadata();
        const w = meta.width || 0;
        const h = meta.height || 0;
        const W = 960;
        const H = 540;

        let output;
        if (w >= 700 && h >= 380) {
            // Già abbastanza grande: upscale/pad a 16:9 con crop morbido.
            output = await sharp(buf)
                .resize(W, H, { fit: "cover", position: "centre", withoutEnlargement: false })
                .webp({ quality: 82, effort: 4 })
                .toBuffer();
        } else {
            // Logo/icona piccola: composizione su gradiente brand + logo nitido e centrato.
            const logoSize = Math.min(W * 0.5, Math.max(220, w * 3));
            const logo = await sharp(buf)
                .resize(Math.round(logoSize), Math.round(logoSize * (h / (w || 1))), { fit: "inside", withoutEnlargement: false, background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .png()
                .toBuffer();

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

            const bg = await sharp(Buffer.from(svg)).png().toBuffer();

            const titleBuffer = titleEsc
                ? await sharp(Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="90">
  <text x="${W / 2}" y="40" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#ffffff" text-anchor="middle" textLength="${Math.max(100, W - 120)}" lengthAdjust="spacingAndGlyphs">${titleEsc}</text>
  <text x="${W / 2}" y="72" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#00d586" text-anchor="middle" letter-spacing="4">LIVE</text>
</svg>`)).png().toBuffer()
                : null;

            const composites = [
                { input: bg, top: 0, left: 0 },
                {
                    input: logo,
                    top: titleBuffer ? Math.round((H - 300) / 2 - 10) : Math.round((H - logoSize * (h / (w || 1))) / 2),
                    left: Math.round((W - logoSize) / 2)
                }
            ];
            if (titleBuffer) composites.push({ input: titleBuffer, left: 0, top: H - 150 });

            output = await sharp({ create: { width: W, height: H, channels: 4, background: "#0b1220" } })
                .composite(composites)
                .webp({ quality: 82, effort: 4 })
                .toBuffer();
        }

        memo.set(key, { t: Date.now(), data: output });
        return new NextResponse(output, {
            headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" }
        });

    } catch (err) {
        // Fallback: reindirizza all'originale se qualcosa va storto.
        const src = new URL(request.url).searchParams.get("src");
        if (src) return NextResponse.redirect(src, 302);
        return new NextResponse("Image Error: " + err.message, { status: 500 });
    }
}