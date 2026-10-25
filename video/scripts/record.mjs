// 실제 화면(실제 DB · Claude가 붙은 로컬 서버)을 조작하면서 CDP 스크린캐스트로 녹화한다 → public/rec/<clip>.mp4 + src/recordings.json
// 시나리오: 임광현(한화시스템 해외사업팀)이 인재풀에 데이터를 올려 둠 → 인사 담당자가 한화에어로스페이스 JD-045를 스캔 → 숨은 후보 1위 →
//          추천서·제안서 → 임광현이 제안을 받고 셀프 진단 후 지원 → 인사 콘솔에 도착
// - mark(label, 영역): 그 시점에 카메라가 비출 영역 (자막·내레이션도 이 시점에 맞춘다)
// - '~click' · '~type' 마커: 효과음 위치
// - cut(): AI가 작성하는 동안처럼 기다리는 구간을 잘라 낸다 (잘라 낸 길이는 '~cut' 마커에 남겨 화면에 "실제 약 N초"로 표시)
// 실행: (1) node data/scan/reset-records.mjs  (2) node data/scan/dev-server.mjs  (3) node scripts/record.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = path.resolve(import.meta.dirname, '../public/rec');
fs.mkdirSync(OUT, { recursive: true });

// 녹화 화면에 보이는 커서와 클릭 파동 (헤드리스에는 커서가 없다)
const CURSOR = () => {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:26px;height:26px;pointer-events:none;transform:translate(-3px,-2px)';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10 13 L16 13 Z" fill="#191f28" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const pos = JSON.parse(sessionStorage.getItem('__cur') || '[800,450]');
    c.style.left = pos[0] + 'px'; c.style.top = pos[1] + 'px';
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; sessionStorage.setItem('__cur', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', e => {
      const r = document.createElement('div');
      r.style.cssText = `position:fixed;z-index:99998;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #f4511e;pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out`;
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
const wait = ms => page.waitForTimeout(ms);
const L = sel => page.locator(sel);
let mouse = [800, 450], curMark = null;

async function moveTo(loc, opts = {}) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  const x = b.x + (opts.fx ?? 0.5) * b.width, y = b.y + (opts.fy ?? 0.5) * b.height;
  await page.mouse.move(x, y, { steps: opts.steps ?? 26 });
  mouse = [x, y];
}
async function click(loc, opts) { await moveTo(loc, opts); await wait(200); if (curMark) await curMark('~click'); await page.mouse.down(); await wait(70); await page.mouse.up(); await wait(150); }
async function type(text) { if (curMark) await curMark('~type'); await page.keyboard.type(text, { delay: 40 }); if (curMark) await curMark('~type-end') }
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
  const markers = [], cuts = [];
  const mark = async (label, loc) => {
    const t = Date.now() / 1000;
    let box = null;
    if (loc) { const b = await loc.boundingBox(); if (b) box = [b.x, b.y, b.width, b.height].map(v => Math.round(v * DSF)); }
    markers.push({ label, t, box });
  };
  // 기다리는 동안을 잘라 낸다: until()이 끝날 때까지의 구간
  const cut = async until => { const a = Date.now() / 1000; await until(); await wait(250); const b = Date.now() / 1000; cuts.push([a + 0.35, b]); markers.push({ label: '~cut', t: a + 0.35, box: null, sec: Math.round(b - a) }) };
  curMark = mark;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VW * DSF, maxHeight: VH * DSF, everyNthFrame: 1 });
  await wait(300);
  await fn(mark, cut);
  await wait(800);
  curMark = null;
  await cdp.send('Page.stopScreencast');
  await wait(300);
  // 잘라 낸 구간을 빼고 시간을 다시 매긴다
  const shift = t => cuts.reduce((s, [a, b]) => s + (t > b ? b - a : t > a ? t - a : 0), 0);
  const inCut = t => cuts.some(([a, b]) => t > a && t < b);
  const kept = frames.filter(f => !inCut(f.t)).map(f => ({ ...f, t: f.t - shift(f.t) }));
  const start = kept[0].t;
  const list = kept.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, (kept[i + 1]?.t ?? f.t + 0.5) - f.t).toFixed(4)}`).join('\n') + `\nfile '${kept.at(-1).file.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  const mp4 = path.join(OUT, name + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', `scale=${VW * DSF}:${VH * DSF}:flags=lanczos,format=yuv420p`, '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', mp4]);
  const dur = (kept.at(-1).t + 0.5) - start;
  fs.rmSync(dir, { recursive: true, force: true });
  await cdp.detach();
  return { name, duration: +dur.toFixed(3), width: VW * DSF, height: VH * DSF, markers: markers.map(m => ({ label: m.label, t: +(m.t - shift(m.t) - start).toFixed(3), box: m.box, ...(m.sec ? { sec: m.sec } : {}) })) };
}

const result = {};

// 준비: 인사 담당자 로그인 (녹화 안 함)
await page.goto(BASE + '/login.html');
await page.click('#pw');
await Promise.all([page.waitForURL(/talent_hr_admin/), page.click('#go')]);
await page.evaluate(() => localStorage.clear());

// ───────── 인사 담당자: AI 인재 매칭 ─────────
await page.goto(BASE + '/hr_matching.html');
await page.waitForFunction(() => /2\d\d명/.test(document.getElementById('scopeCount').textContent));
await page.selectOption('#jdSelect', 'JD-045');
await page.mouse.move(...mouse);
await wait(500);
result.hr = await record('hr', async (mark, cut) => {
  await mark('start', L('main'));
  await wait(1400);
  await mark('jd', L('#p1 .form-grid'));
  await moveTo(L('#jdSelect'), { fx: 0.3 }); await wait(700);
  await moveTo(L('#jdText'), { fx: 0.3, fy: 0.35, steps: 30 }); await wait(1300);
  await mark('scope', L('#p1 .form-grid > div:last-child'));
  await moveTo(L('#scope .chip').nth(2)); await wait(1200);
  await mark('analyze-btn', L('#p1 .form-foot'));
  await click(L('#btnAnalyze'));
  await mark('reqs', L('#p2 .card').first());
  await page.waitForSelector('#btnGate:not([disabled])', { timeout: 60000 });
  await wait(500);
  await moveTo(L('#reqRows tr').nth(7).locator('.srctag').first()); await wait(1200);
  await mark('hard', L('#hardCard'));
  await moveTo(L('#hardBody .qa').nth(1), { fx: 0.3 }); await wait(1800);
  await mark('refs', L('#refCard'));
  await moveTo(L('#refBody .rf').nth(2), { fx: 0.4, fy: 0.3 }); await wait(2000);
  await mark('weights', L('#weightCard'));
  await moveTo(L('#weightsGate .w').nth(1)); await wait(1200);
  await mark('gate', L('#p2 > .form-foot'));
  await click(L('#btnGate'));
  await mark('scan', L('#p3 .scan'));
  await page.waitForSelector('#p4.active', { timeout: 60000 });
  await mark('list', L('#candList'));
  await wait(800);
  await moveTo(L('.cand').first(), { fx: 0.25 }); await wait(1500);
  await moveTo(L('.cand .badge-hidden').first()); await wait(1200);
  await mark('reweight', L('#p4'));
  await level(1, 2);
  await level(4, 0);
  await wait(1400);
  await level(1, 0);
  await level(4, 2);
  await wait(900);
  await click(L('.cand').filter({ hasText: '임광현' }), { fx: 0.3 });
  await mark('detail', L('#detail'));
  await wait(1300);
  await mark('detail-hard', L('#detail table').first());
  await moveTo(L('#detail table').first(), { fx: 0.5, fy: 0.5 }); await wait(1800);
  await mark('detail-reqs', L('#detail table').nth(1));
  await moveTo(L('#detail table').nth(1).locator('.status').nth(1)); await wait(1800);
  await mark('concerns', L('#detail .evidence.warn').first());
  await moveTo(L('#detail .evidence.warn').first(), { fx: 0.5 }); await wait(1800);
  await moveTo(L('#detail .docbtn.primary')); await wait(300);
  await click(L('#detail .docbtn.primary'));
  await mark('report', L('#p5'));
  await wait(600);
  await cut(() => page.waitForSelector('#btnSend:not([disabled])', { timeout: 90000 }));
  await mark('report-done', L('#docBody'));
  await moveTo(L('#docBody'), { fx: 0.4, fy: 0.3 }); await wait(2200);
  await click(L('#btnSend'));
  await mark('report-sent', L('#p5'));
  await wait(1200);
  await click(L('#docTabs button[data-doc=offer]'));
  await mark('offer', L('#p5'));
  await wait(600);
  await cut(() => page.waitForSelector('#btnSend:not([disabled])', { timeout: 90000 }));
  await mark('offer-done', L('#docBody'));
  await moveTo(L('#docAttach .file')); await wait(2000);
  await click(L('#btnSend'));
  await mark('offer-sent', L('#p5'));
  await wait(2200);
});
console.log('hr', result.hr.duration);

// ───────── 임직원(임광현): 로그인 → 받은 제안 → 셀프 진단 → 지원 ─────────
await page.goto(BASE + '/login.html?role=emp&next=/employee.html');
await page.mouse.move(...mouse);
await wait(500);
result.emp = await record('emp', async (mark, cut) => {
  await mark('login', L('.wrap'));
  await wait(900);
  await click(L('#id'));
  await wait(900);
  await click(L('#go'));
  await page.waitForURL(/employee/);
  await page.waitForFunction(() => document.getElementById('meName').textContent === '임광현', null, { timeout: 20000 });
  await wait(700);
  await mark('home', L('main'));
  await wait(1200);
  await mark('offer-card', L('#offerBox .card').first());
  await moveTo(L('#offerBox .card-head h2').first(), { fx: 0.3 }); await wait(1200);
  await click(L('#offerBox button').first());
  await mark('offer-open', L('#offerBox .card').first());
  await moveTo(L('#offerBox .fieldbox').first(), { fx: 0.4, fy: 0.25 }); await wait(2600);
  await click(L('#offerBox button.primary').first());
  await mark('diag-wait', L('#diagnose'));
  await wait(600);
  await cut(() => page.waitForSelector('#diagBody .seg', { timeout: 90000 }));
  await mark('diag', L('#diagBody .pane[data-p="0"]'));
  await moveTo(L('#diagBody .bar-row').first()); await wait(1600);
  await moveTo(L('#diagBody .evidence').first(), { fx: 0.3 }); await wait(1400);
  await click(L('#diagBody .seg button[data-t="1"]'));
  await mark('reqs', L('#diagBody .pane[data-p="1"]'));
  await moveTo(L('#diagBody tbody tr').nth(1).locator('.status')); await wait(1500);
  await moveTo(L('#diagBody tbody tr').nth(6).locator('.status')); await wait(1500);
  await click(L('#diagBody .seg button[data-t="2"]'));
  await mark('apply', L('#diagBody .pane[data-p="2"]'));
  await click(L('#applyMotive'));
  await type('해외 전시회와 영문 세일즈키트를 직접 운영한 경험을 글로벌 브랜드 전략에 쓰고 싶습니다.');
  await wait(500);
  await moveTo(L('#diagBody .pane[data-p="2"] button.primary')); await wait(300);
  await click(L('#diagBody .pane[data-p="2"] button.primary'));
  await page.waitForFunction(() => /지원 완료/.test(document.querySelector('#diagBody .pill')?.textContent || ''), null, { timeout: 20000 });
  await mark('applied', L('#diagBody .pane[data-p="2"]'));
  await wait(2200);
});
console.log('emp', result.emp.duration);

// ───────── 인사 콘솔: 보고 · 제안 · 지원이 도착한 모습 ─────────
await page.goto(BASE + '/talent_hr_admin.html#overview');
await page.waitForFunction(() => typeof LIVE !== 'undefined' && LIVE, null, { timeout: 20000 });
await page.mouse.move(...mouse);
await wait(800);
result.console = await record('console', async mark => {
  await mark('recent', L('#overview .two'));
  await moveTo(L('#recent .record').first(), { fx: 0.3 }); await wait(2400);
  await click(L('nav a[href="#jobs"]'));
  await mark('jobs', L('#jobs'));
  await click(L('#jobSearch'));
  await type('JD-045');
  await wait(600);
  await click(L('#jobRows tr').filter({ hasText: 'JD-045' }).getByText('지원자 · 검토'));
  await mark('people', L('#people'));
  await wait(700);
  await moveTo(L('#peopleRows tr').filter({ hasText: '임광현' }), { fx: 0.25 }); await wait(2600);
});
console.log('console', result.console.duration);

fs.writeFileSync(path.resolve(import.meta.dirname, '../src/recordings.json'), JSON.stringify(result, null, 2));
await browser.close();
