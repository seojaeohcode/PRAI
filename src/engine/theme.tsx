// Brand tokens and fonts. Pretendard (SIL OFL 1.1, see src/assets/fonts/OFL-Pretendard.txt) ships with PRAI;
// project fonts come from the project's public folder (theme.fonts). A font that fails to load stops the render
// instead of silently falling back.
import React from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import type { Spec } from "./spec";
import regular from "../assets/fonts/Pretendard-Regular.woff2";
import medium from "../assets/fonts/Pretendard-Medium.woff2";
import bold from "../assets/fonts/Pretendard-Bold.woff2";
import extra from "../assets/fonts/Pretendard-ExtraBold.woff2";

export type Theme = Spec["theme"] & { body: string; head: string };
export const ThemeCtx = React.createContext<Theme | null>(null);
export function useTheme(): Theme {
  const t = React.useContext(ThemeCtx);
  if (!t) throw new Error("useTheme outside <ThemeProvider>");
  return t;
}
export function makeTheme(t: Spec["theme"]): Theme {
  const stack = (f: string) => `"${f}", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif`;
  return { ...t, body: stack(t.font), head: stack(t.headFont ?? t.font) };
}
export const toneColor = (t: Theme, tone?: string) =>
  ({ brand: t.brand, accent: t.accent, warn: t.warn, danger: t.danger, ok: t.ok, info: t.info } as Record<string, string>)[tone ?? "warn"] ?? t.warn;

const loaded = new Set<string>();
/** loads Pretendard and the project's fonts once per page; the render waits for them */
export function useFonts(theme: Spec["theme"]) {
  const key = JSON.stringify(theme.fonts);
  const [handle] = React.useState(() => (loaded.has(key) ? null : delayRender("fonts")));
  React.useEffect(() => {
    if (handle === null) return;
    const faces: [string, string, number][] = [["Pretendard", regular, 400], ["Pretendard", medium, 500], ["Pretendard", bold, 700], ["Pretendard", extra, 800],
      ...theme.fonts.map((f) => [f.family, staticFile(f.src), f.weight] as [string, string, number])];
    Promise.all(faces.map(([family, url, weight]) => new FontFace(family, `url(${url})`, { weight: String(weight) }).load().then((ff) => (document as any).fonts.add(ff))))
      .then(() => { loaded.add(key); continueRender(handle); })
      .catch((e) => cancelRender(new Error(`font failed to load: ${e?.message ?? e}`)));
  }, [handle, key, theme.fonts]);
}
