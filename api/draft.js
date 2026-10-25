// 추천서 · 제안서 초안 생성: 프롬프트 틀(_lib/prompts.js) → Claude(구조화 JSON 출력)
// Claude가 실패하면 Gemini, 둘 다 실패하면 화면이 규칙 기반 초안으로 대신한다.
// 인사 담당자 세션 쿠키가 있어야 호출할 수 있다.
import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
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

async function withClaude(type, input) {
  const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 25000, maxRetries: 1 });
  const model = env('CLAUDE_MODEL') || 'claude-opus-5-5';
  const res = await client.beta.messages.create({
    model,
    max_tokens: 8000,
    // 정책상 거절되면 서버가 대체 모델로 이어서 처리한다
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMAS[type] } },
    system: SYSTEM,
    messages: [{ role: 'user', content: build(type, input) }],
  });
  if (res.stop_reason === 'refusal') throw new Error('refusal');
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { model: JSON.parse(text), by: res.model };
}

// Gemini용 스키마: 대문자 타입, additionalProperties 없음
const toGemini = s => s.type === 'object'
  ? { type: 'OBJECT', properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGemini(v)])), required: s.required }
  : s.type === 'array' ? { type: 'ARRAY', items: toGemini(s.items) } : { type: 'STRING' };

async function withGemini(type, input) {
  const model = env('GEMINI_MODEL') || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: build(type, input) }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: toGemini(SCHEMAS[type]) },
    }),
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const data = await r.json();
  return { model: JSON.parse(data.candidates[0].content.parts.map(p => p.text || '').join('')), by: model };
}

export async function POST(request) {
  if (!isHR(request)) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { type, input } = await request.json().catch(() => ({}));
  if (!SCHEMAS[type] || !input) return Response.json({ error: '요청 형식이 맞지 않습니다.' }, { status: 400 });
  const errors = [];
  for (const [name, run] of [['claude', withClaude], ['gemini', withGemini]]) {
    if (!env(name === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY')) continue;
    try { return Response.json(await run(type, input)); }
    catch (e) { errors.push(`${name}: ${e.status || ''} ${e.message}`.slice(0, 200)); }
  }
  console.error('draft failed', errors);
  return Response.json({ error: 'AI 호출에 실패했습니다.' }, { status: 502 });
}
