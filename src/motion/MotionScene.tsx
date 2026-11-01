// An intro / outro / title scene: a background plus a beat sheet of cues, drawn in order (later cues on top).
import React from "react";
import { AbsoluteFill } from "remotion";
import { useBeats } from "../engine/beat";
import { beatValue, type MotionSceneT } from "../engine/spec";
import { useTheme } from "../engine/theme";
import { BLOCKS, background } from "./blocks";
import { CueLayer, INTENSITY } from "./cue";
import { GrooveProvider, useGroove } from "./groove";

/** cues drawn over any scene (motion scenes and demo overlays share this) */
export const CueStack: React.FC<{ cues: MotionSceneT["cues"]; len: number; meter: number; intensity: number; bg: "brand" | "light" | "dark" }> = ({ cues, len, meter, intensity, bg }) => {
  // the background under a cue is the last wipe that has landed by the cue's beat
  const bgAt = (b: number) => {
    let cur = bg;
    for (const c of cues) if (c.block === "wipe" && beatValue(c.at, meter) <= b && (c.until === undefined || beatValue(c.until, meter) > b)) cur = c.to;
    return cur;
  };
  return <>{cues.map((c, i) => {
    const Block = BLOCKS[c.block] as React.FC<{ c: typeof c }>;
    return <CueLayer key={i} cue={c} sceneLen={len} meter={meter} intensity={intensity} onDark={bgAt(beatValue(c.at, meter)) !== "light"}><Block c={c} /></CueLayer>;
  })}</>;
};

const Pulse: React.FC<{ bg: string }> = ({ bg }) => {
  const g = useGroove();
  return <AbsoluteFill style={{ background: bg, filter: `brightness(${1 + 0.035 * g.hit()})` }} />;
};

export const MotionScene: React.FC<{ scene: MotionSceneT; len: number; meter: number }> = ({ scene, len, meter }) => {
  const t = useTheme();
  const intensity = INTENSITY[scene.intensity];
  void useBeats;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <GrooveProvider intensity={intensity}>
        <Pulse bg={background(t, scene.bg)} />
        <CueStack cues={scene.cues} len={len} meter={meter} intensity={intensity} bg={scene.bg} />
      </GrooveProvider>
    </AbsoluteFill>
  );
};
