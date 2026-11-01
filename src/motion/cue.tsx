// A cue's life on the beat grid: anticipate (lead frames before `at`) → hit/arrive on `at` → settle → hold →
// leave so it is gone on `until`. Blocks read this from <CueCtx> and decide how each phase looks.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useBeats } from "../engine/beat";
import { arrive, depart, settle } from "../engine/motion";
import { beatValue, type Cue } from "../engine/spec";
import { cueLead } from "./meta";

export type CueState = {
  f: number; A: number; Z: number; lead: number;
  /** 0→1, reaches 1 exactly on the cue's beat */ p: number;
  /** damped swing after the landing (1 → 0), already scaled by the beat's accent and the scene's intensity */ s: number;
  /** 1 while visible, → 0 as it leaves */ out: number;
  amp: number; onDark: boolean; at: number; meter: number;
  /** local frame of a beat counted from the cue's own `at` */ fAt: (b: number) => number;
  /** arrive/settle helpers for a sub-element landing `b` beats after the cue */ land: (b: number) => { p: number; s: number };
};
export const CueCtx = React.createContext<CueState | null>(null);
export const useCue = () => { const c = React.useContext(CueCtx); if (!c) throw new Error("useCue outside a cue"); return c; };

export const INTENSITY = { low: 0.6, medium: 1, high: 1.35 } as const;

export const CueLayer: React.FC<{ cue: Cue; sceneLen: number; meter: number; intensity: number; onDark: boolean; children: React.ReactNode }> =
  ({ cue, sceneLen, meter, intensity, onDark, children }) => {
    const f = useCurrentFrame(), B = useBeats();
    const at = beatValue(cue.at, meter), A = B.f(at);
    const Z = cue.until !== undefined ? B.f(beatValue(cue.until, meter)) : sceneLen;
    const lead = cueLead(cue, B.fpb);
    if (f < A - lead || f >= Z) return null;
    const amp = (0.55 + 0.45 * B.accent(at)) * intensity;
    const exit = cue.exit ?? "fade";
    const out = Z >= sceneLen || exit === "cut" ? 1 : depart(f, Z, exit === "sink" ? 6 : 4);
    const fAt = (b: number) => B.f(at + b);
    const land = (b: number) => { const F = fAt(b); return { p: arrive(f, F, lead), s: settle(f, F, 10, amp) }; };
    const st: CueState = { f, A, Z, lead, p: arrive(f, A, lead), s: settle(f, A, 10, amp), out, amp, onDark, at, meter, fAt, land };
    return <CueCtx.Provider value={st}><AbsoluteFill style={{ pointerEvents: "none" }}>{children}</AbsoluteFill></CueCtx.Provider>;
  };

/** the standard entrance for a block's root element (opacity + transform), by `enter` style */
export function enterStyle(enter: Cue["enter"] | undefined, st: CueState, exit: Cue["exit"] | undefined): React.CSSProperties {
  const { p, s, out } = st;
  const sink = exit === "sink" ? (1 - out) * 40 : 0;
  const o = Math.min(1, p * 1.8) * out;
  switch (enter ?? "rise") {
    case "pop": return { opacity: o, transform: `translateY(${sink}px) scale(${0.86 + 0.14 * p + 0.06 * s})` };
    case "scale": return { opacity: o, transform: `translateY(${sink}px) scale(${1.22 - 0.22 * p + 0.04 * s})` };
    case "drop": return { opacity: o, transform: `translateY(${-60 * (1 - p) + 10 * s + sink}px)` };
    case "slide": return { opacity: o, transform: `translateX(${-90 * (1 - p) + 12 * s}px) translateY(${sink}px)` };
    case "cut": return { opacity: (p >= 1 ? 1 : 0) * out, transform: `translateY(${sink}px) scale(${1 + 0.07 * s})` };
    case "type": return { opacity: out, transform: `translateY(${sink}px)` };
    case "rise": default: return { opacity: o, transform: `translateY(${44 * (1 - p) - 8 * s + sink}px) scale(${0.96 + 0.04 * p})` };
  }
}
