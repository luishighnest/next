// Helper per il recupero esatto dei loghi dei canali
export function getChannelLogoUrl(ch) {
    if (!ch || (!ch.title && !ch.name)) return "/logos/premium_logo_dark.jpg";
    const rawTitle = (ch.title || ch.name || "").toUpperCase();

    if (rawTitle.includes("CARTOON NETWORK")) return "/logos/cartoonnetwork.png";
    if (rawTitle.includes("BOOMERANG")) return "/logos/boomerang.png";
    if (rawTitle.includes("DEAKIDS") || rawTitle.includes("DEA KIDS")) return "/logos/deakids.png";
    if (rawTitle.includes("NICKELODEON")) return "/logos/nickelodeon.png";
    if (rawTitle.includes("NICK JR") || rawTitle.includes("NICK JUNIOR")) return "/logos/nickjr.png";
    if (rawTitle.includes("SUPER!")) return "/logos/super.png";
    if (rawTitle.includes("FRISBEE")) return "/logos/frisbee.png";
    if (rawTitle.includes("K2")) return "/logos/k2.png";
    if (rawTitle.includes("CINEMA UNO")) return "/logos/skycinemauno.png";
    if (rawTitle.includes("CINEMA COLLECTION")) return "/logos/skycinemacollection.png";
    if (rawTitle.includes("CINEMA FAMILY")) return "/logos/skycinemafamily.png";
    if (rawTitle.includes("CINEMA ACTION")) return "/logos/skycinemaaction.png";
    if (rawTitle.includes("CINEMA SUSPENSE")) return "/logos/skycinemasuspense.png";
    if (rawTitle.includes("CINEMA ROMANCE")) return "/logos/skycinemaromance.png";
    if (rawTitle.includes("CINEMA DRAMA")) return "/logos/skycinemadrama.png";
    if (rawTitle.includes("CINEMA COMEDY")) return "/logos/skycinemacomedy.png";
    if (rawTitle.includes("CINEMA STORIES")) return "/logos/skycinemastories.png";

    if (ch.logo && !ch.logo.includes("ui-avatars.com")) {
        return ch.logo.startsWith("/") ? ch.logo : ("/" + ch.logo.replace(/^\/+/, ""));
    }

    const upperTitle = rawTitle;
    const titleNoSpace = upperTitle.replace(/\s+/g, "");

    if (titleNoSpace.includes("TG24") || upperTitle.includes("SKY NEWS") || upperTitle.includes("TG 24")) {
        return "/logos/skytg24.png";
    }

    const groupNoSpace = ch.group ? ch.group.toUpperCase().replace(/\s+/g, "") : "";
    const isSkySport = groupNoSpace === "SKYSPORT" || titleNoSpace.includes("SKYSPORT");

    if (isSkySport) {
        const localLogos = {
            "UNO": "sksportuno.png", "CALCIO": "sksportcalcio.png",
            "ARENA": "sksportarena.png", "TENNIS": "sksporttennis.png",
            "MAX": "sksportmax.png", "GOLF": "sksportgolf.png",
            "F1": "sksportf1.png", "COLLECTION": "sksportcollection.png",
            "LEGEND": "sksportlegend.png", "MIX": "sksportmix.png",
            "BASKET": "sksportbasket.png", "MOTOGP": "sksportmotogp.png",
            "ACTION": "sksportaction.png", "24": "sksport24.png"
        };
        let filename = "sksport.png";
        for (const [key, file] of Object.entries(localLogos)) {
            if (upperTitle.includes(key)) { filename = file; break; }
        }
        return "/logos/" + filename;
    }

    if (groupNoSpace === "EVENTI" || ch.title.toUpperCase().startsWith("DAZN") || ch.title.toUpperCase().includes("DAZN")) {
        return "/logos/dazn.png";
    }

    const intrattenimentoLogos = {
        "SKY UNO+": "skyunoplus.png", "SKY UNO +": "skyunoplus.png", "SKY UNO +1": "skyunoplus.png", "SKY UNO": "skyuno.png",
        "SKY ATLANTIC": "skyatlantic.png", "SKY DOCUMENTARIES": "skydocumentaries.png", "SKY NATURE": "skynature.png",
        "SKY SERIE": "skyserie.png", "SKY ARTE": "skyarte.png", "SKY INVESTIGATION": "skyinvestigation.png",
        "SKY CINEMA": "skycinema.png", "SKY CRIME": "skycrime.png", "SKY ADVENTURE": "skyadventure.png",
        "SKY COLLECTION": "skycollection.png", "COMEDY CENTRAL": "comedycentral.png", "HISTORY": "history.png", "MTV": "mtv.png"
    };
    for (const [key, file] of Object.entries(intrattenimentoLogos)) {
        if (upperTitle.includes(key)) return "/logos/" + file;
    }

    return "/logos/premium_logo_dark.jpg";
}

// Programma in onda dall'EPG
export function getCurrentProgramInfo(epg) {
    if (!epg || !Array.isArray(epg) || epg.length === 0) return null;
    const now = new Date();
    let nowMinutes = now.getHours() * 60 + now.getMinutes();

    let currentIdx = -1;
    for (let i = 0; i < epg.length; i++) {
        const prog = epg[i];
        const parts = (prog.ora || "0:00").split(":");
        const progMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        if (progMinutes > nowMinutes) {
            currentIdx = i > 0 ? i - 1 : 0;
            break;
        }
    }
    if (currentIdx === -1) currentIdx = epg.length - 1;

    let currentProg = epg[currentIdx];
    let nextProg = currentIdx < epg.length - 1 ? epg[currentIdx + 1] : null;

    if (currentProg && currentProg.titolo && (currentProg.titolo.toLowerCase().includes("non disponibile") || currentProg.titolo.toLowerCase().includes("da definire"))) {
        if (currentIdx > 0 && epg[currentIdx - 1]) currentProg = epg[currentIdx - 1];
        else if (nextProg) currentProg = nextProg;
    }

    let progress = 0;
    const startParts = (currentProg.ora || "0:00").split(":");
    const startMinutes = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);

    let endMinutes = 24 * 60;
    if (nextProg) {
        const endParts = (nextProg.ora || "0:00").split(":");
        endMinutes = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
        if (endMinutes <= startMinutes) endMinutes += 24 * 60;
    }
    if (nowMinutes < startMinutes) nowMinutes += 24 * 60;

    if (nowMinutes >= startMinutes && endMinutes > startMinutes) {
        progress = ((nowMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
        if (progress > 100) progress = 100;
        if (progress < 0) progress = 0;
    }

    return {
        oraInizio: currentProg.ora || "",
        oraFine: nextProg ? (nextProg.ora || "") : "",
        titolo: currentProg.titolo || "",
        immagine: currentProg.immagine || "",
        percentuale: Math.round(progress)
    };
}
