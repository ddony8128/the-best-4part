// 공고 분석 (POST /api/analyze-jd { jd }) — 실시간, 약 10~20초
// JD + 공고별 참고 자료(전임자 인수인계·고성과자 패턴·연구 요약·연구 기반 행동 요건) → Claude가 요건·축 중요도 제안 → job_analyses에 저장
import Anthropic from '@anthropic-ai/sdk';
import { select, insert, isHR, json, denied, env } from './_lib/db.js';
import { analyzeParams, normalizeAnalysis, parseJSON } from './_lib/talent.js';

export async function analyzeJob(jd, by) {
  const [[job], [ref]] = await Promise.all([select('jobs', `id=eq.${jd}`), select('job_references', `jd_id=eq.${jd}`)]);
  if (!job) throw new Error('공고 없음 ' + jd);
  const res = await new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 55000, maxRetries: 1 }).messages.create(analyzeParams(job, ref));
  const [row] = await insert('job_analyses', [{ jd_id: jd, analysis: normalizeAnalysis(parseJSON(res)), model: res.model, requested_by: by }]);
  return row;
}

export async function POST(request) {
  if (!isHR(request)) return denied();
  const { jd } = await request.json().catch(() => ({}));
  if (!/^JD-\d{3}$/.test(jd || '')) return json({ error: '공고 번호가 맞지 않습니다.' }, 400);
  try { return json(await analyzeJob(jd, '김대헌')) }
  catch (e) { console.error('analyze', e.status || '', e.message); return json({ error: 'AI 분석에 실패했습니다.' }, 502) }
}
