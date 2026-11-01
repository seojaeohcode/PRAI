// Motion on the beat. The rule PRAI enforces everywhere: a move *arrives* on the beat — it starts a few frames
// early (the lead) so its key pose lands exactly on the beat, then settles with a small overshoot. Leaving works the
// same way backwards. Accents (bar 1 > beat 3 > beats 2/4) and the song's energy scale how hard things hit.
import { Easing, interpolate } from "remotion";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = {
  out: Easing.out(Easing.cubic),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  snap: Easing.bezier(0.72, 0, 0.16, 1),            // fast middle, soft landing: camera moves
  back: Easing.out(Easing.back(1.7)),
};

/** 0→1 over [F - lead, F]: the motion lands on frame F */
export const arrive = (f: number, F: number, lead = 5, e = ease.out) => (lead <= 0 ? (f >= F ? 1 : 0) : interpolate(f, [F - lead, F], [0, 1], { ...clamp, easing: e }));
/** 1→0 over [F - lead, F]: gone exactly on frame F */
export const depart = (f: number, F: number, lead = 4) => 1 - arrive(f, F, lead, ease.inOut);
/** the bounce after landing on F: `amp` at F, a damped swing back to 0 over n frames */
export function settle(f: number, F: number, n = 10, amp = 1) {
  if (f < F || f > F + n) return 0;
  const t = (f - F) / n;
  return amp * Math.exp(-4 * t) * Math.cos(Math.PI * 1.5 * t);
}
/** an [a, b] frame range that interpolate() accepts (b > a), so zero-length or reversed spans finish at once */
export const span = (a: number, b: number): [number, number] => [a, Math.max(a + 1, b)];
/** 0→1 from frame a over n frames */
export const tween = (f: number, a: number, n = 8, e = ease.out) => interpolate(f, span(a, a + n), [0, 1], { ...clamp, easing: e });

/** a hit on every beat in `beatFrames`: 1 on the beat, gone after `n` frames, scaled by the beat's weight */
export function hits(f: number, beatFrames: { f: number; w: number }[], n = 7) {
  let v = 0;
  for (const b of beatFrames) { const d = f - b.f; if (d >= 0 && d < n) v = Math.max(v, b.w * (1 - d / n) ** 2); }
  return v;
}
/** moves one step per beat (each step eased over its first 5 frames): background marquees, counters */
export function stepped(f: number, fpb: number, per = 1) {
  const k = Math.floor(f / fpb), ph = Math.min(1, (f - k * fpb) / 5);
  return (k + (1 - (1 - ph) ** 3)) * per;
}
