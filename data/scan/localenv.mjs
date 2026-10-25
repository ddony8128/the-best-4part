// 로컬 스크립트용 환경: DB는 이 저장소의 .env.local(talent-link)만, Claude 키는 Vercel 프로젝트 환경변수에서 읽는다(값은 출력하지 않음).
// 다른 프로젝트 값이 섞이지 않게 SUPABASE_*는 process.env를 덮어쓴다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const local = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).replace(/^﻿/, '').trim(), l.slice(l.indexOf('=') + 1).trim()]));
const EXPECTED = 'iqhdhkdruyefzcdekvhc'; // talent-link
if (local.SUPABASE_PROJECT_REF !== EXPECTED || local.SUPABASE_URL !== `https://${EXPECTED}.supabase.co`) throw new Error('대상 DB가 talent-link가 아닙니다');
process.env.SUPABASE_URL = local.SUPABASE_URL;
process.env.SUPABASE_SECRET_KEY = local.SUPABASE_SECRET_KEY;

if (!process.env.ANTHROPIC_API_KEY) {
  const P = 'prj_9HCOe3UD4hnFt00z8bWqbDbKy5PK', T = 'team_VUtHaHuDkLevyyCSCAs1Xwmk', H = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
  const list = await (await fetch(`https://api.vercel.com/v9/projects/${P}/env?teamId=${T}`, { headers: H })).json();
  const item = list.envs.find(e => e.key === 'ANTHROPIC_API_KEY' && e.target.includes('production'));
  const one = await (await fetch(`https://api.vercel.com/v1/projects/${P}/env/${item.id}?teamId=${T}`, { headers: H })).json();
  process.env.ANTHROPIC_API_KEY = one.value.replace(/^﻿/, '').trim();
}
console.log('환경: talent-link DB · Claude 키', process.env.ANTHROPIC_API_KEY ? '있음' : '없음');
