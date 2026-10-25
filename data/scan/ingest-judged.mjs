// 미리 판정한 결과를 스캔 결과로 넣는다: 공고마다 정량 필수 조건 통과자 전원 =
//   (같은 공고 분석본으로 이미 판정한 결과) + (새로 판정한 결과: 판정 파일들). 점수·카드는 지금 인사 기록으로 다시 계산한다.
// 실행: node data/scan/ingest-judged.mjs <판정 JSON 파일...>   (각 파일: { "JD-045|EMP-HW-0019": judged, ... })
import './localenv.mjs';
import fs from 'node:fs';
import { select, insert } from '../../api/_lib/db.js';
import { loadPool, activeApps, prefilter, candidateOf, MODEL } from '../../api/_lib/talent.js';

const files = process.argv.slice(2);
const fresh = Object.assign({}, ...files.map(f => JSON.parse(fs.readFileSync(f, 'utf8'))));
const [jobs, pool, apps, runs, an] = await Promise.all([select('jobs', 'order=id'), loadPool(), activeApps(), select('scan_runs', 'status=eq.' + encodeURIComponent('완료')), select('job_analyses', 'order=id.desc')]);
const H = { apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` };
let missing = 0, total = 0;
for (const j of jobs) {
  const a = an.find(x => x.jd_id === j.id);
  const prev = runs.filter(r => r.jd_id === j.id && r.analysis_id === a.id).at(-1);
  const old = prev ? Object.fromEntries((await select('scan_results', `run_id=eq.${prev.id}&select=employee_id,judged,model`)).map(r => [r.employee_id, r])) : {};
  const f = prefilter(j, a.analysis, pool, apps);
  const rows = [];
  for (const id of f.pass2) {
    const judged = fresh[`${j.id}|${id}`] || old[id]?.judged;
    if (!judged) { missing++; console.log('판정 없음', j.id, id); continue }
    const app = apps.find(x => x.jd_id === j.id && x.employee_id === id);
    rows.push({ employee_id: id, applied: !!app, judged, candidate: candidateOf(j, a.analysis, pool[id], judged, app), model: fresh[`${j.id}|${id}`] ? MODEL() : old[id].model });
  }
  const [run] = await insert('scan_runs', [{ jd_id: j.id, analysis_id: a.id, requested_by: '인사팀 정기 스캔', scope: null, status: '완료', total: f.total, pass1: f.pass1, pass2: f.pass2.length, processed: rows.length, finished_at: new Date().toISOString() }]);
  for (let i = 0; i < rows.length; i += 200) await insert('scan_results', rows.slice(i, i + 200).map(r => ({ ...r, run_id: run.id })));
  // 이 공고의 예전 스캔 실행은 지운다(결과는 cascade)
  for (const r of await select('scan_runs', `jd_id=eq.${j.id}&id=lt.${run.id}&select=id`)) await fetch(`${process.env.SUPABASE_URL}/rest/v1/scan_runs?id=eq.${r.id}`, { method: 'DELETE', headers: H });
  total += rows.length;
}
console.log(`스캔 ${jobs.length}개 · 판정 ${total}건 · 빠진 판정 ${missing}건`);
