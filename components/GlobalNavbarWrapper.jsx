"use client";
import React, { Suspense } from "react";
import GlobalNavbarInner from "./GlobalNavbarInner";

export default function GlobalNavbarWrapper() {
    return (
        <Suspense fallback={null}>
            <GlobalNavbarInner />
        </Suspense>
    );
}
