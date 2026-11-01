**P1 — Review blocker · 0:00.03–0:33.80 · all scenes / sampled beats · Contact sheet repeats frame 0.** Even `draw b4` (0:10.70) and `outro b10` (0:32.03) show the opening marquee, kicker and orbs. This does **not** establish that the video itself is frozen.

The cause is in [src/Video.tsx:17](../../../src/Video.tsx:17): sheet metadata sets `durationInFrames: 1`. The installed Remotion clamps requested frames to `durationInFrames - 1`, so the `<Freeze frame={fr}>` in [src/Sheet.tsx:18](../../../src/Sheet.tsx:18) resolves every sample to frame 0.

**Concrete fix:** set the sheet metadata’s `durationInFrames` to `Math.max(1, tl.totalFrames)` and regenerate the sheet. **`prai.json` field/value: none**—a JSON adjustment cannot fix this renderer defect.

What is fine: the visible opening background has a coherent purple palette, and the orbs do not overlap the kicker. The oversized cropped marquee reads as decoration.

Actual scene text legibility, demo framing, beat landings and cross-scene consistency remain unverified. No additional visual fixes are justified by this sheet. No files changed.