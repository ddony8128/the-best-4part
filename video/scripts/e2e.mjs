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
// 로컬 정적 서버에는 AI 함수가 없다 → 빈 응답으로 두고 화면의 기본 초안 경로를 쓴다
await page.route('**/api/draft', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
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
// Gate: 축마다 4단계 중요도, 비율은 자동 계산 (100%를 맞출 필요 없음)
check(await page.locator('#weightsGate .lv').count() === 5 && await page.locator('#weightsGate .lv button.on').count() === 5, 'gate: 5 axes with 4-level importance');
const shareBefore = await page.locator('#weightsGatev3').textContent();
await page.click('#weightsGate .w:nth-child(4) .lv button:nth-child(1)');
check((await page.locator('#weightsGatev3').textContent()) !== shareBefore && await page.locator('#btnGate').isEnabled(), 'gate: level change recomputes share, scan stays enabled');
await page.click('#weightsGate .w:nth-child(4) .lv button:nth-child(4)');
await page.click('#btnGate');
await page.waitForSelector('#p4.active', { timeout: 20000 });
const names = await page.locator('.cand .nm').allTextContents();
check(names.length === 10, 'top 10 listed: ' + names.slice(0, 3).join(', '));
check(names[0] === '김서윤', 'default #1 is 김서윤');
check(await page.locator('.badge-hidden').count() > 0, 'hidden candidates flagged');
// 성장 가능성·커리어 적합성을 '매우 중요'로 올리면 이한결이 1위
await page.click('#weightsLive .w:nth-child(4) .lv button:nth-child(1)');
await page.click('#weightsLive .w:nth-child(5) .lv button:nth-child(1)');
await page.waitForTimeout(300);
check((await page.locator('.cand .nm').first().textContent()) === '이한결', 'reweight moves 이한결 to #1');
await page.locator('.cand', { hasText: '이한결' }).click();
await page.click('text=추천서 작성 →');
await page.waitForSelector('#btnSend:not([disabled])', { timeout: 20000 });
check((await page.locator('#docBody').textContent()).includes('인재 추천 보고서') && !(await page.locator('#docBody').textContent()).includes('EV-'), 'report generated');
await page.click('#btnSend');
await page.click('#docTabs button[data-doc=offer]');
await page.waitForSelector('#btnSend:not([disabled])', { timeout: 20000 });
check((await page.locator('#docBody').textContent()).includes('참여 제안서') && (await page.locator('#docAttach').textContent()).includes('Job_Offer_Letter'), 'offer generated with offer letter attached');
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
await page.goto(base + '/talent_hr_admin.html');
check(await page.locator('#overview.active').count() === 1 && await page.locator('nav a').count() === 4, 'console: home is default, 4 menu items');
await page.goto(base + '/talent_hr_admin.html#jobs');
await page.locator('#jobRows tr', { hasText: 'JD-014' }).getByText('지원자 · 검토').click();
const jv = [await page.locator('#jobs.active #people').isVisible(), await page.locator('#peopleTitle').textContent(), await page.locator('#reviewList .job').count()];
check(jv[0] && jv[1].includes('JD-014') && jv[2] >= 2, 'jobs: applicants + review for selected job inside 공고 관리 ' + JSON.stringify(jv));
await page.goto(base + '/talent_hr_admin.html#overview');
const recent = await page.locator('#recent').textContent();
check(recent.includes('직접 지원') && recent.includes('정정 요청'), 'HR activity log shows apply + correction');
const audit = () => page.evaluate(() => JSON.parse(localStorage.getItem('talent-hr-admin-v1')).audit.map(a => a.action).join('|'));
check((await audit()).includes('참여 제안 발송'), 'HR audit log has offer sent');

// ── 피드백 반영 확인 (2026-10-23) ──
const html = await page.content();
check(!html.includes('가온'), 'console: no fictional company names');
check(!html.includes('가상 설정') && !html.includes('미이수로 단정하지 않음'), 'console: evidence/education wording cleaned');
check(await page.evaluate(() => state.jobs.length === 45 && state.jobs.find(j => j.id === 'JD-002').company === '한화오션' && state.jobs.find(j => j.id === 'JD-002').title === '선체 구조설계'), 'console: 45 JDs from 직무.docx');
check(!/한화(갤러리아|에너지|생명|솔루션|투자증권|엔진)|㈜한화/.test(html), 'console: only the 3 affiliates');
// 인재 참여 제안: 검색 팝업
await page.click('nav a[href="#offers"]');
await page.click('#offerPick');
await page.fill('#pickerSearch', '박민준');
check(await page.locator('#pickerList .pick-row').count() === 1, 'offer picker: search narrows to one person');
await page.locator('#pickerList .pick-row').first().click();
check((await page.locator('#offerPerson').inputValue()) === 'APP-002' && (await page.locator('#offerPickLabel').textContent()).includes('한화에어로스페이스'), 'offer picker: selection applied');
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
await page.selectOption('#jdSelect', 'JD-010');
await page.click('#btnAnalyze');
await page.waitForSelector('#btnGate:not([disabled])', { timeout: 15000 });
check((await page.locator('#reqRows').textContent()).includes('디지털 트윈'), 'matching: JD-010 requirements');
await page.click('#btnGate');
await page.waitForSelector('#p4.active', { timeout: 20000 });
const top2 = await page.locator('.cand .nm').allTextContents();
check(top2[0] === '이한결' && top2.includes('박민준'), 'matching: JD-010 ranks 이한결 first with 박민준 listed: ' + top2.slice(0, 3).join(', '));
check(!(await page.content()).includes('가온'), 'matching: no fictional company names');

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
server.close();
