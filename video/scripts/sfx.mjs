// 효과음을 직접 합성한다(외부 음원 없음 → 저작권 걱정 없음) → public/sfx/*.wav
// click: 커서 클릭 · type: 타이핑 · whoosh: 장면 전환 · chime: 완료·도착 알림 · pop: 숫자·카드 등장 · tick: 스캔 진행
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100, OUT = path.resolve(import.meta.dirname, '../public/sfx');
fs.mkdirSync(OUT, { recursive: true });
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
function save(name, sec, fn) {
  const n = Math.round(sec * SR), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  let lp = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; const v = Math.max(-1, Math.min(1, fn(t, i, x => (lp += (x - lp) * 0.2)))); buf.writeInt16LE(Math.round(v * 30000), 44 + i * 2) }
  fs.writeFileSync(path.join(OUT, name + '.wav'), buf);
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
// 클릭: 짧고 둔탁한 탁
save('click', 0.08, t => (Math.sin(2 * Math.PI * 1800 * t) * 0.5 + rnd() * 0.25) * env(t, 0.001, 0.012) * 0.6);
// 타이핑: 아주 작은 톡
save('type', 0.05, t => (Math.sin(2 * Math.PI * 2600 * t) * 0.35 + rnd() * 0.2) * env(t, 0.0008, 0.008) * 0.45);
// 휙: 대역이 올라갔다 내려가는 노이즈
{ let y = 0; save('whoosh', 0.7, t => { const k = 0.04 + 0.5 * Math.sin(Math.PI * Math.min(1, t / 0.7)); y += (rnd() - y) * k; return y * Math.sin(Math.PI * Math.min(1, t / 0.7)) ** 2 * 0.55 }) }
// 차임: 두 음 종소리 (도착 · 완료)
save('chime', 1.4, t => {
  const bell = (f, d) => (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t)) * env(t - d, 0.004, 0.35) * (t > d ? 1 : 0);
  return (bell(1046.5, 0) * 0.32 + bell(1568, 0.11) * 0.28);
});
// 팝: 위로 튀는 짧은 음
save('pop', 0.16, t => Math.sin(2 * Math.PI * (520 + 900 * t / 0.16) * t) * env(t, 0.003, 0.05) * 0.45);
// 틱: 스캔 진행
save('tick', 0.06, t => Math.sin(2 * Math.PI * 1320 * t) * env(t, 0.001, 0.015) * 0.3);
// 로고: 낮은 울림 + 반짝임
save('logo', 1.8, t => (Math.sin(2 * Math.PI * 110 * t) * 0.5 * env(t, 0.02, 0.6) + Math.sin(2 * Math.PI * 880 * t) * 0.18 * env(t - 0.25, 0.01, 0.5) * (t > 0.25 ? 1 : 0) + Math.sin(2 * Math.PI * 1318.5 * t) * 0.14 * env(t - 0.4, 0.01, 0.6) * (t > 0.4 ? 1 : 0)));
console.log('효과음', fs.readdirSync(OUT).join(', '));
