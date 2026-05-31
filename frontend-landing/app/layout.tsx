import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
};

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
                {/* MusicSchool — local business identity + ratings */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "MusicSchool",
                            "name": "Hyderabad School of Music",
                            "url": "https://hsm.org.in",
                            "logo": "https://hsm.org.in/HSM_Logo_Horizontal.png",
                            "telephone": "+919652444188",
                            "description": "Music school in Kismatpur, Hyderabad offering classes in Guitar, Keyboard, Piano, Drums, Tabla, Violin, Hindustani Vocals, and Carnatic Vocals. 100% Merit/Distinction rate in Trinity College London exams.",
                            "address": {
                                "@type": "PostalAddress",
                                "streetAddress": "Kismatpur",
                                "addressLocality": "Hyderabad",
                                "addressRegion": "Telangana",
                                "postalCode": "500091",
                                "addressCountry": "IN"
                            },
                            "openingHours": [
                                "Tu-Fr 17:00-21:00",
                                "Sa 15:00-21:00",
                                "Su 10:00-13:00,17:00-21:00"
                            ],
                            "aggregateRating": {
                                "@type": "AggregateRating",
                                "ratingValue": "4.9",
                                "reviewCount": "47",
                                "bestRating": "5",
                                "worstRating": "1"
                            },
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

                {/* Event schema — Demo Day June 13 */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Event",
                            "name": "HSM Demo Day — Free Music Trial",
                            "description": "Experience the HSM Method live. Try Piano, Drums, Guitar, Violin, or Vocals. Meet our faculty and see our daily habit tracking system in action. Free entry — no commitment.",
                            "startDate": "2026-06-13T10:00:00+05:30",
                            "endDate": "2026-06-13T18:00:00+05:30",
                            "eventStatus": "https://schema.org/EventScheduled",
                            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                            "url": "https://portal.hsm.org.in/demoday",
                            "image": "https://hsm.org.in/HSM_Logo_Horizontal.png",
                            "location": {
                                "@type": "Place",
                                "name": "Hyderabad School of Music — Kismatpur",
                                "address": {
                                    "@type": "PostalAddress",
                                    "streetAddress": "Kismatpur",
                                    "addressLocality": "Hyderabad",
                                    "addressRegion": "Telangana",
                                    "addressCountry": "IN"
                                }
                            },
                            "organizer": {
                                "@type": "Organization",
                                "name": "Hyderabad School of Music",
                                "url": "https://hsm.org.in"
                            },
                            "offers": {
                                "@type": "Offer",
                                "price": "0",
                                "priceCurrency": "INR",
                                "availability": "https://schema.org/InStock",
                                "url": "https://portal.hsm.org.in/demoday",
                                "validFrom": "2026-05-31"
                            },
                            "sameAs": "https://share.google/luZQOKzDpHdTKykOd",
                            "performer": [
                                { "@type": "Person", "name": "Joshua", "jobTitle": "Guitar & Keyboard Instructor" },
                                { "@type": "Person", "name": "Subroto Bhaduri", "jobTitle": "Drums & Tabla Instructor" },
                                { "@type": "Person", "name": "Isaac Lawrence", "jobTitle": "Violin Instructor" },
                                { "@type": "Person", "name": "Sangeetha", "jobTitle": "Vocals Instructor" }
                            ]
                        })
                    }}
                />

                {/* FAQPage schema — feeds Google's rich FAQ results */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "FAQPage",
                            "mainEntity": [
                                {
                                    "@type": "Question",
                                    "name": "How is HSM different from a regular music class?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "Most music schools teach students to play individually and work toward grade exams. HSM puts students into ensembles from the start — you learn to play with others, perform on stage, and build habits that make practice at home actually stick. We're building musicians, not just grading them." }
                                },
                                {
                                    "@type": "Question",
                                    "name": "What is the habit tracker and homework reviewer?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "Every student gets access to our practice portal. Teachers assign homework and students log daily practice streaks. The homework reviewer lets teachers send audio/video instructions for what to practice. Students see exactly what they need to do — and check it off when done." }
                                },
                                {
                                    "@type": "Question",
                                    "name": "Does my child need prior experience to join HSM?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "Not at all. We start from the very beginning and move at your child's pace." }
                                },
                                {
                                    "@type": "Question",
                                    "name": "What age groups does Hyderabad School of Music teach?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "We welcome students from age 5 to 60+. Music has no age limit." }
                                },
                                {
                                    "@type": "Question",
                                    "name": "How soon will my child play a real song?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "Most students play their first song within 4–6 weeks. We make early wins a priority." }
                                },
                                {
                                    "@type": "Question",
                                    "name": "What are the fees at Hyderabad School of Music?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "We offer a Trial Pack (4 classes, starting ₹2000) and a Quarterly Pack (24 classes). Your first demo class is completely free — no commitment." }
                                },
                                {
                                    "@type": "Question",
                                    "name": "Where is Hyderabad School of Music located?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "HSM is located in Kismatpur, Hyderabad, Telangana. Classes run Tuesday–Friday 5PM–9PM, Saturday 3PM–9PM, and Sunday 10AM–1PM & 5PM–9PM." }
                                },
                                {
                                    "@type": "Question",
                                    "name": "Does HSM prepare students for Trinity College London exams?",
                                    "acceptedAnswer": { "@type": "Answer", "text": "Yes. HSM has a 100% Merit or Distinction success rate in Trinity College London examinations. Our structured HSM Method and monthly assessments ensure every student is exam-ready." }
                                }
                            ]
                        })
                    }}
                />
            </head>
            <body>{children}</body>
        </html>
    );
}
