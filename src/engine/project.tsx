// What every component of a render can see: the solved timeline and the measured rectangles.
import React from "react";
import type { Rects } from "./spec";
import type { Timeline } from "./timeline";

export type Project = { tl: Timeline; rects: Rects };
export const ProjectCtx = React.createContext<Project | null>(null);
export function useProject(): Project {
  const p = React.useContext(ProjectCtx);
  if (!p) throw new Error("useProject outside <ProjectCtx>");
  return p;
}
