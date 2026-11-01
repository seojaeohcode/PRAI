// Two compositions: the video, and a contact sheet of it. Props come from `prai` (.prai/<project>/props.json);
// without them a tiny built-in spec renders so Studio always opens.
import React from "react";
import { Composition } from "remotion";
import { PraiSheet } from "./Sheet";
import { PraiVideo, calculateMetadata } from "./Video";
import type { Props } from "./engine/spec";

const hello: Props = {
  spec: {
    video: { title: "PRAI hello", lang: "en" },
    grid: { bpm: 120 },
    scenes: [
      { id: "hello", type: "motion", beats: 8, bg: "brand", cues: [
        { block: "marquee", at: 0, text: "PREVIEW AI · PREVIEW AI" },
        { block: "orbs", at: 0 },
        { block: "title", at: 1, text: "Run|`prai|init`", step: 1 },
        { block: "tagline", at: 4, text: "then point it at your product", y: 700 },
      ] },
    ],
  },
  lock: {},
  rects: {},
};

export const Root: React.FC = () => (
  <>
    <Composition id="PRAI" component={PraiVideo} defaultProps={hello} calculateMetadata={calculateMetadata} durationInFrames={1} fps={30} width={1920} height={1080} />
    <Composition id="PRAI-Sheet" component={PraiSheet} defaultProps={{ ...hello, sheet: { frames: [0, 30, 60, 90], cols: 2, labels: ["0", "1", "2", "3"] } }}
      calculateMetadata={calculateMetadata} durationInFrames={1} fps={30} width={1280} height={720} />
  </>
);
