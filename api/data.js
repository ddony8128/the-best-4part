// 화면 데이터 조회 (GET /api/data?r=...)
// 인사 담당자 전용: pool, applications, analysis, scan, audit, offers(전체)
// 임직원 화면: jobs, me, my(내 지원·받은 제안·진단)
import { select, isHR, json, denied, env, ME_ID } from './_lib/db.js';
import { loadPool, activeApps, applicationRecord, availability, AXES, ruleScore } from './_lib/talent.js';

const latest = async (table, q) => (await select(table, q + '&order=id.desc&limit=1'))[0] || null;

export async function GET(request) {
  const u = new URL(request.url), r = u.searchParams.get('r'), jd = u.searchParams.get('jd');
  try {
    if (r === 'jobs') return json(await select('jobs', 'order=id'));

    if (r === 'me' || r === 'my') { if (!ME_ID(request)) return denied() }
    if (r === 'me') return json(await meProfile(ME_ID(request)));
    if (r === 'my') {
      const id = ME_ID(request);
      const [apps, offers, diags] = await Promise.all([
        select('applications', `employee_id=eq.${id}&cancelled_at=is.null&order=id.desc`),
        select('offers', `employee_id=eq.${id}&order=id.desc`),
        select('self_diagnoses', `employee_id=eq.${id}&order=id.desc`),
      ]);
      return json({ apps, offers, diagnoses: diags });
    }

    if (!isHR(request)) return denied();
    if (r === 'pool') {
      const e = await select('employees', 'select=company&talent_pool=is.true');
      const counts = {};
      e.forEach(x => counts[x.company] = (counts[x.company] || 0) + 1);
      return json(counts);
    }
    if (r === 'applications') {
      const [apps, jobs] = await Promise.all([activeApps(), select('jobs', 'select=id,title')]);
      const pool = await loadPool([...new Set(apps.map(a => a.employee_id))]);
      return json(apps.map(a => applicationRecord(a, pool[a.employee_id], jobs.find(j => j.id === a.jd_id))));
    }
    if (r === 'people') {
      const pool = await loadPool();
      return json(Object.values(pool).filter(e => e.talent_pool).map(e => applicationRecord(null, e)));
    }
    if (r === 'analysis') {
      const [row, ref, job] = await Promise.all([latest('job_analyses', `jd_id=eq.${jd}`), select('job_references', `jd_id=eq.${jd}`), select('jobs', `id=eq.${jd}&select=hard`)]);
      return json({ analysis: row, reference: ref[0] || null, hard: job[0]?.hard || [] });
    }
    if (r === 'scan') {
      const run = await latest('scan_runs', `jd_id=eq.${jd}`);
      const done = await latest('scan_runs', `jd_id=eq.${jd}&status=eq.${encodeURIComponent('완료')}`);
      const results = done ? await select('scan_results', `run_id=eq.${done.id}&select=employee_id,applied,candidate`) : [];
      const analysis = done ? (await select('job_analyses', `id=eq.${done.analysis_id}`))[0] : null;
      return json({ run, done, analysis, candidates: results.map(x => x.candidate) });
    }
    if (r === 'audit') return json(await select('audit_log', 'order=id.desc&limit=300'));
    if (r === 'offers') return json(await select('offers', 'select=id,employee_id,jd_id,sender,subject,attachment,created_at&order=id.desc'));
    if (r === 'reports') return json(await select('reports', 'select=id,employee_id,jd_id,sender,recipient,subject,created_at&order=id.desc'));
    return json({ error: '알 수 없는 요청' }, 400);
  } catch (e) {
    console.error('data', r, e.message);
    return json({ error: '데이터를 불러오지 못했습니다.' }, 502);
  }
}

// 임직원 본인 화면용 프로필: 5개 축별 정량(인사 담당자만 열람)·정성 요약 + 근거 문서
async function meProfile(id) {
  const e = (await loadPool([id]))[id];
  if (!e) return null;
  const perf = e.performance.filter(p => p.year >= 2024).sort((a, b) => a.year - b.year);
  const plan = e.career_plans[0] || {};
  const p = e.projects;
  // 전 공고와의 근접도(규칙 1·2단계 점수) — 홈 화면의 "가까운 직무" 순서에만 쓴다
  const [jobs, analyses] = await Promise.all([select('jobs', 'order=id'), select('job_analyses', 'order=id.desc')]);
  const near = jobs.map(j => {
    const a = analyses.find(x => x.jd_id === j.id);
    return { jd: j.id, rule: ruleScore(j, a ? a.analysis : { reqs: [] }, e) };
  });
  return {
    emp: id, name: e.name, company: e.company, team: e.team, role: e.role, checked: e.as_of, location: e.location,
    availability: availability(e),
    profile: {
      '직무경험': { quant: `근속 ${Math.floor(e.tenure_months / 12)}년 ${e.tenure_months % 12}개월 / 현 직무 ${e.current_role_months}개월`, qual: (e.career_summary || '').split('\n')[0] },
      '업무 역량': { quant: e.certifications.map(c => `${c.certificate}(${c.obtained_date.slice(0, 4)})`).join(' · ') || '등록 자격 없음', qual: e.skills.map(s => `${s.skill} Lv${s.level}`).join(', ') },
      '업무 성과': { quant: perf.map(x => `${x.year} KPI ${x.kpi_achievement_pct}% · ${x.grade}`).join(' / ') || '평가 기록 없음', qual: p.map(x => x.outcome).filter(Boolean).join(' / ') || '프로젝트 결과 기록 없음' },
      '성장 가능성': { quant: `역량 향상 ${e.skill_development.length}건 · 교육 ${e.training.length}건`, qual: e.skill_development.map(d => `${d.skill} ${d.method}`).slice(0, 3).join(' / ') || '-' },
      '커리어 적합성': { quant: `희망 직무: ${plan.desired_role || '-'}`, qual: [plan.development_goal, plan.plan].filter(Boolean).join(' / ') || (e.interest || '-') },
    },
    evidence: e.evidence.map(v => `${v.title} / ${v.evidence_type} — 역할: ${v.role}`),
    projects: p.map(x => ({ title: x.title, period: `${x.start_date} ~ ${x.end_date || '진행 중'}`, contributions: x.direct_contributions, deliverable: x.deliverable })),
    near,
    axes: AXES,
  };
}
