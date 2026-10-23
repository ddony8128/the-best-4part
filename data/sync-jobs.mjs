// 공고 원문(data/jobs_source.txt)을 읽어 data/jobs.json을 만들고, 세 화면의 공고 데이터를 같은 내용으로 맞춘다.
// 공고를 고칠 때: jobs_source.txt만 수정 → node data/sync-jobs.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PUB = path.resolve(DIR, '../public');
const src = fs.readFileSync(path.join(DIR, 'jobs_source.txt'), 'utf8').replace(/\r/g, '');

const jobs = src.split(/^=+$/m).map(b => b.trim()).filter(Boolean).map(block => {
  const head = k => (block.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.trim() ?? '';
  const sec = k => {
    const m = block.match(new RegExp(`\\[${k}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`));
    return m ? m[1].trim().split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean) : [];
  };
  return {
    id: head('JD 번호'), title: head('공고명'), org: head('요청 조직'), status: head('공고 상태'),
    tasks: sec('담당 업무'), required: sec('필수 요건'), preferred: sec('우대 요건'),
    conditions: sec('기간 · 투입 · 근무 조건').join(' '), deadline: sec('마감일')[0] || '',
  };
});
if (jobs.length !== 10 || jobs.some(j => !j.id || !j.title || !j.tasks.length)) throw new Error('공고 원문을 읽지 못했습니다');
fs.writeFileSync(path.join(DIR, 'jobs.json'), JSON.stringify(jobs, null, 2) + '\n');

// 화면별 형태로 바꿔 표시된 구간(/*JOBS:BEGIN*/ … /*JOBS:END*/)에 넣는다
const console_ = jobs.map(j => ({ id: j.id, title: j.title, org: j.org, status: j.status, tasks: j.tasks.join('\n'), required: j.required.join('\n'), preferred: j.preferred.join('\n'), conditions: j.conditions, deadline: j.deadline, source: '인사본부 공고 원문' }));
const blocks = {
  'talent_hr_admin.html': `const INITIAL_JOBS=${JSON.stringify(console_)};`,
  'employee.html': `const FALLBACK_JOBS=${JSON.stringify(console_)};`,
  'hr_matching.html': `const JOB_SOURCE=${JSON.stringify(jobs)};`,
};
for (const [file, code] of Object.entries(blocks)) {
  const p = path.join(PUB, file);
  const s = fs.readFileSync(p, 'utf8');
  const re = /\/\*JOBS:BEGIN\*\/[\s\S]*?\/\*JOBS:END\*\//;
  if (!re.test(s)) throw new Error(`${file}: JOBS 표시 구간이 없습니다`);
  fs.writeFileSync(p, s.replace(re, () => `/*JOBS:BEGIN*/${code}/*JOBS:END*/`));
}
console.log(`공고 ${jobs.length}개 동기화: ${jobs.map(j => j.id).join(', ')}`);
