import React from 'react';
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './theme';
import { Dark, Fade, Kicker, Rise, useSpring } from './ui';
import REC from './recordings.json';

type Marker = { label: string; t: number; box: number[] | null };
type Clip = { name: string; duration: number; width: number; height: number; markers: Marker[] };
export type Caption = { step?: string; title: string; sub?: string };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const clipFrames = (name: keyof typeof REC, rate: number, fps: number) => Math.ceil(((REC[name] as Clip).duration / rate) * fps);

// 녹화 화면 위를 움직이는 카메라: 마커마다 기록된 영역을 화면에 맞춰 비춘다
function useCamera(clip: Clip, rate: number, vw: number, vh: number) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const minS = vw / clip.width;
  const fit = (b: number[]) => {
    const [x, y, w, h] = b;
    const s = Math.min(1.45, Math.max(minS, Math.min(vw / w, vh / h) * 0.9));
    const cx = x + w / 2;
    const cy = y + Math.min(h, vh / s) / 2 - (h > vh / s ? 0 : 0);
    const tx = Math.min(0, Math.max(vw - clip.width * s, vw / 2 - cx * s));
    const ty = Math.min(0, Math.max(vh - clip.height * s, vh / 2 - cy * s));
    return { s, tx, ty };
  };
  const keys = clip.markers.filter(m => m.box).map(m => ({ f: (m.t / rate) * fps, ...fit(m.box!) }));
  let i = keys.findIndex(k => k.f > f) - 1;
  if (i === -2) i = keys.length - 1;
  if (i < 0) return keys[0];
  const cur = keys[i], prev = keys[Math.max(0, i - 1)];
  const p = Easing.inOut(Easing.cubic)(interpolate(f, [cur.f, cur.f + 26], [0, 1], clamp));
  // 확대 비율은 로그 공간에서 섞어야 움직임이 자연스럽다
  const s = Math.exp(Math.log(prev.s) + (Math.log(cur.s) - Math.log(prev.s)) * p);
  return { s, tx: prev.tx + (cur.tx - prev.tx) * p, ty: prev.ty + (cur.ty - prev.ty) * p };
}

const Browser: React.FC<{ url: string; w: number; h: number; children: React.ReactNode }> = ({ url, w, h, children }) => (
  <div style={{ width: w, borderRadius: 18, overflow: 'hidden', background: '#fff', boxShadow: '0 50px 120px #000000aa, 0 0 0 1.5px #ffffff22' }}>
    <div style={{ height: 46, background: '#242424', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px' }}>
      {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
      <div style={{ marginLeft: 18, flex: 1, height: 28, borderRadius: 8, background: '#333', color: '#bbb', fontSize: 16, display: 'flex', alignItems: 'center', padding: '0 14px', letterSpacing: 0.2 }}>🔒 {url}</div>
    </div>
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', background: '#f6f6f4' }}>{children}</div>
  </div>
);

export const ScreenDemo: React.FC<{ clip: keyof typeof REC; rate: number; url: string; chapter: string; steps?: string[]; captions: Record<string, Caption> }> = ({ clip: name, rate, url, chapter, steps, captions }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clip = REC[name] as Clip;
  const VW = 1600, VH = 900;
  const cam = useCamera(clip, rate, VW, VH);
  const caps = clip.markers.filter(m => captions[m.label]).map(m => ({ f: (m.t / rate) * fps, ...captions[m.label], label: m.label }));
  const ci = caps.filter(c => c.f <= f + 4).length - 1;
  const cap = caps[Math.max(0, ci)];
  const capStart = cap ? Math.max(0, cap.f - 4) : 0;
  const curStep = caps.slice(0, Math.max(0, ci) + 1).reverse().find(c => c.step)?.step;
  const enter = useSpring(0, { damping: 18 } as never);
  return (
    <Dark glow={[50, 20]}>
      <div style={{ position: 'absolute', left: 160, top: 26, right: 160, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Kicker style={{ fontSize: 20 }}>{chapter}</Kicker>
        {steps && (
          <div style={{ display: 'flex', gap: 10 }}>
            {steps.map(s => {
              const on = s === curStep;
              return <div key={s} style={{ fontSize: 17, fontWeight: 700, padding: '6px 14px', borderRadius: 999, border: `1.5px solid ${on ? C.accent : '#ffffff26'}`, color: on ? C.ink : '#999', background: on ? C.accent : 'transparent' }}>{s}</div>;
            })}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 160, top: 92, transform: `translateY(${(1 - enter) * 80}px) scale(${0.94 + enter * 0.06})`, opacity: enter }}>
        <Browser url={url} w={VW} h={VH}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: clip.width, height: clip.height, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}>
            <OffthreadVideo src={staticFile(`rec/${name}.mp4`)} playbackRate={rate} muted style={{ width: clip.width, height: clip.height }} />
          </div>
        </Browser>
      </div>
      {cap && <CaptionCard key={cap.label} cap={cap} start={capStart} />}
    </Dark>
  );
};

const CaptionCard: React.FC<{ cap: Caption; start: number }> = ({ cap, start }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(f - start, [0, 0.45 * fps], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  return (
    <div style={{ position: 'absolute', left: 110, bottom: 70, maxWidth: 1050, transform: `translateX(${(1 - k) * -60}px)`, opacity: Math.min(1, k * 1.4) }}>
      <div style={{ background: '#141414ee', backdropFilter: 'blur(12px)', borderRadius: 20, padding: '26px 34px 26px 30px', borderLeft: `8px solid ${C.accent}`, boxShadow: '0 30px 80px #00000088' }}>
        <div style={{ fontSize: 46, fontWeight: 900, color: '#fff', letterSpacing: -1.4, lineHeight: 1.25 }}>{cap.title}</div>
        {cap.sub && <div style={{ fontSize: 26, color: '#c9c9c9', marginTop: 10, lineHeight: 1.45 }}>{cap.sub}</div>}
      </div>
    </div>
  );
};

// ───────── 두 화면이 이어지는 구조 ─────────
export const Connection: React.FC<{ rate: number }> = ({ rate }) => {
  const f = useCurrentFrame();
  const clip = REC.console as Clip;
  const VW = 1040, VH = 585;
  const cam = useCamera(clip, rate, VW, VH);
  const nodes = [
    { t: '인사 담당자', d: 'JD 등록 · 스캔 · 추천', x: 0 },
    { t: '임직원', d: '제안 확인 · 진단 · 지원', x: 1 },
    { t: '인사 콘솔', d: '검토 · 추천서 · 상부 보고', x: 2 },
  ];
  const edges = ['제안서', '지원서'];
  return (
    <Dark glow={[80, 70]}>
      <AbsoluteFill style={{ padding: '80px 110px' }}>
        <Kicker>ONE CONNECTED FLOW</Kicker>
        <Rise delay={4} style={{ marginTop: 12 }}><div style={{ fontSize: 66, fontWeight: 900, letterSpacing: -2.2 }}>제안 · 지원 · 정정 요청이 <span style={{ color: C.accent }}>인사 콘솔에 바로</span> 남습니다</div></Rise>
        <div style={{ display: 'flex', gap: 60, marginTop: 50, alignItems: 'flex-start' }}>
          <Fade delay={14} y={40}>
            <Browser url="talent-link-seven.vercel.app/talent_hr_admin.html" w={VW} h={VH}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: clip.width, height: clip.height, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` }}>
                <OffthreadVideo src={staticFile('rec/console.mp4')} playbackRate={rate} muted style={{ width: clip.width, height: clip.height }} />
              </div>
            </Browser>
          </Fade>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 10 }}>
            {nodes.map((n, i) => {
              const s = interpolate(f, [30 + i * 40, 46 + i * 40], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
              const line = interpolate(f, [48 + i * 40, 70 + i * 40], [0, 1], clamp);
              return (
                <div key={n.t}>
                  <div style={{ display: 'flex', gap: 22, alignItems: 'center', transform: `scale(${0.8 + 0.2 * s})`, opacity: s, transformOrigin: 'left center' }}>
                    <div style={{ width: 78, height: 78, borderRadius: 22, background: i === 1 ? C.accent : '#ffffff14', border: `2px solid ${i === 1 ? C.accent : '#ffffff33'}`, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 900, color: i === 1 ? C.ink : '#fff' }}>{i + 1}</div>
                    <div><div style={{ fontSize: 40, fontWeight: 900 }}>{n.t}</div><div style={{ fontSize: 24, color: '#aaa' }}>{n.d}</div></div>
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
    </Dark>
  );
};
