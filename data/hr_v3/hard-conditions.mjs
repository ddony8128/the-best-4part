// 공고별 정량 필수 조건(Yes/No) + 그 조건에 맞는 사람이 있도록 데이터 보강
// - 공고 원문 필수 요건은 모두 정성적이라, 공고마다 그럴듯한 정량 조건 1~2개를 둔다 (data/jobs.json의 hard)
// - 조건: 자격(인사 자격 대장) 또는 직무군 경력(발령 이력 기준 관련 경력 개월). 둘 다 기록에서 바로 Yes/No가 나온다.
// - 직원의 현 직무군(job_family)을 기록한다. 자격증은 직무와 무관하게 흩어져 있어, 직무에 맞는 자격을 일부 인원에게 보강한다.
// 실행: SUPABASE_ACCESS_TOKEN=... node data/hr_v3/hard-conditions.mjs  (DB는 .env.local의 talent-link만)
import '../scan/localenv.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { JD_FAMILY } from './org.mjs';
import { select, insert, update } from '../../api/_lib/db.js';

const DIR = import.meta.dirname, J = f => path.join(DIR, 'clean', f + '.json');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8')), write = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));

const ENG = ['OPIc IM2 이상', 'TOEIC Speaking 6급 이상'];
const exp = (families, months) => ({ families, months });
const cert = (...names) => ({ certs: names });
// 조건 = { label, any: [선택지...] } — 선택지 중 하나만 충족하면 통과. 조건끼리는 모두 충족해야 한다.
const C = (label, ...any) => ({ label, any });
const HARD = {
  설계: [C('설계·개발 직무 경력 3년 이상', exp(['설계'], 36))],
  생산: [C('생산·공정 직무 경력 3년 이상', exp(['생산'], 36))],
  품질: [C('품질경영기사 또는 품질 직무 경력 3년 이상', cert('품질경영기사', '품질경영산업기사'), exp(['품질'], 36))],
  안전: [C('산업안전기사(또는 산업안전산업기사) 보유', cert('산업안전기사', '산업안전산업기사')), C('안전·환경 직무 경력 2년 이상', exp(['안전'], 24))],
  SW: [C('SW·데이터 개발 직무 경력 2년 이상', exp(['SW'], 24))],
  전략: [C('기획·재무·영업 직무 경력 3년 이상', exp(['전략', '재무', '영업', '마케팅'], 36))],
  영업: [C('영업·사업개발·마케팅 직무 경력 3년 이상', exp(['영업', '마케팅', '전략'], 36))],
  구매: [C('구매·SCM·생산 직무 경력 2년 이상', exp(['구매', '생산'], 24))],
  재무: [C('재경관리사 또는 재무·회계 직무 경력 3년 이상', cert('재경관리사', '회계관리 1급'), exp(['재무'], 36))],
  인사: [C('인사·조직 직무 경력 2년 이상', exp(['인사'], 24))],
  마케팅: [C('마케팅·영업·해외사업 직무 경력 3년 이상', exp(['마케팅', '영업', '전략'], 36)), C('영어 공인 성적 (OPIc IM2 / TOEIC Speaking 6급 이상)', cert('OPIc IM2', 'OPIc IM3', 'OPIc IH', 'OPIc AL', 'TOEIC Speaking Level 6', 'TOEIC Speaking Level 7'))],
};
const EXTRA = { // 공고 성격상 더 붙는 조건
  'JD-023': [C('전기기사 또는 설계·개발 직무 경력 5년 이상', cert('전기기사'), exp(['설계'], 60))],
  'JD-029': [C('영어 공인 성적 (OPIc IM2 / TOEIC Speaking 6급 이상)', cert('OPIc IM2', 'OPIc IM3', 'OPIc IH', 'OPIc AL', 'TOEIC Speaking Level 6', 'TOEIC Speaking Level 7'))],
  'JD-008': [C('로봇·제어 SW 또는 설계 직무 경력 2년 이상', exp(['SW', '설계'], 24))],
  'JD-009': [C('생산·설비·제어 직무 경력 3년 이상', exp(['생산', 'SW', '설계'], 36))],
};
const family = jd => JD_FAMILY[jd] || '마케팅';
const hardOf = jd => {
  const base = jd === 'JD-008' || jd === 'JD-009' ? [] : HARD[family(jd)];
  return [...base, ...(EXTRA[jd] || [])];
};

// 1) 공고에 조건 넣기
const jobsFile = path.join(DIR, '../jobs.json');
const jobs = read(jobsFile).map(j => ({ ...j, hard: hardOf(j.id) }));
write(jobsFile, jobs);

// 2) 직원 현 직무군 (현 소속은 희망 공고 직무군 기준으로 만들어졌다. 주인공은 별도 지정)
const E = read(J('employees')).map(e => ({ ...e, job_family: e.job_family || family(e.desired_jd) }));
write(J('employees'), E);

// 3) 직무에 맞는 자격 보강 (사번 기반 고정 규칙 → 다시 돌려도 같은 결과)
const certs = read(J('certifications'));
const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100;
const has = (id, name) => certs.some(c => c.employee_id === id && c.certificate === name);
const PLAN = [
  ['안전', 85, ['산업안전기사', '한국산업인력공단']],
  ['품질', 50, ['품질경영기사', '한국산업인력공단']],
  ['재무', 40, ['재경관리사', '삼일회계법인']],
  ['SW', 40, ['정보처리기사', '한국산업인력공단']],
  ['설계', 30, ['일반기계기사', '한국산업인력공단']],
];
const ENGS = [['OPIc IH', 'ACTFL'], ['OPIc IM2', 'ACTFL'], ['TOEIC Speaking Level 6', 'ETS'], ['OPIc IM3', 'ACTFL'], ['TOEIC Speaking Level 7', 'ETS']];
const added = [];
const add = (e, name, issuer) => {
  if (has(e.employee_id, name)) return;
  const n = certs.filter(c => c.employee_id === e.employee_id).length + 1;
  const row = { certification_id: `CERT-${e.employee_id}-${n}`, employee_id: e.employee_id, certificate: name, issuer, obtained_date: `20${21 + h(e.employee_id + name) % 5}-0${1 + h(name + e.employee_id) % 9}-15` };
  certs.push(row); added.push(row);
};
for (const e of E) {
  if (e.employee_id === 'EMP-HW-0019') continue;
  for (const [fam, pct, [name, issuer]] of PLAN) if (e.job_family === fam && h(e.employee_id + fam) < pct) add(e, name, issuer);
  if (['마케팅', '영업', '전략'].includes(e.job_family) && h(e.employee_id + 'eng') < 60) { const [n, i] = ENGS[h(e.employee_id) % ENGS.length]; add(e, n, i) }
}
write(J('certifications'), certs);
console.log('자격 보강', added.length, Object.entries(Object.groupBy(added, c => c.certificate)).map(([k, v]) => k + ' ' + v.length).join(' · '));

// 4) DB 반영: 열 추가 → 값 갱신 → 자격 추가
const REF = 'iqhdhkdruyefzcdekvhc';
const meta = await (await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` } })).json();
if (meta.name !== 'talent-link') throw new Error('대상 프로젝트가 talent-link가 아닙니다');
const sql = async q => { const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: q }) }); if (!r.ok) throw new Error(await r.text()); return r.json() };
await sql("alter table jobs add column if not exists hard jsonb; alter table employees add column if not exists job_family text; notify pgrst, 'reload schema';");
await new Promise(r => setTimeout(r, 3000));
for (const j of jobs) await update('jobs', `id=eq.${j.id}`, { hard: j.hard });
for (const [fam, list] of Object.entries(Object.groupBy(E, e => e.job_family))) await update('employees', `employee_id=in.(${list.map(e => e.employee_id).join(',')})`, { job_family: fam });
const inDb = new Set((await select('certifications', 'select=certification_id')).map(c => c.certification_id));
const todo = added.filter(c => !inDb.has(c.certification_id) && E.some(e => e.employee_id === c.employee_id));
if (todo.length) await insert('certifications', todo);
console.log('DB 반영 · 공고', jobs.length, '· 자격 추가', todo.length);
