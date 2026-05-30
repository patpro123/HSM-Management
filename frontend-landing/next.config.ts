import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async redirects() {
        return [
            {
                source: "/demoday",
                destination: `${process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.hsm.org.in'}/demoday`,
                permanent: false,
            },
        ];
    },
    async headers() {
        return [
            {
                source: "/sitemap.xml",
                headers: [{ key: "Content-Type", value: "application/xml" }],
            },
            {
                source: "/robots.txt",
                headers: [{ key: "Content-Type", value: "text/plain" }],
            },
        ];
    },
};

export default nextConfig;
