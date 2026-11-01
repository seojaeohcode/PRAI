Three findings, ranked by severity. Beats below are scene-local.

1. **P2 · 0:18.67–0:21.37 · `style`, b2–8 — styling controls remain too small.** The full-height panel plus diagram forces a wide view; the highlighted controls are difficult to read. In [prai.json:46](../../../projects/excalidraw/prai.json:46), retain the initial camera key, then add:
   ```json
   {"at":3,"to":{"box":[16,76,195,340]},"pad":30},
   {"at":6,"to":"styled.all","pad":60}
   ```
   At line 47, set the mark’s `on` to that same box, `until: 6`, and `label: "Colours · strokes"`. This gives the controls a readable close-up, followed by the styled result.

2. **P2 · 0:23.57–0:26.70 · `export`, b3–10 — spotlight emphasizes settings rather than export actions.** `export.buttons` includes the entire right column, placing “One click” above the settings while PNG/SVG/clipboard remain small at the bottom. In [prai.json:54](../../../projects/excalidraw/prai.json:54), change `marks[0].on` to `{"box":[1091,680,340,40]}`. At line 53, append:
   ```json
   {"at":3,"to":{"box":[1091,680,340,40]},"pad":100}
   ```
   These coordinates target the action row visible in the captured screenshot.

3. **P3 · 0:01.80–0:02.70 · `intro`, b4–6 — headline has very little horizontal breathing room.** The completed sentence nearly spans the frame. The `|` separators reveal inline chunks; they do not create the three lines suggested by the plan. In [prai.json:20](../../../projects/excalidraw/prai.json:20), change the title’s `size` from `130` to `110` to give the existing single-line layout safer margins.

What is fine: the contact sheet now contains distinct frames, resolving round one. The flow diagram and arrow mark are clear; demo captions sit below the main subjects. The purple palette is consistent, and the closing URL is prominent.

No P1 issue is evident in these stills. Sound, motion smoothness, and unsampled frames are unverified. No files changed.