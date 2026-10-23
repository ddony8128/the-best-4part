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
check(9, j2 && j2.org === '제조혁신본부 · 설비기술팀' && j2.tasks.includes('센서') && j2.required && j2.deadline === '2026-11-20', '공고 수정: JD-002 요청 조직·업무·요건·마감일 채워짐 (예전 저장 데이터가 있던 브라우저 포함)');
check(9, await page.evaluate(() => state.jobs.length === 10 && state.jobs.every(j => j.tasks && !j.tasks.includes('원문 미제공'))), '공고 10개 모두 본문 있음');
await page.locator('#jobRows tr', { hasText: 'JD-002' }).locator('button', { hasText: '수정' }).click();
await page.waitForTimeout(300);
await shot('9-jd002-edit', page.locator('#jobModal'));
await page.keyboard.press('Escape');

// #3 지원자 상세 › 자격·근거
await page.click('nav a[href="#people"]');
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
check('메뉴', JSON.stringify(m1) === JSON.stringify(m2) && m2.includes('검토 · 협의 현황'), `인사 콘솔과 AI 매칭의 메뉴가 같음 (${m2.join(' / ')})`);

// #4 AI 매칭 공고 선택
await page.selectOption('#jdSelect', 'JD-002');
const jd = await page.inputValue('#jdText');
check(4, jd.includes('제조혁신본부') && jd.includes('예지보전') && jd.includes('창원'), 'JD-002 본문 전체가 들어감');
await page.selectOption('#jdSelect', 'JD-003');
check(4, (await page.inputValue('#jdText')).includes('RAG 검색 파이프라인'), 'JD-003 본문 전체가 들어감');
check(4, (await page.locator('#jdSelect option').count()) === 10, '공고 10개 모두 선택 가능');
await shot('4-jd003', page.locator('#p1 .form-grid'));

// #1 Gate 가중치
await page.selectOption('#jdSelect', 'JD-001');
await page.click('#btnAnalyze');
await page.waitForSelector('#btnGate:not([disabled])', { timeout: 15000 });
await page.locator('#weightsGate input').nth(1).fill('50');
check(1, (await page.locator('#weightsGate input').nth(1).inputValue()) === '30', '합계 100% 넘게 올릴 수 없음');
await page.locator('#weightsGate input').nth(0).fill('10');
check(1, await page.locator('#btnGate').isDisabled() && (await page.locator('#weightsGateWarn').textContent()).includes('100%를 채워야'), '100% 미만이면 경고 + 스캔 불가');
await shot('1-gate-warning', page.locator('#weightCard'));
await page.locator('#weightsGate input').nth(0).fill('25');
await page.click('#btnGate');
await page.waitForSelector('#p4.active', { timeout: 20000 });
// #2 후보 단계 가중치
await page.locator('#weightsLive input').nth(2).fill('50');
check(2, (await page.locator('#weightsLive input').nth(2).inputValue()) === '20', '합계 100% 넘게 올릴 수 없음');
await page.locator('#weightsLive input').nth(2).fill('10');
check(2, await page.locator('#detail .docbtn').first().isDisabled() && await page.locator('#weightsLiveWarn').isVisible(), '100% 미만이면 경고 + 추천서·제안서 불가');
await page.click('.step[data-s="5"]');
check(2, await page.locator('#p4').isVisible(), '100% 미만이면 STEP 5로도 못 넘어감');
await shot('2-live-warning', page.locator('#p4 .card').first());
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
check(8, (await page.locator('#profileGrid .masked').count()) === 5 && !/KPI|SQLD\(2023\)|근속 4년/.test(prof), '정량 5칸 가림 · 실제 값이 화면에 없음');
check(8, prof.includes('3개 사업소 데이터 표준'), '정성 칸은 그대로 보임');
check(3, !prof.includes('시연용'), '임직원 프로필 근거 문서 문구도 정리');
await shot('8-profile', page.locator('#profileGrid'));
check('회사명', prof.includes('한화에너지') && !(await page.content()).includes('가온'), '임직원 화면 회사명 한화에너지');
await page.goto(base + '/employee.html#diagnose');
await page.fill('#applyMotive', '테스트 지원');
await page.click('text=지원하기 →');
await page.click('nav a[href="#applications"]');
await shot('5-applications', page.locator('#appList'));
page.once('dialog', d => d.accept());
await page.click('#appList button.cancel');
await page.waitForTimeout(200);
check(5, await page.locator('#appList .empty').count() === 1, '지원 취소 → 미지원 상태');
await page.click('nav a[href="#diagnose"]');
check(5, await page.locator('text=지원하기 →').isEnabled(), '취소 후 다시 지원 가능');

check('오류', errors.length === 0, 'page errors: ' + (errors.join(' | ') || '없음'));
console.log(results.join('\n'));
console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} 통과 · 캡처: ${OUT}`);
await b.close(); server.close();
