// What the solver and the cue layer must know about each block: how early it starts moving (lead) and the last beat
// its content still needs (staggered chunks, rolling numbers, reading time). One place, so `auto` scene lengths and
// mounting agree with what the block draws.
import { beatValue, type Cue } from "../engine/spec";

/** frames a block starts before its beat; null = the default (≈0.45 beat, max 6 frames) */
export function cueLead(c: Cue, fpb: number): number {
  if (c.block === "wipe") return 8;
  if (c.block === "screen") return Math.round(fpb);
  return Math.round(Math.min(6, fpb * 0.45));
}

/** the beat by which a cue's content has landed and had time to be read (scene-local) */
export function cueEnd(c: Cue, meter: number, fpb = 13): number {
  if (c.until !== undefined) return beatValue(c.until, meter);
  const at = beatValue(c.at, meter), read = 1.5;
  switch (c.block) {
    case "title": return at + (c.text.split("|").length - 1) * beatValue(c.step, meter, 1) + read;
    case "chips": return at + (c.items.length - 1) * beatValue(c.step, meter, 0) + read;
    case "cards": return at + (c.tags.length - 1) * beatValue(c.step, meter, 0) + read;
    case "counter": return at + beatValue(c.roll, meter, 1) + read;
    case "bars": return Math.max(at + c.items.length - 1, c.overlap ? beatValue(c.overlap.at, meter) : 0) + read;
    case "beam": return at + beatValue(c.beats, meter, 2) + 6 / fpb;
    case "ripples": return at + ((Math.max(1, c.count ?? 3) - 1) * 5 + 34) / fpb;
    case "stat": return at + 2 + read;
    case "screen": return at + 1;
    case "marquee": case "orbs": case "ribbons": case "wipe": return at + 1;   // backgrounds: they fill whatever time there is
    default: return at + 2;
  }
}
