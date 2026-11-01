## How to choose (the rubric)

Score **a technique applied to a scene with its parameters** — never a technique in general.

**1. Hard fails (any one → drop it, no score can save it)**
- It contradicts a product fact, or shows something the product does not do.
- It needs an asset you have no right to use.
- PRAI cannot build it and there is no fallback (`status: custom` with nobody to build it).
- It covers the key information of the scene.
- The only evidence is an unwatched reference (`status: candidate`).

**2. Score (0–4 each, weighted; total = Σ weight × score / 4)**

| criterion | weight | question |
|---|---:|---|
| message fit | 30 | Does it make the scene's purpose (problem / proof / benefit / brand / cta) clearer? |
| legibility & focus | 25 | At the real output size, can the viewer find and read it? |
| time & beat fit | 15 | Is there time to land, read and leave? |
| brand & story | 15 | Does it fit the scenes around it and the product's character? |
| cost vs gain | 10 | Is the build/render cost worth it? |
| originality | 5 | Does it come from the product's own material? |

Subtract cognitive load (0–15) and needless cliché (0–10). **Adopt at ≥ 75** (a starting threshold — calibrate on your own videos).

**3. Always compare with doing nothing.** If you cannot say what the plain version loses, don't add the technique.

**4. Limits**
- Per scene: one primary technique + one secondary. Only one thing pulls the eye at a time.
- Per 30 seconds: 4–6 technique families, at most 2 decorative transitions.
- One **signature motif** for the whole video, made from the product's own material (a shape, a state, a word), varied 2–3 times. Never a reference's design.
- Conflicts: long text changing during a camera move; an important click under a wipe; two targets marked at once.
- Reading time starts when the element has landed: warn below `max(1.2 s, characters ÷ 8)` (tune per language).

**5. Evidence**
- Every adopted technique names its evidence: a watched reference observation (`r2@0:14`) or a catalog source, plus the product fact it serves.
- "I learned it from that video" needs an observation with a time code.
- Keep the rejected list with reasons. The same cliché under a new name counts as rejected.

**Output: `projects/<p>/style.json`**

```json
{
  "signature": { "name": "overlapping work bars", "from_product": "the app detects two jobs at the same time and place", "scenes": ["intro", "outro"] },
  "adopted": [
    { "technique": "word-cut", "scenes": ["intro"], "role": "primary", "evidence": ["r1@0:03", "catalog:word-cut"], "why": "the problem fits in three beats", "params": { "step": 1 } }
  ],
  "rejected": [ { "technique": "shape-wipe", "why": "already used once; a second time reads as a template" } ]
}
```

Check it with `npm run prai -- refs check <project>`.
