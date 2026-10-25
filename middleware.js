// 인사 담당자 화면과 임직원 화면은 로그인한 사람만 연다. 세션 쿠키(tl_hr · tl_emp)의 서명을 확인하고, 없으면 로그인 화면으로 보낸다.
export const config = {
  matcher: ['/hr_matching.html', '/hr_matching', '/talent_hr_admin.html', '/talent_hr_admin', '/employee.html', '/employee'],
};

const enc = new TextEncoder();
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(request) {
  const secret = (process.env.HR_SESSION_SECRET || '').replace(/^﻿/, '').trim();
  const url = new URL(request.url);
  const emp = url.pathname.startsWith('/employee');
  const name = emp ? 'tl_emp=' : 'tl_hr=';
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(name));
  const parts = (cookie ? decodeURIComponent(cookie.slice(name.length)) : '').split('.');
  const sig = parts.pop(), value = parts.join('.'), exp = parts[0];
  if (secret && exp && sig && Number(exp) > Date.now() && sig === await sign(`${emp ? 'emp' : 'hr'}.${value}`, secret)) {
    // 그대로 진행 (@vercel/functions의 next()와 같은 신호)
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  const login = new URL('/login.html', url);
  login.searchParams.set('next', url.pathname);
  if (emp) login.searchParams.set('role', 'emp');
  return Response.redirect(login, 307);
}
