---
name: prai
description: Make a beat-synced product demo or launch video with PRAI — capture the real product, write the JSON spec (intro/outro motion graphics + zoomed demo scenes + captions + narration), render, check, and run capped Codex review rounds. Use when the user wants a demo video, promo, launch video, feature walkthrough or motion-graphics intro for their product.
---

# PRAI: produce a demo video

You are the **director**. Codex is the read-only reviewer. The person gives the goal and watches the result with sound.
Rules: `docs/roles.md`. Settings: `agents.json`. Work inside a PRAI checkout (`git clone https://github.com/seojaeohcode/PRAI`, `npm install`).

## 1. Understand the product (no questions you can answer yourself)
- What does it do, for whom, and what is the one feeling the video should leave? Read the product's README/site.
- Pick 3–5 moments that prove it (each becomes a demo scene). Give each scene a purpose: problem · proof · benefit · brand · cta.
- Write the narration as short lines (one per scene, ≤ 12 words in English, ≤ 30 syllables in Korean). No unverifiable numbers.

## 2. Capture the real screens
- `npm run prai -- init <name>` then edit `projects/<name>/capture.json`:
  - `url` (a running app) or `serve` (a folder), `locale`, `viewport` 1920×1080, `scale` 2.
  - `steps`: goto · click · fill · type · press · upload · wait · scroll · eval · `shot` with `rects` = `{ "key": "css selector" }`.
  - For canvas apps or complex flows use `"script": "capture.mjs"` and call `shot(name, selectors, boxes)`.
- `npm run prai -- capture <name>` → `public/shots/<shot>.png` + `rects.json`. Look at every shot before using it.

## 3. Music and voice
- `music.url` for a licensed track (+ `credit`), or `npm run prai -- music <name> --synth --bpm 120` for a CC0 groove.
- `npm run prai -- beat <name>`: BPM, first beat, bar phase (beat clarity < 2 → set `music.bpm/offset` by hand).
- `npm run prai -- voice <name>` (edge-tts by default; `voice.provider: "file"` for your own recordings).

## 4. Write `prai.json`
Times are **beats** inside each scene (`3`, `2.5`, `"5/2"`, `"2:1"`). Lengths are `"auto"` by default.
- **motion** scenes (intro/outro): `cues` of blocks — `title` (`"A|B|C"` + `step` = one chunk per beat), `kicker`, `counter`,
  `chips`, `bars` (+`overlap`), `cards`, `beam`, `ripples`, `wipe`, `logo`, `tagline`, `marquee`, `orbs`, `ribbons`, `credits`,
  `stat`, `screen` (hand-off into the first demo). Each cue: `at`, optional `until`, `enter` (pop/rise/drop/slide/scale/cut/type), `exit`.
- **demo** scenes: `shot`, `camera` keys (`to`: `"shot.key"`, a list = union, `"full"`, or `{box}`), `marks` (box/spotlight/underline + label),
  `clicks`, `swaps` (next screenshot on a beat; `fade: 0` = cut), `typing` (big typed card), optional `cues` overlays.
- `headline` per scene (≤ 20 Korean / 38 English characters), `say` for narration, `captions.subtitles` for spoken subtitles.
- Shape it like a song: intro 16–28 beats ending with `screen` → demos of 8–12 beats → outro 16 beats with the CTA held ≥ 2 beats.

## 5. Plan → review → render → review
1. `npm run prai -- plan <name>` (scene table + beat sheets) and `npm run prai -- check <name>`. Fix every error.
2. Round 1: `npm run prai -- review <name> storyboard` → decide each finding in `reviews/ledger.md`.
3. Round 2: `npm run prai -- review <name> beats` (xhigh).
4. `npm run prai -- render <name>` (renders + masters to −14 LUFS) → `npm run prai -- check <name>` (loudness, beat alignment).
5. Round 3: `npm run prai -- review <name> frames` (contact sheet attached).
6. Round 4 (last): fix everything raised, including side effects; record known limits; stop.
7. Tell the person exactly what was checked and that they must watch it once with sound.

## Useful
- `npm run prai -- studio <name>` — Remotion Studio with live props.
- `npm run prai -- sheet <name> --scene draw --every 1` — a sheet of one scene, beat by beat.
- `npm run prai -- gif <name> --from 0 --to 6` — a GIF for a README or a PR.
- References and technique picking: `skills/prai-refs/SKILL.md`.
