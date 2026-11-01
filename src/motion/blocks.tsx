// The motion blocks a cue can use. Positions are in a 1920×1080 design space (centre-based x/y).
// No 3D engine: gradients, shadows and SVG give the glossy look.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { useBeats } from "../engine/beat";
import { clamp, ease, span, stepped, tween } from "../engine/motion";
import { beatValue, type Cue } from "../engine/spec";
import { toneColor, useTheme, type Theme } from "../engine/theme";
import { ShotScreen } from "../demo/Screen";
import { enterStyle, useCue } from "./cue";
import { useGroove } from "./groove";

type Of<K extends Cue["block"]> = Extract<Cue, { block: K }>;
const ink = (t: Theme, onDark: boolean) => (onDark ? "#FFFFFF" : t.ink);
const sub = (t: Theme, onDark: boolean) => (onDark ? "rgba(255,255,255,.82)" : t.ink2);

export const background = (t: Theme, bg: "brand" | "light" | "dark") =>
  bg === "brand" ? `linear-gradient(135deg, ${t.brand} 0%, ${t.brand2} 100%)`
    : bg === "dark" ? `radial-gradient(120% 100% at 50% 0%, #1B2436 0%, #0B101B 75%)`
      : `radial-gradient(120% 90% at 50% 10%, #FFFFFF 0%, ${t.ground} 75%, #E3E9F2 100%)`;

const Title: React.FC<{ c: Of<"title"> }> = ({ c }) => {
  const t = useTheme(), st = useCue(), B = useBeats();
  const chunks = c.text.split("|"), step = beatValue(c.step, st.meter, 1), size = c.size ?? 120;
  const align = c.align ?? "center", x = c.x ?? 960, y = c.y ?? 540;
  return (
    <div style={{ position: "absolute", left: align === "center" ? 0 : x, right: align === "center" ? 0 : undefined, top: y - size * 0.6, textAlign: align,
      font: `${c.weight ?? 800} ${size}px/1.15 ${t.head}`, color: c.color ?? ink(t, st.onDark), letterSpacing: `${-size / 60}px`, opacity: st.out,
      transform: c.exit === "sink" ? `translateY(${(1 - st.out) * 40}px)` : undefined }}>
      {chunks.map((w, k) => {
        const { p, s } = st.land(k * step);
        if (c.enter === "type") {
          const F = st.fAt(k * step), n = Math.max(0, Math.min(w.length, Math.ceil(((st.f - F + st.lead) / Math.max(1, B.fpb * 0.6)) * w.length)));
          return <span key={k}>{w.slice(0, n)}{k === chunks.length - 1 && st.f % 16 < 9 ? <span style={{ fontWeight: 300 }}>|</span> : null}</span>;
        }
        return <span key={k} style={{ display: "inline-block", marginRight: k < chunks.length - 1 ? size * 0.28 : 0, ...enterStyle(c.enter ?? "rise", { ...st, p, s, out: 1 }, undefined) }}>{w}</span>;
      })}
    </div>
  );
};

const Kicker: React.FC<{ c: Of<"kicker"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  return <div style={{ position: "absolute", left: 0, right: 0, top: (c.y ?? 380) - 28, display: "flex", justifyContent: "center", ...enterStyle(c.enter ?? "pop", st, c.exit) }}>
    <div style={{ padding: "10px 26px", borderRadius: 999, background: st.onDark ? "rgba(255,255,255,.16)" : toneColor(t, c.tone ?? "brand"), color: "#fff",
      font: `700 32px ${t.body}`, border: st.onDark ? "1px solid rgba(255,255,255,.4)" : "none" }}>{c.text}</div></div>;
};

const Counter: React.FC<{ c: Of<"counter"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  const roll = beatValue(c.roll, st.meter, 1), E = st.fAt(roll);
  const v = Math.round(interpolate(st.f, span(st.A, E), [c.from, c.to], { ...clamp, easing: ease.out }));
  const hit = st.f >= E ? Math.max(0, 1 - (st.f - E) / 8) : 0;           // a punch the moment it stops, on the beat
  const size = c.size ?? 190, y = c.y ?? 470;
  return (<div style={{ position: "absolute", left: 0, right: 0, top: y - size * 0.6, textAlign: "center", ...enterStyle(c.enter ?? "pop", st, c.exit) }}>
    <div style={{ font: `800 ${size}px/1.1 ${t.head}`, color: ink(t, st.onDark), letterSpacing: "-4px", transform: `scale(${1 + 0.06 * hit * st.amp})`, fontVariantNumeric: "tabular-nums" }}>
      {c.prefix}{v.toLocaleString()}{c.suffix}</div>
    {c.note && <div style={{ marginTop: 18, font: `600 32px ${t.body}`, color: sub(t, st.onDark), opacity: tween(st.f, E - 2, 6) }}>{c.note}</div>}
  </div>);
};

const Chips: React.FC<{ c: Of<"chips"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  const step = beatValue(c.step, st.meter, 0), y = c.y ?? 720;
  return (<div style={{ position: "absolute", left: 0, right: 0, top: y - 50, display: "flex", justifyContent: "center", gap: 28, opacity: st.out }}>
    {c.items.map((label, k) => {
      const { p, s } = step ? st.land(k * step) : { p: st.p, s: st.s };
      const delay = step ? 0 : k * 1;
      const pp = step ? p : Math.max(0, Math.min(1, p * 1.2 - delay * 0.06));
      return <div key={k} style={{ padding: "20px 42px", borderRadius: 999, background: "linear-gradient(180deg,#FFFFFF 0%,#DCE6FA 100%)", color: toneColor(t, c.tone ?? "brand"),
        font: `800 40px ${t.body}`, whiteSpace: "nowrap", opacity: Math.min(1, pp * 2), transform: `translateY(${(1 - pp) * 120 - 8 * s}px)`,
        boxShadow: "0 18px 40px rgba(0,20,60,.28), inset 0 -6px 14px rgba(16,56,192,.16), inset 0 4px 8px rgba(255,255,255,.9)" }}>{label}</div>;
    })}
  </div>);
};

const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };
const Bars: React.FC<{ c: Of<"bars"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  const T0 = hm(c.axis[0]), T1 = hm(c.axis[1]), X0 = 300, X1 = 1620, tx = (m: number) => X0 + ((m - T0) / (T1 - T0)) * (X1 - X0);
  const top = (c.y ?? 600) - 90, rowH = 120;
  const lo = Math.max(...c.items.map((i) => hm(i.from))), hi = Math.min(...c.items.map((i) => hm(i.to)));
  const ov = c.overlap && c.items.length > 1 && hi > lo ? st.land(beatValue(c.overlap.at, st.meter) - st.at) : null;
  const ticks = c.ticks ?? [c.axis[0], c.axis[1]];
  const axisY = top + rowH * c.items.length + 10;
  return (<div style={{ position: "absolute", inset: 0, opacity: st.out }}>
    <div style={{ position: "absolute", left: X0, width: X1 - X0, top: axisY, height: 2, background: st.onDark ? "rgba(255,255,255,.5)" : "#A9B6C8", opacity: st.p }} />
    {ticks.map((k) => <div key={k} style={{ position: "absolute", left: tx(hm(k)) - 50, width: 100, top: axisY + 12, textAlign: "center", font: `600 26px ${t.body}`, color: sub(t, st.onDark), opacity: st.p }}>{k}</div>)}
    {c.items.map((it, k) => {
      const { p } = st.land(k);
      return <div key={k} style={{ position: "absolute", left: tx(hm(it.from)), top: top + k * rowH, width: (tx(hm(it.to)) - tx(hm(it.from))) * p, height: 84, borderRadius: 18,
        background: k === 0 ? "#FFFFFF" : "#BFD2FF", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 26px", color: t.brand, font: `800 30px ${t.body}`,
        whiteSpace: "nowrap", boxShadow: "0 14px 34px rgba(0,20,60,.28), inset 0 -5px 12px rgba(16,56,192,.16)" }}>{it.label}</div>;
    })}
    {ov && <>
      <div style={{ position: "absolute", left: tx(lo) - 8, top: top - 20, width: tx(hi) - tx(lo) + 16, height: rowH * c.items.length + 4, borderRadius: 22,
        border: `5px solid ${t.accent}`, background: `${t.accent}24`, opacity: ov.p, transform: `scale(${0.92 + 0.08 * ov.p + 0.03 * ov.s})` }} />
      <div style={{ position: "absolute", left: (tx(lo) + tx(hi)) / 2, top: top - 72, transform: `translate(-50%,0) scale(${ov.p})`, padding: "6px 18px", borderRadius: 999,
        background: t.accent, color: "#fff", font: `800 28px ${t.body}`, whiteSpace: "nowrap" }}>{c.overlap!.label}</div>
    </>}
  </div>);
};

const Cards: React.FC<{ c: Of<"cards"> }> = ({ c }) => {
  const t = useTheme(), st = useCue(), n = c.tags.length, step = beatValue(c.step, st.meter, 0);
  return (<div style={{ position: "absolute", inset: 0, opacity: st.out }}>
    {c.tags.map((tag, i) => {
      const { p, s } = step ? st.land(i * step) : { p: Math.max(0, Math.min(1, st.p * 1.3 - i * 0.12)), s: st.s };
      const dx = (i - (n - 1) / 2) * 120, rot = (i - (n - 1) / 2) * 7, w = 270;
      return <div key={i} style={{ position: "absolute", left: (c.x ?? 960) + dx, top: c.y ?? 640, width: w, height: w * 1.3, borderRadius: 16, padding: 26, overflow: "hidden",
        transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${0.6 + 0.4 * p + 0.04 * s})`, opacity: Math.min(1, p * 2),
        background: "linear-gradient(160deg,#FFFFFF 0%,#EEF3FC 100%)", boxShadow: "0 24px 50px rgba(0,20,60,.30)" }}>
        <div style={{ position: "absolute", right: 0, top: 0, width: 54, height: 54, background: "linear-gradient(225deg,#C9D6F2 50%,transparent 50%)" }} />
        <div style={{ display: "inline-block", padding: "5px 14px", borderRadius: 8, background: t.brand, color: "#fff", font: `700 22px ${t.body}` }}>{tag}</div>
        {[0, 1, 2, 3, 4, 5].map((j) => <div key={j} style={{ height: 14, borderRadius: 7, background: "#D3DBE6", marginTop: 22, width: `${92 - ((j * 19) % 40)}%` }} />)}
      </div>;
    })}
  </div>);
};

const Beam: React.FC<{ c: Of<"beam"> }> = ({ c }) => {
  const st = useCue(), E = st.fAt(beatValue(c.beats, st.meter, 2));
  if (st.f < st.A || st.f > E + 6) return null;
  const top = c.top ?? 300, bottom = c.bottom ?? 880, y = top + (bottom - top) * tween(st.f, st.A, E - st.A, ease.inOut);
  return (<div style={{ opacity: st.out }}>
    <div style={{ position: "absolute", left: 0, right: 0, top, height: y - top, background: "linear-gradient(180deg, rgba(91,134,255,0) 0%, rgba(91,134,255,.18) 100%)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: y - 3, height: 6, background: "#BFD2FF", boxShadow: "0 0 30px 10px rgba(120,160,255,.85)" }} />
  </div>);
};

const Ripples: React.FC<{ c: Of<"ripples"> }> = ({ c }) => {
  const st = useCue(), x = c.x ?? 960, y = c.y ?? 600;
  return <>{Array.from({ length: c.count ?? 3 }).map((_, i) => {
    const k = tween(st.f, st.A + i * 5, 34); if (k <= 0 || k >= 1) return null;
    const r = k * 1100;
    return <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `${Math.max(1, 6 - i)}px solid ${st.onDark ? "#fff" : "rgba(31,59,255,.6)"}`, opacity: (1 - k) * 0.8 * st.out }} />;
  })}</>;
};

const Wipe: React.FC<{ c: Of<"wipe"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  const k = tween(st.f, st.A - st.lead, st.lead, ease.inOut);             // fully covered exactly on the beat
  return <AbsoluteFill style={{ clipPath: k >= 1 ? undefined : `circle(${k * 2300}px at ${c.x ?? 960}px ${c.y ?? 600}px)`, background: background(t, c.to), opacity: st.out }} />;
};

const Logo: React.FC<{ c: Of<"logo"> }> = ({ c }) => {
  const t = useTheme(), st = useCue(), src = c.src ?? t.logo, w = c.width ?? 860, y = c.y ?? 470;
  const ring = tween(st.f, st.A - st.lead, 26, ease.inOut);
  return (<div style={{ position: "absolute", inset: 0, opacity: st.out }}>
    {c.rings !== false && <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      <g transform={`translate(${c.x ?? 960} ${y}) rotate(${-120 + 120 * ring})`}><ellipse rx={w * 0.66} ry={w * 0.18} fill="none" stroke={t.brand} strokeWidth={10} strokeDasharray={`${3600 * ring} 4000`} opacity={0.3} /></g>
      <g transform={`translate(${c.x ?? 960} ${y}) rotate(${150 - 150 * ring})`}><ellipse rx={w * 0.71} ry={w * 0.2} fill="none" stroke={t.accent} strokeWidth={5} strokeDasharray={`${3800 * ring} 4200`} opacity={0.35} /></g>
    </svg>}
    {src ? <Img src={staticFile(src)} style={{ position: "absolute", left: (c.x ?? 960) - w / 2, top: y - w * 0.12, width: w, ...enterStyle(c.enter ?? "pop", st, undefined) }} />
      : <div style={{ position: "absolute", left: 0, right: 0, top: y - 70, textAlign: "center", font: `800 140px ${t.head}`, color: ink(t, st.onDark), ...enterStyle(c.enter ?? "pop", st, undefined) }}>PRAI</div>}
  </div>);
};

const Tagline: React.FC<{ c: Of<"tagline"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  return <div style={{ position: "absolute", left: 0, right: 0, top: (c.y ?? 690) - 30, textAlign: "center", font: `700 ${c.size ?? 56}px ${t.body}`, color: ink(t, st.onDark),
    letterSpacing: "-1px", ...enterStyle(c.enter ?? "rise", st, c.exit) }}>{c.text}</div>;
};

const Marquee: React.FC<{ c: Of<"marquee"> }> = ({ c }) => {
  const t = useTheme(), st = useCue(), B = useBeats(), f = useCurrentFrame();
  const d = stepped(f, B.fpb, 54) * (c.dir === "right" ? 1 : -1);
  return <div style={{ position: "absolute", left: (c.x ?? 120) + d, top: (c.y ?? 150), font: `800 ${c.size ?? 260}px/1 ${t.head}`, color: "transparent", whiteSpace: "nowrap",
    WebkitTextStroke: `3px ${st.onDark ? "rgba(255,255,255,.18)" : "rgba(31,59,255,.14)"}`, letterSpacing: "-4px", opacity: Math.min(1, st.p * 2) * st.out }}>{c.text}</div>;
};

const Orbs: React.FC<{ c: Of<"orbs"> }> = () => {
  const st = useCue(), g = useGroove();
  const orb = (x: number, y: number, r: number, k: number, c1: string) => (
    <div key={`${x}`} style={{ position: "absolute", left: x - r, top: y - r - g.hit(k) * 18, width: 2 * r, height: 2 * r, borderRadius: "50%",
      background: `radial-gradient(circle at 32% 28%, #FFFFFF 0%, ${c1} 22%, #2443D8 70%, #001A55 100%)`, boxShadow: `0 ${r * 0.35}px ${r * 0.8}px rgba(0,20,60,.30)`, opacity: 0.55 * Math.min(1, st.p * 2) * st.out }} />);
  return <>{orb(1660, 230, 130, 0, "#9DB4EE")}{orb(250, 880, 92, 0.5, "#BFD2FF")}{orb(1500, 930, 58, 0, "#9DB4EE")}</>;
};

const Ribbons: React.FC<{ c: Of<"ribbons"> }> = () => {
  const st = useCue(), f = useCurrentFrame();
  const path = (k: number, amp: number, y0: number) => {
    let d = "";
    for (let x = -100; x <= 2020; x += 40) { const y = y0 + Math.sin(x / 420 + f / 26 + k) * amp + Math.sin(x / 170 + f / 17 + k * 2) * amp * 0.25; d += `${x === -100 ? "M" : "L"}${x},${y.toFixed(1)} `; }
    return d;
  };
  return (<svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: 0.6 * Math.min(1, st.p * 2) * st.out }}>
    <defs>
      <linearGradient id="rb1" x1="0" x2="1"><stop offset="0" stopColor="#5B86FF" stopOpacity="0" /><stop offset=".4" stopColor="#9DB4EE" /><stop offset="1" stopColor="#FFFFFF" stopOpacity=".2" /></linearGradient>
      <linearGradient id="rb2" x1="0" x2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".1" /><stop offset=".6" stopColor="#7FA2FF" /><stop offset="1" stopColor="#1038C0" stopOpacity="0" /></linearGradient>
    </defs>
    <path d={path(0, 120, 640)} stroke="url(#rb1)" strokeWidth={130} fill="none" strokeLinecap="round" opacity={0.55} />
    <path d={path(2, 90, 760)} stroke="url(#rb2)" strokeWidth={70} fill="none" strokeLinecap="round" opacity={0.6} />
    <path d={path(4, 150, 420)} stroke="url(#rb2)" strokeWidth={26} fill="none" strokeLinecap="round" opacity={0.45} />
  </svg>);
};

const Credits: React.FC<{ c: Of<"credits"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  return <div style={{ position: "absolute", left: 0, right: 0, bottom: 1080 - (c.y ?? 1036), textAlign: "center", font: `500 24px/1.6 ${t.body}`, color: sub(t, st.onDark),
    opacity: st.p * st.out }}>{c.lines.map((l, i) => <div key={i}>{l}</div>)}</div>;
};

const Stat: React.FC<{ c: Of<"stat"> }> = ({ c }) => {
  const t = useTheme(), st = useCue();
  const v = Math.round(interpolate(st.f, span(st.A, st.fAt(2)), [0, c.value], { ...clamp, easing: ease.out }));
  return (<AbsoluteFill style={{ background: `rgba(240,244,248,${0.8 * Math.min(1, st.p * 2) * st.out})`, alignItems: "center", justifyContent: "center" }}>
    <div style={{ padding: "44px 60px", borderRadius: 28, background: "#fff", boxShadow: "0 30px 80px rgba(0,37,84,.25)", textAlign: "center", ...enterStyle(c.enter ?? "pop", st, c.exit) }}>
      <div style={{ font: `700 30px ${t.body}`, color: t.brand }}>{c.title}</div>
      <div style={{ font: `800 96px/1.15 ${t.head}`, color: t.ink, margin: "8px 0 26px", fontVariantNumeric: "tabular-nums" }}>
        <span style={{ color: t.danger }}>{v.toLocaleString()}{c.suffix}</span></div>
      {c.items && <div style={{ display: "flex", gap: 22, justifyContent: "center" }}>{c.items.map((it, i) => {
        const { p } = st.land(1 + i * 0.5), col = toneColor(t, it.tone ?? "info");
        return <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)`, display: "flex", alignItems: "center", gap: 16, padding: "16px 28px", borderRadius: 18,
          border: `2px solid ${col}55`, background: `${col}12`, color: col }}>
          <b style={{ font: `800 60px/1 ${t.head}` }}>{it.value}</b>
          <span style={{ font: `700 28px/1.25 ${t.body}`, textAlign: "left" }}>{it.label}{it.sub && <><br /><i style={{ fontStyle: "normal", fontWeight: 500, fontSize: 22 }}>{it.sub}</i></>}</span></div>;
      })}</div>}
      {c.note && <div style={{ font: `600 26px ${t.body}`, color: t.ink2, marginTop: 26 }}>{c.note}</div>}
    </div>
  </AbsoluteFill>);
};

const ScreenBlock: React.FC<{ c: Of<"screen"> }> = ({ c }) => {
  const st = useCue();
  const k = tween(st.f, st.A - st.lead, st.lead, ease.inOut);             // grows for one beat, lands on the cue's beat
  return <div style={{ position: "absolute", inset: 0, transformOrigin: "960px 1080px", transform: `translateY(${160 * (1 - k)}px) scale(${0.3 + 0.7 * k})`, opacity: Math.min(1, k * 4) * st.out }}>
    <ShotScreen shot={c.shot} /></div>;
};

export const BLOCKS: { [K in Cue["block"]]: React.FC<{ c: Of<K> }> } = {
  title: Title, kicker: Kicker, counter: Counter, chips: Chips, bars: Bars, cards: Cards, beam: Beam, ripples: Ripples, wipe: Wipe, logo: Logo,
  tagline: Tagline, marquee: Marquee, orbs: Orbs, ribbons: Ribbons, credits: Credits, stat: Stat, screen: ScreenBlock,
};
