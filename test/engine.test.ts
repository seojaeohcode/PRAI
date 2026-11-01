import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeBeats } from "../cli/lib/beat-analyze.ts";
import { synthGroove } from "../cli/lib/synth.ts";
import { Spec, beatValue } from "../src/engine/spec.ts";
import { solve, splitLine } from "../src/engine/timeline.ts";

// the groove is ours, so we know the truth: beats every 60/bpm s from 0
function downsample(x: Float32Array, k: number) { const o = new Float32Array(Math.floor(x.length / k)); for (let i = 0; i < o.length; i++) o[i] = x[i * k]; return o; }
for (const bpm of [96, 120, 135]) {
  test(`beat analysis finds ${bpm} BPM and the first beat`, () => {
    const a = analyzeBeats(downsample(synthGroove({ bpm, bars: 24 }), 2), 22050);
    assert.ok(Math.abs(a.bpm - bpm) < 0.1, `bpm ${a.bpm}`);
    const period = 60 / bpm, off = Math.min(a.offset, Math.abs(period - a.offset));
    assert.ok(off < 0.02, `offset ${a.offset}`);
  });
}

test("beat times: numbers, fractions, bar:beat", () => {
  assert.equal(beatValue(3, 4), 3);
  assert.equal(beatValue("5/2", 4), 2.5);
  assert.equal(beatValue("2:1", 4), 4);
  assert.equal(beatValue("2:1", 3), 3);
  assert.equal(Spec.safeParse({ grid: { bpm: 120 }, scenes: [{ id: "a", type: "motion", cues: [{ block: "title", text: "x", at: "1/0" }] }] }).success, false);
  assert.equal(Spec.safeParse({ grid: { bpm: 120 }, scenes: [{ id: "a", type: "motion", cues: [{ block: "title", text: "x", at: "0:1" }] }] }).success, false);
});

test("auto length covers staggered content and voices; lines without `at` follow each other", () => {
  const tl = solve({ grid: { bpm: 120 }, scenes: [
    { id: "a", type: "motion", cues: [{ block: "title", text: "A|B|C|D|E", step: 2, at: 0 }] },
    { id: "b", type: "motion", say: ["one two three four five six seven eight", "nine ten eleven twelve"], cues: [] },
  ] });
  assert.ok(tl.scenes[0].beats >= 10, `title scene ${tl.scenes[0].beats}`);
  const [v1, v2] = tl.scenes[1].voices;
  assert.ok(v2.atBeat > v1.atBeat + v1.seconds * 2, "second line starts after the first");
  assert.equal(tl.scenes[1].beats % 2, 0);
  assert.equal(tl.totalFrames, Math.round(tl.totalBeats * 15));
});

test("song starts on a beat: beat 0 is frame 0", () => {
  const tl = solve({ music: { src: "m.mp3", bpm: 120, offset: 0.3, downbeat: 1, trim: 1 }, scenes: [{ id: "a", type: "motion", beats: 4, cues: [] }] });
  assert.ok(Math.abs(tl.musicStart - 1.3) < 1e-9);
  assert.equal(tl.grid.downbeat, ((1 - 2) % 4 + 4) % 4);
});

test("subtitle lines split at punctuation", () => {
  const parts = splitLine("Shipnote pulls in every merged pull request, then drafts the notes for you.", 42);
  assert.ok(parts.every((p) => p.length <= 43), JSON.stringify(parts));
});

import { frameOfBeat } from "../src/engine/beat.ts";
import { cameraKeys } from "../src/demo/camera.ts";

test("scenes tile the timeline with no gaps or overlaps at a non-integer frames-per-beat", () => {
  const tl = solve({ grid: { bpm: 135 }, scenes: [1, 2, 3, 4, 5].map((i) => ({ id: `s${i}`, type: "motion" as const, beats: 3 + i, cues: [] })) });
  for (let i = 1; i < tl.scenes.length; i++) assert.equal(tl.scenes[i].from, tl.scenes[i - 1].from + tl.scenes[i - 1].len);
  assert.equal(tl.totalFrames, frameOfBeat(tl.grid, tl.totalBeats));
});

test("invalid times and sizes are rejected by the schema", () => {
  const base = { grid: { bpm: 120 }, scenes: [{ id: "a", type: "motion" }] } as any;
  assert.equal(Spec.safeParse({ ...base, captions: { maxChars: -1 } }).success, false);
  assert.equal(Spec.safeParse({ ...base, video: { fps: 1 } }).success, false);
  assert.equal(Spec.safeParse({ grid: { bpm: 120 }, scenes: [{ id: "a", type: "motion", cues: [{ block: "counter", at: 0, to: 5, roll: 0 }] }] }).success, false);
  assert.equal(Spec.safeParse({ grid: { bpm: 120 }, scenes: [{ id: "a", type: "motion", say: [{ text: "x", id: "v" }, { text: "y", id: "v" }] }] }).success, false);
});

test("a lock made for another track is ignored, and a silent video uses grid.bpm", () => {
  const lock = { music: { file: "old.mp3", bpm: 90, offset: 0.1, downbeat: 0, clarity: 5, barConfidence: 1, energy: [], duration: 60, hash: "x" } };
  assert.equal(solve({ grid: { bpm: 120 }, scenes: [{ id: "a", type: "motion", beats: 4 }] }, lock).grid.bpm, 120);
  assert.equal(solve({ music: { src: "new.mp3" }, scenes: [{ id: "a", type: "motion", beats: 4 }] }, lock).grid.bpm, 120);
});

test("unrecorded lines do not duck the music; ripples extend an auto scene to their last frame", () => {
  const tl = solve({ grid: { bpm: 180 }, scenes: [{ id: "a", type: "motion", say: "hello there", cues: [{ block: "ripples", at: 2, count: 3 }] }] });
  assert.equal(tl.duck.length, 0);
  assert.ok(tl.scenes[0].len >= frameOfBeat(tl.grid, 2) + 10 + 34, `len ${tl.scenes[0].len}`);
});

test("camera: same-frame keys merge, move 0 cuts, every key lands on its beat", () => {
  const rects = { _page: { w: 1920, h: 1080 }, s: { a: { x: 100, y: 100, w: 200, h: 100 }, b: { x: 1200, y: 600, w: 300, h: 200 } } } as any;
  const F = (b: number) => Math.round(b * 13.333);
  const sc = { type: "demo", shot: "s", device: "browser", camera: [{ at: 1, to: "a" }, { at: 1, to: "b" }, { at: 3, to: "a", move: 0 }], marks: [], clicks: [], swaps: [], typing: [], cues: [], sfx: [], id: "x", beats: 8 } as any;
  const keys = cameraKeys(sc, F, rects, 4, 0.2);
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i].f > keys[i - 1].f, "strictly increasing");
  assert.ok(keys.some((k) => k.f === F(1)), "lands on beat 1");
  assert.ok(keys.some((k) => k.f === F(3)) && keys.some((k) => k.f === F(3) - 1), "move 0 is a one-frame cut on beat 3");
});
