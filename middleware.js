// 인사 담당자 화면은 로그인한 사람만 연다. 세션 쿠키(tl_hr)의 서명을 확인하고, 없으면 로그인 화면으로 보낸다.
export const config = {
  matcher: ['/hr_matching.html', '/hr_matching', '/talent_hr_admin.html', '/talent_hr_admin'],
};

const enc = new TextEncoder();
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(request) {
  const secret = process.env.HR_SESSION_SECRET;
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith('tl_hr='));
  const [exp, sig] = (cookie ? decodeURIComponent(cookie.slice(6)) : '').split('.');
  if (secret && exp && sig && Number(exp) > Date.now() && sig === await sign(`hr.${exp}`, secret)) {
    // 그대로 진행 (@vercel/functions의 next()와 같은 신호)
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  const url = new URL(request.url);
  const login = new URL('/login.html', url);
  login.searchParams.set('next', url.pathname);
  return Response.redirect(login, 307);
}
