// 서버 API(/api/*) 호출 도우미. 실패하면 null을 돌려주고, 화면은 페이지에 들어 있는 기본 데이터로 계속 동작한다.
(function () {
  async function call(url, opt = {}, ms = 20000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { ...opt, signal: ctl.signal, credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(opt.headers || {}) } });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null } finally { clearTimeout(t) }
  }
  const qs = p => new URLSearchParams(p).toString();
  window.TalentAPI = {
    data: (r, p = {}, ms) => call('/api/data?' + qs({ r, ...p }), {}, ms),
    post: (path, body, ms) => call('/api/' + path, { method: 'POST', body: JSON.stringify(body) }, ms),
    get: (path, p = {}, ms) => call('/api/' + path + '?' + qs(p), {}, ms),
    record: (kind, body) => call('/api/records', { method: 'POST', body: JSON.stringify({ kind, ...body }) }),
    when: iso => iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    minutes: (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 60000)),
  };
})();
