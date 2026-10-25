// 업무 기록 저장 (POST /api/records { kind, ... })
// 임직원 화면: apply(지원) · cancel(지원 취소) · fix(프로필 정정 요청) — 로그인한 임직원 본인 것만
// 인사 담당자: review(검토 단계) · offer(제안 발송) · report(상부 보고) · audit(운영 기록)
import { insert, update, select, isHR, json, denied, ME_ID } from './_lib/db.js';

const log = (actor, action, detail) => insert('audit_log', [{ actor, action, detail: detail || null }]);

export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  try {
    const me = ME_ID();
    if (b.kind === 'apply') {
      const [emp] = await select('employees', `employee_id=eq.${me}&select=name`);
      const dup = await select('applications', `employee_id=eq.${me}&jd_id=eq.${b.jd}&cancelled_at=is.null`);
      if (dup.length) return json({ error: '이미 지원한 공고입니다.' }, 409);
      const [a] = await insert('applications', [{ employee_id: me, jd_id: b.jd, motive: b.motive, available_from: b.available_from || null, participation_pct: b.participation_pct || null, location: b.location || null, org_status: '조직장 협의 전', status: '미검토',
        review: { stage: '미검토', owner: '', note: b.note || '임직원 셀프 진단 화면에서 지원', org: '협의 전', cert: '원문 상태 유지' } }]);
      await log(`${emp.name}(${me})`, `${emp.name}(${me}) · ${b.title || b.jd}(${b.jd}) 직접 지원 — 임직원 셀프 진단 화면`);
      return json(a);
    }
    if (b.kind === 'cancel') {
      const [a] = await update('applications', `id=eq.${Number(b.id)}&employee_id=eq.${me}`, { cancelled_at: new Date().toISOString() });
      if (!a) return json({ error: '지원 기록이 없습니다.' }, 404);
      await log(me, `${b.name || me}(${me}) · ${b.title || a.jd_id}(${a.jd_id}) 지원 취소 — 임직원 화면`);
      return json(a);
    }
    if (b.kind === 'fix') {
      await log(me, `${b.name || me}(${me}) 프로필 정정 요청 — ${String(b.note || '').slice(0, 120)}`);
      return json({ ok: true });
    }

    if (!isHR(request)) return denied();
    const actor = b.actor || '인사팀';
    if (b.kind === 'review') {
      const [a] = await update('applications', `id=eq.${Number(b.id)}`, { review: b.review, status: b.review?.stage || '미검토' });
      if (b.action) await log(actor, b.action);
      return json(a || null);
    }
    if (b.kind === 'offer') {
      const [o] = await insert('offers', [{ employee_id: b.employee_id, jd_id: b.jd_id, sender: b.sender, subject: b.subject, model: b.model || null, html: b.html, attachment: b.attachment || null }]);
      await log(actor, b.action || `${b.subject} 발송`);
      return json(o);
    }
    if (b.kind === 'report') {
      const [r] = await insert('reports', [{ employee_id: b.employee_id, jd_id: b.jd_id, sender: b.sender, recipient: b.recipient, subject: b.subject, model: b.model || null, html: b.html }]);
      await log(actor, b.action || `${b.subject} 보고`);
      return json(r);
    }
    if (b.kind === 'audit') { await log(actor, String(b.action || '').slice(0, 500), b.detail); return json({ ok: true }) }
    return json({ error: '알 수 없는 기록' }, 400);
  } catch (e) {
    console.error('records', b.kind, e.message);
    return json({ error: '저장하지 못했습니다.' }, 502);
  }
}
