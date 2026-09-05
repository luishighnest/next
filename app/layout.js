import "./globals.css";

export const metadata = {
    title: "NMDZ - Live TV & Sport",
    description: "Next.js & React High Performance Streaming Platform",
    icons: {
        icon: "/logos/premium_logo_dark.jpg",
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="it">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" rel="stylesheet" />
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
