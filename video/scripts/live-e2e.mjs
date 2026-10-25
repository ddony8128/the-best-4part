// DB·AI가 붙은 상태에서 세 화면을 끝까지 확인한다 (실제 Claude 호출 포함).
// 로컬: node data/scan/dev-server.mjs 를 띄운 뒤  node scripts/live-e2e.mjs
// 배포: BASE=https://talent-link-seven.vercel.app HR_ID=... HR_PW=... node scripts/live-e2e.mjs
// NEW_BATCH=1 이면 공고를 다시 분석해 새 스캔 배치까지 돌려 본다(수 분 소요).
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4173';
const ID = process.env.HR_ID || 'hr', PW = process.env.HR_PW || 'hr';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) process.exitCode = 1 };
const t = () => new Date().toLocaleTimeString('ko-KR');

// 로그인
await page.goto(BASE + '/login.html');
await page.click('#pw');
check(await page.inputValue('#id') !== '', 'hr login autofill');
if (process.env.HR_ID) { await page.fill('#id', ID); await page.fill('#pw', PW) }
await Promise.all([page.waitForURL(/talent_hr_admin/, { timeout: 20000 }), page.click('#go')]);
check(true, 'hr login');
const api = async (r, p = '') => (await ctx.request.get(`${BASE}/api/data?r=${r}${p}`)).json();
const offers0 = (await api('offers')).length, reports0 = (await api('reports')).length;

// ── AI 인재 매칭
await page.goto(BASE + '/hr_matching.html?fast');
await page.waitForFunction(() => /2\d\d명/.test(document.getElementById('scopeCount').textContent), null, { timeout: 15000 });
check(true, 'pool size from DB: ' + await page.locator('#scopeCount').textContent());
await page.selectOption('#jdSelect', 'JD-045');
await page.click('#btnAnalyze');
await page.waitForSelector('#btnGate:not([disabled])', { timeout: 30000 });
const reqN = await page.locator('#reqRows tr').count();
check(reqN >= 6, `stored AI analysis: ${reqN} requirements · ${await page.locator('#aiState').textContent()}`);
check(await page.locator('#refCard:not(.hidden) .rf').count() === 3, 'reference card: handover · high performers · research');
check((await page.locator('#reqRows').textContent()).includes('연구자료'), 'research-based requirement included');

if (process.env.NEW_BATCH) {
  // 분석 결과를 지우면 분석 버튼이 그 자리에서 Claude로 분석한다 → 새 요건이므로 새 스캔 배치
  console.log('NEW_BATCH: run data/scan/reset-analyses.mjs for JD-045 first');
  await page.click('#btnGate');
  await page.waitForSelector('#asyncBox:not(.hidden)', { timeout: 60000 });
  check(true, 'async batch box: ' + (await page.locator('#asyncBox').textContent()).slice(0, 80));
  console.log(t(), 'waiting for batch…');
  await page.waitForSelector('#p4.active', { timeout: 30 * 60000 });
  check(true, t() + ' new batch finished and candidates shown');
} else {
  await page.click('#btnGate');
  await page.waitForSelector('#p4.active', { timeout: 60000 });
}
const names = await page.locator('#candList .cand .nm').allTextContents();
check(names.length === 10, 'top 10 from DB: ' + names.slice(0, 4).join(', '));
check(await page.locator('#candList .badge-hidden').count() > 0, 'hidden candidates present');
check(!/EMP-0\d\d/.test(await page.locator('#candList').textContent()), 'no embedded demo people');
const before = names.join();
for (const i of [0, 1, 2]) await page.click(`#weightsLive .w:nth-child(${i + 1}) .lv button:nth-child(4)`);
await page.waitForTimeout(500);
check((await page.locator('#candList .cand .nm').allTextContents()).join() !== before, 'reweight changes ranking');
const detail = await page.locator('#detail').textContent();
check(/요건별 비교/.test(detail) && /— /.test(detail), 'detail shows requirement evidence');

// 추천서 (실제 AI 작성) → 보고 → DB
await page.click('#detail .docbtn.primary');
await page.waitForSelector('#btnSend:not([disabled])', { timeout: 60000 });
check((await page.locator('#docState').textContent()).includes('AI'), 'report drafted by AI: ' + await page.locator('#docState').textContent());
await page.click('#btnSend');
await page.waitForTimeout(1500);
check((await api('reports')).length === reports0 + 1, 'report saved to DB');
// 제안서 → 발송 → DB
await page.click('#docTabs button[data-doc=offer]');
await page.waitForSelector('#btnSend:not([disabled])', { timeout: 60000 });
check(await page.locator('#docAttach .file').count() === 1, 'offer letter attached');
await page.click('#btnSend');
await page.waitForTimeout(1500);
check((await api('offers')).length === offers0 + 1, 'offer saved to DB');

// ── 임직원 화면 (로그인한 본인)
// 임직원 로그인(시연 계정: 입력칸에 커서를 두면 자동 입력)
await page.goto(BASE + '/login.html?role=emp&next=/employee.html');
await page.click('#id');
check(await page.inputValue('#id') === 'pangpanghyun' && (await page.inputValue('#pw')).length > 0, 'employee login autofill');
await Promise.all([page.waitForURL(/employee\.html/, { timeout: 20000 }), page.click('#go')]);
const emp = await ctx.newPage();
emp.on('pageerror', e => errors.push(e.message));
await emp.goto(BASE + '/employee.html');
await emp.waitForFunction(() => document.getElementById('meName').textContent === '임광현', null, { timeout: 15000 });
const me = await emp.locator('#meName').textContent();
check(true, 'employee from DB: ' + me + ' · ' + await emp.locator('#meOrg').textContent());
await emp.evaluate(() => go('jobs'));
await emp.locator('#jobList button', { hasText: '진단' }).first().waitFor();
// 본인이 아직 지원하지 않은 마케팅 공고로 진단·지원해 본다 (테스트가 만든 지원서만 마지막에 취소)
const already = new Set((await api('applications')).filter(a => a.name === me).map(a => a.jd));
const target = ['JD-045', 'JD-034', 'JD-019'].find(j => !already.has(j));
await emp.evaluate(jd => diagnose(jd), target);
console.log(t(), 'self diagnosis (live Claude if not cached)');
await emp.waitForSelector('#diagBody .score-big', { timeout: 90000 });
check(await emp.locator('#diagBody tbody tr').count() >= 6, 'diagnosis: requirement rows ' + await emp.locator('#diagBody .score-big').textContent());
{
  await emp.fill('#applyMotive', '캠페인 성과 분석 경험을 제품전략 커뮤니케이션에 적용하고 싶습니다.');
  await emp.click('#diagBody button.primary');
  await emp.waitForFunction(() => /지원 완료/.test(document.querySelector('#diagBody .pill')?.textContent || ''), null, { timeout: 20000 });
  check(true, 'employee applied to ' + target);
}
const apps = await api('applications');
const mine = apps.find(a => a.name === me && a.jd === target);
check(!!mine, 'application visible to HR: ' + (mine && mine.id));

// ── 인사 콘솔
await page.goto(BASE + '/talent_hr_admin.html#jobs');
await page.waitForFunction(id => typeof SOURCE_APPS !== 'undefined' && SOURCE_APPS.some(a => a.id === id), mine.id, { timeout: 20000 });
check(true, 'console loaded DB applications: ' + await page.evaluate(() => SOURCE_APPS.length));
await page.evaluate(jd => viewJobPeople(jd), target);
await page.waitForTimeout(500);
check((await page.locator('#peopleRows').textContent()).includes(me), 'console shows employee application in ' + target);
// 검토 단계 변경 → 새로고침 후 유지
await page.evaluate(id => { state.reviews[id] = { ...review(SOURCE_APPS.find(a => a.id === id)), stage: '인터뷰 예정' }; syncReview(SOURCE_APPS.find(a => a.id === id)) }, mine.id);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForFunction(id => SOURCE_APPS.some(a => a.id === id), mine.id, { timeout: 20000 });
check(await page.evaluate(id => review(SOURCE_APPS.find(a => a.id === id)).stage, mine.id) === '인터뷰 예정', 'review stage persisted in DB');
const audit = (await api('audit')).map(a => a.action).join('\n');
check(/추천서 상부 보고/.test(audit) && /참여 제안 발송/.test(audit) && /직접 지원/.test(audit), 'audit log has report · offer · application');
check(await page.evaluate(() => POOL.length) >= 246, 'offer picker uses full talent pool');

// 임직원: 지원 취소 → 콘솔에서 빠짐 (테스트 흔적 정리)
await emp.evaluate(() => go('applications'));
emp.once('dialog', d => d.accept());
await emp.locator('#appList .job', { hasText: target }).locator('button.cancel').click();
await emp.waitForTimeout(1500);
check(!(await api('applications')).some(a => a.id === mine.id), 'cancelled application removed');

check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
