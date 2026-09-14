import "./globals.css";
import { DeviceProvider } from "@/components/DeviceProvider";

export const metadata = {
    title: "NMDZ - Live TV & Sport",
    description: "Next.js & React High Performance Streaming Platform",
    icons: {
        icon: [
            { url: "/logos/nmdz_monogram.png", type: "image/png" },
            { url: "/favicon.ico" }
        ],
        shortcut: "/logos/nmdz_monogram.png",
        apple: "/logos/nmdz_monogram.png",
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="it" suppressHydrationWarning>
            <head>
                {/* Script sincrono immediato (0ms, zero-flicker) che tagga <html> con data-device="mobile" o "desktop" prima del primo render */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var ua=navigator.userAgent||navigator.vendor||window.opera||"";var isMob=(navigator.userAgentData&&typeof navigator.userAgentData.mobile==="boolean")?navigator.userAgentData.mobile:(/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS|Windows Phone|BB10/i.test(ua)&&!(/iPad|Tablet|PlayBook|Silk|SmartTV/i.test(ua)));if(!isMob&&/iPad|iPhone|iPod/.test(ua)&&window.screen&&Math.min(window.screen.width,window.screen.height)<=768){isMob=true;}if(!isMob&&window.matchMedia&&window.matchMedia("(pointer: coarse) and (max-width: 768px)").matches){isMob=true;}document.documentElement.setAttribute("data-device",isMob?"mobile":"desktop");}catch(e){}})();`
                    }}
                />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" rel="stylesheet" />
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
            </head>
            <body>
                <DeviceProvider>
                    {children}
                </DeviceProvider>
            </body>
        </html>
    );
}
