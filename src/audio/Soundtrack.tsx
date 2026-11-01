// Music bed + narration + sound effects. The bed ducks under every voice (10-frame ramps), fades in over 6 frames
// and out over the last `fadeOutBeats`. The song starts on a beat (Timeline.musicStart) so beat 0 is frame 0.
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { frameOfBeat } from "../engine/beat";
import { beatValue } from "../engine/spec";
import type { Timeline } from "../engine/timeline";

export function musicVolume(tl: Timeline, f: number) {
  const m = tl.spec.music!;
  let duck = 1;
  for (const [a, b] of tl.duck) duck = Math.min(duck, f < a ? Math.min(1, (a - f) / 10) : f > b ? Math.min(1, (f - b) / 10) : 0);
  const v = m.duck + (m.bed - m.duck) * duck;
  const fadeLen = Math.max(1, frameOfBeat(tl.grid, m.fadeOutBeats));
  return Math.max(0, v * Math.min(1, f / 6, (tl.totalFrames - f) / fadeLen));
}

export const Soundtrack: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const m = tl.spec.music, meter = tl.grid.beatsPerBar;
  return (<>
    {m && <Audio src={staticFile(m.src)} trimBefore={Math.round(tl.musicStart * tl.grid.fps)} volume={(f) => musicVolume(tl, f)} />}
    {tl.voices.filter((v) => v.file).map((v) => (
      <Sequence key={v.id} from={v.from} durationInFrames={v.frames + 6}><Audio src={staticFile(`voice/${v.file}`)} /></Sequence>))}
    {tl.scenes.flatMap((s) => s.scene.sfx.map((x, i) => (
      <Sequence key={`${s.id}-sfx-${i}`} from={frameOfBeat(tl.grid, s.start + beatValue(x.at, meter))}><Audio src={staticFile(x.src)} volume={x.volume ?? 0.6} /></Sequence>)))}
  </>);
};
