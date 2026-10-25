// 임직원 셀프 진단 (POST /api/diagnose { jd, fresh }) — 로그인한 임직원 본인 프로필 ↔ 공고
// 저장된 진단이 있으면 그대로, 없거나 fresh면 Claude로 실시간 판정(약 10~20초) 후 저장
import { select, insert, json, ME_ID } from './_lib/db.js';
import { loadPool, candidateOf } from './_lib/talent.js';
import { evaluateNow } from './_lib/scan.js';
import { analyzeJob } from './analyze-jd.js';

export async function POST(request) {
  const { jd, fresh } = await request.json().catch(() => ({}));
  if (!/^JD-\d{3}$/.test(jd || '')) return json({ error: '공고 번호가 맞지 않습니다.' }, 400);
  const me = ME_ID();
  try {
    if (!fresh) {
      const [d] = await select('self_diagnoses', `employee_id=eq.${me}&jd_id=eq.${jd}&order=id.desc&limit=1`);
      if (d) return json({ ...d, analysis: (await select('job_analyses', `id=eq.${d.analysis_id}`))[0]?.analysis });
    }
    const [[job], an0, apps] = await Promise.all([select('jobs', `id=eq.${jd}`), select('job_analyses', `jd_id=eq.${jd}&order=id.desc&limit=1`), select('applications', `employee_id=eq.${me}&jd_id=eq.${jd}&cancelled_at=is.null`)]);
    const anRow = an0[0] || await analyzeJob(jd, '임직원 셀프 진단');
    const e = (await loadPool([me]))[me];
    const { judged, model } = await evaluateNow(job, anRow.analysis, e, apps[0]);
    const [d] = await insert('self_diagnoses', [{ employee_id: me, jd_id: jd, analysis_id: anRow.id, judged, candidate: candidateOf(job, anRow.analysis, e, judged, apps[0]), model }]);
    return json({ ...d, analysis: anRow.analysis });
  } catch (e) { console.error('diagnose', e.status || '', e.message); return json({ error: '진단에 실패했습니다.' }, 502) }
}
