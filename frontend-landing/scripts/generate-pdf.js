// Generates hsm-methodology.pdf from public/methodology.html using Playwright.
// Run: node scripts/generate-pdf.js
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

(async () => {
  const htmlPath = path.resolve(__dirname, '../public/methodology.html');
  const outPath  = path.resolve(__dirname, '../public/hsm-methodology.pdf');

  if (!fs.existsSync(htmlPath)) {
    console.error('Source not found:', htmlPath);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page    = await browser.newPage();

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 30000 });
  // Extra wait for Google Fonts
  await page.waitForTimeout(1500);

  await page.pdf({
    path:              outPath,
    format:            'A4',
    printBackground:   true,
    margin:            { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`✓ PDF generated: ${outPath} (${kb} KB)`);
})();
