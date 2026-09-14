"use client";
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const TransitionContext = createContext({
    startTransitionToPlayer: () => {},
    isTransitioning: false,
    activeTransitionData: null
});

export function TransitionProvider({ children }) {
    const router = useRouter();
    const [transitionState, setTransitionState] = useState(null);
    const timeoutRef = useRef(null);

    const startTransitionToPlayer = useCallback(({
        cardRect,
        targetHref,
        posterImg,
        logoImg,
        title,
        group,
        ora
    }) => {
        if (!cardRect) {
            router.push(targetHref);
            return;
        }

        try {
            sessionStorage.setItem("nmdz_transition_poster", posterImg || "");
            sessionStorage.setItem("nmdz_transition_logo", logoImg || "");
            sessionStorage.setItem("nmdz_transition_title", title || "");
            sessionStorage.setItem("nmdz_transition_group", group || "");
        } catch (e) {}

        const startRect = {
            top: cardRect.top,
            left: cardRect.left,
            width: cardRect.width,
            height: cardRect.height,
            borderRadius: "12px"
        };

        setTransitionState({
            phase: "expanding",
            startRect,
            posterImg,
            logoImg,
            title,
            group,
            ora,
            targetHref
        });

        router.push(targetHref);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setTransitionState(null);
        }, 1600);
    }, [router]);

    const endTransition = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setTransitionState(null);
    }, []);

    return (
        <TransitionContext.Provider
            value={{
                startTransitionToPlayer,
                isTransitioning: Boolean(transitionState),
                activeTransitionData: transitionState,
                endTransition
            }}
        >
            {children}
            {transitionState && (
                <ExpandingOverlay
                    state={transitionState}
                    onFinish={() => setTransitionState(null)}
                />
            )}
        </TransitionContext.Provider>
    );
}

function ExpandingOverlay({ state, onFinish }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        const animFrame = requestAnimationFrame(() => {
            setIsExpanded(true);
        });

        const fadeTimer = setTimeout(() => {
            setIsFadingOut(true);
        }, 550);

        const endTimer = setTimeout(() => {
            onFinish();
        }, 850);

        return () => {
            cancelAnimationFrame(animFrame);
            clearTimeout(fadeTimer);
            clearTimeout(endTimer);
        };
    }, [onFinish]);

    const { startRect, posterImg, logoImg, title, group } = state;

    const currentStyle = isExpanded
        ? {
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              borderRadius: 0,
              transition: "all 0.38s cubic-bezier(0.16, 1, 0.3, 1)"
          }
        : {
              top: startRect.top + "px",
              left: startRect.left + "px",
              width: startRect.width + "px",
              height: startRect.height + "px",
              borderRadius: startRect.borderRadius || "12px",
              transition: "none"
          };

    return (
        <div
            className={`global-expanding-transition-portal ${isFadingOut ? "is-fading-out" : ""}`}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                pointerEvents: "none",
                background: isExpanded ? "rgba(4, 5, 8, 0.88)" : "transparent",
                transition: "background 0.38s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
        >
            <div
                className="expanding-card-clone"
                style={{
                    position: "absolute",
                    overflow: "hidden",
                    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95)",
                    background: "#08090d",
                    ...currentStyle
                }}
            >
                {posterImg ? (
                    <img
                        src={posterImg}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            filter: isExpanded ? "brightness(0.65) contrast(1.05)" : "brightness(1)",
                            transform: isExpanded ? "scale(1.03)" : "scale(1)",
                            transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)"
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            background: "radial-gradient(circle at center, #151a28 0%, #08090e 100%)"
                        }}
                    />
                )}

                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 40%, rgba(4,5,8,0.95) 100%)",
                        opacity: isExpanded ? 1 : 0.6,
                        transition: "opacity 0.38s ease"
                    }}
                />

                <div
                    style={{
                        position: "absolute",
                        bottom: isExpanded ? "12vh" : "12px",
                        left: isExpanded ? "6vw" : "12px",
                        right: isExpanded ? "6vw" : "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                        transition: "all 0.38s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                >
                    {logoImg && (
                        <img
                            src={logoImg}
                            alt=""
                            style={{
                                width: isExpanded ? "64px" : "32px",
                                height: isExpanded ? "64px" : "32px",
                                objectFit: "contain",
                                filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.8))",
                                transition: "all 0.38s cubic-bezier(0.16, 1, 0.3, 1)"
                            }}
                        />
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: isExpanded ? "0.85rem" : "0.7rem",
                                    fontWeight: "800",
                                    letterSpacing: "0.08em",
                                    color: "#ff2a44",
                                    background: "rgba(255, 42, 68, 0.12)",
                                    border: "1px solid rgba(255, 42, 68, 0.3)",
                                    padding: "2px 8px",
                                    borderRadius: "4px"
                                }}
                            >
                                <span
                                    style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        background: "#ff2a44",
                                        animation: "livePulse 1.4s infinite"
                                    }}
                                />
                                LIVE
                            </span>
                            {group && (
                                <span
                                    style={{
                                        fontSize: isExpanded ? "0.95rem" : "0.75rem",
                                        fontWeight: "600",
                                        color: "rgba(255,255,255,0.7)"
                                    }}
                                >
                                    {group}
                                </span>
                            )}
                        </div>
                        <h2
                            style={{
                                margin: 0,
                                fontSize: isExpanded ? "1.9rem" : "0.95rem",
                                fontWeight: "800",
                                color: "#ffffff",
                                textShadow: "0 2px 16px rgba(0,0,0,0.9)",
                                letterSpacing: "-0.01em",
                                transition: "all 0.38s cubic-bezier(0.16, 1, 0.3, 1)"
                            }}
                        >
                            {title || "Canale Live"}
                        </h2>
                    </div>
                </div>

                {isExpanded && (
                    <div
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "14px"
                        }}
                    >
                        <div className="sky-spinner" style={{ width: "42px", height: "42px", borderWidth: "3px" }} />
                    </div>
                )}
            </div>
        </div>
    );
}

export function useTransitionRouter() {
    return useContext(TransitionContext);
}
