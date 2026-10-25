// 배포 사이트에서 로그인 → AI 매칭 → 추천서·제안서를 실제 AI로 생성해 본다. 실행: HR_ID=... HR_PW=... node scripts/live-check.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const U = 'https://talent-link-seven.vercel.app';
const OUT = path.resolve(import.meta.dirname, '../out/live'); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => console.log('ERR', e.message));
const drafts = [];
page.on('response', async r => { if (r.url().endsWith('/api/draft')) drafts.push([r.status(), (await r.json().catch(() => ({}))).by || 'none']); });
await page.goto(U + '/login.html?next=' + encodeURIComponent('/hr_matching.html?fast'));
await page.fill('input[type=text], #id', process.env.HR_ID); await page.fill('input[type=password]', process.env.HR_PW);
await Promise.all([page.waitForURL(/hr_matching/), page.keyboard.press('Enter')]);
await page.waitForSelector('#btnAnalyze');
await page.click('#btnAnalyze'); await page.waitForSelector('#btnGate:not([disabled])', { timeout: 20000 });
await page.click('#btnGate'); await page.waitForSelector('#p4.active', { timeout: 30000 });
for (const [tab, file] of [['추천서 작성 →', 'report'], [null, 'offer']]) {
  const t = Date.now();
  if (tab) await page.click('text=' + tab); else await page.click('#docTabs button[data-doc=offer]');
  await page.waitForSelector('#btnSend:not([disabled])', { timeout: 40000 });
  console.log(file, ((Date.now() - t) / 1000).toFixed(1) + 's', await page.locator('#docState').textContent());
  await page.locator('#p5').screenshot({ path: `${OUT}/${file}.png` });
}
console.log('api/draft', JSON.stringify(drafts));
await b.close();
