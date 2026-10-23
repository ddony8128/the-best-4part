// 직무.docx를 pandoc으로 텍스트로 바꾼 파일을 읽어 data/jobs_source.txt 형식으로 만든다.
// 사용: pandoc 직무.docx -t plain --wrap=none -o jobs.txt && node data/import-docx-jobs.mjs jobs.txt
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lines = fs.readFileSync(process.argv[2], 'utf8').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);

const jobs = [];
let cur = null, sec = null;
for (const l of lines) {
  const head = l.match(/^\[(한화[^\]]+)\]\s*(.+?)(\s*\[더미 JD\])?$/);
  if (head) { cur = { company: head[1], title: head[2].trim(), tasks: [], required: [], preferred: [], note: '' }; jobs.push(cur); sec = null; continue; }
  if (!cur) continue;
  if (l === '담당 업무') sec = 'tasks';
  else if (l === '필수 요건') sec = 'required';
  else if (l === '우대 요건') sec = 'preferred';
  else if (l.startsWith('검증 상태:')) { cur.note = l.replace('검증 상태:', '').trim(); sec = null; }
  else if (l.startsWith('·') && sec) cur[sec].push(l.replace(/^·\s*/, ''));
  else if (/^한화/.test(l) && !l.includes('|')) { cur = null; sec = null; }
}
if (jobs.length !== 45) throw new Error(`직무 ${jobs.length}개를 읽었습니다 (예상 45개)`);

const out = jobs.map((j, i) => `==========================================================
JD 번호: JD-${String(i + 1).padStart(3, '0')}
공고명: ${j.title}
회사: ${j.company}
요청 조직: ${j.company}
공고 상태: 모집 중
검증 상태: ${j.note}

[담당 업무]
${j.tasks.map(t => '- ' + t).join('\n')}

[필수 요건]
${j.required.map(t => '- ' + t).join('\n')}

[우대 요건]
${j.preferred.map(t => '- ' + t).join('\n')}

[기간 · 투입 · 근무 조건]
(확인필요)

[마감일]
`).join('\n');
fs.writeFileSync(path.join(DIR, 'jobs_source.txt'), out);
const by = {}; jobs.forEach(j => (by[j.company] = (by[j.company] || 0) + 1));
console.log(Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · '));
jobs.forEach((j, i) => console.log(`JD-${String(i + 1).padStart(3, '0')} ${j.company} ${j.title}`));
