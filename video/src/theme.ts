import { loadFont } from '@remotion/google-fonts/NotoSansKR';

// 사이트(TALENT LINK)와 같은 색을 쓴다
export const C = {
  ink: '#181818',
  muted: '#717171',
  line: '#e6e5e2',
  bg: '#f6f6f4',
  accent: '#f6995d',
  accentDeep: '#a24c17',
  soft: '#fff1e7',
  dark: '#111110',
  dark2: '#1b1b1b',
  ok: '#2f6b3a',
};

const { fontFamily } = loadFont('normal', { weights: ['500', '900'], subsets: ['korean', 'latin'], ignoreTooManyRequestsWarning: true });
export const FONT = `${fontFamily}, 'Malgun Gothic', Arial, sans-serif`;
export const FPS = 30;
