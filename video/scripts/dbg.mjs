import { chromium } from 'playwright';
const b = await chromium.launch(); const pg = await b.newPage();
pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto('file:///C:/not_system/project/26-10/hanwha-ai/public/hr_matching.html?fast');
await pg.click('#btnAnalyze'); await pg.waitForSelector('#btnGate:not([disabled])'); await pg.click('#btnGate');
await pg.waitForSelector('#p4.active', { timeout: 20000 }); await pg.waitForTimeout(300);
console.log('detail len', (await pg.locator('#detail').innerHTML()).length, 'selected', await pg.evaluate(() => selected));
await b.close();
