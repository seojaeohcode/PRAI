// Camera keys for a demo scene (pure: no React, no assets), shared by the composition and the tests.
import { interpolate } from "remotion";
import { Box, frameTarget, pad } from "../engine/geometry";
import { clamp, ease } from "../engine/motion";
import { beatValue, type DemoSceneT } from "../engine/spec";
import { pageOf, resolveRef } from "../engine/timeline";

/** the frame area of a device (screenshots are drawn inside it) */
export const frameRect = (device: "browser" | "none"): Box => (device === "none" ? { x: 0, y: 0, w: 1920, h: 1080 } : { x: 96, y: 74, w: 1728, h: 972 });

/** the whole page fitted to a frame aspect (letterboxed when the page has another shape) */
export function fullWindow(page: { w: number; h: number }, aspect: number): Box {
  const fw = Math.max(page.w, page.h * aspect);
  return { x: (page.w - fw) / 2, y: (page.h - fw / aspect) / 2, w: fw, h: fw / aspect };
}

export type Key = { f: number; win: Box };
/** camera windows over the scene: each move takes `move` beats (default 1) and arrives exactly on its beat */
export function cameraKeys(scene: DemoSceneT, F: (b: number) => number, rects: any, meter: number, room: number): Key[] {
  const page = pageOf(rects), R = frameRect(scene.device), aspect = R.w / R.h;
  // "full" = the whole page fitted to the frame's aspect (letterboxed if the page has another shape)
  const full = fullWindow(page, aspect);
  const raw = scene.camera.map((k) => {
    const target = k.to === "full" ? full : pad(resolveRef(k.to, rects, scene.shot), k.pad ?? 36);
    return { at: beatValue(k.at, meter), move: beatValue(k.move, meter, 1), win: k.to === "full" ? full : frameTarget(target, page, aspect, { room }) };
  }).sort((a, b) => a.at - b.at);
  if (!raw.length || raw[0].at > 0) raw.unshift({ at: 0, move: 0, win: full });
  // keys on the same frame: the last one wins
  const keys = raw.filter((k, i) => i === raw.length - 1 || F(raw[i + 1].at) !== F(k.at));
  const out: Key[] = [{ f: F(keys[0].at), win: keys[0].win }];
  for (let i = 1; i < keys.length; i++) {
    const prev = out[out.length - 1], end = F(keys[i].at);
    if (JSON.stringify(keys[i].win) === JSON.stringify(prev.win)) { out.push({ f: end, win: keys[i].win }); continue; }
    // move 0 = a cut on the beat; otherwise the move lasts `move` beats and lands on `end`
    const dur = keys[i].move <= 0 ? 1 : Math.max(2, end - F(keys[i].at - keys[i].move));
    const start = Math.max(prev.f, end - dur);
    if (start > prev.f) out.push({ f: start, win: prev.win });
    out.push({ f: Math.max(end, out[out.length - 1].f + 1), win: keys[i].win });
  }
  return out;
}
export function windowAt(keys: Key[], f: number, aspect: number): Box {
  if (keys.length === 1) return keys[0].win;
  const fs = keys.map((k) => k.f), o = { ...clamp, easing: ease.snap };
  const cx = interpolate(f, fs, keys.map((k) => k.win.x + k.win.w / 2), o), cy = interpolate(f, fs, keys.map((k) => k.win.y + k.win.h / 2), o);
  const w = Math.exp(interpolate(f, fs, keys.map((k) => Math.log(k.win.w)), o));    // zoom on a log scale feels even
  return { x: cx - w / 2, y: cy - w / aspect / 2, w, h: w / aspect };
}

