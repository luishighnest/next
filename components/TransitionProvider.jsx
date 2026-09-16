"use client";
import { createContext, useContext, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const TransitionContext = createContext({
    startTransitionToPlayer: () => {},
    isTransitioning: false,
    activeTransitionData: null
});

const LEAVE_ANIM_MS = 150;
const ENTER_RESET_MS = 700;

export function TransitionProvider({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const leaveTimerRef = useRef(null);
    const resetTimerRef = useRef(null);

    // Rimuove lo stato di uscita appena la nuova rotta è montata
    useEffect(() => {
        document.documentElement.classList.remove("nmdz-leaving");
    }, [pathname]);

    useEffect(() => {
        return () => {
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        };
    }, []);

    // Intercetta ogni navigazione interna (Link o <a>) e applica il fade-out
    // prima di cambiare rotta, per una transizione Apple TV-like fluida.
    useEffect(() => {
        const onClick = (e) => {
            if (e.defaultPrevented) return;
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            let el = e.target && e.target.closest ? e.target.closest("a[href]") : null;
            if (!el) return;
            if (el.target && el.target !== "_self") return;
            if (el.hasAttribute("download")) return;

            const href = el.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
            if (/^https?:\/\//i.test(href) || href.startsWith("//")) return;

            // Solo navigazioni interne
            const url = new URL(el.href, window.location.origin);
            if (url.origin !== window.location.origin) return;
            const dest = url.pathname + url.search + url.hash;

            e.preventDefault();

            document.documentElement.classList.add("nmdz-leaving");

            // Attende il fade-out completo della pagina corrente, poi rimuove lo
            // stato PRIMA di navigare: la nuova pagina monta pulita e parte con
            // il proprio fade-in senza rischiare di essere nascosta.
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
            leaveTimerRef.current = setTimeout(() => {
                document.documentElement.classList.remove("nmdz-leaving");
                router.push(dest);
                // Rete di sicurezza: se la rotta non cambia (es. stessa pagina o
                // push ignorato) la classe è già rimossa, non serve altro.
                resetTimerRef.current = setTimeout(() => {
                    document.documentElement.classList.remove("nmdz-leaving");
                }, ENTER_RESET_MS);
            }, LEAVE_ANIM_MS);
        };

        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [router]);

    const startTransitionToPlayer = useCallback(({ targetHref, posterImg }) => {
        if (posterImg) {
            try {
                sessionStorage.setItem("nmdz_transition_poster", posterImg);
            } catch (e) {}
        }
        // Passaggio immediato ed istantaneo senza alcuna animazione o overlay grafico
        router.push(targetHref);
    }, [router]);

    const endTransition = useCallback(() => {}, []);

    return (
        <TransitionContext.Provider
            value={{
                startTransitionToPlayer,
                isTransitioning: false,
                activeTransitionData: null,
                endTransition
            }}
        >
            {children}
        </TransitionContext.Provider>
    );
}

export function useTransitionRouter() {
    return useContext(TransitionContext);
}
