// Estrazione dinamica e reattiva delle sottocategorie da sezioni Live (HomeView) e VOD (VodView)

export function extractSubCategories(categories = [], currentTab = "all") {
    if (!categories || !Array.isArray(categories)) return [];

    if (currentTab === "eventi") {
        // Eventi: dinamico al 100%, riflette esattamente le sezioni presenti in questo istante
        const eventSecs = categories.filter(sec => {
            const isTest = sec.navbar === "eventi" || (sec.channels && sec.channels.some(c => c.isTestJson));
            const normName = (sec.title || "").toUpperCase().replace(/\s+/g, "");
            return isTest && normName !== "LIVETV";
        });

        return eventSecs.map(sec => ({
            id: sec.title.toLowerCase().trim(),
            label: sec.title,
            count: (sec.channels || []).length,
            titleMatch: sec.title
        }));
    }

    if (currentTab === "sport") {
        // Sport: sezioni attive per sport
        const sportSecs = categories.filter(sec => sec.navbar === "sport");
        return sportSecs.map(sec => ({
            id: sec.title.toLowerCase().trim(),
            label: sec.title,
            count: (sec.channels || []).length,
            titleMatch: sec.title
        }));
    }

    if (currentTab === "intrattenimento") {
        // Intrattenimento: sezioni attive
        const intraSecs = categories.filter(sec => sec.navbar === "intrattenimento");
        return intraSecs.map(sec => ({
            id: sec.title.toLowerCase().trim(),
            label: sec.title,
            count: (sec.channels || []).length,
            titleMatch: sec.title
        }));
    }

    return [];
}

export function extractVodSubCategories(vodSections = []) {
    if (!vodSections || !Array.isArray(vodSections)) return [];

    const list = [
        { id: "movie", label: "Film", icon: "movie" },
        { id: "tv", label: "Serie TV", icon: "tv" }
    ];

    // Aggiungi anche i generi specifici presenti nelle sezioni
    vodSections.forEach(sec => {
        const cat = sec.category || sec.title;
        const normCat = (cat || "").toLowerCase();
        if (normCat !== "film" && normCat !== "serie tv" && normCat !== "cinema") {
            const id = "cat_" + normCat.replace(/[^a-z0-9]/g, "_");
            if (!list.some(item => item.id === id)) {
                list.push({
                    id: id,
                    label: sec.title || cat,
                    categoryMatch: cat,
                    titleMatch: sec.title
                });
            }
        }
    });

    return list;
}
