import React from 'react';
import { linearTiming, springTiming, TransitionSeries } from '@remotion/transitions';
import type { TransitionPresentation } from '@remotion/transitions';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { slide } from '@remotion/transitions/slide';
import { FPS } from './theme';
import { Chapter, Effects, Hook, Intro, Outro, Principles, Problem } from './scenes';
import { Caption, clipFrames, Connection, ScreenDemo } from './demo';
import { ring, sweep, zoomThrough } from './transitions';
import { C } from './theme';

export const RATE = { hr: 1.3, emp: 1.12, console: 0.62 };
const W = 1920, H = 1080;

const HR_STEPS = ['JD 입력', '요건 확정', '전수 스캔', '후보 추천', '추천서·제안서'];
const HR_CAPTIONS: Record<string, Caption> = {
  start: { step: 'JD 입력', title: 'JD 한 장이면 시작됩니다', sub: '충원할 TF·공석의 업무와 필수·우대 요건을 올립니다' },
  sources: { step: 'JD 입력', title: '참고 자료와 스캔 범위까지', sub: '직무 적합 연구 · 고성과자 패턴 · 전임자 메모 / 3개 계열사 인재풀 1,248명' },
  reqs: { step: '요건 확정', title: 'AI가 요건을 분해합니다', sub: '평가 축 · 정량/정성 · 필수/우대 · 근거 출처를 함께 제안' },
  weights: { step: '요건 확정', title: '사람이 확정해야 다음 단계로', sub: 'Gate — 요건과 가중치는 인사 담당자가 결정합니다' },
  scan: { step: '전수 스캔', title: '그룹 전체를 전수 스캔', sub: '필수 요건은 규칙으로 → 정성 항목은 LLM이 대조 → 상위 10명' },
  list: { step: '후보 추천', title: '지원하지 않은 ‘숨은 후보’까지', sub: '상위 10명 중 8명이 공모에 지원하지 않은 임직원' },
  reweight: { step: '후보 추천', title: '가중치를 바꾸면 순위가 즉시 바뀝니다', sub: '성장 가능성 · 커리어 적합성 ↑ → 이한결 님이 1위로' },
  detail: { step: '후보 추천', title: '점수보다 근거', sub: '요건별 확인 / 확인 필요 / 정보 미확인 — 미확인을 부족으로 단정하지 않습니다' },
  concerns: { step: '후보 추천', title: '우려되는 점과 면담 질문까지', sub: '적합한 경험과 실제 이동 가능 여부는 따로 확인합니다' },
  report: { step: '추천서·제안서', title: '추천서가 바로 작성됩니다', sub: '상부 보고용 — 적합한 이유 · 우려 사항 · 확인 질문' },
  offer: { step: '추천서·제안서', title: '당사자에게 보낼 제안서도', sub: '어떤 자리인지 · 필요한 역량과 성향 · 당신을 제안하는 이유' },
  'offer-sent': { step: '추천서·제안서', title: '제안 발송 → 임직원 화면에 도착', sub: '근거가 없는 역량은 문서에 쓰지 않습니다' },
};
const EMP_STEPS = ['받은 제안', '적합도 진단', '보충할 점', '바로 지원'];
const EMP_CAPTIONS: Record<string, Caption> = {
  home: { step: '받은 제안', title: '인사팀에서 제안이 도착했습니다', sub: '공모를 몰랐어도, 내 프로필이 먼저 발견됩니다' },
  'offer-open': { step: '받은 제안', title: '왜 나에게 제안했는지 확인', sub: '자리 소개 · 필요한 역량 · 나를 제안한 이유' },
  diag: { step: '적합도 진단', title: '지원 전에 내 적합도부터', sub: '인사 담당자와 같은 기준, 5개 축으로 대조합니다' },
  reqs: { step: '적합도 진단', title: '요건별로 무엇이 확인됐는지', sub: '확인 / 확인 필요 / 정보 미확인 · 면담에서 받을 질문까지' },
  gap: { step: '보충할 점', title: '더 적합해지려면 무엇을 보충할지', sub: '부족한 축마다 구체적인 다음 행동을 알려 줍니다' },
  apply: { step: '바로 지원', title: '그 자리에서 바로 지원', sub: '지원 동기와 참여 가능 조건만 적으면 됩니다' },
  applied: { step: '바로 지원', title: '지원 완료 → 인사 담당자에게 전달', sub: '인사 콘솔의 지원자 목록과 운영 기록에 바로 반영' },
};

const T = 22; // 전환 길이(프레임)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = { d: number; el: React.ReactNode; tr?: TransitionPresentation<any> };
const items = (): Item[] => [
  { d: 180, el: <Intro />, tr: zoomThrough() },
  { d: 220, el: <Hook />, tr: sweep() },
  { d: 790, el: <Problem />, tr: ring() },
  { d: 96, el: <Chapter n="01" eyebrow="FOR HR · 인사 담당자" title="인사 담당자" sub="JD 한 장으로 그룹 전체에서 후보를 찾고, 근거와 함께 보고 · 제안합니다" />, tr: sweep() },
  { d: clipFrames('hr', RATE.hr, FPS), el: <ScreenDemo clip="hr" rate={RATE.hr} url="talent-link-seven.vercel.app/hr_matching.html" chapter="01 · 인사 담당자 — AI 인재 매칭" steps={HR_STEPS} captions={HR_CAPTIONS} />, tr: clockWipe({ width: W, height: H }) },
  { d: 96, el: <Chapter n="02" eyebrow="FOR EMPLOYEE · 지원자" title="지원자 (임직원)" sub="받은 제안을 확인하고, 내 적합도와 보충할 점을 본 뒤 바로 지원합니다" />, tr: sweep({ colors: [C.accent, C.soft, C.ink], reverse: true }) },
  { d: clipFrames('emp', RATE.emp, FPS), el: <ScreenDemo clip="emp" rate={RATE.emp} url="talent-link-seven.vercel.app/employee.html" chapter="02 · 지원자 — 셀프 진단 · 지원" steps={EMP_STEPS} captions={EMP_CAPTIONS} />, tr: slide({ direction: 'from-right' }) },
  { d: clipFrames('console', RATE.console, FPS), el: <Connection rate={RATE.console} />, tr: zoomThrough() },
  { d: 520, el: <Effects />, tr: sweep({ colors: [C.ink, C.accent, C.dark] }) },
  { d: 250, el: <Principles />, tr: ring() },
  { d: 220, el: <Outro /> },
];

export const totalFrames = () => {
  const list = items();
  return list.reduce((a, it) => a + it.d, 0) - list.filter(it => it.tr).length * T;
};

export const Main: React.FC = () => (
  <TransitionSeries>
    {items().flatMap((it, i) => {
      const out = [<TransitionSeries.Sequence key={'s' + i} durationInFrames={it.d}>{it.el}</TransitionSeries.Sequence>];
      if (it.tr) out.push(<TransitionSeries.Transition key={'t' + i} presentation={it.tr} timing={i % 3 === 1 ? springTiming({ config: { damping: 200 }, durationInFrames: T }) : linearTiming({ durationInFrames: T })} />);
      return out;
    })}
  </TransitionSeries>
);
