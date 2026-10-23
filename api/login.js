// 인사 담당자 로그인: 아이디·비밀번호를 환경변수와 비교하고 8시간짜리 서명 쿠키를 준다.
import crypto from 'node:crypto';

const HOURS = 8;

export async function POST(request) {
  const { id = '', password = '' } = await request.json().catch(() => ({}));
  // 환경변수에 줄바꿈·BOM이 섞여 들어와도 비교가 깨지지 않게 다듬는다
  const env = k => (process.env[k] || '').replace(/^﻿/, '').trim();
  const okId = env('HR_ID'), okPw = env('HR_PASSWORD'), secret = env('HR_SESSION_SECRET');
  if (!okId || !okPw || !secret) return Response.json({ ok: false, error: '서버에 로그인 설정이 없습니다.' }, { status: 500 });
  const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  if (!same(String(id), okId) || !same(String(password), okPw)) {
    return Response.json({ ok: false, error: '아이디 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  }
  const exp = Date.now() + HOURS * 3600 * 1000;
  const sig = crypto.createHmac('sha256', secret).update(`hr.${exp}`).digest('hex');
  return Response.json({ ok: true }, {
    headers: { 'set-cookie': `tl_hr=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${HOURS * 3600}` },
  });
}
