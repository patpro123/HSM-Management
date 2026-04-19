import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700", "800", "900"],
    variable: "--loaded-inter",
    display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    variable: "--loaded-jakarta",
    display: "swap",
});

export const metadata: Metadata = {
    metadataBase: new URL("https://hsm.org.in"),
    title: "Hyderabad School of Music | Learn Music in Kismatpur, Hyderabad",
    description: "Hyderabad School of Music (HSM) offers in-person classes in Guitar, Keyboard, Piano, Drums, Tabla, Violin, and Vocals at Kismatpur, Hyderabad. Free demo class. All ages welcome.",
    keywords: "music school hyderabad, guitar classes hyderabad, keyboard lessons kismatpur, piano classes hyderabad, drums tabla violin vocals, HSM hyderabad",
    openGraph: {
        title: "Hyderabad School of Music",
        description: "Learn Guitar, Keyboard, Piano, Drums, Tabla, Violin, and Vocals in Kismatpur, Hyderabad. Free demo class for all ages.",
        url: "https://hsm.org.in",
        siteName: "Hyderabad School of Music",
        images: [
            {
                url: "/HSM_Logo_Horizontal.png",
                width: 1200,
                height: 630,
                alt: "Hyderabad School of Music",
            },
        ],
        locale: "en_IN",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Hyderabad School of Music",
        description: "Learn music in Kismatpur, Hyderabad. Guitar, Keyboard, Piano, Drums, Tabla, Violin, Vocals. Free demo class.",
        images: ["/HSM_Logo_Horizontal.png"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
        },
    },
    alternates: {
        canonical: "https://hsm.org.in",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable}`}>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "MusicSchool",
                            "name": "Hyderabad School of Music",
                            "url": "https://hsm.org.in",
                            "logo": "https://hsm.org.in/HSM_Logo_Horizontal.png",
                            "description": "Music school offering classes in Guitar, Keyboard, Piano, Drums, Tabla, Violin, Hindustani Vocals, and Carnatic Vocals.",
                            "address": {
                                "@type": "PostalAddress",
                                "streetAddress": "Kismatpur",
                                "addressLocality": "Hyderabad",
                                "addressRegion": "Telangana",
                                "addressCountry": "IN"
                            },
                            "openingHours": [
                                "Tu-Fr 17:00-21:00",
                                "Sa 15:00-21:00",
                                "Su 10:00-13:00,17:00-21:00"
                            ],
                            "hasOfferCatalog": {
                                "@type": "OfferCatalog",
                                "name": "Music Classes",
                                "itemListElement": [
                                    "Guitar", "Keyboard", "Piano", "Drums", "Tabla", "Violin",
                                    "Hindustani Vocals", "Carnatic Vocals"
                                ].map(instrument => ({
                                    "@type": "Offer",
                                    "itemOffered": {
                                        "@type": "Service",
                                        "name": `${instrument} Classes`
                                    }
                                }))
                            }
                        })
                    }}
                />
            </head>
            <body>{children}</body>
        </html>
    );
}
