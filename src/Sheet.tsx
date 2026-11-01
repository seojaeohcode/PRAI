// A contact sheet in one still: the video frozen at many frames, each cell labelled (time · scene · beat).
// Used by `prai sheet` and by the Codex frame review.
import React from "react";
import { AbsoluteFill, Freeze } from "remotion";
import type { Props } from "./engine/spec";
import { solve } from "./engine/timeline";
import { PraiFrame } from "./Video";

export const PraiSheet: React.FC<Props> = (props) => {
  const tl = React.useMemo(() => solve(props.spec, props.lock), [props.spec, props.lock]);
  const sh = props.sheet ?? { frames: [0], cols: 1, labels: [""] };
  const W = 640, H = 360, sx = Math.min(W / tl.spec.video.width, H / tl.spec.video.height);
  const ox = (W - tl.spec.video.width * sx) / 2, oy = (H - tl.spec.video.height * sx) / 2;
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      {sh.frames.map((fr, i) => (
        <div key={i} style={{ position: "absolute", left: (i % sh.cols) * W, top: Math.floor(i / sh.cols) * H, width: W, height: H, overflow: "hidden", outline: "1px solid #000" }}>
          <div style={{ width: tl.spec.video.width, height: tl.spec.video.height, transform: `translate(${ox}px, ${oy}px) scale(${sx})`, transformOrigin: "0 0", position: "relative" }}>
            <Freeze frame={fr}><PraiFrame tl={tl} props={props} audio={false} /></Freeze>
          </div>
          <div style={{ position: "absolute", left: 0, top: 0, padding: "3px 8px", background: "rgba(0,0,0,.78)", color: "#FFE14D", font: "600 15px monospace" }}>{sh.labels[i]}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
