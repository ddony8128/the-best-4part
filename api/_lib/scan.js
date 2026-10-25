// 인재 스캔 실행: 규칙 필터로 후보를 좁힌 뒤 Claude Message Batches로 후보별 판정을 맡기고(비동기, 수십 분),
// 끝나면 결과를 받아 점수를 계산해 scan_results에 넣는다. 여러 공고를 한 배치로 묶을 수 있다.
import Anthropic from '@anthropic-ai/sdk';
import { env, select, insert, update } from './db.js';
import { loadPool, activeApps, prefilter, evalParams, candidateOf, parseJSON, MODEL } from './talent.js';

const client = () => new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 2 });
const cid = (run, emp) => `r${run}-${emp}`;

// jobs: [{ job, analysisRow, scope }]
export async function startRuns(items, by) {
  const [pool, apps] = await Promise.all([loadPool(), activeApps()]);
  const requests = [], runs = [];
  for (const { job, analysisRow, scope } of items) {
    const f = prefilter(job, analysisRow.analysis, pool, apps, scope);
    const [run] = await insert('scan_runs', [{ jd_id: job.id, analysis_id: analysisRow.id, requested_by: by, scope, status: '대기', total: f.total, pass1: f.pass1, pass2: f.pass2.length }]);
    runs.push(run);
    for (const emp of f.pass2) {
      const app = apps.find(a => a.jd_id === job.id && a.employee_id === emp);
      requests.push({ custom_id: cid(run.id, emp), params: evalParams(job, analysisRow.analysis, pool[emp], app) });
    }
  }
  const batch = await client().messages.batches.create({ requests });
  for (const run of runs) await update('scan_runs', `id=eq.${run.id}`, { batch_id: batch.id, status: '진행 중' });
  return { batch: batch.id, runs: runs.map(r => r.id), requests: requests.length };
}

// 배치 상태를 확인하고, 끝났으면 그 배치에 묶인 모든 실행의 결과를 저장한다
export async function syncBatch(batchId) {
  const b = await client().messages.batches.retrieve(batchId);
  const c = b.request_counts, all = c.processing + c.succeeded + c.errored + c.canceled + c.expired, done = all - c.processing;
  const runs = await select('scan_runs', `batch_id=eq.${batchId}&status=eq.${encodeURIComponent('진행 중')}`);
  if (b.processing_status !== 'ended') {
    for (const r of runs) await update('scan_runs', `id=eq.${r.id}`, { processed: Math.round(r.pass2 * done / Math.max(1, all)) });
    return { status: '진행 중', done, all };
  }
  if (!runs.length) return { status: '완료', done, all };
  const jobs = Object.fromEntries((await select('jobs', `id=in.(${runs.map(r => r.jd_id).join(',')})`)).map(j => [j.id, j]));
  const analyses = Object.fromEntries((await select('job_analyses', `id=in.(${runs.map(r => r.analysis_id).join(',')})`)).map(a => [a.id, a.analysis]));
  const apps = await activeApps();
  const got = {};
  for await (const res of await client().messages.batches.results(batchId)) {
    if (res.result.type !== 'succeeded') continue;
    const m = /^r(\d+)-(.+)$/.exec(res.custom_id);
    try { (got[m[1]] ||= []).push({ emp: m[2], judged: parseJSON(res.result.message), model: res.result.message.model }) } catch { /* 형식이 깨진 응답은 건너뛴다 */ }
  }
  const emps = [...new Set(Object.values(got).flat().map(x => x.emp))];
  const pool = emps.length ? await loadPool(emps) : {};
  for (const r of runs) {
    const job = jobs[r.jd_id], an = analyses[r.analysis_id];
    const rows = (got[r.id] || []).map(x => {
      const app = apps.find(a => a.jd_id === r.jd_id && a.employee_id === x.emp);
      return { run_id: r.id, employee_id: x.emp, applied: !!app, judged: x.judged, candidate: candidateOf(job, an, pool[x.emp], x.judged, app), model: x.model };
    });
    for (let i = 0; i < rows.length; i += 200) await insert('scan_results', rows.slice(i, i + 200));
    await update('scan_runs', `id=eq.${r.id}`, { status: '완료', processed: rows.length, finished_at: new Date().toISOString() });
  }
  return { status: '완료', done, all };
}

// 단건 판정(셀프 진단·재시도용, 실시간)
export async function evaluateNow(job, analysis, e, app) {
  const res = await new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 60000, maxRetries: 1 }).messages.create(evalParams(job, analysis, e, app));
  return { judged: parseJSON(res), model: res.model || MODEL() };
}
