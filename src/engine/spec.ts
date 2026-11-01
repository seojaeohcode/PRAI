// The PRAI spec: one JSON file (projects/<name>/prai.json) describes the whole video.
// Every time inside a scene is a beat: 3 (beat 3), 2.5 or "5/2" (the off-beat), "2:1" (bar 2, beat 1 — both 1-based).
// Seconds appear only where they belong to audio: music trim, measured voice lengths, subtitle timings.
import { z } from "zod";

export const BeatTime = z.union([
  z.number().finite().min(0),
  z.string().regex(/^(\d+\/[1-9]\d*|[1-9]\d*:[1-9]\d*|\d+(\.\d+)?)$/, "a beat: 3, 2.5, \"5/2\" or \"bar:beat\" like \"2:1\" (bar and beat start at 1)"),
]);
export type BeatTime = z.infer<typeof BeatTime>;
/** an element measured at capture time: "shot.key", or several (their union), or { box: [x, y, w, h] } in shot pixels */
export const Ref = z.union([z.string(), z.array(z.string()).min(1), z.object({ box: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]) })]);
/** a duration in beats: must be more than zero */
const Span = BeatTimePositive();
function BeatTimePositive() { return BeatTime.refine((t) => (typeof t === "number" ? t > 0 : !/^0+(\.0+)?$|^0+\//.test(t)), "must be more than 0 beats"); }
export type Ref = z.infer<typeof Ref>;

const Say = z.union([z.string(), z.object({ text: z.string().min(1), at: BeatTime.optional(), id: z.string().optional() })]);
const Tone = z.enum(["brand", "accent", "warn", "danger", "ok", "info"]);

// ---- motion blocks (intro, outro, overlays) ----
const Common = {
  at: BeatTime,
  until: BeatTime.optional(),                         // exclusive end (gone on this beat); default: the scene's end
  enter: z.enum(["pop", "rise", "drop", "slide", "cut", "type", "scale"]).optional(),
  exit: z.enum(["fade", "cut", "sink"]).optional(),
  x: z.number().optional(), y: z.number().optional(),
};
export const Cue = z.discriminatedUnion("block", [
  z.object({ block: z.literal("title"), text: z.string(), size: z.number().optional(), color: z.string().optional(), align: z.enum(["center", "left"]).optional(),
    /** "|" splits the text into chunks that land one per `step` beats */ step: BeatTime.optional(), weight: z.number().optional(), ...Common }),
  z.object({ block: z.literal("kicker"), text: z.string(), tone: Tone.optional(), ...Common }),
  z.object({ block: z.literal("counter"), from: z.number().default(0), to: z.number(), prefix: z.string().optional(), suffix: z.string().optional(),
    /** beats the number rolls for; it stops on at + roll */ roll: Span.optional(), size: z.number().optional(), note: z.string().optional(), ...Common }),
  z.object({ block: z.literal("chips"), items: z.array(z.string()).min(1), step: BeatTime.optional(), tone: Tone.optional(), ...Common }),
  z.object({ block: z.literal("bars"), axis: z.tuple([z.string(), z.string()]), ticks: z.array(z.string()).optional(),
    items: z.array(z.object({ label: z.string(), from: z.string(), to: z.string() })).min(1).max(4),
    overlap: z.object({ at: BeatTime, label: z.string() }).optional(), ...Common }),
  z.object({ block: z.literal("cards"), tags: z.array(z.string()).min(1).max(5), step: BeatTime.optional(), ...Common }),
  z.object({ block: z.literal("beam"), beats: Span.optional(), top: z.number().optional(), bottom: z.number().optional(), ...Common }),
  z.object({ block: z.literal("ripples"), count: z.number().optional(), ...Common }),
  z.object({ block: z.literal("wipe"), to: z.enum(["brand", "light", "dark"]), ...Common }),
  z.object({ block: z.literal("logo"), src: z.string().optional(), width: z.number().optional(), rings: z.boolean().optional(), ...Common }),
  z.object({ block: z.literal("tagline"), text: z.string(), size: z.number().optional(), ...Common }),
  z.object({ block: z.literal("marquee"), text: z.string(), size: z.number().optional(), dir: z.enum(["left", "right"]).optional(), ...Common }),
  z.object({ block: z.literal("orbs"), ...Common }),
  z.object({ block: z.literal("ribbons"), ...Common }),
  z.object({ block: z.literal("credits"), lines: z.array(z.string()).min(1), ...Common }),
  z.object({ block: z.literal("stat"), title: z.string(), value: z.number(), suffix: z.string().optional(), note: z.string().optional(),
    items: z.array(z.object({ value: z.union([z.number(), z.string()]), label: z.string(), sub: z.string().optional(), tone: Tone.optional() })).max(4).optional(), ...Common }),
  z.object({ block: z.literal("screen"), shot: z.string(), ...Common }),
]);
export type Cue = z.infer<typeof Cue>;

const SceneBase = {
  id: z.string().regex(/^[\w-]+$/),
  /** what the scene is for — the reference rubric scores techniques against it */
  purpose: z.enum(["problem", "proof", "benefit", "brand", "cta"]).optional(),
  beats: z.union([z.number().int().positive(), z.literal("auto")]).default("auto"),
  say: z.union([Say, z.array(Say)]).optional(),
  headline: z.union([z.string(), z.object({ text: z.string(), sub: z.string().optional(), at: BeatTime.optional() })]).optional(),
  transition: z.enum(["cut", "punch"]).optional(),
  cues: z.array(Cue).default([]),
  sfx: z.array(z.object({ at: BeatTime, src: z.string(), volume: z.number().optional() })).default([]),
};
export const MotionScene = z.object({
  type: z.literal("motion"),
  bg: z.enum(["brand", "light", "dark"]).default("brand"),
  intensity: z.enum(["low", "medium", "high"]).default("medium"),
  ...SceneBase,
});
export const DemoScene = z.object({
  type: z.literal("demo"),
  shot: z.string(),
  device: z.enum(["browser", "none"]).default("browser"),
  url: z.string().optional(),
  camera: z.array(z.object({ at: BeatTime, to: z.union([z.literal("full"), Ref]), pad: z.number().optional(), move: BeatTime.optional() })).default([]),
  marks: z.array(z.object({ at: BeatTime, until: BeatTime.optional(), on: Ref, label: z.string().optional(), tone: Tone.optional(),
    style: z.enum(["box", "spotlight", "underline"]).optional(), pad: z.number().optional() })).default([]),
  clicks: z.array(z.object({ at: BeatTime, on: Ref })).default([]),
  swaps: z.array(z.object({ at: BeatTime, shot: z.string(), fade: z.number().optional() })).default([]),
  typing: z.array(z.object({ at: BeatTime, until: BeatTime, text: z.string(), title: z.string().optional(), done: BeatTime.optional() })).default([]),
  ...SceneBase,
});
export const Scene = z.discriminatedUnion("type", [MotionScene, DemoScene]);
export type Scene = z.infer<typeof Scene>;
export type MotionSceneT = z.infer<typeof MotionScene>;
export type DemoSceneT = z.infer<typeof DemoScene>;

export const Spec = z.object({
  $schema: z.string().optional(),
  schemaVersion: z.literal("0.1").default("0.1"),
  video: z.object({ title: z.string().default("PRAI video"), width: z.number().int().positive().default(1920), height: z.number().int().positive().default(1080), fps: z.number().int().min(10).max(120).default(30),
    lang: z.string().default("en") }).default({}),
  theme: z.object({
    brand: z.string().default("#1F3BFF"), brand2: z.string().default("#6C8CFF"), ink: z.string().default("#0E1726"), ink2: z.string().default("#46536B"),
    ground: z.string().default("#F2F5FA"), accent: z.string().default("#FF5A4E"), ok: z.string().default("#0E8A4B"), warn: z.string().default("#D97706"),
    danger: z.string().default("#C62828"), info: z.string().default("#2B59C3"),
    font: z.string().default("Pretendard"), headFont: z.string().optional(),
    fonts: z.array(z.object({ family: z.string(), src: z.string(), weight: z.number().default(400) })).default([]),
    logo: z.string().optional(),
  }).default({}),
  music: z.object({
    src: z.string(), url: z.string().optional(), credit: z.string().optional(),
    bpm: z.number().positive().optional(), offset: z.number().min(0).optional(), downbeat: z.number().int().min(0).optional(),
    meter: z.number().int().min(2).max(7).default(4), trim: z.number().min(0).default(0),
    bed: z.number().default(0.34), duck: z.number().default(0.14), fadeOutBeats: z.number().default(4),
  }).optional(),
  grid: z.object({ bpm: z.number().min(30).max(300), meter: z.number().int().min(2).max(7).default(4) }).optional(),   // a silent video still needs a grid
  voice: z.object({ provider: z.enum(["edge", "command", "file"]).default("edge"), voice: z.string().optional(), rate: z.string().optional(), pitch: z.string().optional(),
    command: z.string().optional(), python: z.string().optional(), lead: BeatTime.default("1/2"), tail: z.number().default(1) }).default({}),
  captions: z.object({ headline: z.boolean().default(true), subtitles: z.boolean().default(false), maxChars: z.number().int().min(0).default(0) }).default({}),
  timing: z.object({ snap: z.number().int().positive().default(2), minBeats: z.number().int().min(1).default(4) }).default({}),
  scenes: z.array(Scene).min(1),
}).superRefine((s, ctx) => {
  if (!s.music && !s.grid) ctx.addIssue({ code: "custom", message: "set music (with a track) or grid.bpm for a silent video", path: ["music"] });
  const ids = new Set<string>();
  s.scenes.forEach((sc, i) => { if (ids.has(sc.id)) ctx.addIssue({ code: "custom", message: `duplicate scene id "${sc.id}"`, path: ["scenes", i, "id"] }); ids.add(sc.id); });
  const voiceIds = new Set<string>();
  s.scenes.forEach((sc, i) => (sc.say === undefined ? [] : Array.isArray(sc.say) ? sc.say : [sc.say]).forEach((l, k) => {
    const id = (typeof l === "object" && l.id) || `${sc.id}-${k + 1}`;
    if (voiceIds.has(id)) ctx.addIssue({ code: "custom", message: `duplicate voice line id "${id}"`, path: ["scenes", i, "say"] });
    voiceIds.add(id);
  }));
  if (s.music && !(s.music.bpm === undefined || (s.music.bpm >= 30 && s.music.bpm <= 300))) ctx.addIssue({ code: "custom", message: "music.bpm must be 30–300", path: ["music", "bpm"] });
});
export type Spec = z.infer<typeof Spec>;
export type SpecInput = z.input<typeof Spec>;

/** "2:1" → 4 in 4/4 (bar and beat are 1-based), "5/2" → 2.5, 3 → 3 */
export function beatValue(t: BeatTime | undefined, meter: number, dflt = 0): number {
  if (t === undefined) return dflt;
  if (typeof t === "number") return t;
  if (t.includes(":")) { const [bar, beat] = t.split(":").map(Number); return (bar - 1) * meter + (beat - 1); }
  if (t.includes("/")) { const [a, b] = t.split("/").map(Number); return a / b; }
  return Number(t);
}

/** what `prai beat` and `prai voice` measured (projects/<name>/prai.lock.json) */
export type Lock = {
  music?: { file: string; bpm: number; offset: number; downbeat: number; clarity: number; barConfidence: number; energy: number[]; duration: number; hash: string };
  voice?: Record<string, { file: string; text: string; seconds: number; cues: { start: number; end: number; text: string }[]; hash: string }>;
};
/** shots/rects.json from `prai capture` */
export type Rects = { _page?: { w: number; h: number } } & Record<string, Record<string, { x: number; y: number; w: number; h: number } | null> | { w: number; h: number } | undefined>;

export type Props = { spec: SpecInput; lock: Lock; rects: Rects; sheet?: { frames: number[]; cols: number; labels: string[] } };
