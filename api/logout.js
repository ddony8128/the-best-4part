// 로그아웃: 세션 쿠키(인사 담당자·임직원)를 지우고 시작 페이지로 보낸다.
export function GET(request) {
  const clear = n => `${n}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  const h = new Headers({ location: new URL('/', request.url).toString() });
  h.append('set-cookie', clear('tl_hr'));
  h.append('set-cookie', clear('tl_emp'));
  return new Response(null, { status: 303, headers: h });
}
