export async function GET() {
    const text = `User-agent: *
Allow: /

Sitemap: https://hsm.org.in/sitemap.xml`;

    return new Response(text, {
        headers: { 'Content-Type': 'text/plain' },
    });
}
