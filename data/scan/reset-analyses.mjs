// 공고 분석·스캔 기록을 비운다(다시 미리 계산할 때). 대상은 talent-link만.
import './localenv.mjs';
const H = { apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` };
for (const t of ['self_diagnoses', 'scan_results', 'scan_runs', 'job_analyses']) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${t}?id=gt.0`, { method: 'DELETE', headers: H });
  console.log(t, r.status);
}
