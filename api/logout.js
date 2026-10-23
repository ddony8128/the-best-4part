// 로그아웃: 세션 쿠키를 지우고 시작 페이지로 보낸다.
export function GET(request) {
  return new Response(null, {
    status: 303,
    headers: { location: new URL('/', request.url).toString(), 'set-cookie': 'tl_hr=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' },
  });
}
