// Generates hsm-methodology.pdf from public/methodology.html using Playwright.
// Run: node scripts/generate-pdf.js
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const COPYRIGHT = '© 2024–2028 Hyderabad School of Music. All rights reserved.';

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
    path:            outPath,
    format:          'A4',
    printBackground: true,
    margin:          { top: '0', right: '0', bottom: '14px', left: '0' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `
      <div style="
        width:100%;padding:0 28px;box-sizing:border-box;
        font-family:Inter,sans-serif;font-size:8px;color:#94a3b8;
        display:flex;justify-content:space-between;align-items:center;
        border-top:1px solid #e2e8f0;padding-top:4px;
      ">
        <span>${COPYRIGHT} Unauthorised reproduction prohibited.</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
  });

  await browser.close();

  // Embed PDF metadata using pdf-lib
  await embedPdfMetadata(outPath, {
    title:    'The HSM Method — 5 Daily Habits of Students Who Score Distinction',
    author:   'Hyderabad School of Music',
    subject:  'Music education methodology — proprietary content, all rights reserved.',
    creator:  'Hyderabad School of Music (hsm.org.in)',
    keywords: 'HSM, music education, Trinity, distinction, daily habits',
  });

  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`✓ PDF generated: ${outPath} (${kb} KB)`);
})();

async function embedPdfMetadata(filePath, meta) {
  const { PDFDocument } = require('pdf-lib');
  const bytes = fs.readFileSync(filePath);
  const doc   = await PDFDocument.load(bytes);
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  doc.setCreator(meta.creator);
  doc.setKeywords([meta.keywords]);
  doc.setProducer('Hyderabad School of Music');
  const out = await doc.save();
  fs.writeFileSync(filePath, out);
  console.log('✓ PDF metadata embedded:', Object.keys(meta).join(', '));
}
