// The PRAI composition: solve the timeline once, then lay scenes on the beat grid.
import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Soundtrack } from "./audio/Soundtrack";
import { Headline, Subtitles } from "./captions/Captions";
import { DemoScene } from "./demo/DemoScene";
import { SceneCtx } from "./engine/beat";
import { ease } from "./engine/motion";
import { ProjectCtx } from "./engine/project";
import type { Props } from "./engine/spec";
import { ThemeCtx, makeTheme, useFonts } from "./engine/theme";
import { solve, type SceneSlot, type Timeline } from "./engine/timeline";
import { MotionScene } from "./motion/MotionScene";

export const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const tl = solve(props.spec, props.lock);
  // the sheet keeps the video's length: <Freeze> clamps to the composition's last frame
  if (props.sheet) return { durationInFrames: Math.max(1, tl.totalFrames), width: props.sheet.cols * 640, height: Math.ceil(props.sheet.frames.length / props.sheet.cols) * 360, fps: tl.grid.fps };
  return { durationInFrames: Math.max(1, tl.totalFrames), width: tl.spec.video.width, height: tl.spec.video.height, fps: tl.grid.fps };
};

/** a cut on the beat: the new scene punches in (3 % over 5 frames) */
const Cut: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => {
  const f = useCurrentFrame();
  const k = on ? interpolate(f, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out }) : 1;
  return <AbsoluteFill style={{ transform: `scale(${1 + 0.03 * (1 - k)})` }}>{children}</AbsoluteFill>;
};

const SceneView: React.FC<{ tl: Timeline; slot: SceneSlot }> = ({ tl, slot }) => {
  const sc = slot.scene, meter = tl.grid.beatsPerBar, caps = tl.spec.captions;
  const head = caps.headline && sc.headline;
  return (
    <SceneCtx.Provider value={{ grid: tl.grid, start: slot.start, beats: slot.beats }}>
      <Cut on={slot.index > 0 && (sc.transition ?? "punch") === "punch"}>
        {sc.type === "motion" ? <MotionScene scene={sc} len={slot.len} meter={meter} />
          : <DemoScene scene={sc} len={slot.len} meter={meter} hasCaption={!!head || caps.subtitles} />}
        {head && <Headline h={sc.headline!} meter={meter} top={caps.subtitles} />}
      </Cut>
    </SceneCtx.Provider>
  );
};

/** everything is laid out in a 1920×1080 design space and scaled (uniformly, centred) to the output size */
const Design: React.FC<{ width: number; height: number; children: React.ReactNode }> = ({ width, height, children }) => {
  const k = Math.min(width / 1920, height / 1080);
  return <AbsoluteFill style={{ width: 1920, height: 1080, left: (width - 1920 * k) / 2, top: (height - 1080 * k) / 2, transformOrigin: "0 0", transform: `scale(${k})`, overflow: "hidden" }}>{children}</AbsoluteFill>;
};

export const PraiFrame: React.FC<{ tl: Timeline; props: Props; audio?: boolean }> = ({ tl, props, audio = true }) => {
  useFonts(tl.spec.theme);
  const theme = React.useMemo(() => makeTheme(tl.spec.theme), [tl.spec.theme]);
  return (
    <ThemeCtx.Provider value={theme}>
      <ProjectCtx.Provider value={{ tl, rects: props.rects }}>
        <AbsoluteFill style={{ background: theme.ground, fontFamily: theme.body }}>
          {audio && <Soundtrack tl={tl} />}
          <Design width={tl.spec.video.width} height={tl.spec.video.height}>
            {tl.scenes.map((s) => <Sequence key={s.id} from={s.from} durationInFrames={s.len} name={s.id}><SceneView tl={tl} slot={s} /></Sequence>)}
            {tl.spec.captions.subtitles && <Subtitles subs={tl.subs} />}
          </Design>
        </AbsoluteFill>
      </ProjectCtx.Provider>
    </ThemeCtx.Provider>
  );
};

export const PraiVideo: React.FC<Props> = (props) => {
  const tl = React.useMemo(() => solve(props.spec, props.lock), [props.spec, props.lock]);
  return <PraiFrame tl={tl} props={props} />;
};
