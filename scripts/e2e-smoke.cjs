// Browser smoke test of the whole flow. Needs Playwright and a running server:
//   BOOK_PROVIDER=mock PORT=3100 npm start
//   node scripts/e2e-smoke.cjs ./test-output
// Writes screenshots and the exported PDFs (side.pdf, stack.pdf) into the output dir.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'test-output';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:3100';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  // 1) search + pick a book that has a back-cover image (index 0)
  await page.getByLabel('검색어').fill('봄날');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.locator('.result').first().click();
  await page.waitForSelector('[data-testid=preview]');
  await page.waitForTimeout(800);
  const backMode = await page.locator('[aria-label="뒷면 방식"] button[aria-pressed=true]').innerText();
  console.log('book0 back mode:', backMode);
  // drag front image a bit (front is the right half in side mode)
  const box = await page.locator('[data-testid=preview]').boundingBox();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75 + 60, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await page.screenshot({ path: OUT + '/1-editor.png', fullPage: true });
  await page.getByRole('button', { name: '인쇄 목록에 담기' }).click();
  // 2) a book without back image -> template back, 3 copies
  await page.getByLabel('검색어').fill('고양이');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.result').length === 1);
  await page.locator('.result').first().click();
  await page.waitForTimeout(800);
  console.log('book1 back mode:', await page.locator('[aria-label="뒷면 방식"] button[aria-pressed=true]').innerText());
  await page.getByRole('region', { name: '표지 편집' }).locator('input[type=number]').last().fill('20');
  await page.screenshot({ path: OUT + '/2-template-back.png', fullPage: true });
  await page.getByRole('button', { name: '인쇄 목록에 담기' }).click();
  console.log('summary:', await page.locator('[data-testid=layout-summary]').innerText());
  console.log('list:', (await page.locator('.summary').last().innerText()).replace(/\s+/g,' '));
  // 3) download PDF
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF 다운로드' }).click()]);
  await dl.saveAs(OUT + '/side.pdf');
  console.log('download:', dl.suggestedFilename());
  // 4) change size + stack mode, check reflow, download again
  await page.locator('#innerW').fill('45'); await page.locator('#innerW').press('Enter');
  await page.locator('#innerH').fill('31'); await page.locator('#innerH').press('Enter');
  console.log('after resize:', await page.locator('[data-testid=layout-summary]').innerText());
  await page.getByLabel('접는 방식').selectOption('stack');
  console.log('stack:', await page.locator('[data-testid=layout-summary]').innerText());
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF 다운로드' }).click()]);
  await dl2.saveAs(OUT + '/stack.pdf');
  // 5) persistence across reload
  await page.reload();
  await page.waitForTimeout(500);
  console.log('after reload items:', await page.locator('.list li').count(), 'innerW:', await page.locator('#innerW').inputValue());
  // 6) mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: OUT + '/3-mobile.png', fullPage: false });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
