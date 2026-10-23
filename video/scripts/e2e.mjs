// 세 화면(인사 매칭 → 임직원 → 인사 콘솔)의 연결 흐름을 실제 브라우저로 확인한다.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../public');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) process.exitCode = 1; };

await page.goto(base + '/index.html');
check(await page.locator('a.door').count() === 2, 'start page has two doors');

// HR 콘솔을 한 번 열어 저장소 상태를 만든다
await page.goto(base + '/talent_hr_admin.html');
await page.waitForTimeout(400);

await page.goto(base + '/hr_matching.html?fast');
await page.click('#btnAnalyze');
await page.waitForSelector('#btnGate:not([disabled])', { timeout: 15000 });
check(await page.locator('#reqRows tr').count() === 6, 'six requirements generated');
// Gate: 합계 100%를 넘겨 올릴 수 없고, 모자라면 스캔 버튼이 잠긴다
await page.locator('#weightsGate input').nth(3).fill('50');
check((await page.locator('#weightsGate input').nth(3).inputValue()) === '10', 'gate: cannot raise past 100% total');
await page.locator('#weightsGate input').nth(0).fill('20');
check(await page.locator('#btnGate').isDisabled(), 'gate: scan blocked when total < 100%');
check(await page.locator('#weightsGateWarn').isVisible(), 'gate: warning shown when total < 100%');
await page.locator('#weightsGate input').nth(0).fill('25');
check(await page.locator('#btnGate').isEnabled(), 'gate: scan enabled again at 100%');
await page.click('#btnGate');
await page.waitForSelector('#p4.active', { timeout: 20000 });
const names = await page.locator('.cand .nm').allTextContents();
check(names.length === 10, 'top 10 listed: ' + names.slice(0, 3).join(', '));
check(names[0] === '김서윤', 'default #1 is 김서윤');
check(await page.locator('.badge-hidden').count() > 0, 'hidden candidates flagged');
await page.locator('#weightsLive input').nth(4).fill('50');
check((await page.locator('#weightsLive input').nth(4).inputValue()) === '15', 'live: cannot raise past 100% total');
await page.locator('#weightsLive input').nth(0).fill('15');
check(await page.locator('#detail .docbtn').first().isDisabled(), 'live: report/offer blocked when total < 100%');
await page.locator('#weightsLive input').nth(0).fill('25');
// 성장 가능성·커리어 적합성 가중치를 올리면 이한결이 1위
for (const [i, v] of [[0, 15], [1, 20], [2, 15], [3, 25], [4, 25]]) {
  await page.locator('#weightsLive input').nth(i).fill(String(v));
}
await page.waitForTimeout(300);
check((await page.locator('.cand .nm').first().textContent()) === '이한결', 'reweight moves 이한결 to #1');
await page.locator('.cand', { hasText: '이한결' }).click();
await page.click('text=추천서 작성 →');
await page.waitForSelector('#btnSend:not([disabled])', { timeout: 20000 });
check((await page.locator('#docBody').textContent()).includes('[추천서]'), 'report generated');
await page.click('#btnSend');
await page.click('#docTabs button[data-doc=offer]');
await page.waitForSelector('#btnSend:not([disabled])', { timeout: 20000 });
check((await page.locator('#docBody').textContent()).includes('참여를 제안드립니다'), 'offer generated');
await page.click('#btnSend');

await page.goto(base + '/employee.html');
check(await page.locator('#offerBox .card').count() === 1, 'employee sees received offer');
await page.click('#offerBox button.primary');
check(await page.locator('#diag table tbody tr, #diagBody table tbody tr').count() >= 3, 'requirement table on diagnosis');
await page.fill('#applyMotive', '데이터 표준 통일 경험을 그룹 지표 통일에 쓰고 싶습니다.');
await page.click('text=지원하기 →');
await page.waitForTimeout(300);
check(await page.locator('text=이미 지원함').count() === 1, 'application submitted');
await page.click('nav a[href="#profile"]');
await page.fill('#fixNote', 'Power BI 대시보드는 팀 공동 작업이었습니다.');
await page.click('text=정정 요청 보내기');

await page.goto(base + '/talent_hr_admin.html#people');
await page.waitForTimeout(400);
check(await page.locator('#peopleRows', { hasText: '이한결' }).count() === 1, 'HR console lists 이한결 as applicant');
await page.goto(base + '/talent_hr_admin.html#overview');
const recent = await page.locator('#recent').textContent();
check(recent.includes('직접 지원') && recent.includes('정정 요청'), 'HR activity log shows apply + correction');
const audit = () => page.evaluate(() => JSON.parse(localStorage.getItem('talent-hr-admin-v1')).audit.map(a => a.action).join('|'));
check((await audit()).includes('참여 제안 발송'), 'HR audit log has offer sent');

// ── 피드백 반영 확인 (2026-10-23) ──
const html = await page.content();
check(!html.includes('가온'), 'console: no fictional company names');
check(!html.includes('가상 설정') && !html.includes('미이수로 단정하지 않음'), 'console: evidence/education wording cleaned');
check(await page.evaluate(() => state.jobs.find(j => j.id === 'JD-002').org) === '제조혁신본부 · 설비기술팀', 'console: JD-002 filled from source');
// 인재 참여 제안: 검색 팝업
await page.click('nav a[href="#offers"]');
await page.click('#offerPick');
await page.fill('#pickerSearch', '박민준');
check(await page.locator('#pickerList .pick-row').count() === 1, 'offer picker: search narrows to one person');
await page.locator('#pickerList .pick-row').first().click();
check((await page.locator('#offerPerson').inputValue()) === 'APP-002' && (await page.locator('#offerPickLabel').textContent()).includes('한화엔진'), 'offer picker: selection applied');
// 임직원: 인사 링크 없음, 정량 데이터 가림, 지원 취소
await page.goto(base + '/employee.html#profile');
check(await page.locator('header a[href="./talent_hr_admin.html"]').count() === 0, 'employee: HR link removed');
const prof = await page.locator('#profileGrid').textContent();
check(!prof.includes('KPI 달성률') && !prof.includes('SQLD(2023)') && (await page.locator('#profileGrid .masked').count()) === 5, 'employee: quantitative data masked');
page.once('dialog', d => d.accept());
await page.click('nav a[href="#applications"]');
await page.click('#appList button.cancel');
await page.waitForTimeout(200);
check(await page.locator('#appList .empty').count() === 1, 'employee: application cancelled');
await page.goto(base + '/talent_hr_admin.html#people');
await page.waitForTimeout(300);
check(await page.locator('#peopleRows', { hasText: '이한결' }).count() === 0 && (await audit()).includes('지원 취소'), 'console: cancelled applicant removed + logged');
// AI 매칭: 다른 공고는 다른 요건·후보
await page.goto(base + '/hr_matching.html?fast');
await page.selectOption('#jdSelect', 'JD-002');
await page.click('#btnAnalyze');
await page.waitForSelector('#btnGate:not([disabled])', { timeout: 15000 });
check((await page.locator('#reqRows').textContent()).includes('예지보전'), 'matching: JD-002 requirements');
await page.click('#btnGate');
await page.waitForSelector('#p4.active', { timeout: 20000 });
const top2 = await page.locator('.cand .nm').allTextContents();
check(top2[0] === '이한결' && top2.includes('박민준'), 'matching: JD-002 ranks 이한결 first with 박민준 listed: ' + top2.slice(0, 3).join(', '));
check(!(await page.content()).includes('가온'), 'matching: no fictional company names');

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server.close();
