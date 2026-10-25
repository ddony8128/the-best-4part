import { continueRender, delayRender, staticFile } from 'remotion';

// 사이트(TALENT LINK · TL-DS)와 같은 색: TDS 회색 + 한화 오렌지 + 네이비
export const C = {
  ink: '#191f28',
  muted: '#4e5968',
  line: '#e5e8eb',
  bg: '#f2f4f6',
  accent: '#f4511e',
  accentDeep: '#b8390e',
  soft: '#fff4ee',
  dark: '#141c2e',
  dark2: '#19243b',
  ok: '#029359',
};

// Pretendard(사이트와 같은 서체)를 영상 렌더 전에 불러온다
const FAMILY = 'Pretendard';
// (document.fonts.check는 등록되지 않은 글꼴에도 true를 돌려주므로 쓰지 않는다)
if (typeof document !== 'undefined') {
  const handle = delayRender('Pretendard');
  const face = new FontFace(FAMILY, `url(${staticFile('fonts/PretendardVariable.woff2')}) format('woff2')`, { weight: '100 900' });
  face.load().then(f => { document.fonts.add(f); continueRender(handle) }).catch(() => continueRender(handle));
}
export const FONT = `${FAMILY}, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
export const FPS = 30;
