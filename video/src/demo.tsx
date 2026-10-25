import React from 'react';
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FPS } from './theme';
import { Dark, Fade, Kicker, Rise, useSpring } from './ui';
import REC from './recordings.json';
import TTS from './tts.json';

type Marker = { label: string; t: number; box: number[] | null; sec?: number };
type Clip = { name: string; duration: number; width: number; height: number; markers: Marker[] };
export type Caption = { step?: string; title: string; sub?: string };
type ClipName = keyof typeof REC;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const tts = TTS as Record<string, { sec: number }>;
export const voice = (id: string) => tts[id] ? id : null;
export const voiceSec = (id: string) => tts[id]?.sec ?? 0;

// ── 시간 맞추기: 내레이션이 붙은 마커마다 구간을 나누고, 내레이션이 끝날 때까지 그 구간을 늦춰 재생한다
//    (녹화는 그대로, 구간별 재생 속도만 바뀜) → 녹화 시간(초) ↔ 영상 프레임 변환
type Seg = { t0: number; t1: number; f0: number; f1: number };
const PAD = 0.45;
export function timeline(name: ClipName, base: number, captions: Record<string, Caption>): { segs: Seg[]; frames: number; toF: (t: number) => number } {
  const clip = REC[name] as Clip;
  const anchors = clip.markers.filter(m => captions[m.label] || voice(`${name}-${m.label}`)).map(m => m.t);
  const cuts = [0, ...anchors.filter(t => t > 0.05), clip.duration].filter((t, i, a) => i === 0 || t > a[i - 1] + 0.05);
  const segs: Seg[] = [];
  let f = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const t0 = cuts[i], t1 = cuts[i + 1];
    const m = clip.markers.find(x => Math.abs(x.t - t0) < 0.06 && voice(`${name}-${x.label}`));
    const need = m ? voiceSec(`${name}-${m.label}`) + PAD : 0;
    const len = Math.max((t1 - t0) / base, need);
    segs.push({ t0, t1, f0: f, f1: f + len * FPS });
    f += len * FPS;
  }
  const toF = (t: number) => { const s = segs.find(x => t <= x.t1) ?? segs[segs.length - 1]; return s.f0 + (Math.min(t, s.t1) - s.t0) / (s.t1 - s.t0) * (s.f1 - s.f0) };
  return { segs, frames: Math.ceil(f), toF };
}

// 녹화 화면 위를 움직이는 카메라: 마커마다 기록된 영역을 화면에 맞춰 비춘다
function useCamera(clip: Clip, toF: (t: number) => number, vw: number, vh: number) {
  const f = useCurrentFrame();
  const minS = vw / clip.width;
  const fit = (b: number[]) => {
    const [x, y, w, h] = b;
    const s = Math.min(1.45, Math.max(minS, Math.min(vw / w, vh / h) * 0.9));
    const cx = x + w / 2, cy = y + Math.min(h, vh / s) / 2;
    const tx = Math.min(0, Math.max(vw - clip.width * s, vw / 2 - cx * s));
    const ty = Math.min(0, Math.max(vh - clip.height * s, vh / 2 - cy * s));
    return { s, tx, ty };
  };
  const keys = clip.markers.filter(m => m.box).map(m => ({ f: toF(m.t), ...fit(m.box!) }));
  let i = keys.findIndex(k => k.f > f) - 1;
  if (i === -2) i = keys.length - 1;
  if (i < 0) return keys[0];
  const cur = keys[i], prev = keys[Math.max(0, i - 1)];
  const p = Easing.inOut(Easing.cubic)(interpolate(f, [cur.f, cur.f + 26], [0, 1], clamp));
  const s = Math.exp(Math.log(prev.s) + (Math.log(cur.s) - Math.log(prev.s)) * p);
  return { s, tx: prev.tx + (cur.tx - prev.tx) * p, ty: prev.ty + (cur.ty - prev.ty) * p };
}

// 구간마다 다른 재생 속도로 녹화를 이어 붙인다
const Footage: React.FC<{ name: ClipName; segs: Seg[]; w: number; h: number }> = ({ name, segs, w, h }) => (
  <>
    {segs.map((s, i) => (
      <Sequence key={i} from={Math.round(s.f0)} durationInFrames={Math.max(1, Math.round(s.f1) - Math.round(s.f0))} layout="none">
        <OffthreadVideo src={staticFile(`rec/${name}.mp4`)} trimBefore={Math.round(s.t0 * FPS)} playbackRate={(s.t1 - s.t0) * FPS / Math.max(1, Math.round(s.f1) - Math.round(s.f0))} muted style={{ width: w, height: h, position: 'absolute', left: 0, top: 0 }} />
      </Sequence>
    ))}
  </>
);

// 내레이션 · 효과음 (audio가 꺼져 있으면 아무것도 넣지 않는다)
const ClipAudio: React.FC<{ name: ClipName; toF: (t: number) => number; frames: number; audio: boolean }> = ({ name, toF, frames, audio }) => {
  if (!audio) return null;
  const clip = REC[name] as Clip;
  const out: React.ReactNode[] = [];
  clip.markers.forEach((m, i) => {
    const at = Math.round(toF(m.t));
    const v = voice(`${name}-${m.label}`);
    if (v) out.push(<Sequence key={'v' + i} from={at + 4}><Audio src={staticFile(`tts/${v}.wav`)} volume={1} /></Sequence>);
    if (m.label === '~click') out.push(<Sequence key={'c' + i} from={at + 7} durationInFrames={6}><Audio src={staticFile('sfx/click.wav')} volume={0.55} /></Sequence>);
    if (m.label === '~type') {
      const end = clip.markers.find((x, k) => k > i && x.label === '~type-end')?.t ?? m.t + 1;
      for (let t = m.t; t < end; t += 0.11) out.push(<Sequence key={'t' + i + '-' + t} from={Math.round(toF(t))} durationInFrames={3}><Audio src={staticFile('sfx/type.wav')} volume={0.35} /></Sequence>);
    }
    if (['report-sent', 'offer-sent', 'applied', 'list', 'people'].includes(m.label)) out.push(<Sequence key={'h' + i} from={at + 6}><Audio src={staticFile('sfx/chime.wav')} volume={0.4} /></Sequence>);
  });
  return <Sequence durationInFrames={frames} layout="none">{out}</Sequence>;
};

// 잘라 낸 대기 구간 표시: "AI 작성 중 · 실제 약 N초"
const CutBadge: React.FC<{ markers: Marker[]; toF: (t: number) => number }> = ({ markers, toF }) => {
  const f = useCurrentFrame();
  const c = markers.filter(m => m.label === '~cut').map(m => ({ f: toF(m.t), sec: m.sec ?? 0 })).find(x => f >= x.f - 6 && f < x.f + 54);
  if (!c) return null;
  const k = interpolate(f, [c.f - 6, c.f + 4, c.f + 44, c.f + 54], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', right: 190, top: 120, opacity: k, transform: `translateY(${(1 - k) * -12}px)`, background: C.ink, color: '#fff', borderRadius: 999, padding: '12px 22px', fontSize: 24, fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 16px 40px #0006' }}>
      <span style={{ color: C.accent }}>⏩</span> AI가 작성하는 시간 · 실제 약 {c.sec}초를 줄였습니다
    </div>
  );
};

const Browser: React.FC<{ url: string; w: number; h: number; children: React.ReactNode }> = ({ url, w, h, children }) => (
  <div style={{ width: w, borderRadius: 18, overflow: 'hidden', background: '#fff', boxShadow: '0 50px 120px #000000aa, 0 0 0 1.5px #ffffff22' }}>
    <div style={{ height: 46, background: '#1f2a40', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px' }}>
      {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
      <div style={{ marginLeft: 18, flex: 1, height: 28, borderRadius: 8, background: '#2b3650', color: '#c9cfda', fontSize: 16, display: 'flex', alignItems: 'center', padding: '0 14px', letterSpacing: 0.2 }}>🔒 {url}</div>
    </div>
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', background: '#f2f4f6' }}>{children}</div>
  </div>
);

export const demoFrames = (name: ClipName, base: number, captions: Record<string, Caption>) => timeline(name, base, captions).frames;

export const ScreenDemo: React.FC<{ clip: ClipName; rate: number; url: string; chapter: string; steps?: string[]; captions: Record<string, Caption>; audio: boolean }> = ({ clip: name, rate, url, chapter, steps, captions, audio }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clip = REC[name] as Clip;
  const { segs, frames, toF } = timeline(name, rate, captions);
  const VW = 1600, VH = 900;
  const cam = useCamera(clip, toF, VW, VH);
  const caps = clip.markers.filter(m => captions[m.label]).map(m => ({ f: toF(m.t), ...captions[m.label], label: m.label }));
  const ci = caps.filter(c => c.f <= f + 4).length - 1;
  const cap = caps[Math.max(0, ci)];
  const capStart = cap ? Math.max(0, cap.f - 4) : 0;
  const curStep = caps.slice(0, Math.max(0, ci) + 1).reverse().find(c => c.step)?.step;
  const enter = useSpring(0, { damping: 18 } as never);
  void fps;
  return (
    <Dark glow={[50, 20]}>
      <div style={{ position: 'absolute', left: 160, top: 26, right: 160, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Kicker style={{ fontSize: 20, letterSpacing: 2 }}>{chapter}</Kicker>
        {steps && (
          <div style={{ display: 'flex', gap: 10 }}>
            {steps.map(s => {
              const on = s === curStep;
              return <div key={s} style={{ fontSize: 18, fontWeight: 700, padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${on ? C.accent : '#ffffff26'}`, color: on ? '#fff' : '#aab1bd', background: on ? C.accent : 'transparent' }}>{s}</div>;
            })}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 160, top: 92, transform: `translateY(${(1 - enter) * 80}px) scale(${0.94 + enter * 0.06})`, opacity: enter }}>
        <Browser url={url} w={VW} h={VH}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: clip.width, height: clip.height, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}>
            <Footage name={name} segs={segs} w={clip.width} h={clip.height} />
          </div>
        </Browser>
      </div>
      <CutBadge markers={clip.markers} toF={toF} />
      {cap && <CaptionCard key={cap.label} cap={cap} start={capStart} />}
      <ClipAudio name={name} toF={toF} frames={frames} audio={audio} />
    </Dark>
  );
};

const CaptionCard: React.FC<{ cap: Caption; start: number }> = ({ cap, start }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(f - start, [0, 0.45 * fps], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  return (
    <div style={{ position: 'absolute', left: 110, bottom: 70, maxWidth: 1080, transform: `translateX(${(1 - k) * -60}px)`, opacity: Math.min(1, k * 1.4) }}>
      <div style={{ background: '#141c2eee', backdropFilter: 'blur(12px)', borderRadius: 20, padding: '24px 34px 24px 30px', borderLeft: `8px solid ${C.accent}`, boxShadow: '0 30px 80px #00000088' }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: -1.2, lineHeight: 1.25 }}>{cap.title}</div>
        {cap.sub && <div style={{ fontSize: 26, color: '#c9cfda', marginTop: 10, lineHeight: 1.45, fontWeight: 500 }}>{cap.sub}</div>}
      </div>
    </div>
  );
};

// ───────── 세 화면이 이어지는 구조 (인사 콘솔에 도착) ─────────
export const CONSOLE_CAPS: Record<string, Caption> = { recent: { title: '보고 · 제안 · 지원이 모두 기록됩니다' } };
export const Connection: React.FC<{ rate: number; audio: boolean }> = ({ rate, audio }) => {
  const f = useCurrentFrame();
  const clip = REC.console as Clip;
  const { segs, frames, toF } = timeline('console', rate, CONSOLE_CAPS);
  const VW = 1040, VH = 585;
  const cam = useCamera(clip, toF, VW, VH);
  const nodes = [
    { t: '인사 담당자', d: '공고 분석 · 스캔 · 추천서 · 제안서' },
    { t: '임광현 (임직원)', d: '제안 확인 · 셀프 진단 · 지원' },
    { t: '인사 콘솔', d: '지원자 검토 · 운영 기록' },
  ];
  const edges = ['제안서', '지원서'];
  return (
    <Dark glow={[80, 70]}>
      <AbsoluteFill style={{ padding: '80px 110px' }}>
        <Kicker style={{ letterSpacing: 2 }}>ONE CONNECTED FLOW</Kicker>
        <Rise delay={4} style={{ marginTop: 12 }}><div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>보고 · 제안 · 지원이 <span style={{ color: C.accent }}>인사 콘솔에 바로</span> 남습니다</div></Rise>
        <div style={{ display: 'flex', gap: 60, marginTop: 50, alignItems: 'flex-start' }}>
          <Fade delay={14} y={40}>
            <Browser url="talent-link-seven.vercel.app/talent_hr_admin.html" w={VW} h={VH}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: clip.width, height: clip.height, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}>
                <Footage name="console" segs={segs} w={clip.width} h={clip.height} />
              </div>
            </Browser>
          </Fade>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 10 }}>
            {nodes.map((n, i) => {
              const s = interpolate(f, [30 + i * 40, 46 + i * 40], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
              const line = interpolate(f, [48 + i * 40, 70 + i * 40], [0, 1], clamp);
              return (
                <div key={n.t}>
                  <div style={{ display: 'flex', gap: 22, alignItems: 'center', transform: `scale(${0.8 + 0.2 * s})`, opacity: s, transformOrigin: 'left center' }}>
                    <div style={{ width: 78, height: 78, borderRadius: 22, background: i === 1 ? C.accent : '#ffffff14', border: `2px solid ${i === 1 ? C.accent : '#ffffff33'}`, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#fff' }}>{i + 1}</div>
                    <div><div style={{ fontSize: 38, fontWeight: 800 }}>{n.t}</div><div style={{ fontSize: 24, color: '#aab1bd' }}>{n.d}</div></div>
                  </div>
                  {i < 2 && (
                    <div style={{ marginLeft: 38, height: 96, borderLeft: `4px dashed ${C.accent}`, transform: `scaleY(${line})`, transformOrigin: 'top', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 26, top: 30, fontSize: 24, fontWeight: 700, color: C.accent, opacity: line }}>{edges[i]} →</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
      <ClipAudio name="console" toF={toF} frames={frames} audio={audio} />
    </Dark>
  );
};
export const consoleFrames = (rate: number) => timeline('console', rate, CONSOLE_CAPS).frames + 30;
