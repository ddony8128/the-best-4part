import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from './theme';

export const Dark: React.FC<{ children?: React.ReactNode; glow?: [number, number] }> = ({ children, glow = [70, 30] }) => {
  const f = useCurrentFrame();
  const gx = glow[0] + Math.sin(f / 90) * 6, gy = glow[1] + Math.cos(f / 110) * 5;
  return (
    <AbsoluteFill style={{ background: C.dark, fontFamily: FONT, color: '#fff' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 55% at ${gx}% ${gy}%, #f6995d24 0%, transparent 70%), radial-gradient(ellipse 50% 50% at ${100 - gx}% ${100 - gy}%, #ffffff0a 0%, transparent 70%)` }} />
      {children}
    </AbsoluteFill>
  );
};

export const Light: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.ink }}>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 60% at 85% 10%, #f6995d1c 0%, transparent 70%)' }} />
    {children}
  </AbsoluteFill>
);

export const useSpring = (delay = 0, config = { damping: 200 }, durationInFrames?: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config, durationInFrames });
};

// 아래에서 위로 마스크를 뚫고 올라오는 글자
export const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties; distance?: number }> = ({ delay = 0, children, style, distance = 110 }) => {
  const s = useSpring(delay, { damping: 18, mass: 0.8, stiffness: 120 } as never);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: '0.08em', ...style }}>
      <div style={{ transform: `translateY(${(1 - s) * distance}%)`, opacity: Math.min(1, s * 1.6) }}>{children}</div>
    </div>
  );
};

export const Fade: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties; y?: number; x?: number }> = ({ delay = 0, children, style, y = 24, x = 0 }) => {
  const s = useSpring(delay);
  return <div style={{ opacity: s, transform: `translate(${(1 - s) * x}px, ${(1 - s) * y}px)`, ...style }}>{children}</div>;
};

export const Kicker: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.accent, style }) => (
  <div style={{ fontSize: 22, letterSpacing: 6, fontWeight: 700, color, textTransform: 'uppercase', ...style }}>{children}</div>
);

export const LogoMark: React.FC<{ size?: number; delay?: number }> = ({ size = 120, delay = 0 }) => {
  const f = useCurrentFrame();
  const s = useSpring(delay, { damping: 12, stiffness: 140 } as never);
  const draw = interpolate(f - delay - 8, [0, 18], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.25, background: C.accent, transform: `scale(${s}) rotate(${(1 - s) * -30}deg)`, display: 'grid', placeItems: 'center', boxShadow: `0 ${size * 0.2}px ${size * 0.6}px #f6995d55` }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 60 60">
        <path d="M14 30 L26 42 L47 17" fill="none" stroke={C.ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={draw} />
      </svg>
    </div>
  );
};

export const Counter: React.FC<{ from?: number; to: number; delay?: number; dur?: number; suffix?: string; decimals?: number }> = ({ from = 0, to, delay = 0, dur = 40, suffix = '', decimals = 0 }) => {
  const f = useCurrentFrame();
  const k = interpolate(f - delay, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const v = from + (to - from) * k;
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
};

export const Pill: React.FC<{ children: React.ReactNode; dark?: boolean; style?: React.CSSProperties }> = ({ children, dark, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 26px', borderRadius: 999, border: `2px solid ${dark ? '#ffffff26' : C.line}`, background: dark ? '#ffffff0d' : '#fff', fontSize: 30, fontWeight: 700, ...style }}>{children}</div>
);
