// 시연 전 정리: 화면에서 쌓인 업무 기록(제안·보고·운영 기록·셀프 진단)을 비우고, 지원서는 적재 당시 상태로 되돌린다.
// 공고 분석·스캔 결과(미리 계산한 것)는 그대로 둔다. 대상은 talent-link만.
import './localenv.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { select, update } from '../../api/_lib/db.js';

const H = { apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` };
const del = async (t, f) => console.log('삭제', t, (await fetch(`${process.env.SUPABASE_URL}/rest/v1/${t}?${f}`, { method: 'DELETE', headers: H })).status);
for (const t of ['offers', 'reports', 'audit_log', 'self_diagnoses']) await del(t, 'id=gt.0');
const seed = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../hr_v3/clean/applications.json'), 'utf8'));
const rows = await select('applications', 'order=id');
const key = a => a.employee_id + a.jd_id;
const orig = Object.fromEntries(seed.map(a => [key(a), a]));
for (const a of rows) {
  const o = orig[key(a)];
  if (!o || a.id > seed.length) { await del('applications', `id=eq.${a.id}`); continue }
  if (a.cancelled_at || a.review || a.status !== o.status) await update('applications', `id=eq.${a.id}`, { cancelled_at: null, review: null, status: o.status });
}
// 같은 공고의 스캔이 여러 번이면 마지막 완료본만 남긴다
const runs = await select('scan_runs', 'order=id');
const last = {};
runs.filter(r => r.status === '완료').forEach(r => last[r.jd_id] = r.id);
for (const r of runs) if (last[r.jd_id] !== r.id) await del('scan_runs', `id=eq.${r.id}`);
// 마지막 스캔 뒤에 새로 한 공고 분석은 지운다(화면이 미리 계산한 스캔 결과를 바로 쓰도록)
const keepAn = Object.fromEntries(runs.filter(r => last[r.jd_id] === r.id).map(r => [r.jd_id, r.analysis_id]));
for (const a of await select('job_analyses', 'select=id,jd_id')) if (keepAn[a.jd_id] && a.id > keepAn[a.jd_id]) await del('job_analyses', `id=eq.${a.id}`);
console.log('지원서', (await select('applications', 'cancelled_at=is.null')).length, '· 스캔', Object.keys(last).length);
