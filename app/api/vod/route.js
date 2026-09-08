import { NextResponse } from "next/server";

const TMDB_READ_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyZTBiMzhjZmIyOTM2Y2VjOGFiMWNlNDhlNDMzNWFjMyIsIm5iZiI6MTc0NzAxMTUwOS4xNTgwMDAyLCJzdWIiOiI2ODIxNDdiNWJmODdmYzQzNzAyZDE5ZDciLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.6VwFOU7O4p9oRyGQcgK8tAdNzuSmeSC2bzuOBmxnI1c";
const TMDB_BASE = "https://api.themoviedb.org/3";

let vodCache = null;
let vodCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function tmdbFetch(endpoint) {
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `${TMDB_BASE}${endpoint}${sep}language=it-IT`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_READ_TOKEN}`,
            Accept: "application/json"
        },
        next: { revalidate: 600 }
    });
    if (!res.ok) {
        throw new Error(`TMDB error ${res.status}: ${res.statusText}`);
    }
    return res.json();
}

function formatItem(item, type = "movie", customCategory = "Vod") {
    const isMovie = type === "movie" || item.title !== undefined;
    const title = item.title || item.name || "Senza Titolo";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);

    let imageUrl = "";
    if (item.backdrop_path) {
        imageUrl = `https://image.tmdb.org/t/p/w780${item.backdrop_path}`;
    } else if (item.poster_path) {
        imageUrl = `https://image.tmdb.org/t/p/w780${item.poster_path}`;
    }

    const vote = item.vote_average ? item.vote_average.toFixed(1) : null;
    const desc = item.overview || "";

    return {
        id: `vod_${type}_${item.id}`,
        tmdbId: item.id,
        vodType: isMovie ? "movie" : "tv",
        title: title,
        name: title,
        image: imageUrl,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : imageUrl,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : imageUrl,
        ora: year ? year : (isMovie ? "Film" : "Serie TV"),
        year: year,
        rating: vote,
        desc: desc,
        descrizione: desc,
        group: isMovie ? "Film" : "Serie TV",
        category: customCategory,
        isVod: true
    };
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");

        if (action === "details") {
            const id = searchParams.get("id");
            const type = searchParams.get("type") || "movie";
            if (!id) {
                return NextResponse.json({ error: "Missing id" }, { status: 400 });
            }

            const data = await tmdbFetch(`/${type}/${id}?append_to_response=credits,videos,recommendations,similar`);
            return NextResponse.json({
                success: true,
                details: data
            }, {
                headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1200" }
            });
        }

        if (action === "vixembed") {
            const type = searchParams.get("type") || "movie";
            const id = searchParams.get("id");
            const season = searchParams.get("season");
            const episode = searchParams.get("episode");
            const lang = searchParams.get("lang") || "it";

            if (!id) {
                return NextResponse.json({ error: "Missing id" }, { status: 400 });
            }

            let vixUrl;
            if (type === "tv") {
                vixUrl = `https://vixsrc.to/api/tv/${id}/${season}/${episode}?lang=${lang}`;
            } else {
                vixUrl = `https://vixsrc.to/api/movie/${id}?lang=${lang}`;
            }

            const vixRes = await fetch(vixUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Referer": "https://vixsrc.to/",
                    "Origin": "https://vixsrc.to",
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            if (!vixRes.ok) {
                return NextResponse.json({ error: `VixSrc error ${vixRes.status}` }, { status: 502 });
            }

            const vixData = await vixRes.json();

            if (vixData?.src) {
                return NextResponse.json({
                    success: true,
                    embedUrl: "https://vixsrc.to" + vixData.src
                }, {
                    headers: { "Cache-Control": "no-store" }
                });
            }

            // Fallback: return the direct page URL if no embed src
            const fallbackUrl = type === "tv"
                ? `https://vixsrc.to/tv/${id}/${season}/${episode}?primaryColor=e30a17&autoplay=true&lang=${lang}`
                : `https://vixsrc.to/movie/${id}?primaryColor=e30a17&autoplay=true&lang=${lang}`;

            return NextResponse.json({
                success: true,
                embedUrl: fallbackUrl,
                fallback: true
            }, {
                headers: { "Cache-Control": "no-store" }
            });
        }

        if (action === "season") {
            const id = searchParams.get("id");
            const seasonNumber = searchParams.get("season") || "1";
            if (!id) {
                return NextResponse.json({ error: "Missing id" }, { status: 400 });
            }

            const data = await tmdbFetch(`/tv/${id}/season/${seasonNumber}`);
            return NextResponse.json({
                success: true,
                season: data
            }, {
                headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1200" }
            });
        }

        if (action === "search") {
            const query = searchParams.get("q");
            if (!query) {
                return NextResponse.json({ results: [] });
            }

            const data = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}`);
            const items = (data.results || [])
                .filter(x => x.media_type === "movie" || x.media_type === "tv")
                .map(x => formatItem(x, x.media_type, x.media_type === "movie" ? "Film" : "Serie TV"));

            return NextResponse.json({
                success: true,
                results: items
            });
        }

        const now = Date.now();
        if (vodCache && now - vodCacheTime < CACHE_TTL_MS) {
            return NextResponse.json(vodCache, {
                headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" }
            });
        }

        const [
            trendingMovies,
            popularSeries,
            topMovies,
            trendingSeries,
            actionMovies,
            comedyMovies,
            scifiMovies,
            animationMovies
        ] = await Promise.allSettled([
            tmdbFetch("/trending/movie/week"),
            tmdbFetch("/tv/popular"),
            tmdbFetch("/movie/top_rated"),
            tmdbFetch("/trending/tv/week"),
            tmdbFetch("/discover/movie?with_genres=28&sort_by=popularity.desc"),
            tmdbFetch("/discover/movie?with_genres=35&sort_by=popularity.desc"),
            tmdbFetch("/discover/movie?with_genres=878&sort_by=popularity.desc"),
            tmdbFetch("/discover/movie?with_genres=16&sort_by=popularity.desc")
        ]);

        const sections = [
            {
                title: "Film in Tendenza",
                category: "Film",
                channels: (trendingMovies.status === "fulfilled" ? trendingMovies.value.results || [] : [])
                    .map(m => formatItem(m, "movie", "Film"))
            },
            {
                title: "Serie TV Popolari",
                category: "Serie TV",
                channels: (popularSeries.status === "fulfilled" ? popularSeries.value.results || [] : [])
                    .map(s => formatItem(s, "tv", "Serie TV"))
            },
            {
                title: "I Più Votati di Sempre",
                category: "Cinema",
                channels: (topMovies.status === "fulfilled" ? topMovies.value.results || [] : [])
                    .map(m => formatItem(m, "movie", "Top Rated"))
            },
            {
                title: "Serie TV del Momento",
                category: "Serie TV",
                channels: (trendingSeries.status === "fulfilled" ? trendingSeries.value.results || [] : [])
                    .map(s => formatItem(s, "tv", "Serie TV"))
            },
            {
                title: "Azione & Adrenalina",
                category: "Azione",
                channels: (actionMovies.status === "fulfilled" ? actionMovies.value.results || [] : [])
                    .map(m => formatItem(m, "movie", "Azione"))
            },
            {
                title: "Commedie da Non Perdere",
                category: "Commedia",
                channels: (comedyMovies.status === "fulfilled" ? comedyMovies.value.results || [] : [])
                    .map(m => formatItem(m, "movie", "Commedia"))
            },
            {
                title: "Fantascienza & Futuro",
                category: "Fantascienza",
                channels: (scifiMovies.status === "fulfilled" ? scifiMovies.value.results || [] : [])
                    .map(m => formatItem(m, "movie", "Sci-Fi"))
            },
            {
                title: "Animazione & Famiglia",
                category: "Animazione",
                channels: (animationMovies.status === "fulfilled" ? animationMovies.value.results || [] : [])
                    .map(m => formatItem(m, "movie", "Animazione"))
            }
        ].filter(sec => sec.channels.length > 0);

        const responsePayload = {
            success: true,
            sections: sections
        };

        vodCache = responsePayload;
        vodCacheTime = now;

        return NextResponse.json(responsePayload, {
            headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" }
        });
    } catch (err) {
        console.error("Errore API VOD:", err);
        return NextResponse.json({
            success: false,
            error: err.message,
            sections: []
        }, { status: 500 });
    }
}
