// TL-DS 적용: 각 페이지의 글자 크기·회색 값을 디자인 시스템 기준으로 바꾸고, Pretendard와 tl-ds.css를 불러온다.
// 다시 돌려도 결과가 같다(이미 적용된 페이지는 건너뛴다). 실행: node scripts/apply-ds.mjs
import fs from 'node:fs';
import path from 'node:path';

const PUB = path.resolve(import.meta.dirname, '../public');
const PAGES = ['index.html', 'login.html', 'hr_matching.html', 'talent_hr_admin.html', 'employee.html'];
const MARK = '<!--tl-ds-->';
const HEAD = `${MARK}<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><link rel="stylesheet" href="./tl-ds.css">`;

// 글자 크기: 13px를 최소로, TDS 단계(13·15·17·20·22·26·30)에 맞춘다
const size = n => n <= 11 ? 13 : n === 12 ? 14 : n <= 14 ? 15 : n === 15 ? 16 : n === 16 ? 17 : n <= 18 ? 18 : n <= 20 ? 20 : n <= 23 ? 22 : n <= 26 ? 26 : n <= 31 ? 30 : n;
// 연한 회색 → TDS 회색 (본문에 쓰이던 것은 한두 단계 진하게)
const COLORS = [['#999', '#6b7684'], ['#aaa', '#8b95a1'], ['#888', '#6b7684'], ['#777', '#4e5968'], ['#929292', '#6b7684'], ['#26324d', '#333d4b'],
  ['#ddd', '#d1d6db'], ['#eee', '#e5e8eb'], ['#fafafa', '#f9fafb'], ['#fafbfc', '#f9fafb'], ['#f1f1f1', '#f2f4f6'], ['#f3f5f8', '#f2f4f6'], ['#f8f9fb', '#f9fafb'], ['#eceff4', '#e5e8eb'],
  ['#677386', '#4e5968'], ['#596578', '#4e5968'], ['#8f9bad', '#6b7684']];

for (const f of PAGES) {
  const p = path.join(PUB, f);
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes(MARK)) { console.log('건너뜀', f); continue }
  let n = 0;
  s = s.replace(/font-size:\s*(\d+)px/g, (m, v) => (n++, `font-size:${size(+v)}px`));
  s = s.replace(/(font:\s*(?:\d{3}\s+|bold\s+)?)(\d+)px/g, (m, pre, v) => (n++, `${pre}${size(+v)}px`));
  for (const [a, b] of COLORS) s = s.replace(new RegExp(a + '(?![0-9a-fA-F])', 'gi'), b);
  // 페이지 <style>보다 뒤에서 불러와야 덮어쓴다
  const at = s.indexOf('</head>'); // 스크립트 안 문자열의 </head>가 아니라 문서의 첫 </head>
  s = s.slice(0, at) + HEAD + s.slice(at);
  fs.writeFileSync(p, s);
  console.log('적용', f, '글자 크기', n);
}
