// 인재 스캔 (비동기)
// POST /api/scan { jd, analysis_id, scope }  → 규칙 필터 후 Claude Message Batches 제출, 실행 번호 반환
// GET  /api/scan?run=ID                      → 진행 상태 확인(끝났으면 결과 저장)
import { select, isHR, json, denied } from './_lib/db.js';
import { startRuns, syncBatch } from './_lib/scan.js';

export async function POST(request) {
  if (!isHR(request)) return denied();
  const { jd, analysis_id, scope } = await request.json().catch(() => ({}));
  try {
    const [[job], [analysisRow]] = await Promise.all([select('jobs', `id=eq.${jd}`), select('job_analyses', `id=eq.${Number(analysis_id)}`)]);
    if (!job || !analysisRow || analysisRow.jd_id !== jd) return json({ error: '공고 분석을 먼저 해 주세요.' }, 400);
    // 같은 공고로 이미 돌고 있는 스캔이 있으면 그것을 이어서 본다
    const running = await select('scan_runs', `jd_id=eq.${jd}&status=eq.${encodeURIComponent('진행 중')}&order=id.desc&limit=1`);
    if (running.length) return json({ run: running[0], reused: true });
    const r = await startRuns([{ job, analysisRow, scope: Array.isArray(scope) && scope.length ? scope : null }], '김대헌');
    const [run] = await select('scan_runs', `id=eq.${r.runs[0]}`);
    return json({ run });
  } catch (e) { console.error('scan start', e.status || '', e.message); return json({ error: '스캔 요청에 실패했습니다.' }, 502) }
}

export async function GET(request) {
  if (!isHR(request)) return denied();
  const id = Number(new URL(request.url).searchParams.get('run'));
  try {
    let [run] = await select('scan_runs', `id=eq.${id}`);
    if (!run) return json({ error: '실행 기록이 없습니다.' }, 404);
    if (run.status === '진행 중' && run.batch_id) { await syncBatch(run.batch_id); [run] = await select('scan_runs', `id=eq.${id}`) }
    return json({ run });
  } catch (e) { console.error('scan poll', e.message); return json({ error: '상태를 확인하지 못했습니다.' }, 502) }
}
