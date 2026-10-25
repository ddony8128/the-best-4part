import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Main, totalFrames } from './Main';
import { FPS } from './theme';

// TalentLink: 내레이션(Gemini TTS) + 효과음 / TalentLinkSilent: 소리 없는 판
const Root: React.FC = () => (
  <>
    <Composition id="TalentLink" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} defaultProps={{ audio: true }} />
    <Composition id="TalentLinkSilent" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} defaultProps={{ audio: false }} />
  </>
);

registerRoot(Root);
