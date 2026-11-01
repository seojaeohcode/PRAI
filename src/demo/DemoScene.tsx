// A demo scene: the real product screen with a beat-locked camera, marks, a single continuous cursor, typed
// input cards, screenshot swaps and optional motion-block overlays.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { useBeats } from "../engine/beat";
import { Box, center, frameTarget, pad } from "../engine/geometry";
import { arrive, clamp, depart, ease, settle, span } from "../engine/motion";
import { useProject } from "../engine/project";
import { beatValue, type DemoSceneT } from "../engine/spec";
import { toneColor, useTheme } from "../engine/theme";
import { pageOf, resolveRef } from "../engine/timeline";
import { CueStack } from "../motion/MotionScene";
import { INTENSITY } from "../motion/cue";
import { Layer, Screen, frameRect, useScreenScale } from "./Screen";
import { cameraKeys, windowAt } from "./camera";

const CamCtx = React.createContext<{ win: (f: number) => Box; frameW: number }>({ win: () => ({ x: 0, y: 0, w: 1920, h: 1080 }), frameW: 1728 });

const Mark: React.FC<{ m: DemoSceneT["marks"][number]; shot: string; meter: number; sceneLen: number; room: number }> = ({ m, shot, meter, sceneLen, room }) => {
  const t = useTheme(), f = useCurrentFrame(), B = useBeats(), s = useScreenScale(), { rects } = useProject(), cam = React.useContext(CamCtx);
  const at = beatValue(m.at, meter), A = B.f(at), Z = m.until !== undefined ? B.f(beatValue(m.until, meter)) : sceneLen;
  const lead = 3;
  if (f < A - lead || f >= Z) return null;
  const b = pad(resolveRef(m.on, rects, shot), m.pad ?? 6), col = toneColor(t, m.tone);
  const p = arrive(f, A, lead), out = Z >= sceneLen ? 1 : depart(f, Z, 4), sw = settle(f, A, 9, 0.6 + 0.4 * B.accent(at));
  const o = Math.min(1, p * 1.6) * out, grow = 1.12 - 0.12 * p + 0.025 * sw;   // a small pop, not a jump
  const style = m.style ?? "box";
  // label: the first side (above, below, right, left) that fits inside the camera window at the landing frame
  let label: React.ReactNode = null;
  if (m.label) {
    // placement and size both use the camera at the landing frame, so they agree
    const w0 = cam.win(A), sA = cam.frameW / w0.w;
    const lh = 50 / sA, lw = (m.label.length * (/[가-힣]/.test(m.label) ? 30 : 17) + 36) / sA, gap = 10 / sA;
    const usableBottom = w0.y + w0.h * (1 - room);
    const cands = [{ x: b.x, y: b.y - lh - gap }, { x: b.x, y: b.y + b.h + gap }, { x: b.x + b.w + gap, y: b.y }, { x: b.x - lw - gap, y: b.y }];
    const fits = (c: { x: number; y: number }) => c.x >= w0.x && c.y >= w0.y && c.x + lw <= w0.x + w0.w && c.y + lh <= usableBottom;
    const c0 = cands.find(fits) ?? cands[0];
    const pos = { x: Math.max(w0.x, Math.min(w0.x + w0.w - lw, c0.x)), y: Math.max(w0.y, Math.min(usableBottom - lh, c0.y)) };
    label = <div style={{ position: "absolute", left: pos.x - b.x, top: pos.y - b.y, height: lh, padding: `0 ${16 / sA}px`, borderRadius: 10 / sA, background: col, color: "#fff",
      font: `700 ${28 / sA}px/${lh}px ${t.body}`, whiteSpace: "nowrap", boxShadow: `0 ${4 / sA}px ${12 / sA}px rgba(0,0,0,.18)` }}>{m.label}</div>;
  }
  const box: React.CSSProperties = style === "underline"
    ? { borderBottom: `${6 / s}px solid ${col}` }
    : { border: `${4 / s}px solid ${col}`, borderRadius: 10 / s, background: style === "spotlight" ? "transparent" : `${col}12`,
      boxShadow: style === "spotlight" ? `0 0 0 ${4000 / s}px rgba(8,16,32,${0.42 * o})` : `0 0 0 ${6 / s}px ${col}33` };
  return <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, opacity: o, transform: `scale(${grow})`, transformOrigin: "center", ...box }}>{label}</div>;
};

/** one cursor for the whole scene: it travels from the last click to the next and touches down on the beat */
const Cursor: React.FC<{ clicks: DemoSceneT["clicks"]; shot: string; meter: number; sceneLen: number }> = ({ clicks, shot, meter, sceneLen }) => {
  const f = useCurrentFrame(), B = useBeats(), s = useScreenScale(), { rects } = useProject(), t = useTheme();
  if (!clicks.length) return null;
  // clicks on the same frame merge; a click needs at least 3 frames of travel from the previous one
  // compared with the last kept click (prai check reports clicks closer than 3 frames as an error)
  const pts = clicks.map((c) => ({ F: B.f(beatValue(c.at, meter)), ...center(resolveRef(c.on, rects, shot)) })).sort((a, b) => a.F - b.F)
    .reduce<{ F: number; x: number; y: number }[]>((kept, p) => (kept.length && p.F <= kept[kept.length - 1].F + 2 ? kept : [...kept, p]), []);
  const first = pts[0], enterF = first.F - Math.round(B.fpb);
  if (f < enterF - 4) return null;
  let x = first.x + 140 / s, y = first.y + 120 / s;
  for (let i = 0; i < pts.length; i++) {
    const from = i === 0 ? { x: first.x + 140 / s, y: first.y + 120 / s, F: enterF }
      : { ...pts[i - 1], F: Math.min(pts[i].F - 2, Math.max(pts[i - 1].F + Math.min(6, Math.floor((pts[i].F - pts[i - 1].F) / 2)), pts[i].F - Math.round(B.fpb))) };
    if (f <= pts[i].F) {
      const k = interpolate(f, [from.F, pts[i].F], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1) });
      x = from.x + (pts[i].x - from.x) * k; y = from.y + (pts[i].y - from.y) * k;
      break;
    }
    x = pts[i].x; y = pts[i].y;
  }
  const o = Math.min(interpolate(f, [enterF - 4, enterF + 2], [0, 1], clamp), interpolate(f, [sceneLen - 5, sceneLen - 1], [1, 0], clamp));
  const press = pts.reduce((v, p) => Math.max(v, f >= p.F && f < p.F + 6 ? 1 - (f - p.F) / 6 : 0), 0);
  return (<>
    {pts.map((p, i) => { const r = interpolate(f, [p.F, p.F + 20], [0, 1], clamp); if (f < p.F || r >= 1) return null;
      return <div key={i} style={{ position: "absolute", left: p.x - (40 / s) * r, top: p.y - (40 / s) * r, width: (80 / s) * r, height: (80 / s) * r, borderRadius: "50%", border: `${4 / s}px solid ${t.brand}`, opacity: 1 - r }} />; })}
    <svg viewBox="0 0 24 24" style={{ position: "absolute", left: x - 3 / s, top: y - 2 / s, width: 36 / s, height: 36 / s, opacity: o, transform: `scale(${1 - 0.15 * press})`, transformOrigin: "10% 8%" }}>
      <path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#0F1B2D" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </>);
};

/** a long input shown large while it is typed (the real input box is too small to read in a video) */
const TypeCard: React.FC<{ c: DemoSceneT["typing"][number]; meter: number }> = ({ c, meter }) => {
  const t = useTheme(), f = useCurrentFrame(), B = useBeats();
  const at = beatValue(c.at, meter), A = B.f(at), Z = B.f(beatValue(c.until, meter)), D = B.f(beatValue(c.done, meter, at + 3));
  if (f < A - 4 || f >= Z) return null;
  const n = Math.round(interpolate(f, span(A + 4, D), [0, c.text.length], clamp));
  const o = Math.min(arrive(f, A, 4), depart(f, Z, 5));
  return (<div style={{ position: "absolute", left: 300, right: 300, top: 150, opacity: o, transform: `translateY(${(1 - o) * 20}px)`, padding: "30px 40px", borderRadius: 24,
    background: "#fff", boxShadow: "0 24px 60px rgba(0,37,84,.28)", border: `2px solid ${t.brand}` }}>
    {c.title && <div style={{ font: `700 26px ${t.body}`, color: t.brand, marginBottom: 12 }}>{c.title}</div>}
    <div style={{ font: `600 40px/1.45 ${t.body}`, color: t.ink, letterSpacing: "-0.5px" }}>{c.text.slice(0, n)}<span style={{ opacity: f % 20 < 10 ? 1 : 0 }}>|</span></div>
  </div>);
};

export const DemoScene: React.FC<{ scene: DemoSceneT; len: number; meter: number; hasCaption: boolean }> = ({ scene, len, meter, hasCaption }) => {
  const f = useCurrentFrame(), B = useBeats(), { rects } = useProject();
  const room = hasCaption ? 0.22 : 0.06, R = frameRect(scene.device), aspect = R.w / R.h;
  const keys = React.useMemo(() => cameraKeys(scene, B.f, rects, meter, room), [scene, rects, meter, room, B.fpb]);
  const win = (fr: number) => windowAt(keys, fr, aspect);
  // swaps in time order; each one is complete on its beat (fade 0 = an instant cut on the beat)
  const layers: Layer[] = [{ shot: scene.shot, from: 0, fade: 0 },
    ...[...scene.swaps].sort((a, b) => beatValue(a.at, meter) - beatValue(b.at, meter)).map((s) => ({ shot: s.shot, from: B.f(beatValue(s.at, meter)) - Math.max(0, s.fade ?? 4), fade: Math.max(0, s.fade ?? 4) }))];
  return (
    <AbsoluteFill>
      <CamCtx.Provider value={{ win, frameW: R.w }}>
        <Screen win={win(f)} layers={layers} device={scene.device} url={scene.url}>
          {scene.marks.map((m, i) => <Mark key={i} m={m} shot={scene.shot} meter={meter} sceneLen={len} room={room} />)}
          <Cursor clicks={scene.clicks} shot={scene.shot} meter={meter} sceneLen={len} />
        </Screen>
      </CamCtx.Provider>
      {scene.typing.map((c, i) => <TypeCard key={i} c={c} meter={meter} />)}
      {scene.cues.length > 0 && <CueStack cues={scene.cues} len={len} meter={meter} intensity={INTENSITY.medium} bg="light" />}
    </AbsoluteFill>
  );
};
