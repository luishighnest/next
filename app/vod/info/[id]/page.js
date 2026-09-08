"use client";
import React, { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import VodInfoView from "@/components/VodInfoView";

function VodInfoPageContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params?.id ? String(params.id) : "";
    const type = searchParams?.get("type") || "movie";

    return <VodInfoView id={id} initialType={type} />;
}

export default function VodInfoPage() {
    return (
        <Suspense fallback={<div className="desktop-home" style={{ minHeight: "100vh", background: "#000" }} />}>
            <VodInfoPageContent />
        </Suspense>
    );
}
