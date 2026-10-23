import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { C } from './theme';
import { Counter, Dark, Fade, Kicker, Light, LogoMark, Pill, Rise, useSpring } from './ui';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const hash = (i: number) => ((i * 2654435761) >>> 0) % 1000;

// ───────── 인트로 ─────────
export const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const word = 'TALENT LINK';
  return (
    <Dark glow={[50, 45]}>
      <AbsoluteFill style={{ display: 'grid', gridTemplateColumns: 'repeat(40, 1fr)', padding: 40, gap: 18, opacity: 0.55 }}>
        {Array.from({ length: 40 * 22 }).map((_, i) => {
          const x = i % 40, y = Math.floor(i / 40);
          const d = Math.hypot(x - 19.5, y - 10.5);
          const a = interpolate(f - d * 2.2, [0, 20], [0, 1], clamp);
          const pulse = 0.25 + 0.2 * Math.sin((f - d * 4) / 12);
          return <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: d < 4 ? C.accent : '#fff', opacity: a * (d < 4 ? 0.6 : pulse) }} />;
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40 }}>
        <LogoMark size={150} delay={8} />
        <div style={{ display: 'flex', fontSize: 132, fontWeight: 900, letterSpacing: -4 }}>
          {word.split('').map((ch, i) => {
            const s = useSpring(30 + i * 2, { damping: 14, stiffness: 160 } as never);
            return <span key={i} style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 60}px)`, opacity: s, width: ch === ' ' ? 36 : undefined }}>{ch}</span>;
          })}
        </div>
        <Fade delay={62}><div style={{ fontSize: 40, color: '#cfcfcf', fontWeight: 500 }}>그룹 전체에서 적합한 인재를 찾는 <b style={{ color: C.accent }}>AI 직무 매칭</b></div></Fade>
        <Fade delay={95}><div style={{ fontSize: 22, letterSpacing: 6, color: '#8a8a8a', fontWeight: 700 }}>HANWHA AI SOLUTION CHALLENGE · GREAT CHALLENGER</div></Fade>
      </AbsoluteFill>
    </Dark>
  );
};

// ───────── 질문 던지기 ─────────
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const card = useSpring(22, { damping: 16 } as never);
  const under = interpolate(f, [150, 172], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const phase2 = interpolate(f, [92, 104], [0, 1], clamp);
  return (
    <Light>
      <AbsoluteFill style={{ padding: '150px 150px', flexDirection: 'row', gap: 90, alignItems: 'center' }}>
        <div style={{ flex: 1.15 }}>
          <Kicker color={C.accentDeep}>A NEW POSITION IS OPEN</Kicker>
          <div style={{ position: 'relative', height: 330, marginTop: 26 }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 1 - phase2, transform: `translateY(${-phase2 * 40}px)` }}>
              <Rise delay={4}><div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -3, lineHeight: 1.2 }}>새 자리가</div></Rise>
              <Rise delay={12}><div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -3, lineHeight: 1.2 }}>열렸습니다.</div></Rise>
            </div>
            <div style={{ position: 'absolute', inset: 0, opacity: phase2 }}>
              <Rise delay={96}><div style={{ fontSize: 78, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.25 }}>적합한 사람은</div></Rise>
              <Rise delay={104}><div style={{ fontSize: 78, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.25 }}>그룹 어딘가에 있습니다.</div></Rise>
              <Fade delay={140} y={16}>
                <div style={{ fontSize: 54, fontWeight: 700, marginTop: 26, position: 'relative', display: 'inline-block', color: C.ink }}>
                  그런데, 그 사람은 <span style={{ position: 'relative', color: C.accentDeep }}>지원했을까요?
                    <span style={{ position: 'absolute', left: 0, bottom: 2, height: 14, width: `${under * 100}%`, background: '#f6995d55', zIndex: -1 }} />
                  </span>
                </div>
              </Fade>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, transform: `translateX(${(1 - card) * 300}px) rotate(${(1 - card) * 6}deg)`, opacity: card }}>
          <div style={{ background: '#fff', borderRadius: 22, border: `2px solid ${C.line}`, padding: 46, boxShadow: '0 40px 90px #0000001a' }}>
            <div style={{ fontSize: 20, letterSpacing: 4, color: C.muted, fontWeight: 700 }}>JD-014 · 한화오션</div>
            <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: -1.5, margin: '10px 0 26px' }}>사업기획 및 사업관리</div>
            {[['필수', '사업계획 수립·사업성 분석'], ['필수', '매출·원가·손익 지표 분석'], ['우대', '조선·제조업 PM·사업관리 경험'], ['우대', 'ERP·Excel·Power BI 실적분석']].map(([k, v], i) => (
              <Fade key={i} delay={40 + i * 7} y={10}>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '15px 0', borderTop: `1.5px solid ${C.line}`, fontSize: 28 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, padding: '4px 12px', borderRadius: 7, background: k === '필수' ? C.ink : '#f1f1ef', color: k === '필수' ? '#fff' : C.ink }}>{k}</span>{v}
                </div>
              </Fade>
            ))}
            <div style={{ marginTop: 18, fontSize: 22, color: C.muted }}>사내 공모 · 계열사 간 이동 가능</div>
          </div>
        </div>
      </AbsoluteFill>
    </Light>
  );
};

// ───────── 문제 → 해결 (같은 점 그리드가 이어진다) ─────────
const COLS = 48, ROWS = 26; // 48 × 26 = 1,248명
const APPLICANTS = new Set([37, 152, 230, 318, 401, 488, 590, 671, 760, 845, 951, 1102]);
const HOT = [211, 377, 529, 615, 702, 866, 903, 1001, 1137, 1190];
const HOT_APPLIED = new Set([152 /* not in HOT */]);

export const Problem: React.FC = () => {
  const f = useCurrentFrame();
  // 단계: 0 보이는 건 지원자뿐 / 1~3 문제 카드 / 4 스캔 해결
  const P = [0, 150, 250, 350, 460];
  const stage = P.filter(p => f >= p).length - 1;
  const split = interpolate(f, [250, 290, 340, 370], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const beam = interpolate(f, [470, 590], [-0.08, 1.08], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const hotOn = interpolate(f, [600, 625], [0, 1], clamp);
  const cell = 19;
  const problems = [
    { n: '01', t: '공고를 보고 지원한 사람만', d: '적합하지만 지원하지 않았거나 덜 알려진 인재는 검토 대상에서 빠집니다.' },
    { n: '02', t: '계열사마다 흩어진 인재 정보', d: '경력·역량·프로젝트 경험을 그룹 차원에서 한 번에 볼 수 없습니다.' },
    { n: '03', t: '사람마다 다른 기준, 매번 수작업', d: 'JD와 경력을 일일이 대조하고, 추천 근거를 설명하기 어렵습니다.' },
  ];
  return (
    <Dark glow={[75, 50]}>
      <AbsoluteFill style={{ padding: '120px 0 0 120px' }}>
        <div style={{ width: 720, position: 'relative', height: 820 }}>
          {/* 단계 0 */}
          <div style={{ position: 'absolute', inset: 0, opacity: interpolate(f, [140, 152], [1, 0], clamp) }}>
            <Kicker>PROBLEM</Kicker>
            <Rise delay={20} style={{ marginTop: 26 }}><div style={{ fontSize: 76, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.2 }}>지금은 지원한</div></Rise>
            <Rise delay={28}><div style={{ fontSize: 76, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.2 }}>사람만 보입니다.</div></Rise>
            <Fade delay={60} style={{ marginTop: 50 }}>
              <div style={{ fontSize: 34, color: '#bbb' }}>인재풀 등록 <b style={{ color: '#fff' }}>1,248명</b> 중</div>
              <div style={{ fontSize: 128, fontWeight: 900, color: C.accent, letterSpacing: -4, lineHeight: 1.1 }}><Counter to={12} delay={66} dur={30} />명</div>
              <div style={{ fontSize: 30, color: '#999' }}>공모에 지원한 사람만 검토됩니다</div>
            </Fade>
          </div>
          {/* 단계 1~3 */}
          {stage >= 1 && stage <= 3 && (
            <div style={{ position: 'absolute', inset: 0, opacity: interpolate(f, [440, 458], [1, 0], clamp) }}>
              <Kicker>WHY IT HAPPENS</Kicker>
              <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 22 }}>
                {problems.map((p, i) => {
                  const on = f >= P[i + 1];
                  const cur = stage === i + 1;
                  return (
                    <Fade key={i} delay={P[i + 1]} x={-40} y={0}>
                      <div style={{ opacity: on ? (cur ? 1 : 0.42) : 0, padding: '28px 32px', borderRadius: 18, border: `2px solid ${cur ? C.accent : '#ffffff22'}`, background: cur ? '#f6995d14' : 'transparent' }}>
                        <div style={{ display: 'flex', gap: 22, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 30, fontWeight: 900, color: C.accent }}>{p.n}</span>
                          <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: -1.2 }}>{p.t}</span>
                        </div>
                        <div style={{ fontSize: 27, color: '#aaa', marginTop: 10, marginLeft: 56, lineHeight: 1.5 }}>{p.d}</div>
                      </div>
                    </Fade>
                  );
                })}
              </div>
            </div>
          )}
          {/* 단계 4: 해결 */}
          {stage >= 4 && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <Kicker>SOLUTION · TALENT LINK</Kicker>
              <Rise delay={466} style={{ marginTop: 26 }}><div style={{ fontSize: 70, fontWeight: 900, letterSpacing: -2.4, lineHeight: 1.22 }}>지원하지 않은 인재까지,</div></Rise>
              <Rise delay={474}><div style={{ fontSize: 70, fontWeight: 900, letterSpacing: -2.4, lineHeight: 1.22 }}>그룹 전체를 <span style={{ color: C.accent }}>스캔</span>합니다.</div></Rise>
              <div style={{ marginTop: 52, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'flex-start' }}>
                {['① 인재 스캐닝 · 상위 N명 추천', '② 추천서 자동 작성', '③ 제안서 자동 작성', '④ 임직원 셀프 진단 · 바로 지원'].map((t, i) => (
                  <Fade key={i} delay={640 + i * 12} x={-30} y={0}><Pill dark>{t}</Pill></Fade>
                ))}
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
      {/* 점 그리드 */}
      <div style={{ position: 'absolute', left: 860, top: 150, width: COLS * cell + 2 * 30, height: ROWS * cell }}>
        {Array.from({ length: COLS * ROWS }).map((_, i) => {
          const x = i % COLS, y = Math.floor(i / COLS);
          const company = Math.floor((x * 3) / COLS);
          const appear = interpolate(f - (x + y) * 0.9, [0, 18], [0, 1], clamp);
          const isApp = APPLICANTS.has(i);
          const appOn = interpolate(f, [70 + (i % 7) * 3, 84 + (i % 7) * 3], [0, 1], clamp);
          const scanned = beam > x / COLS;
          const hotIdx = HOT.indexOf(i);
          let bg = '#3a3835', scale = 1, glow = 0;
          if (scanned) bg = hash(i) < 250 ? '#c9a185' : '#6b6158';
          if (isApp && appOn > 0 && !(stage >= 4 && scanned)) { bg = C.accent; scale = 1 + 0.35 * appOn; glow = appOn; }
          if (stage === 3 && isApp) scale *= 1 + 0.25 * Math.max(0, Math.sin((f + i) / 4));
          if (hotIdx >= 0 && hotOn > 0) { bg = C.accent; scale = 1 + 0.6 * hotOn + 0.12 * Math.sin((f + hotIdx * 5) / 6); glow = hotOn; }
          const gapX = company * 30 * split;
          return (
            <div key={i} style={{ position: 'absolute', left: x * cell + gapX, top: y * cell, width: 11, height: 11, borderRadius: 6, background: bg, opacity: appear, transform: `scale(${scale})`, boxShadow: glow ? `0 0 ${14 * glow}px ${C.accent}` : undefined }}>
              {hotIdx >= 0 && hotOn > 0 && !HOT_APPLIED.has(i) && (
                <div style={{ position: 'absolute', inset: -7, borderRadius: 14, border: `2px solid #fff`, opacity: hotOn * 0.85, transform: `scale(${1 + 0.3 * Math.sin((f + hotIdx * 7) / 8)})` }} />
              )}
            </div>
          );
        })}
        {/* 계열사 라벨 (정보 분산 단계) */}
        {['한화오션', '한화시스템', '한화에어로스페이스'].map((n, k) => (
          <div key={n} style={{ position: 'absolute', top: -46, left: Math.ceil((k * COLS) / 3) * cell + k * 30 * split, width: (Math.ceil(((k + 1) * COLS) / 3) - Math.ceil((k * COLS) / 3)) * cell, textAlign: 'center', fontSize: 18, color: '#ccc', opacity: split, whiteSpace: 'nowrap' }}>{n}</div>
        ))}
        {/* 스캔 빔 */}
        {beam > -0.05 && beam < 1.05 && (
          <div style={{ position: 'absolute', top: -30, bottom: -30, left: `${beam * 100}%`, width: 6, background: C.accent, boxShadow: `0 0 40px 12px #f6995d88`, borderRadius: 3 }} />
        )}
        {/* 범례 */}
        <div style={{ position: 'absolute', top: ROWS * cell + 40, left: 0, display: 'flex', gap: 36, fontSize: 24, color: '#aaa' }}>
          {stage < 4 ? (
            <><span><b style={{ color: C.accent }}>●</b> 공모 지원자 12명</span><span><b style={{ color: '#555' }}>●</b> 검토되지 않는 임직원 1,236명</span></>
          ) : (
            <Fade delay={600}><span><b style={{ color: C.accent }}>●</b> 추천 후보 상위 10명 &nbsp;·&nbsp; <span style={{ color: '#fff' }}>◯</span> 그중 공모 미지원 <b style={{ color: '#fff' }}>숨은 후보</b></span></Fade>
          )}
        </div>
      </div>
    </Dark>
  );
};

// ───────── 챕터 카드 ─────────
export const Chapter: React.FC<{ n: string; title: string; sub: string; eyebrow: string }> = ({ n, title, sub, eyebrow }) => {
  const f = useCurrentFrame();
  const bar = interpolate(f, [8, 40], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const numX = interpolate(f, [0, 30], [-120, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Dark glow={[20, 60]}>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 160px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 70 }}>
          <div style={{ fontSize: 330, fontWeight: 900, letterSpacing: -14, color: 'transparent', WebkitTextStroke: `4px ${C.accent}`, transform: `translateX(${numX}px)`, opacity: interpolate(f, [0, 14], [0, 1], clamp), lineHeight: 1 }}>{n}</div>
          <div>
            <Kicker>{eyebrow}</Kicker>
            <Rise delay={10} style={{ marginTop: 14 }}><div style={{ fontSize: 110, fontWeight: 900, letterSpacing: -4 }}>{title}</div></Rise>
            <div style={{ height: 8, width: 520 * bar, background: C.accent, borderRadius: 4, margin: '18px 0 26px' }} />
            <Fade delay={24}><div style={{ fontSize: 38, color: '#c8c8c8', maxWidth: 1000, lineHeight: 1.45 }}>{sub}</div></Fade>
          </div>
        </div>
      </AbsoluteFill>
    </Dark>
  );
};

// ───────── 기대 효과 ─────────
const Tile: React.FC<{ delay: number; label: string; children: React.ReactNode; sub: string }> = ({ delay, label, children, sub }) => {
  const s = useSpring(delay, { damping: 16 } as never);
  return (
    <div style={{ background: '#fff', borderRadius: 24, border: `2px solid ${C.line}`, padding: '36px 42px', transform: `translateY(${(1 - s) * 60}px) scale(${0.96 + s * 0.04})`, opacity: s, boxShadow: '0 24px 60px #00000010', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.muted }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{children}</div>
      <div style={{ fontSize: 24, color: C.muted, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
};

export const Effects: React.FC = () => {
  const f = useCurrentFrame();
  const shrink = interpolate(f, [150, 195], [1, 6 / 45], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const big = { fontSize: 92, fontWeight: 900, letterSpacing: -3.5, lineHeight: 1 } as const;
  const arrow = (d: number) => <span style={{ display: 'inline-block', margin: '0 22px', color: C.accent, opacity: interpolate(f, [d, d + 10], [0, 1], clamp), transform: `translateX(${interpolate(f, [d, d + 14], [-20, 0], clamp)}px)` }}>→</span>;
  return (
    <Light>
      <AbsoluteFill style={{ padding: '90px 130px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <Kicker color={C.accentDeep}>EXPECTED IMPACT</Kicker>
            <Rise delay={4} style={{ marginTop: 12 }}><div style={{ fontSize: 82, fontWeight: 900, letterSpacing: -3 }}>무엇이 달라지나요</div></Rise>
          </div>
          <Fade delay={30}><div style={{ fontSize: 22, color: C.muted, textAlign: 'right', lineHeight: 1.6 }}>시연 데이터 · 팀 추정치 기준<br />도입 시 기준선 측정 후 확정</div></Fade>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 28, marginTop: 40 }}>
          <Tile delay={24} label="후보 탐색 범위" sub="공모 지원자만 → 설정한 범위의 전 임직원">
            <div style={big}><span style={{ color: C.muted }}>12명</span>{arrow(44)}<span style={{ color: C.ink }}><Counter from={12} to={1248} delay={50} dur={50} />명</span></div>
          </Tile>
          <Tile delay={110} label="후보 1명 검토 시간" sub="요건 대조 · 근거 정리를 AI가 먼저 해 둡니다">
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
                <div style={big}><Counter from={45} to={6} delay={150} dur={45} />분</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#fff', background: C.ink, borderRadius: 12, padding: '4px 16px', opacity: interpolate(f, [190, 200], [0, 1], clamp) }}>−87%</div>
              </div>
              <div style={{ height: 22, background: '#efefed', borderRadius: 6, marginTop: 22, overflow: 'hidden' }}><div style={{ height: '100%', width: `${shrink * 100}%`, background: C.accent, borderRadius: 6 }} /></div>
            </div>
          </Tile>
          <Tile delay={200} label="숨은 후보 발견" sub="상위 10명 중 공모에 지원하지 않은 적합 후보">
            <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
              <div style={big}><Counter to={8} delay={215} dur={30} />명</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 40px)', gap: 14 }}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const on = interpolate(f, [220 + i * 4, 230 + i * 4], [0, 1], clamp);
                  const hidden = i !== 0 && i !== 6;
                  return <div key={i} style={{ width: 40, height: 40, borderRadius: 20, background: hidden ? C.accent : '#d9d6d1', transform: `scale(${on})` }} />;
                })}
              </div>
            </div>
          </Tile>
          <Tile delay={290} label="추천 근거 문서화" sub="모든 추천에 요건별 근거 · 우려 · 확인 질문 · 확인일">
            <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
              <div style={big}><Counter to={100} delay={305} dur={40} />%</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 24 }}>
                {['추천서 · 상부 보고', '제안서 · 당사자 메일', '면담 확인 질문'].map((t, i) => <Fade key={t} delay={320 + i * 8} x={20} y={0}><span style={{ color: C.ok, fontWeight: 900 }}>✓</span> {t}</Fade>)}
              </div>
            </div>
          </Tile>
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 28 }}>
          {[['조직', '외부 채용 전에, 그룹 안에서 먼저 찾습니다.'], ['임직원', '지원하지 않아도, 맞는 기회가 먼저 옵니다.']].map(([k, v], i) => (
            <Fade key={k} delay={390 + i * 14} style={{ flex: 1 }}>
              <div style={{ background: C.ink, color: '#fff', borderRadius: 18, padding: '24px 34px', fontSize: 32, fontWeight: 700, display: 'flex', gap: 20, alignItems: 'center' }}>
                <span style={{ fontSize: 22, color: C.ink, background: C.accent, borderRadius: 8, padding: '4px 14px', fontWeight: 900 }}>{k}</span>{v}
              </div>
            </Fade>
          ))}
        </div>
      </AbsoluteFill>
    </Light>
  );
};

// ───────── 운영 원칙 ─────────
export const Principles: React.FC = () => {
  const items = [
    ['순위보다 근거', '근거 문서 · 확인일 · 추가 질문을 함께 보여 줍니다'],
    ['정보 미확인 ≠ 역량 부족', '필수 요건이 미확인이어도 자동으로 탈락시키지 않습니다'],
    ['적합성 ≠ 이동 가능성', '본인의 참여 의사와 소속 조직 협의는 따로 확인합니다'],
    ['직무와 무관한 속성 제외', '성별 · 나이 등은 평가에 쓰지 않습니다'],
  ];
  return (
    <Dark glow={[30, 30]}>
      <AbsoluteFill style={{ padding: '120px 150px', justifyContent: 'center' }}>
        <Kicker>OPERATING PRINCIPLES</Kicker>
        <Rise delay={6} style={{ marginTop: 18 }}><div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -3.5 }}>AI는 찾고,</div></Rise>
        <Rise delay={16}><div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -3.5 }}>결정은 <span style={{ color: C.accent }}>사람</span>이 합니다.</div></Rise>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 60px', marginTop: 64 }}>
          {items.map(([t, d], i) => (
            <Fade key={t} delay={46 + i * 14} x={-30} y={0}>
              <div style={{ borderLeft: `5px solid ${C.accent}`, paddingLeft: 28 }}>
                <div style={{ fontSize: 40, fontWeight: 900 }}>{t}</div>
                <div style={{ fontSize: 27, color: '#aaa', marginTop: 6 }}>{d}</div>
              </div>
            </Fade>
          ))}
        </div>
      </AbsoluteFill>
    </Dark>
  );
};

// ───────── 아웃트로 ─────────
export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Dark glow={[50, 50]}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 34 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <LogoMark size={120} delay={4} />
          <Rise delay={14}><div style={{ fontSize: 120, fontWeight: 900, letterSpacing: -4 }}>TALENT LINK</div></Rise>
        </div>
        <Fade delay={34}><div style={{ fontSize: 50, fontWeight: 700 }}>그룹 안의 인재를, <span style={{ color: C.accent }}>그룹의 기회</span>로.</div></Fade>
        <Fade delay={56}><Pill dark style={{ fontSize: 32, marginTop: 20 }}><span style={{ color: C.accent }}>●</span> talent-link-seven.vercel.app</Pill></Fade>
        <Fade delay={74}><div style={{ fontSize: 22, letterSpacing: 6, color: '#8a8a8a', fontWeight: 700, marginTop: 30 }}>HANWHA AI SOLUTION CHALLENGE · GREAT CHALLENGER</div></Fade>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: C.accent, transform: `scaleX(${interpolate(f, [0, 60], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })})`, transformOrigin: 'left' }} />
    </Dark>
  );
};
