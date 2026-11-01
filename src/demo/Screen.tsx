// The product screen: screenshots in a device frame, seen through a camera window. Children are drawn in
// screenshot coordinates, so marks and cursors zoom with the page while their line widths stay constant on screen.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Box } from "../engine/geometry";
import { clamp } from "../engine/motion";
import { pageOf } from "../engine/timeline";
import { useProject } from "../engine/project";
import { useTheme } from "../engine/theme";

export const ScaleCtx = React.createContext(1);
export const useScreenScale = () => React.useContext(ScaleCtx);

export type Device = "browser" | "none";
import { frameRect, fullWindow } from "./camera";
export { frameRect };
const BAR = 40;

export type Layer = { shot: string; from: number; fade: number };

export const Screen: React.FC<{ win: Box; layers: Layer[]; device?: Device; url?: string; children?: React.ReactNode }> = ({ win, layers, device = "browser", url, children }) => {
  const t = useTheme(), { rects } = useProject(), page = pageOf(rects), f = useCurrentFrame();
  const R = frameRect(device), s = R.w / win.w;
  const body = (
    <div style={{ position: "relative", width: R.w, height: R.h, overflow: "hidden", background: "#fff" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: page.w, height: page.h, transformOrigin: "0 0", transform: `scale(${s}) translate(${-win.x}px, ${-win.y}px)` }}>
        {layers.map((l, i) => {
          // the bottom layer stays opaque; each later shot fades in over it from its own beat
          const o = i === 0 ? 1 : l.fade <= 0 ? (f >= l.from ? 1 : 0) : interpolate(f, [l.from, l.from + l.fade], [0, 1], clamp);
          if (o <= 0) return null;
          return <Img key={i} src={staticFile(`shots/${l.shot}.png`)} style={{ position: "absolute", left: 0, top: 0, width: page.w, height: page.h, opacity: o }} />;
        })}
        <ScaleCtx.Provider value={s}>{children}</ScaleCtx.Provider>
      </div>
    </div>
  );
  if (device === "none") return <AbsoluteFill>{body}</AbsoluteFill>;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: R.x, top: R.y - BAR, width: R.w, height: R.h + BAR, borderRadius: 18, overflow: "hidden", background: "#fff",
        boxShadow: "0 30px 80px rgba(0,37,84,.22), 0 4px 14px rgba(0,37,84,.10)" }}>
        <div style={{ height: BAR, background: "#E9EEF5", display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "1px solid #D3DBE6" }}>
          {["#F26B5B", "#F5BF4F", "#5CC26E"].map((c) => <i key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, display: "block" }} />)}
          {url && <div style={{ marginLeft: 18, flex: "0 1 560px", height: 24, borderRadius: 12, background: "#fff", color: t.ink2, font: `500 14px ${t.body}`,
            display: "flex", alignItems: "center", padding: "0 14px", whiteSpace: "nowrap", overflow: "hidden" }}>{url}</div>}
        </div>
        {body}
      </div>
    </AbsoluteFill>
  );
};

/** one shot, whole page, in the browser frame (used by the `screen` motion block to hand over into a demo) */
export const ShotScreen: React.FC<{ shot: string; device?: Device }> = ({ shot, device }) => {
  const { rects } = useProject(), page = pageOf(rects);
  const R = frameRect(device ?? "browser");
  return <Screen win={fullWindow(page, R.w / R.h)} layers={[{ shot, from: 0, fade: 0 }]} device={device} />;
};
