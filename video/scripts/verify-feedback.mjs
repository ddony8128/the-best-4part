// 팀 피드백(2026-10-23) 10건을 화면 단위로 다시 확인하고, 항목별 캡처를 남긴다 → video/out/feedback/*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../public');
const OUT = path.resolve(import.meta.dirname, '../out/feedback');
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(p).pipe(r);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
// 로컬 정적 서버에는 AI 함수가 없다 → 빈 응답으로 두고 화면의 기본 초안 경로를 쓴다
await page.route('**/api/draft', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
const errors = []; page.on('pageerror', e => errors.push(e.message));
const results = [];
const check = (n, ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} #${n} ${msg}`); };
const shot = async (n, loc) => (loc ? loc.screenshot({ path: `${OUT}/${n}.png` }) : page.screenshot({ path: `${OUT}/${n}.png` }));

// 예전 버전의 저장 데이터가 남아 있는 브라우저를 흉내 낸다 (빈 공고 · 옛 회사명)
await page.goto(base + '/index.html');
await page.evaluate(() => {
  localStorage.setItem('talent-link-data-version', 'old');
  localStorage.setItem('talent-hr-admin-v1', JSON.stringify({ jobs: [{ id: 'JD-002', title: '설비 이상징후 분석', org: '(확인필요)', status: '초안', tasks: '공고 원문 미제공. 담당 업무를 입력해 주세요.', required: '', preferred: '', conditions: '(확인필요)', deadline: '', source: '지원서 연결용 임시 제목' }], reviews: {}, audit: [{ time: 'x', action: '옛 기록' }] }));
  localStorage.setItem('talent-link-applications', JSON.stringify([{ id: 'APP-011', name: '이한결', jd: 'JD-001', emp: 'EMP-011', company: 'OLD', raw: 'old', fields: {}, evidence: [] }]));
});

// #9 공고 수정창: JD-002 본문이 채워져 있는가 (예전 저장 데이터가 있어도)
await page.goto(base + '/talent_hr_admin.html#jobs');
await page.waitForTimeout(300);
const j2 = await page.evaluate(() => state.jobs.find(j => j.id === 'JD-002'));
check(9, j2 && j2.company === '한화오션' && j2.tasks.includes('선체 구조물') && j2.required && j2.preferred, '공고 수정: JD-002(한화오션 선체 구조설계) 업무·요건 채워짐 (예전 저장 데이터가 있던 브라우저 포함)');
check(9, await page.evaluate(() => state.jobs.length === 45 && state.jobs.every(j => j.tasks && !j.tasks.includes('원문 미제공'))), '직무.docx 공고 45개 모두 본문 있음');
await page.locator('#jobRows tr', { hasText: 'JD-002' }).locator('button', { hasText: '수정' }).click();
await page.waitForTimeout(300);
await shot('9-jd002-edit', page.locator('#jobModal'));
await page.keyboard.press('Escape');

// #3 지원자 상세 › 자격·근거
await page.click('nav a[href="#jobs"]');
await page.locator('#peopleRows tr', { hasText: '김서윤' }).locator('button').last().click();
await page.click('#detailTabs button[data-detail="evidence"]');
await page.waitForTimeout(200);
const ev = await page.locator('#detailBody').textContent();
check(3, !ev.includes('미이수로 단정') && ev.includes('기재 없음'), '교육: "기재 없음"만 표시');
check(3, !ev.includes('가상 설정') && !ev.includes('시연용') && ev.includes("지원서 '보유 자격증'") && ev.includes('프로젝트 책임자가 확인'), '근거 기록: 첨부 문서가 지원서 어느 항목을 확인했는지로 표시');
await shot('3-evidence', page.locator('#personModal'));
const allEv = await page.evaluate(() => SOURCE_APPS.map(a => a.evidence.join(' ') + a.fields['교육']).join(' '));
check(3, !/가상 설정|미이수로 단정|시연용/.test(allEv), '지원자 10명 전원 문구 정리');
await page.keyboard.press('Escape');

// #10 인재 참여 제안 › 검색 팝업
await page.click('nav a[href="#offers"]');
await page.waitForSelector('#offers.active');
check(10, await page.locator('#offerPerson').isHidden() && await page.locator('#offerPick').isVisible(), '드롭다운 대신 검색 버튼');
await page.click('#offerPick');
await page.fill('#pickerSearch', '한화시스템');
await page.waitForTimeout(150);
await shot('10-picker', page.locator('#pickerModal'));
const n = await page.locator('#pickerList .pick-row').count();
check(10, n >= 2, `계열사로 검색됨 (한화시스템 ${n}명)`);
await page.locator('#pickerList .pick-row').first().click();
check(10, (await page.locator('#offerPickLabel').textContent()).includes('한화시스템'), '선택한 인재가 폼에 반영');

// 메뉴: 모든 인사 화면에서 같은 메뉴
const menu = () => page.$$eval('nav a', as => as.map(a => [...a.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()));
const m1 = await menu();
await page.goto(base + '/hr_matching.html?fast');
const m2 = await menu();
check('메뉴', JSON.stringify(m1) === JSON.stringify(m2) && m2.length === 4 && m2.includes('공고 관리') && !m2.includes('지원자 관리') && !m2.includes('채용 운영 현황'), `인사 콘솔과 AI 매칭의 메뉴가 같음 (${m2.join(' / ')})`);

// #4 AI 매칭 공고 선택
await page.selectOption('#jdSelect', 'JD-010');
const jd = await page.inputValue('#jdText');
check(4, jd.includes('한화오션') && jd.includes('디지털 트윈') && jd.includes('최적화 알고리즘'), 'JD-010 본문 전체가 들어감');
await page.selectOption('#jdSelect', 'JD-013');
check(4, (await page.inputValue('#jdText')).includes('ERP·MES'), 'JD-013 본문 전체가 들어감');
check(4, (await page.locator('#jdSelect option').count()) === 45, '공고 45개 모두 선택 가능');
await shot('4-jd003', page.locator('#p1 .form-grid'));

// #1 Gate 가중치
await page.selectOption('#jdSelect', 'JD-014');
await page.click('#btnAnalyze');
await page.waitForSelector('#btnGate:not([disabled])', { timeout: 15000 });
check(1, (await page.locator('#weightsGate .lv button.on').allTextContents()).join() === '중요,매우 중요,중요,덜 중요,보통', '중요도 4단계로 제안 (JD-014)');
await page.click('#weightsGate .w:nth-child(1) .lv button:nth-child(3)');
check(1, (await page.locator('#weightsGatev0').textContent()) === '16.7%' && await page.locator('#btnGate').isEnabled(), '단계를 바꾸면 비율 자동 계산 · 합계 맞출 필요 없음');
await shot('1-gate-levels', page.locator('#weightCard'));
await page.click('#weightsGate .w:nth-child(1) .lv button:nth-child(2)');
await page.click('#btnGate');
await page.waitForSelector('#p4.active', { timeout: 20000 });
// #2 후보 단계 가중치
await page.click('#weightsLive .w:nth-child(4) .lv button:nth-child(1)');
await page.click('#weightsLive .w:nth-child(5) .lv button:nth-child(1)');
await page.waitForTimeout(300);
check(2, (await page.locator('.cand .nm').first().textContent()) === '이한결', '같은 단계는 같은 비중 · 단계 변경으로 순위 재계산');
await shot('2-live-levels', page.locator('#p4 .card').first());
check('회사명', !(await page.content()).includes('가온'), 'AI 매칭 화면에 가상 회사명 없음');

// #7 로그인 경로
await page.goto(base + '/index.html');
check(7, (await page.getAttribute('a.door.hr', 'href')).includes('login.html'), '첫 화면 인사 담당자 → 로그인');
await page.click('a.door.hr');
check(7, (await page.locator('h2').textContent()).includes('사내 계정(클레버스)'), '사내 계정(클레버스) 로그인 화면');
await shot('7-login');

// #6 #8 #5 임직원
await page.goto(base + '/employee.html#profile');
check(6, (await page.locator('header').textContent()).includes('인사 담당자 화면') === false, '상단 인사 담당자 화면 링크 없음');
const prof = await page.locator('#profileGrid').textContent();
// 2026-10-26 변경: 정량은 보이고 정성을 가린다
check(8, (await page.locator('#profileGrid .masked').count()) === 5 && !prof.includes('3개 사업장 데이터 표준'), '정성 5칸 가림 · 실제 문장이 화면에 없음');
check(8, /KPI|SQLD\(2023\)|근속 4년/.test(prof), '정량 칸은 그대로 보임');
check(3, !prof.includes('시연용'), '임직원 프로필 근거 문서 문구도 정리');
await shot('8-profile', page.locator('#profileGrid'));
check('회사명', prof.includes('한화에어로스페이스') && !/가온|한화(갤러리아|에너지|생명|솔루션|투자증권|엔진)|㈜한화/.test(await page.content()), '임직원 화면 회사명 한화에어로스페이스 · 3개 계열사만');
await page.goto(base + '/employee.html#diagnose');
// 진단은 직접 실행해야 결과가 나온다 → 실행 후 '지원' 단계로
check('진단', (await page.locator('#diagBody .empty-state').count()) === 1, '메뉴에 들어가자마자 결과가 나오지 않음');
await page.click('#btnDiag');
await page.click('#diagBody .seg button[data-t="2"]');
await page.fill('#applyMotive', '테스트 지원');
await page.click('text=지원하기 →');
await page.click('nav a[href="#applications"]');
await shot('5-applications', page.locator('#appList'));
page.once('dialog', d => d.accept());
await page.click('#appList button.cancel');
await page.waitForTimeout(200);
check(5, await page.locator('#appList .empty').count() === 1, '지원 취소 → 미지원 상태');
await page.click('nav a[href="#diagnose"]');
await page.click('#diagBody .seg button[data-t="2"]');
check(5, await page.locator('text=지원하기 →').isEnabled(), '취소 후 다시 지원 가능');

check('오류', errors.length === 0, 'page errors: ' + (errors.join(' | ') || '없음'));
console.log(results.join('\n'));
console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} 통과 · 캡처: ${OUT}`);
await b.close(); server.close();
