"use client";
import Link from "next/link";

export default function MobileHeader({ onOpenSearch, isSearchOpen }) {
    return (
        <header className="nmdz-mobile-header" role="banner">
            <div className="mobile-header-inner">
                {/* Brand Logo */}
                <Link href="/home" className="mobile-header-logo" aria-label="NMDZ Home">
                    <svg className="mobile-logo-svg" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="3.67,166.42 67.08,220.26 67.08,459.18 3.67,511.97" />
                        <polygon points="12.2,5.03 221.73,182.93 221.73,456.97 240.23,439.46 240.23,5.03 289.49,5.03 289.49,392.83 240.23,439.46 221.73,456.97 289.49,511.97 289.49,439.46 508.33,270.03 314.16,157.02 314.16,236.42 431.11,304.38 314.16,394.94 314.16,346.06 228.61,427.11 67.08,290.01 67.08,51.81" />
                    </svg>
                    <span className="mobile-logo-text">NMDZ</span>
                </Link>

                {/* Right Actions: Search button & Live Indicator */}
                <div className="mobile-header-actions">
                    <button
                        type="button"
                        className="mobile-header-btn"
                        onClick={onOpenSearch}
                        aria-label="Cerca"
                        title="Cerca"
                    >
                        <i className="fas fa-magnifying-glass"></i>
                    </button>
                </div>
            </div>
        </header>
    );
}
