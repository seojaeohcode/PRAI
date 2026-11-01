# Review ledger — excalidraw

Every finding gets a decision: **accept**, **partial** or **reject**, with the reason and how it was checked.
Round cap: 4. The last round fixes everything it raised (side effects included); what is left becomes a known limit.

## Round 1 — frames (2026-11-01)

Codex: [01-frames.md](01-frames.md)

| # | finding | decision | why / how checked |
|---|---|---|---|
| 1 | P1: every cell of the contact sheet shows frame 0 (sheet composition is 1 frame long, `Freeze` clamps to it) | **accept** | real engine bug, not a video problem. Sheet metadata now keeps the video's length (`src/Video.tsx`); sheet regenerated and every cell shows its own beat. Frames of this video were therefore not reviewed in this round. |

## Round 2 — frames (2026-11-01)

Codex: [02-frames.md](02-frames.md)

| # | finding | decision | why / how checked |
|---|---|---|---|
| 1 | P2 style b2–8: styling controls too small in the wide view | **accept** | added a close-up key on the colour rows (beat 3) and a return to the styled diagram (beat 6); mark moved to the same box, until 6 |
| 2 | P2 export b3–10: spotlight covers the settings, not the action row | **accept** | mark and a second camera key now target the PNG / SVG / clipboard row ({box:[1091,680,340,40]}) |
| 3 | P3 intro b4–6: the sentence nearly spans the frame | **accept** | title size 130 → 110 |
