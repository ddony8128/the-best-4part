// 추천서 · 제안서 초안 생성: 프롬프트 틀(_lib/prompts.js) + Gemini JSON 출력
// 인사 담당자 세션 쿠키가 있어야 호출할 수 있다. 실패하면 화면이 규칙 기반 초안으로 대신한다.
import crypto from 'node:crypto';
import { SYSTEM, SCHEMAS, build } from './_lib/prompts.js';

const env = k => (process.env[k] || '').replace(/^﻿/, '').trim();

function isHR(request) {
  const secret = env('HR_SESSION_SECRET');
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith('tl_hr='));
  const [exp, sig] = (cookie ? decodeURIComponent(cookie.slice(6)) : '').split('.');
  if (!secret || !exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', secret).update(`hr.${exp}`).digest('hex');
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

export async function POST(request) {
  if (!isHR(request)) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { type, input } = await request.json().catch(() => ({}));
  if (!SCHEMAS[type] || !input) return Response.json({ error: '요청 형식이 맞지 않습니다.' }, { status: 400 });
  const key = env('GEMINI_API_KEY');
  if (!key) return Response.json({ error: 'AI 설정이 없습니다.' }, { status: 503 });

  const model = env('GEMINI_MODEL') || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: build(type, input) }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: SCHEMAS[type] },
    }),
  }).catch(() => null);
  if (!r || !r.ok) return Response.json({ error: 'AI 호출에 실패했습니다.' }, { status: 502 });
  const data = await r.json();
  try {
    const text = data.candidates[0].content.parts.map(p => p.text || '').join('');
    return Response.json({ model: JSON.parse(text), by: model });
  } catch {
    return Response.json({ error: 'AI 응답을 읽지 못했습니다.' }, { status: 502 });
  }
}
