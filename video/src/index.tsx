import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Main, totalFrames } from './Main';
import { FPS } from './theme';

const Root: React.FC = () => (
  <Composition id="TalentLink" component={Main} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} />
);

registerRoot(Root);
