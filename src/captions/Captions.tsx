// Two caption layers that never share a place: the headline (the scene's one-line message, a pill at the bottom)
// and subtitles (what the voice says). With both on, the headline moves to a chip at the top left.
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useBeats } from "../engine/beat";
import { beatValue, type Scene } from "../engine/spec";
import { useTheme } from "../engine/theme";
import type { Sub } from "../engine/timeline";

export const Headline: React.FC<{ h: NonNullable<Scene["headline"]>; meter: number; top?: boolean }> = ({ h, meter, top }) => {
  const t = useTheme(), f = useCurrentFrame(), { fps } = useVideoConfig(), B = useBeats();
  const o = typeof h === "string" ? { text: h } : h;
  const k = spring({ frame: f - B.f(beatValue((o as any).at, meter, 1)), fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  if (top) return (
    <div style={{ position: "absolute", left: 64, top: 40, opacity: k, transform: `translateX(${(1 - k) * -30}px)`, padding: "12px 24px", borderRadius: 14,
      background: t.ink, color: "#fff", font: `700 30px ${t.body}`, boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>{o.text}</div>);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
      <div style={{ padding: "18px 40px", borderRadius: 999, background: t.ink, color: "#fff", font: `700 46px ${t.body}`, letterSpacing: "-0.5px", boxShadow: "0 14px 40px rgba(0,0,0,.30)" }}>{o.text}</div>
      {(o as any).sub && <div style={{ padding: "6px 16px", borderRadius: 999, background: "rgba(255,255,255,.92)", color: t.ink2, font: `500 22px ${t.body}` }}>{(o as any).sub}</div>}
    </div>);
};

/** spoken subtitles; frames are global (this layer sits outside the scene sequences) */
export const Subtitles: React.FC<{ subs: Sub[] }> = ({ subs }) => {
  const t = useTheme(), f = useCurrentFrame();
  const cur = subs.find((s) => f >= s.from && f < s.to);
  if (!cur) return null;
  const o = Math.min(1, (f - cur.from) / 3, (cur.to - f) / 3);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ maxWidth: 1500, padding: "12px 28px", borderRadius: 12, background: "rgba(10,14,24,.78)", color: "#fff", font: `600 42px/1.35 ${t.body}`, textAlign: "center", letterSpacing: "-0.3px" }}>{cur.text}</div>
    </div>);
};
