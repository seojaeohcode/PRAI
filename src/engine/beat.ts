// The beat grid every motion is placed on. Times in a PRAI spec are beats, never frames:
// change the song and the whole video re-times itself.
import React from "react";

export type Grid = {
  bpm: number;
  fps: number;
  /** frame of global beat 0 in the video (the first beat at or after the video's start) */
  zero: number;
  beatsPerBar: number;
  /** which global beat (0…beatsPerBar-1) is beat 1 of a bar */
  downbeat: number;
  /** loudness per bar, 0–1, counted from the first downbeat (optional) */
  energy?: number[];
  /** the song's bar index (into `energy`) of the bar that starts at global beat `downbeat` */
  barOffset?: number;
};

export const fpb = (g: Grid) => (g.fps * 60) / g.bpm;
/** frame of global beat B (fractional beats allowed: 3.5 = the off-beat after beat 3) */
export const frameOfBeat = (g: Grid, B: number) => Math.round(g.zero + B * fpb(g));
export const beatOfFrame = (g: Grid, f: number) => (f - g.zero) / fpb(g);

/** 1 on a bar's first beat, 0.6 on its middle beat, 0.35 on the others (a 4/4 groove; 3/4 → 1, 0.35, 0.35) */
export function accentOf(g: Grid, B: number) {
  if (Math.abs(B - Math.round(B)) > 1e-6) return 0.2;                   // off-beats are light
  const pos = (((Math.round(B) - g.downbeat) % g.beatsPerBar) + g.beatsPerBar) % g.beatsPerBar;
  if (pos === 0) return 1;
  if (g.beatsPerBar % 2 === 0 && pos === g.beatsPerBar / 2) return 0.6;
  return 0.35;
}
export function energyOf(g: Grid, B: number) {
  if (!g.energy?.length) return 1;
  const bar = (g.barOffset ?? 0) + Math.floor((B - g.downbeat) / g.beatsPerBar);
  return g.energy[Math.max(0, Math.min(g.energy.length - 1, bar))];
}

/** the scene a component is drawn in: its first global beat; local beat b = global beat start + b */
export type SceneBeat = { grid: Grid; start: number; beats: number };
export const SceneCtx = React.createContext<SceneBeat>({ grid: { bpm: 120, fps: 30, zero: 0, beatsPerBar: 4, downbeat: 0 }, start: 0, beats: 16 });
export const useScene = () => React.useContext(SceneCtx);

/** helpers for local beats inside the current scene (frames are local to the scene's <Sequence>) */
export function useBeats() {
  const s = useScene();
  const base = frameOfBeat(s.grid, s.start);
  return {
    fpb: fpb(s.grid),
    /** local frame of local beat b */
    f: (b: number) => frameOfBeat(s.grid, s.start + b) - base,
    /** local beat (float) of a local frame */
    beatAt: (frame: number) => beatOfFrame(s.grid, frame + base) - s.start,
    accent: (b: number) => accentOf(s.grid, s.start + b),
    energy: (b: number) => energyOf(s.grid, s.start + b),
    fps: s.grid.fps,
    meter: s.grid.beatsPerBar,
    beats: s.beats,
  };
}
