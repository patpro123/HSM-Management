import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
