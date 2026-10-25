// 정리된 인재풀 데이터(data/hr_v3/clean)와 공고(data/jobs.json)를 Supabase Postgres에 적재한다.
// 테이블은 매번 새로 만든다(drop → create). 모든 테이블은 RLS를 켜고 공개 정책을 두지 않는다 → 서버(secret 키)만 접근.
// 실행: SUPABASE_ACCESS_TOKEN=... node data/load-supabase.mjs   (URL·secret 키·ref는 .env.local에서 읽음)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const local = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).replace(/^﻿/, '').trim(), l.slice(l.indexOf('=') + 1).trim()]));
// 대상 프로젝트 정보는 이 저장소의 .env.local에서만 읽는다 (다른 프로젝트의 환경변수가 섞이지 않게)
const URL_ = local.SUPABASE_URL, KEY = local.SUPABASE_SECRET_KEY, REF = local.SUPABASE_PROJECT_REF, MGMT = process.env.SUPABASE_ACCESS_TOKEN;
const EXPECTED = 'iqhdhkdruyefzcdekvhc'; // talent-link (Free 조직)
if (REF !== EXPECTED || URL_ !== `https://${EXPECTED}.supabase.co`) throw new Error(`대상 프로젝트가 talent-link가 아닙니다: ref=${REF} url=${URL_}`);
const meta = await (await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: `Bearer ${MGMT}` } })).json();
if (meta.name !== 'talent-link') throw new Error('프로젝트 이름 불일치: ' + meta.name);
console.log(`대상: ${meta.name} (${REF}, ${meta.region})`);

const DDL = `
drop table if exists scan_results, scan_runs, audit_log, reports, offers, applications, career_plans, performance, training, certifications,
  skill_development, skills, evidence, projects, assignments, employees, jobs cascade;
create table jobs (id text primary key, company text, title text, org text, status text, note text, tasks text[], required text[], preferred text[], conditions text, deadline date);
create table employees (employee_id text primary key, name text not null, company text, division text, team text, role text, grade text, hire_date date,
  tenure_months int, current_role_start date, current_role_months int, relevant_experience_months int, location text, desired_jd text references jobs(id),
  talent_pool boolean default true, career_summary text, interest text, strengths_and_gaps text, as_of date,
  pool_available_from date, pool_participation_pct int, pool_location text, org_status text);
create table assignments (assignment_id text primary key, employee_id text references employees on delete cascade, effective_date date, end_date date, company text, team text, role text, change_type text);
create table projects (project_id text primary key, employee_id text references employees on delete cascade, company text, title text, start_date date, end_date date, role text, direct_contributions text, deliverable text, not_performed text, outcome text);
create table evidence (evidence_id text primary key, employee_id text references employees on delete cascade, project_id text references projects on delete cascade, evidence_type text, title text, role text, contributions text, deliverables text, results text);
create table skills (skill_record_id text primary key, employee_id text references employees on delete cascade, skill text, level int, basis text, context text);
create table skill_development (development_id text primary key, employee_id text references employees on delete cascade, skill text, from_level int, to_level int, acquired_date date, method text);
create table certifications (certification_id text primary key, employee_id text references employees on delete cascade, certificate text, issuer text, obtained_date date);
create table training (training_id text primary key, employee_id text references employees on delete cascade, course text, completion_date date, hours int);
create table performance (evaluation_id text primary key, employee_id text references employees on delete cascade, year int, kpi text, kpi_target int, kpi_achievement_pct int, grade text);
create table career_plans (cdp_id text primary key, employee_id text references employees on delete cascade, desired_jd text, desired_role text, development_goal text, plan text, target_date date);
-- 업무 기록 (화면에서 쌓임)
create table applications (id bigint generated always as identity primary key, employee_id text references employees on delete cascade, jd_id text references jobs(id), motive text, available_from date, participation_pct int, location text, org_status text, status text default '미검토', created_at timestamptz default now(), cancelled_at timestamptz);
create table offers (id bigint generated always as identity primary key, employee_id text references employees on delete cascade, jd_id text references jobs(id), sender text, subject text, model jsonb, html text, created_at timestamptz default now());
create table reports (id bigint generated always as identity primary key, employee_id text references employees on delete cascade, jd_id text references jobs(id), sender text, recipient text, subject text, model jsonb, html text, created_at timestamptz default now());
create table audit_log (id bigint generated always as identity primary key, actor text, action text, detail jsonb, created_at timestamptz default now());
create table scan_runs (id bigint generated always as identity primary key, jd_id text references jobs(id), requested_by text, criteria jsonb, status text default '대기', total int, processed int default 0, batch_id text, created_at timestamptz default now(), finished_at timestamptz);
create table scan_results (id bigint generated always as identity primary key, run_id bigint references scan_runs on delete cascade, employee_id text references employees on delete cascade, axes jsonb, requirements jsonb, strengths text[], concerns text[], questions text[], model text, created_at timestamptz default now());
create index on assignments(employee_id); create index on projects(employee_id); create index on evidence(employee_id); create index on skills(employee_id);
create index on performance(employee_id); create index on training(employee_id); create index on certifications(employee_id); create index on scan_results(run_id);
do $$ declare t text; begin for t in select tablename from pg_tables where schemaname = 'public' loop execute format('alter table %I enable row level security', t); end loop; end $$;
`;

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${MGMT}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: q }) });
  if (!r.ok) throw new Error('SQL ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}
async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${URL_}/rest/v1/${table}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(`${table} ${r.status} ${(await r.text()).slice(0, 300)}`);
  }
}

await sql(DDL);
await sql("notify pgrst, 'reload schema';");
await new Promise(r => setTimeout(r, 3000));
const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/jobs.json'), 'utf8')).map(j => ({ ...j, deadline: j.deadline || null }));
await insert('jobs', jobs);
const C = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/hr_v3/clean', f + '.json'), 'utf8'));
for (const t of ['employees', 'assignments', 'projects', 'evidence', 'skills', 'skill_development', 'certifications', 'training', 'performance', 'career_plans', 'applications']) await insert(t, C(t));
const counts = await sql(['jobs', 'employees', 'assignments', 'projects', 'evidence', 'skills', 'skill_development', 'certifications', 'training', 'performance', 'career_plans', 'applications'].map(t => `select '${t}' as t, count(*)::int as n from ${t}`).join(' union all '));
console.log(counts.map(c => `${c.t} ${c.n}`).join(' · '));
