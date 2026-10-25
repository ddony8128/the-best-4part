// Supabase(Postgres) REST 접근 · 인사 담당자 세션 확인. 서버에서만 쓴다(secret 키).
// 로컬 스크립트는 .env.local 값을 process.env에 넣고 같은 함수를 쓴다.
import crypto from 'node:crypto';

export const env = k => (process.env[k] || '').replace(/^﻿/, '').trim();

export function isHR(request) {
  const secret = env('HR_SESSION_SECRET');
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith('tl_hr='));
  const [exp, sig] = (cookie ? decodeURIComponent(cookie.slice(6)) : '').split('.');
  if (!secret || !exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', secret).update(`hr.${exp}`).digest('hex');
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

const base = () => env('SUPABASE_URL') + '/rest/v1/';
const headers = extra => ({ apikey: env('SUPABASE_SECRET_KEY'), Authorization: `Bearer ${env('SUPABASE_SECRET_KEY')}`, 'content-type': 'application/json', ...extra });

async function call(method, path, body, extra) {
  const r = await fetch(base() + path, { method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`db ${method} ${path.split('?')[0]} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

// 한 번에 1000행 제한이 있어 나눠 읽는다
export async function select(table, query = '') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await call('GET', `${table}?${query}`, undefined, { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' });
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
export const insert = (table, rows) => call('POST', table, rows, { Prefer: 'return=representation' });
export const update = (table, filter, patch) => call('PATCH', `${table}?${filter}`, patch, { Prefer: 'return=representation' });
export const upsert = (table, rows) => call('POST', table, rows, { Prefer: 'return=representation,resolution=merge-duplicates' });

// 임직원 화면에 로그인한 본인(시연 계정)
export const ME_ID = () => env('DEMO_EMPLOYEE_ID') || 'EMP-HW-0032'; // 권재빈 · 한화오션 마케팅전략팀

export const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
export const denied = () => json({ error: '로그인이 필요합니다.' }, 401);
