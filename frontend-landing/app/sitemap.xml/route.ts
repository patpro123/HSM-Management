import { INSTRUMENTS } from '@/lib/instruments';

export async function GET() {
    const today = new Date().toISOString().split('T')[0];

    const staticUrls = [
        { loc: 'https://hsm.org.in/', priority: '1.0' },
        { loc: 'https://hsm.org.in/kismatpur', priority: '0.9' },
        { loc: 'https://hsm.org.in/pbel-city', priority: '0.8' },
        { loc: 'https://hsm.org.in/practice-portal', priority: '0.8' },
        { loc: 'https://hsm.org.in/terms', priority: '0.3' },
    ];

    const instrumentUrls = INSTRUMENTS.map(i => ({
        loc: `https://hsm.org.in/${i.slug}`,
        priority: '0.9',
    }));

    const urls = [...staticUrls, ...instrumentUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(xml, {
        headers: { 'Content-Type': 'application/xml' },
    });
}
