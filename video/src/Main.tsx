import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { linearTiming, springTiming, TransitionSeries } from '@remotion/transitions';
import type { TransitionPresentation } from '@remotion/transitions';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { slide } from '@remotion/transitions/slide';
import { C, FPS } from './theme';
import { Chapter, Effects, Hook, Intro, Outro, Principles, Problem } from './scenes';
import { Caption, Connection, consoleFrames, demoFrames, ScreenDemo, voice, voiceSec } from './demo';
import { ring, sweep, zoomThrough } from './transitions';

export const RATE = { hr: 1.25, emp: 1.1, console: 0.85 };
const W = 1920, H = 1080;

const HR_STEPS = ['공고 분석', '요건 확정', '전수 스캔', '후보 추천', '추천서 · 제안서'];
const HR_CAPTIONS: Record<string, Caption> = {
  jd: { step: '공고 분석', title: '공고를 고르면 시작됩니다', sub: '한화에어로스페이스 · 마케팅 및 글로벌 브랜드 전략 · 스캔 범위 3개 계열사' },
  reqs: { step: '공고 분석', title: 'AI가 공고와 참고 자료를 함께 읽습니다', sub: 'JD · 전임자 인수인계 · 고성과자 패턴 · 직무 연구 → 요건 8개' },
  hard: { step: '요건 확정', title: '정량 조건은 AI 전에 먼저 거릅니다', sub: '직무 경력 · 영어 성적처럼 기록으로 바로 확인되는 Yes/No 조건' },
  weights: { step: '요건 확정', title: '확정은 담당자가 합니다', sub: '요건과 중요도를 사람이 확인해야 스캔이 시작됩니다' },
  scan: { step: '전수 스캔', title: '조건 통과자 전원을 AI가 판정', sub: '인재풀 247명 → 정량 조건 통과 34명 → 전원 근거 판정 → 상위 10명' },
  list: { step: '후보 추천', title: '지원하지 않은 ‘숨은 후보’까지', sub: '상위 10명 중 9명이 공모에 지원하지 않은 임직원' },
  reweight: { step: '후보 추천', title: '중요도를 바꾸면 순위가 즉시 바뀝니다', sub: '매우 중요 · 중요 · 보통 · 덜 중요 — 비율은 자동 계산' },
  detail: { step: '후보 추천', title: '1위 · 한화시스템 해외사업팀 임광현', sub: '마케팅 직함은 없지만, 해외 전시회 · 영문 세일즈키트 경험이 맞닿아 있습니다' },
  concerns: { step: '후보 추천', title: '점수보다 근거', sub: '요건별 확인 / 확인 필요 / 정보 미확인 · 우려되는 점 · 면담 질문' },
  'report-done': { step: '추천서 · 제안서', title: '추천서를 AI가 근거로만 씁니다', sub: '담당자가 검토해 상사에게 보고 · 운영 기록에 남습니다' },
  'offer-done': { step: '추천서 · 제안서', title: '당사자에게 보낼 제안서 · 오퍼 레터', sub: '배치 확정이 아닌, 참여 의사를 묻는 제안입니다' },
};
const EMP_STEPS = ['인재풀 등록', '받은 제안', '셀프 진단', '바로 지원'];
const EMP_CAPTIONS: Record<string, Caption> = {
  login: { step: '인재풀 등록', title: '새 직무에 도전하고 싶은 임광현 과장', sub: '정보 제공에 동의하고 경력을 인재풀에 올려 두었습니다' },
  home: { step: '받은 제안', title: '지원한 적 없는 회사에서 제안이 왔습니다', sub: '한화에어로스페이스 · 마케팅 및 글로벌 브랜드 전략' },
  'offer-open': { step: '받은 제안', title: '왜 나에게 연락이 왔는지', sub: '자리 소개 · 나를 제안한 이유 · 오퍼 레터' },
  diag: { step: '셀프 진단', title: '같은 기준으로 내 적합도를 진단', sub: '요약 → 요건별 근거 → 지원, 한 번에 하나씩' },
  reqs: { step: '셀프 진단', title: '무엇이 확인됐고, 무엇을 보충할지', sub: '확인 / 확인 필요 / 정보 미확인 · 면담에서 받을 질문' },
  apply: { step: '바로 지원', title: '그 자리에서 바로 지원', sub: '지원 동기와 이동 가능 시점만 적으면 됩니다' },
  applied: { step: '바로 지원', title: '두근두근, 새로운 기회', sub: '지원서가 인사 담당자에게 바로 전달됩니다' },
};

const T = 22; // 전환 길이(프레임)
// 장면 길이는 내레이션보다 짧지 않게: max(설계 길이, 시작 + 내레이션 + 여유)
const fit = (d: number, lines: [string, number][]) => Math.max(d, ...lines.map(([id, at]) => at + Math.ceil((voiceSec(id) + 0.6) * FPS)));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = { d: number; el: React.ReactNode; tr?: TransitionPresentation<any>; vo?: [string, number][] };
const items = (audio: boolean): Item[] => {
  const PV: [string, number][] = [['p0', 20], ['p1', 155], ['p2', 255], ['p3', 355], ['p4', 470]];
  return [
    { d: 150, el: <Intro />, tr: zoomThrough() },
    { d: fit(220, [['hook', 10]]), el: <Hook />, tr: sweep(), vo: [['hook', 10]] },
    { d: fit(770, PV), el: <Problem />, tr: ring(), vo: PV },
    { d: fit(90, [['ch1', 14]]), el: <Chapter n="01" eyebrow="FOR HR · 인사 담당자" title="인사 담당자" sub="공고 하나로 그룹 전체에서 후보를 찾고, 근거와 함께 보고 · 제안합니다" />, tr: sweep(), vo: [['ch1', 14]] },
    { d: demoFrames('hr', RATE.hr, HR_CAPTIONS), el: <ScreenDemo clip="hr" rate={RATE.hr} audio={audio} url="talent-link-seven.vercel.app/hr_matching.html" chapter="01 · 인사 담당자 — AI 인재 매칭" steps={HR_STEPS} captions={HR_CAPTIONS} />, tr: clockWipe({ width: W, height: H }) },
    { d: fit(90, [['ch2', 14]]), el: <Chapter n="02" eyebrow="FOR EMPLOYEE · 임직원" title="임광현 과장" sub="받은 제안을 확인하고, 셀프 진단으로 적합도를 본 뒤 바로 지원합니다" />, tr: sweep({ colors: [C.accent, C.soft, C.ink], reverse: true }), vo: [['ch2', 14]] },
    { d: demoFrames('emp', RATE.emp, EMP_CAPTIONS), el: <ScreenDemo clip="emp" rate={RATE.emp} audio={audio} url="talent-link-seven.vercel.app/employee.html" chapter="02 · 임직원 — 받은 제안 · 셀프 진단 · 지원" steps={EMP_STEPS} captions={EMP_CAPTIONS} />, tr: slide({ direction: 'from-right' }) },
    { d: consoleFrames(RATE.console), el: <Connection rate={RATE.console} audio={audio} />, tr: zoomThrough() },
    { d: fit(420, [['effects', 20]]), el: <Effects />, tr: sweep({ colors: [C.ink, C.accent, C.dark] }), vo: [['effects', 20]] },
    { d: fit(200, [['principles', 16]]), el: <Principles />, tr: ring(), vo: [['principles', 16]] },
    { d: fit(190, [['outro', 30]]), el: <Outro />, vo: [['outro', 30]] },
  ];
};

const starts = (list: Item[]) => { let s = 0; return list.map(it => { const a = s; s += it.d - (it.tr ? T : 0); return a }) };
export const totalFrames = () => {
  const list = items(false);
  return list.reduce((a, it) => a + it.d, 0) - list.filter(it => it.tr).length * T;
};

export const Main: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const list = items(audio);
  const st = starts(list);
  return (
    <>
      <TransitionSeries>
        {list.flatMap((it, i) => {
          const out = [<TransitionSeries.Sequence key={'s' + i} durationInFrames={it.d}>{it.el}</TransitionSeries.Sequence>];
          if (it.tr) out.push(<TransitionSeries.Transition key={'t' + i} presentation={it.tr} timing={i % 3 === 1 ? springTiming({ config: { damping: 200 }, durationInFrames: T }) : linearTiming({ durationInFrames: T })} />);
          return out;
        })}
      </TransitionSeries>
      {audio && (
        <>
          {/* 장면 내레이션 */}
          {list.flatMap((it, i) => (it.vo ?? []).filter(([id]) => voice(id)).map(([id, at]) => <Sequence key={id} from={st[i] + at}><Audio src={staticFile(`tts/${id}.wav`)} /></Sequence>))}
          {/* 장면 전환 효과음 */}
          {list.map((it, i) => it.tr ? <Sequence key={'w' + i} from={st[i] + it.d - T - 4} durationInFrames={30}><Audio src={staticFile('sfx/whoosh.wav')} volume={0.35} /></Sequence> : null)}
          {/* 로고 */}
          <Sequence from={6} durationInFrames={60}><Audio src={staticFile('sfx/logo.wav')} volume={0.5} /></Sequence>
          <Sequence from={st[list.length - 1] + 4} durationInFrames={60}><Audio src={staticFile('sfx/logo.wav')} volume={0.45} /></Sequence>
        </>
      )}
    </>
  );
};
