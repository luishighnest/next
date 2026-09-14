"use client";
import React, { createContext, useContext } from "react";
import { useDevice } from "@/hooks/useDevice";

const DeviceContext = createContext({ isMobile: false, isMounted: false });

export function DeviceProvider({ children }) {
    const device = useDevice();

    return (
        <DeviceContext.Provider value={device}>
            {children}
        </DeviceContext.Provider>
    );
}

/**
 * Hook globale per accedere allo stato del dispositivo in qualsiasi componente
 * Esempio d''uso: const { isMobile } = useDeviceState();
 */
export function useDeviceState() {
    return useContext(DeviceContext);
}
