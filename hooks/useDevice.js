"use client";
import { useState, useEffect } from "react";
import { checkIsMobileDevice } from "@/lib/device";

/**
 * Hook React per il rilevamento istantaneo e reattivo del dispositivo Mobile
 * Ritorna { isMobile, isMounted }
 * - isMounted garantisce l'assenza di hydration mismatch
 * - isMobile e' reattivo anche se l'utente ridimensiona o ruota lo schermo
 */
export function useDevice() {
    const [isMobile, setIsMobile] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const mobile = checkIsMobileDevice();
        setIsMobile(mobile);

        // Aggiunge data-device="mobile" o "desktop" al tag <html> per styling mirato zero-overhead
        try {
            document.documentElement.setAttribute("data-device", mobile ? "mobile" : "desktop");
        } catch (e) {}

        const handleResize = () => {
            const currentMobile = checkIsMobileDevice();
            setIsMobile(currentMobile);
            try {
                document.documentElement.setAttribute("data-device", currentMobile ? "mobile" : "desktop");
            } catch (e) {}
        };

        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
        };
    }, []);

    return { isMobile, isMounted };
}
