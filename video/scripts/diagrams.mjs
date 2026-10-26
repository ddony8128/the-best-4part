// docs/diagrams/*.html → docs/diagrams/png/*.png (2배 해상도)
// 실행: node scripts/diagrams.mjs [이름 일부]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = path.resolve(import.meta.dirname, '../../docs/diagrams'), OUT = path.join(DIR, 'png');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => /^\d.*\.html$/.test(f) && (!only || f.includes(only)));
const b = await chromium.launch();
for (const f of files) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await p.goto(pathToFileURL(path.join(DIR, f)).href);
  await p.waitForSelector('body[data-ready]', { timeout: 10000 }).catch(() => {});
  // 그림 크기(.canvas)가 화면보다 크면 화면을 맞춘 뒤 다시 그린다
  const { w, h } = await p.evaluate(() => { const r = document.querySelector('.canvas').getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) } });
  if (w > 1920 || h > 1080) { await p.setViewportSize({ width: w, height: h }); await p.reload(); await p.waitForSelector('body[data-ready]', { timeout: 10000 }).catch(() => {}) }
  const el = p.locator('.canvas');
  await el.screenshot({ path: path.join(OUT, f.replace('.html', '.png')) });
  console.log('png', f);
  await p.close();
}
await b.close();
