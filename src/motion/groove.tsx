// The groove: background things that move with the music in every motion scene — a hit on each beat, weighted by
// where the beat sits in the bar (accents are global, so bar 1 is the song's bar 1), the bar's loudness and the
// scene's intensity. Blocks only animate on their own cue; the groove keeps the frame breathing in between.
import React from "react";
import { useCurrentFrame } from "remotion";
import { useBeats } from "../engine/beat";

type Groove = { hit: (shiftBeats?: number) => number };
const GrooveCtx = React.createContext<Groove>({ hit: () => 0 });
export const useGroove = () => React.useContext(GrooveCtx);

export const GrooveProvider: React.FC<{ intensity: number; children: React.ReactNode }> = ({ intensity, children }) => {
  const f = useCurrentFrame(), B = useBeats();
  const hit = (shift = 0) => {
    // the beat whose (rounded) frame is the latest one at or before f
    let k = Math.floor(B.beatAt(f) - shift + 1e-6);
    if (B.f(k + 1 + shift) <= f) k += 1;
    if (k < 0) return 0;
    const d = f - B.f(k + shift), n = 7;
    if (d < 0 || d >= n) return 0;
    return B.accent(k + shift) * B.energy(k + shift) * intensity * (1 - d / n) ** 2;
  };
  return <GrooveCtx.Provider value={{ hit }}>{children}</GrooveCtx.Provider>;
};
