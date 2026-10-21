import React from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { C } from './theme';

// 사선 색 띠 세 줄이 화면을 쓸고 지나가며 다음 장면을 드러낸다
type SweepProps = { colors?: string[]; reverse?: boolean };
const Sweep: React.FC<TransitionPresentationComponentProps<SweepProps>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const colors = passedProps.colors ?? [C.accent, C.ink, C.soft];
  const p = Easing.inOut(Easing.cubic)(presentationProgress);
  const skew = 22;
  if (presentationDirection === 'exiting') {
    const s = interpolate(p, [0, 1], [1, 0.94]);
    return <AbsoluteFill style={{ transform: `scale(${s})`, filter: `brightness(${1 - p * 0.35})` }}>{children}</AbsoluteFill>;
  }
  // 띠는 앞서가고, 새 장면은 맨 뒤 띠의 경계를 따라 드러난다
  const span = 140;
  const edge = (k: number) => interpolate(p, [0, 1], [-skew - k * 12, span + skew - k * 12]);
  const reveal = edge(3);
  const clip = passedProps.reverse
    ? `polygon(${100 - reveal}% 0, 100% 0, 100% 100%, ${100 - reveal + skew}% 100%)`
    : `polygon(0 0, ${reveal + skew}% 0, ${reveal}% 100%, 0 100%)`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip }}>{children}</AbsoluteFill>
      {colors.map((col, i) => {
        const a = edge(i), b = edge(i + 1);
        const poly = passedProps.reverse
          ? `polygon(${100 - a}% 0, ${100 - b}% 0, ${100 - b + skew}% 100%, ${100 - a + skew}% 100%)`
          : `polygon(${b + skew}% 0, ${a + skew}% 0, ${a}% 100%, ${b}% 100%)`;
        return <AbsoluteFill key={i} style={{ background: col, clipPath: poly }} />;
      })}
    </AbsoluteFill>
  );
};
export const sweep = (props: SweepProps = {}): TransitionPresentation<SweepProps> => ({ component: Sweep, props });

// 앞 장면은 카메라가 뚫고 들어가듯 커지며 흐려지고, 새 장면은 살짝 작은 곳에서 자리 잡는다
const Zoom: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = Easing.inOut(Easing.cubic)(presentationProgress);
  if (presentationDirection === 'exiting') {
    return <AbsoluteFill style={{ transform: `scale(${1 + p * 0.9})`, opacity: 1 - p, filter: `blur(${p * 14}px)` }}>{children}</AbsoluteFill>;
  }
  return <AbsoluteFill style={{ transform: `scale(${0.82 + p * 0.18})`, opacity: p, filter: `blur(${(1 - p) * 10}px)` }}>{children}</AbsoluteFill>;
};
export const zoomThrough = (): TransitionPresentation<Record<string, never>> => ({ component: Zoom, props: {} });

// 원형으로 번지는 주황 링과 함께 새 장면이 열린다
const Ring: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = Easing.inOut(Easing.quad)(presentationProgress);
  if (presentationDirection === 'exiting') return <AbsoluteFill style={{ transform: `scale(${1 - p * 0.06})` }}>{children}</AbsoluteFill>;
  const r = p * 120;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `circle(${r}% at 50% 50%)` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `circle(${r + 1.2}% at 50% 50%)`, WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${r * 0.9}%, black ${r * 0.9}%)`, background: C.accent, opacity: 1 - p }} />
    </AbsoluteFill>
  );
};
export const ring = (): TransitionPresentation<Record<string, never>> => ({ component: Ring, props: {} });
