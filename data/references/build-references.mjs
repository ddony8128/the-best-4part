// 공고별 참고 자료 → data/references/references.json
// - 전임자 인수인계: 마케팅 3개 공고는 팀이 받은 자료(handover_marketing.json), 나머지는 Claude로 같은 형식 생성
// - 고성과자 패턴: 사례 수는 인재풀 데이터에서 계산(같은 직무군·최근 2년 A/S 평가자), 패턴 문장은 Claude 생성
// - 직무 연구 요약: 특정 논문을 지어내지 않고, 직무 역량 연구에서 반복되는 요인을 요약
// 실행: ANTHROPIC_API_KEY=... node data/references/build-references.mjs  (결과는 references.json에 저장, 이미 있는 공고는 건너뜀)
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { JD_FAMILY } from '../hr_v3/org.mjs';

const DIR = import.meta.dirname, OUT = path.join(DIR, 'references.json');
const jobs = JSON.parse(fs.readFileSync(path.join(DIR, '../jobs.json'), 'utf8'));
const given = JSON.parse(fs.readFileSync(path.join(DIR, 'handover_marketing.json'), 'utf8'));
const E = JSON.parse(fs.readFileSync(path.join(DIR, '../hr_v3/clean/employees.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(DIR, '../hr_v3/clean/performance.json'), 'utf8'));
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

// 같은 직무군(마케팅은 마케팅 공고 희망자)에서 최근 2년 평가가 모두 A 이상인 사람 수
const top = new Set(Object.entries(Object.groupBy(P.filter(p => p.year >= 2025), p => p.employee_id)).filter(([, l]) => l.every(p => ['S', 'A'].includes(p.grade))).map(([id]) => id));
const family = jd => JD_FAMILY[jd] || '마케팅';
const sampleN = jd => Math.max(3, E.filter(e => family(e.desired_jd) === family(jd) && top.has(e.employee_id)).length);

const S = { type: 'string' }, N = { type: 'integer' }, A = x => ({ type: 'array', items: x }), O = p => ({ type: 'object', properties: p, required: Object.keys(p), additionalProperties: false });
const HANDOVER = O({ business: S, tasks: A(O({ task: S, status: S, handover: S, due: S, caution: S, keywords: A(S) })), memos: A(S), successor_keywords: A(S) });
const SCHEMA = O({ handover: HANDOVER, high_performers: A(O({ pattern: S, share_pct: N })), research: A(O({ finding: S, implication: S })) });
const SYSTEM = `당신은 한화 그룹 인사팀에서 공고별 참고 자료를 정리하는 담당자입니다. 이 자료는 AI가 공고의 요건을 정리할 때 JD와 함께 참고합니다.
- handover: 이 자리의 전임자가 남긴 인수인계. business는 이 조직이 다루는 회사의 공개된 실제 사업·제품 한 줄. tasks는 지금 진행 중인 업무 3개(status는 "진행 중"/"검토 중"/"보완 필요" 중 하나, due는 2026-10-28~2026-11-20 사이 날짜, caution은 후임자가 조심할 점, keywords는 필요한 역량 3개). memos는 전임자의 비정형 메모 3개(따옴표 없이 말투 그대로). successor_keywords는 후임자 역량 판단 키워드 6개.
- high_performers: 같은 직무를 잘 수행하는 사내 인원들에게서 공통으로 보인 행동·경험 패턴 3~4개와 그 비율(%).
- research: 이 직무의 성과와 관련해 직무 역량 연구에서 반복적으로 확인되는 요인 2~3개(finding)와, 그래서 후보를 볼 때 무엇을 확인해야 하는지(implication). 특정 논문 제목·저자·연도·수치는 지어내지 않습니다.
- 기밀·계약 금액·고객사 내부 정보는 쓰지 않습니다. "가상", "시연", "더미", "예시" 같은 표현은 쓰지 않습니다. 존댓말로 짧게 씁니다.`;

const client = new Anthropic({ maxRetries: 4 });
async function make(j) {
  const res = await client.messages.create({
    model: 'claude-sonnet-5-5', max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify({ 공고: { 번호: j.id, 회사: j.company, 공고명: j.title, 담당업무: j.tasks, 필수: j.required, 우대: j.preferred }, 이미있는_전임자_인수인계: given[j.id] || null }, null, 1) }],
  });
  const g = JSON.parse(res.content.filter(b => b.type === 'text').map(b => b.text).join(''));
  if (given[j.id]) g.handover = given[j.id]; // 받은 인수인계 자료는 그대로 쓴다
  return { ...g, high_performers_sample_n: sampleN(j.id) };
}
const queue = jobs.filter(j => !out[j.id]);
let done = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const j = queue.shift();
    try { out[j.id] = await make(j); fs.writeFileSync(OUT, JSON.stringify(out, null, 1)) } catch (e) { console.error(j.id, e.status || '', e.message) }
    if (++done % 10 === 0) console.log(`참고 자료 ${done}`);
  }
}));
console.log(`공고 ${Object.keys(out).length}/${jobs.length}`);
