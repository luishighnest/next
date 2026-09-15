"use client";
import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";

const TransitionContext = createContext({
    startTransitionToPlayer: () => {},
    isTransitioning: false,
    activeTransitionData: null
});

export function TransitionProvider({ children }) {
    const router = useRouter();

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
