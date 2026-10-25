// 추천서 · 제안서 공용 모듈
// - 문서 내용(model)은 AI(/api/draft) 또는 같은 형식의 규칙 기반 초안이 채운다
// - 화면 미리보기와 Job Offer Letter 첨부 파일은 이 파일의 고정 틀로 그린다
(function () {
  // 그룹 인사팀 조직도 — 로그인 계정(개인 계정)으로 보내는 사람과 보고받는 상사를 정한다
  const STAFF = [
    { id: 'HR-201', name: '김대헌', dept: '그룹 인사팀', title: '사원', managerId: 'HR-101', email: 'daeheon.kim@hanwha.com' },
    { id: 'HR-202', name: '이수민', dept: '그룹 인사팀', title: '대리', managerId: 'HR-101', email: 'sumin.lee@hanwha.com' },
    { id: 'HR-150', name: '정하윤', dept: '그룹 인사팀', title: '과장', managerId: 'HR-101', email: 'hayoon.jung@hanwha.com' },
    { id: 'HR-101', name: '박정우', dept: '그룹 인사팀', title: '팀장', managerId: 'HR-001', email: 'jungwoo.park@hanwha.com' },
    { id: 'HR-001', name: '최윤호', dept: '그룹 HR실', title: '상무', managerId: '', email: 'yoonho.choi@hanwha.com' },
  ];
  const SESSION = { mode: 'personal', userId: 'HR-201' };
  const staff = id => STAFF.find(p => p.id === id);
  const me = () => staff(SESSION.userId);
  const managerOf = id => staff(staff(id)?.managerId);
  const label = p => p ? [p.name, p.dept, p.title].filter(Boolean).join(' · ') : '';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // 화면·문서에는 내부 근거 코드와 작업용 표기를 내보내지 않는다
  const clean = v => String(v ?? '')
    .replace(/\(?\bEMP-\d+-EV-[A-Z0-9-]+\b\)?:?\s*/gi, '')
    .replace(/시연용\s*(데이터|확인완료)?|확인\s*불가|\(확인필요\)/g, '')
    .replace(/근거\s*:\s*근거\s*:?/g, '근거:')
    .replace(/\s{2,}/g, ' ').trim();
  const items = v => (Array.isArray(v) ? v : v ? [v] : []).map(clean).filter(Boolean);
  const split = v => items(String(v ?? '').split(/\s+\/\s+|;\s*|\n/));
  const list = v => { const r = items(v); return r.length ? `<ul>${r.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; };
  const inline = (v, sep = ' | ') => esc(items(v).join(sep));
  const row = (k, html) => html ? `<div class="td-row"><dt>${esc(k)}</dt><dd>${html}</dd></div>` : '';
  const card = rows => rows.join('') ? `<div class="td-card"><dl>${rows.join('')}</dl></div>` : '';

  // 수행 근거 문장 "OO 수행확인서 / 2026-10-20 / 확인완료 — ..." → 문서 제목만
  const evidenceTitle = s => clean(String(s).split(/\s\/\s|\s—\s/)[0]);

  function renderOffer(m) {
    const e = m.experience || {}, j = m.job || {}, a = m.availability || {};
    return `<article class="td-doc">
<div class="td-eyebrow">TALENT PARTICIPATION OFFER</div>
<h2>${esc(m.title)}</h2>
<div class="td-meta">발신: ${esc(label(m.sender))}<br>수신: ${esc(m.recipient?.name)} 님 (${esc(m.recipient?.org)})</div>
<div class="td-lead"><p><b>${esc(m.recipient?.name)} 님, 안녕하세요. ${esc(m.sender?.dept)} ${esc(m.sender?.name)} ${esc(m.sender?.title)}입니다.</b></p><p>${esc(m.intro)}</p></div>
${items(m.reasons).length ? `<h3>제안드리는 이유</h3>${list(m.reasons)}` : ''}
<h3>확인한 직무 경험</h3>
${card([row('수행 역량', list(e.skills)), row('증빙 정보', inline(e.evidence, ', ')), row('관련 산출물', inline(e.deliverables, ', '))])}
<h3>공고 안내</h3>
${card([row('공고 / 요청 조직', esc(clean(j.title) + (j.org ? ' / ' + clean(j.org) : ''))), row('담당 업무', list(j.tasks)), row('필수 요건', list(j.required)), row('근무 조건', esc(clean(j.conditions)))])}
<h3>참여 의사 확인</h3>
${card([row('희망 참여 조건', esc(clean(a.conditions))), row('소속 조직 협의', esc(clean(a.org_status))), row('회신 요청', esc(clean(m.reply_request)))])}
<p class="td-note">${esc(m.notice)}</p>
</article>`;
  }

  function renderReport(m) {
    const c = m.candidate || {}, e = m.experience || {};
    const skills = items(e.skills).join(' | ') + (items(e.exclusions).length ? ` (※ ${items(e.exclusions).join(', ')} 제외)` : '');
    return `<article class="td-doc">
<div class="td-eyebrow">HR RECOMMENDATION REPORT</div>
<h2>${esc(m.title)}</h2>
<div class="td-meta">작성: ${esc(label(m.sender))}<br>보고: ${esc(label(m.recipient))}</div>
<div class="td-lead"><p>${esc(m.summary)}</p></div>
<h3>인사팀 추천 후보 · ${esc(c.name)} <span class="td-sub">${esc([c.company, c.team, c.role].filter(Boolean).join(' · '))}</span></h3>
${card([row('수행 역량', esc(clean(skills))), row('주요 산출물', inline(e.deliverables, ', ')), row('참여 조건', inline(e.conditions)), row('확인 사항', inline(e.checks)), row('증빙 근거', inline(e.evidence, ', '))])}
${items(m.fit).length ? `<h3>추천 근거 · 직무와 잘 맞는 점</h3>${list(m.fit)}` : ''}
${items(m.concerns).length ? `<h3>우려되는 점 · 확인 필요</h3>${list(m.concerns)}` : ''}
${(m.requirements || []).length ? `<h3>요건별 검토</h3><table class="td-table"><thead><tr><th>요건</th><th>구분</th><th>상태</th><th>근거</th></tr></thead><tbody>${m.requirements.map(r => `<tr><td>${esc(clean(r.requirement))}</td><td>${esc(r.need)}</td><td>${esc(r.status)}</td><td>${esc(clean(r.evidence))}</td></tr>`).join('')}</tbody></table>` : ''}
${m.comparison?.ai_top ? `<h3>AI 매칭 결과와 비교</h3>${card([row('AI 1순위', esc(clean(m.comparison.ai_top))), row('AI 결과 · 출처', esc(clean(m.comparison.reason)))])}` : ''}
${items(m.questions).length ? `<h3>면담 시 확인 질문</h3>${list(m.questions)}` : ''}
<h3>의사결정 요청</h3><p>${esc(m.decision_request)}</p>
</article>`;
  }

  const DOC_CSS = `.td-doc{color:#19243b;line-height:1.75;font-size:14px}.td-doc h2{font-size:22px;margin:4px 0 10px;letter-spacing:-.5px;padding-bottom:12px;border-bottom:2px solid #f4511e}.td-doc h3{font-size:15px;margin:22px 0 10px;padding-left:9px;border-left:3px solid #f4511e}.td-eyebrow{font-size:10px;letter-spacing:2px;font-weight:800;color:#f4511e}.td-meta{color:#677386;font-size:12px;line-height:1.7}.td-lead{margin:14px 0 4px;padding:14px 18px;border-left:3px solid #f4511e;background:#fff7f2;border-radius:0 8px 8px 0}.td-lead p{margin:3px 0}.td-card{padding:12px 18px;border:1px solid #e8eaf0;border-radius:10px;background:#fafbfc}.td-row{display:grid;grid-template-columns:110px 1fr;gap:14px;padding:8px 0;border-bottom:1px solid #eef0f4}.td-row:last-child{border-bottom:0}.td-doc dl,.td-doc dd{margin:0}.td-doc dt{font-weight:700}.td-doc ul{margin:0;padding-left:18px}.td-doc li+li{margin-top:3px}.td-sub{font-weight:400;color:#677386;font-size:12px}.td-note{margin-top:20px;padding:12px 16px;background:#f3f5f8;border-radius:8px;font-size:12px;color:#55617a}.td-table{width:100%;border-collapse:collapse;font-size:12px}.td-table th,.td-table td{border-bottom:1px solid #eef0f4;padding:7px 6px;text-align:left;vertical-align:top}.td-table th{color:#677386;font-weight:600}@media(max-width:640px){.td-row{grid-template-columns:1fr;gap:2px}}`;

  // 제안서와 함께 보내는 Job Offer Letter (단독 HTML · 인쇄하면 PDF)
  function letterFile(m) {
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title)}</title><style>body{max-width:800px;margin:40px auto;padding:24px;font-family:Pretendard,'Noto Sans KR','Malgun Gothic',sans-serif;background:#fff}${DOC_CSS}@media print{body{margin:0;padding:12mm}.td-row{break-inside:avoid}}</style></head><body>${renderOffer(m)}</body></html>`;
    const name = `Job_Offer_Letter_${clean(m.recipient?.name).replace(/[\\/:*?"<>|]/g, '_') || 'candidate'}.html`;
    return { name, html };
  }
  function download(name, text, type = 'text/html') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function printFile(f) { const w = window.open('', '_blank'); if (!w) return; w.document.write(f.html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); }
  const toText = el => el.innerText.replace(/\n{3,}/g, '\n\n').trim();

  // AI 초안: /api/draft 가 같은 형식(JSON)을 돌려주면 그것을, 실패하면 규칙 기반 초안을 쓴다
  async function draft(type, input, fallback) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, input }), signal: ctl.signal });
      clearTimeout(t);
      const j = r.ok ? await r.json() : null;
      if (j && j.model && j.model.title) return { model: { ...fallback, ...j.model, sender: fallback.sender, recipient: fallback.recipient }, source: 'ai' };
    } catch { }
    return { model: fallback, source: 'rules' };
  }

  function senderPicker(id, selected, onChange) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = STAFF.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(label(p))}</option>`).join('');
    if (onChange) el.onchange = () => onChange(el.value);
  }

  window.TalentDocs = { STAFF, SESSION, staff, me, managerOf, label, esc, clean, items, split, evidenceTitle, renderOffer, renderReport, letterFile, download, printFile, toText, draft, senderPicker, DOC_CSS };
  const st = document.createElement('style'); st.textContent = DOC_CSS; document.head.appendChild(st);
})();
