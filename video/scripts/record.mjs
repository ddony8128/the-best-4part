// 실제 화면을 조작하면서 CDP 스크린캐스트로 녹화한다 → public/rec/<clip>.mp4 + markers.json
// 영상(Remotion)에서 자막·확대 위치를 맞추기 위해 각 동작 시점을 marker로 남긴다.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../../public');
const OUT = path.resolve(import.meta.dirname, '../public/rec');
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(p).pipe(r);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

// 녹화 화면에 보이는 커서와 클릭 파동 (헤드리스에는 커서가 없다)
const CURSOR = () => {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:22px;height:22px;pointer-events:none;transform:translate(-3px,-2px);transition:transform .05s';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10 13 L16 13 Z" fill="#181818" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const pos = JSON.parse(sessionStorage.getItem('__cur') || '[800,450]');
    c.style.left = pos[0] + 'px'; c.style.top = pos[1] + 'px';
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; sessionStorage.setItem('__cur', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', e => {
      const r = document.createElement('div');
      r.style.cssText = `position:fixed;z-index:99998;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #f6995d;pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out`;
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.9)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
  });
};

const browser = await chromium.launch();
// 세로로 긴 화면을 한 번에 녹화하고(페이지 스크롤 없음), 영상에서 카메라가 이동·확대한다
const VW = 1600, VH = 2000, DSF = 1.2;
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF });
await ctx.addInitScript(CURSOR);
const page = await ctx.newPage();
// 로컬 정적 서버에는 AI 함수가 없다 → 빈 응답으로 두고 화면의 기본 초안 경로를 쓴다
await page.route('**/api/draft', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
const wait = ms => page.waitForTimeout(ms);
let mouse = [800, 450];

async function moveTo(loc, opts = {}) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  const x = b.x + (opts.fx ?? 0.5) * b.width, y = b.y + (opts.fy ?? 0.5) * b.height;
  await page.mouse.move(x, y, { steps: opts.steps ?? 28 });
  mouse = [x, y];
}
async function click(loc, opts) { await moveTo(loc, opts); await wait(220); await page.mouse.down(); await wait(70); await page.mouse.up(); await wait(150); }
// 페이지는 스크롤하지 않는다. 화면 이동은 영상 카메라가 맡는다.
async function smoothScroll(_y, ms = 900) { await wait(Math.min(ms, 600)); }
// 축 i의 중요도를 k단계(0 매우 중요 · 1 중요 · 2 보통 · 3 덜 중요)로 바꾼다
async function level(i, k) { await click(L(`#weightsLive .w:nth-child(${i + 1}) .lv button:nth-child(${k + 1})`)); await wait(900); }

async function record(name, fn) {
  const cdp = await ctx.newCDPSession(page);
  const dir = path.join(OUT, name + '_frames');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const markers = [];
  const t0 = Date.now() / 1000;
  const mark = async (label, loc) => {
    const t = Date.now() / 1000;
    let box = null;
    if (loc) { const b = await loc.boundingBox(); if (b) box = [b.x, b.y, b.width, b.height].map(v => Math.round(v * DSF)); }
    markers.push({ label, t, box });
  };
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VW * DSF, maxHeight: VH * DSF, everyNthFrame: 1 });
  await wait(300);
  await fn(mark);
  await wait(800);
  await cdp.send('Page.stopScreencast');
  await wait(300);
  // 프레임마다 실제 표시 시간을 주고 30fps 고정 mp4로 묶는다
  const start = frames[0].t;
  const list = frames.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? f.t + 0.5) - f.t).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  const mp4 = path.join(OUT, name + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', `scale=${VW * DSF}:${VH * DSF}:flags=lanczos,format=yuv420p`, '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', mp4]);
  const dur = (frames.at(-1).t + 0.5) - start;
  fs.rmSync(dir, { recursive: true, force: true });
  await cdp.detach();
  void t0;
  return { name, duration: +dur.toFixed(3), width: VW * DSF, height: VH * DSF, markers: markers.map(m => ({ label: m.label, t: +(m.t - start).toFixed(3), box: m.box })) };
}

const result = {};

// 준비: 인사 콘솔 상태를 만들어 둔다 (녹화 안 함)
await page.goto(base + '/talent_hr_admin.html');
await page.evaluate(() => localStorage.clear());
await page.goto(base + '/talent_hr_admin.html');
await wait(500);

// ───────── 인사 담당자: AI 인재 매칭 ─────────
// mark(label, 영역): 그 시점에 카메라가 비출 영역을 함께 기록한다
const L = sel => page.locator(sel);
await page.goto(base + '/hr_matching.html');
await page.mouse.move(...mouse);
await wait(400);
result.hr = await record('hr', async mark => {
  await mark('start', L('main'));
  await wait(1500);
  await mark('jd', L('#p1 .form-grid'));
  await moveTo(L('#jdText'), { fx: 0.3, fy: 0.35, steps: 30 }); await wait(1300);
  await mark('sources', L('#p1 .form-grid > div:last-child'));
  await moveTo(L('#p1 .src').nth(1), { fx: 0.4 }); await wait(900);
  await moveTo(L('#scope .chip').nth(3)); await wait(900);
  await mark('analyze-btn', L('#p1 .form-foot'));
  await click(L('#btnAnalyze'));
  await mark('reqs', L('#p2 .card').first());
  await page.waitForSelector('#btnGate:not([disabled])', { timeout: 20000 });
  await wait(600);
  await moveTo(L('#reqRows tr').nth(2).locator('.need')); await wait(900);
  await mark('weights', L('#p2'));
  await moveTo(L('#weightsGate .w').nth(1)); await wait(1100);
  await moveTo(L('#btnGate')); await wait(500);
  await click(L('#btnGate'));
  await mark('scan', L('#p3 .scan'));
  await page.waitForSelector('#p4.active', { timeout: 30000 });
  await mark('list', L('#p4 .two > .card').first());
  await wait(700);
  await moveTo(L('.cand').nth(1), { fx: 0.3 }); await wait(1500);
  await moveTo(L('.cand .badge-hidden').first()); await wait(1300);
  await mark('reweight', L('#p4'));
  // 합계 100%를 넘길 수 없으므로 먼저 줄이고 나서 올린다
  await level(3, 0);
  await level(4, 0);
  await wait(1500);
  await click(L('.cand').filter({ hasText: '이한결' }), { fx: 0.3 });
  await mark('detail', L('#detail'));
  await wait(1200);
  await moveTo(L('#detail table'), { fx: 0.4, fy: 0.3 }); await wait(1800);
  await mark('concerns', L('#detail .evidence.warn').first());
  await moveTo(L('#detail .evidence.warn').first(), { fx: 0.5 }); await wait(2000);
  await moveTo(L('#detail button.primary')); await wait(300);
  await click(L('#detail button.primary'));
  await mark('report', L('#p5'));
  await page.waitForSelector('#btnSend:not([disabled])', { timeout: 20000 });
  await mark('report-done', L('#p5 .doc'));
  await wait(1800);
  await click(L('#btnSend'));
  await mark('report-sent', L('#p5'));
  await wait(1000);
  await click(L('#docTabs button[data-doc=offer]'));
  await mark('offer', L('#p5'));
  await page.waitForSelector('#btnSend:not([disabled])', { timeout: 20000 });
  await mark('offer-done', L('#p5 .doc'));
  await wait(1800);
  await click(L('#btnSend'));
  await mark('offer-sent', L('#toast'));
  await wait(2000);
});
console.log('hr', result.hr.duration);

// ───────── 지원자(임직원) ─────────
await page.goto(base + '/employee.html');
await page.mouse.move(...mouse);
await wait(500);
result.emp = await record('emp', async mark => {
  await mark('home', L('main'));
  await wait(1300);
  await mark('offer-card', L('#offerBox .card'));
  await moveTo(L('#offerBox h2'), { fx: 0.3 }); await wait(1200);
  await click(L('#offerBox button').first());
  await mark('offer-open', L('#offerBox .card'));
  await wait(2800);
  await click(L('#offerBox button.primary'));
  await mark('diag', L('#diagBody .three'));
  await wait(1200);
  await moveTo(L('#diagBody .bar-row').first()); await wait(1500);
  await mark('reqs', L('#diagBody > .card').first());
  await moveTo(L('#diagBody tbody tr').nth(1).locator('.status')); await wait(1500);
  await moveTo(L('#diagBody tbody tr').nth(3).locator('.status')); await wait(1500);
  await mark('gap', L('#diagBody .two > .card').first());
  await moveTo(L('#diagBody .gap li').first(), { fx: 0.4 }); await wait(2000);
  await mark('apply', L('#diagBody .two > .card').nth(1));
  await click(L('#applyMotive'));
  await page.keyboard.type('사업소 데이터 표준을 통일한 경험을 그룹 매출 지표 통일에 쓰고 싶습니다.', { delay: 45 });
  await wait(600);
  await moveTo(L('#diagBody button.primary')); await wait(300);
  await click(L('#diagBody button.primary'));
  await mark('applied', L('#diagBody .two > .card').nth(1));
  await wait(2200);
});
console.log('emp', result.emp.duration);

// ───────── 인사 콘솔: 지원·제안이 도착한 모습 ─────────
await page.goto(base + '/talent_hr_admin.html#overview');
await page.mouse.move(...mouse);
await wait(500);
result.console = await record('console', async mark => {
  await mark('recent', L('#overview .two'));
  await moveTo(L('#recent .record').first(), { fx: 0.3 }); await wait(2400);
  await click(L('nav a[href="#jobs"]'));
  await click(L('#jobRows tr').filter({ hasText: 'JD-014' }).getByText('지원자 · 검토'));
  await mark('people', L('#people'));
  await wait(700);
  await moveTo(L('#peopleRows tr').filter({ hasText: '이한결' }), { fx: 0.25 }); await wait(2400);
});
console.log('console', result.console.duration);

fs.writeFileSync(path.resolve(import.meta.dirname, '../src/recordings.json'), JSON.stringify(result, null, 2));
await browser.close();
server.close();
