// 내레이션(src/narration.json)을 Gemini TTS로 만든다 → public/tts/<id>.wav, 길이는 src/tts.json
// 같은 문장은 다시 만들지 않는다(문장이 바뀐 줄만 새로 생성). 실행: GEMINI_API_KEY=... node scripts/tts.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const N = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/narration.json'), 'utf8'));
const OUT = path.join(ROOT, 'public/tts'), MAN = path.join(ROOT, 'src/tts.json');
fs.mkdirSync(OUT, { recursive: true });
const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : {};
const MODEL = 'gemini-2.5-flash-preview-tts', RATE = 24000;

// 16-bit PCM(mono) → WAV
const wav = pcm => {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
// 앞뒤 무음을 잘라 낸다(장면에 붙였을 때 타이밍이 정확하도록)
const trim = pcm => {
  const n = pcm.length / 2, th = 500;
  let a = 0, b = n - 1;
  while (a < n && Math.abs(pcm.readInt16LE(a * 2)) < th) a++;
  while (b > a && Math.abs(pcm.readInt16LE(b * 2)) < th) b--;
  a = Math.max(0, a - RATE * 0.03 | 0); b = Math.min(n - 1, b + (RATE * 0.12 | 0));
  return pcm.subarray(a * 2, (b + 1) * 2);
};

async function speak(text) {
  for (let k = 0; k < 4; k++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${N.style} ${text}` }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: N.voice } } } } }),
    });
    const j = await r.json();
    const d = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (d) return trim(Buffer.from(d, 'base64'));
    console.error('retry', r.status, JSON.stringify(j).slice(0, 160));
    await new Promise(res => setTimeout(res, 4000 * (k + 1)));
  }
  throw new Error('TTS 실패: ' + text);
}

const todo = Object.entries(N.lines).filter(([id, text]) => {
  const h = crypto.createHash('md5').update(N.voice + N.style + text).digest('hex');
  return !(man[id]?.hash === h && fs.existsSync(path.join(OUT, id + '.wav')));
});
await Promise.all(Array.from({ length: 3 }, async () => {
  while (todo.length) {
    const [id, text] = todo.shift();
    const pcm = await speak(text);
    fs.writeFileSync(path.join(OUT, id + '.wav'), wav(pcm));
    man[id] = { sec: +(pcm.length / 2 / RATE).toFixed(2), hash: crypto.createHash('md5').update(N.voice + N.style + text).digest('hex') };
    fs.writeFileSync(MAN, JSON.stringify(man, null, 1));
    console.log(id, man[id].sec + 's');
  }
}));
for (const id of Object.keys(man)) if (!N.lines[id]) delete man[id];
fs.writeFileSync(MAN, JSON.stringify(man, null, 1));
console.log('내레이션', Object.keys(man).length, '줄 · 합계', Object.values(man).reduce((a, m) => a + m.sec, 0).toFixed(1) + 's');
