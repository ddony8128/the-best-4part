// 시연 전 미리 계산: 45개 공고 분석(실시간 API와 같은 함수) → 전 공고 스캔을 한 배치로 제출 → 끝날 때까지 기다려 결과 저장
// 실행: node data/scan/precompute.mjs [analyze|scan|wait <batchId>]   (VERCEL_TOKEN 필요: Claude 키를 Vercel 환경변수에서 읽음)
import './localenv.mjs';
import { select } from '../../api/_lib/db.js';
import { analyzeJob } from '../../api/analyze-jd.js';
import { startRuns, syncBatch } from '../../api/_lib/scan.js';

const [cmd = 'all', arg] = process.argv.slice(2);
const jobs = await select('jobs', 'order=id');

if (cmd === 'analyze' || cmd === 'all') {
  const have = new Set((await select('job_analyses', 'select=jd_id')).map(a => a.jd_id));
  const queue = jobs.filter(j => !have.has(j.id));
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const j = queue.shift();
      try { const r = await analyzeJob(j.id, '인사팀 사전 분석'); console.log('분석', j.id, r.analysis.reqs.length + '개 요건') }
      catch (e) { console.error('분석 실패', j.id, e.status || '', e.message); queue.push(j) }
    }
  }));
}
let batch = arg;
if (cmd === 'scan' || cmd === 'all') {
  const an = await select('job_analyses', 'order=id.desc');
  const items = jobs.map(job => ({ job, analysisRow: an.find(a => a.jd_id === job.id), scope: null }));
  const r = await startRuns(items, '인사팀 정기 스캔');
  batch = r.batch;
  console.log(`배치 제출 ${r.batch} · 실행 ${r.runs.length}개 · 판정 요청 ${r.requests}건`);
}
if (batch) {
  const t0 = Date.now();
  for (;;) {
    const s = await syncBatch(batch);
    console.log(`${new Date().toLocaleTimeString('ko-KR')} ${s.status} ${s.done}/${s.all}`);
    if (s.status === '완료') break;
    await new Promise(r => setTimeout(r, 30000));
  }
  console.log(`완료 · ${Math.round((Date.now() - t0) / 60000)}분`);
}
