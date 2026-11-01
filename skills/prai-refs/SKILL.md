---
name: prai-refs
description: Build a reference library for a PRAI video — collect the videos the user loves (or research candidates on YouTube/Vimeo), watch them, write time-coded observations as technique cards, then pick only the techniques that pass the rubric and write style.json. Use when the user shares reference videos, asks for motion-graphics inspiration, or wants the video to "feel like" something.
---

# PRAI references: from "I like that video" to techniques that fit

The goal is not to copy a video. It is to name *how* it works (a technique), check that it fits this product,
and build it from the product's own material. Rubric: `library/rubric.md`. Catalog: `library/techniques.json`.

## 1. Collect
- The user's links first: `npm run prai -- refs add <p> <url> --note "what they like about it"` (title and channel come from oEmbed).
- Not enough? `npm run prai -- refs research <p> "<topic>"` — Codex searches the web and adds ~12 **candidates**.
  Candidates are unverified: search results and thumbnails are not watching. Prefer original sources (studio or brand channels).
  Good places to look: studio sites and their channels (e.g. BUCK, Ordinary Folk, Giant Ant), Motionographer, Stash;
  searches like `"<product category>" product launch motion`, `SaaS UI walkthrough animation`, `kinetic typography brand film`.

## 2. Watch and observe (the evidence)
For the 3 or so most different candidates:
- Open the video in a browser and watch it — with sound when rhythm matters. Note the part you actually watched.
- For each technique you see, add an observation to `projects/<p>/refs.json`:
  `{ "t": "0:12", "technique": "word-cut", "what": "three words cut on consecutive beats over a flat colour" }`
  Keep **what you saw** apart from **why you think it works**. Use catalog ids; for something new use a new id and add a card
  to `library/techniques.json` only after review.
- Set `status` to `analyzed`. If you could only see stills, say "rhythm not verified".
- Rights: store links, time codes and your own words. Do not download videos. Frames of other people's videos stay private
  working notes (never commit them, never put them in a public brief) unless you have permission.
- If you have a video file you may use: `npm run prai -- refs frames <p> <file> --id r3` makes a frame sheet.

## 3. Brief and pick
- `npm run prai -- refs brief <p>` → `out/<p>/refs-brief.md` (product scenes + refs + catalog + rubric).
- Decide per scene, with the rubric: hard fails first; then score; compare with doing nothing; ≤ 1 primary + 1 secondary per
  scene; 4–6 technique families per 30 s; at most 2 decorative transitions.
- Invent **one signature motif** from the product itself (a shape, a state, a word) and vary it 2–3 times.
- Write `projects/<p>/style.json` (adopted with evidence ids like `r2@0:14`, rejected with reasons).
- `npm run prai -- refs check <p>` enforces the structural rules (watched evidence with a time code, at most 1 + 1 per scene, a signature, a rejected list). Truth, rights and the score are your judgement. Optionally `npm run prai -- review <p> refs` for a Codex second opinion (counts as a round).

## 4. Apply
Turn each adopted technique into spec fields (the card's `prai` field says which block or combination), render, and look
at the sheet: if a technique does not make the scene clearer than the plain version, remove it.
