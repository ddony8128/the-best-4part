// 로그인: 인사 담당자(role 없음) 또는 임직원(role: 'emp')의 아이디·비밀번호를 환경변수와 비교하고 8시간짜리 서명 쿠키를 준다.
// 인사 담당자 쿠키 tl_hr = 만료.서명, 임직원 쿠키 tl_emp = 만료.사번.서명
import crypto from 'node:crypto';

const HOURS = 8;
const env = k => (process.env[k] || '').replace(/^﻿/, '').trim();

export async function POST(request) {
  const { id = '', password = '', role } = await request.json().catch(() => ({}));
  const emp = role === 'emp';
  // 임직원 시연 계정은 환경변수가 없으면 기본값(임광현)을 쓴다
  const okId = emp ? env('EMP_LOGIN_ID') || 'pangpanghyun' : env('HR_ID');
  const okPw = emp ? env('EMP_PASSWORD') || 'pph0909' : env('HR_PASSWORD');
  const empNo = env('EMP_EMPLOYEE_ID') || 'EMP-HW-0019'; // 로그인 계정에 연결된 사번
  const secret = env('HR_SESSION_SECRET');
  if (!okId || !okPw || !secret) return Response.json({ ok: false, error: '서버에 로그인 설정이 없습니다.' }, { status: 500 });
  const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  if (!same(String(id), okId) || !same(String(password), okPw)) {
    return Response.json({ ok: false, error: '아이디 또는 비밀번호가 맞지 않습니다.' }, { status: 401 });
  }
  const exp = Date.now() + HOURS * 3600 * 1000;
  const value = emp ? `${exp}.${empNo}` : `${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(`${emp ? 'emp' : 'hr'}.${value}`).digest('hex');
  return Response.json({ ok: true }, {
    headers: { 'set-cookie': `${emp ? 'tl_emp' : 'tl_hr'}=${value}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${HOURS * 3600}` },
  });
}
