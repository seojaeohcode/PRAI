# How PRAI itself was built — the review ledger

PRAI was built the way it tells you to build videos: Claude Code wrote everything, Codex (`gpt-6-astra`, read-only)
reviewed in four planned rounds, and every finding got a decision. Effort: `xhigh` for all four (design, references,
code, final). The round cap was set to 4 at the start of round 2, when the reference library was added to the scope.

## Round 1 — design (xhigh)

Input: a detailed record of how the croScan promo was made, and the PRAI design draft.

| finding | decision | why / what changed |
|---|---|---|
| Cut v0.1 to "JSON → one example renders"; defer capture, beat analysis, TTS, review automation | **partial** | the goal was a complete system, so nothing was cut — instead every step has a fallback (the quickstart renders with generated music and estimated voice timing, no downloads) |
| Accents must be global (the old `Screen` used `frame % 4 beats` per scene) | accept | `accentOf` uses global beats and the song's downbeat |
| Separate anticipate → hit → settle → hold per element type | accept | `arrive` / `settle` / `depart` + per-block lead in `src/motion/meta.ts` |
| One rounding place `F(b) = round(fps · 60b/bpm)` | accept | `frameOfBeat`; scenes start at `F(start)`, local frames are differences |
| References as objects, union only within a shot, auto length rules, overlap checks | partial | `"shot.key"` strings kept for brevity (agents write JSON), plus lists and `{box}`; auto length covers voice, cues, marks; lint checks overlaps |
| Cursor continues from the previous click; labels placed where they fit; no permanent 0.6 % punch; smaller pop | accept | one cursor per scene; label side search; pop 1.3 → 1.12 |
| Bottom screenshot layer opaque, only the new one fades | accept | `Screen` layers |
| **The song is 135 BPM, not 136** | accept | confirmed independently by PRAI's analyser (135.00); the croScan video drifted ~1 beat by its end |
| Licence wording for Remotion, edge-tts, CC BY music, OFL, Playwright, croScan screens | accept | NOTICE + README; croScan screens left out of the repo |
| Trust boundary for `command` TTS and JS capture | accept | documented; `{text}` banned from shell templates in round 3 |

## Round 2 — reference library + code (xhigh)

Triggered by a new request: let users (and AI) collect references, catalogue techniques, and pick only the effective ones.

| finding | decision | why / what changed |
|---|---|---|
| A technique is not a block: add kind (primitive/recipe), status, conflicts | accept | `library/techniques.json` (38 cards: supported / combo / custom) |
| Keep what was seen apart from why it works; uploader ≠ author; status is not enough | partial | observations have `t`, `technique`, `what`; `uploader` kept as `author` from oEmbed for now |
| Scene purpose before scoring (problem / proof / benefit / brand / cta) | accept | `purpose` on scenes |
| Score applied techniques, hard fails first, compare with doing nothing, budgets, one signature motif | accept | `library/rubric.md`, enforced by `prai refs check` |
| Research results are not watching; candidates until observed; don't download | accept | `refs research` adds `candidate`s; evidence must be a watched observation |
| 8 code bugs: invalid times passed the schema; `auto` missed staggered content; two lines started together; close clicks crashed; 4/4 hard-coded in blocks; `screen`/`wipe` broke the arrival contract; demo coordinates ignored output size; swaps unsorted | accept (all) | schema checks; `cueEnd` registry; lines follow each other; click spacing; `st.meter`; per-block lead; 1920×1080 design space scaled uniformly; sorted swaps, `fade: 0` = cut |

## Round 3 — code after rendering (xhigh), plus two frame reviews through `prai review`

The Excalidraw example was reviewed with PRAI's own command (`prai review excalidraw frames`, high):
round 1 caught a real bug (the contact sheet composition was 1 frame long, so `<Freeze>` showed frame 0 in every cell);
round 2 asked for close-ups on the style panel and the export buttons. Both are in
[projects/excalidraw/reviews/ledger.md](../projects/excalidraw/reviews/ledger.md).

The code review found:

| finding | decision | what changed |
|---|---|---|
| P1 shell injection through `{text}` in `voice.command` | accept | `{text}` is rejected; the line goes through `{textfile}` only |
| P1 capture: sibling-prefix path escape, `../` in shot names, bad `%` crashes, server left running if the browser fails | accept | `path.relative` boundary, shot names `[\w-]+`, 400 on bad URIs, cleanup on launch failure |
| P1 inputs that pass the schema but crash rendering (`maxChars: -1`, `roll: 0`, `typing.done ≤ at`, `fps: 1`) | accept | schema limits; zero-length spans finish at once (`span()`); lint errors |
| P1 loudnorm second pass with `-inf` measurements on silence | accept | finite checks; silence is left alone |
| P1 review rounds double-counted (`.prompt.md`), research used the budget, Windows `.cmd` spawning | accept | rounds counted from the ledger; research saved apart; `.cmd` shims quoted, binaries spawned directly |
| P1 stale lock: another track's BPM, voice recorded with other settings, `grid.bpm` ignored | accept | lock dropped on file/hash/voice-hash mismatch; solver ignores a lock for another track |
| P2 groove picked the wrong beat at rounded frames; trimmed energy shifted bars | accept | beat chosen by `frameOfBeat`; energy keeps the song's bar numbers (`barOffset`) |
| P2 camera: same-frame keys, `move: 0`, square pages cropped, label size vs placement | accept | keys merged, `move: 0` = 1-frame cut, `full` letterboxed to the frame's aspect, labels sized and placed at the landing frame and clamped |
| P2 click filter dropped chains of clicks | accept | compared with the last kept click; lint reports clicks < 3 frames apart |
| P2 ripples/beam lifetimes missing from `auto` | accept | frame lifetimes in `cueEnd`; exits respect `out` |
| P2 oEmbed failures treated as dead links; research JSON unchecked | accept | only 404/400 are dead; zod validation; 8 s timeout |
| P2 alignment metric used ideal beats, not rendered ones | accept | nearest `frameOfBeat`; n/a when nothing changes; worst sorted |
| `agents.json` keys that no kind used; `final` not applied | accept | `final` applies to the last allowed round automatically |
| Docs: trust boundary text for the README | accept | "Trust and licences" section |
| 5 edge-case tests | accept | 12 engine tests now (frame tiling, schema limits, stale lock, ducking/ripples, camera keys) |

## Round 4 — final regression (xhigh, the last round)

Codex re-checked every round-3 fix in the code (all P1s confirmed, groove/camera/click/lifetime/oEmbed/alignment fixes confirmed),
re-ran the 12 tests, compared the docs with the code and looked at the three contact sheets. As the last round, everything it
listed as "fix now" was fixed, then the work stopped.

| finding | decision | what changed |
|---|---|---|
| P1 `codex exec … -i sheet.png -`: the stdin `-` can be read as another image | accept | `--` before `-`; verified with a real call (one image + stdin prompt) |
| P1 switching voice provider kept old takes; `--no-voice` still played recordings | accept | `file` takes hashed with their content; provider switches invalidate; `--no-voice` clears the voice lock for check and render |
| P2 generated JSON schema out of date; `minBeats: 0` allowed a 0-frame scene | accept | `npm run schema`; `minBeats ≥ 1` |
| P2 the `screen` block still cropped non-16:9 pages | accept | shares `fullWindow` with the camera |
| P2 PRAI video: the "`at`: a beat" mark pointed at the music lines; terminal zoom cut the result | accept | spec page rebuilt from the real spec with the intro's cues as their own lines; one measured block per command, wrapped |
| P2 Shipnote said "Drafted from 6 PRs" after 5 PRs + 1 manual note | accept | label "5 PRs + 1 note"; the app's footnote and the note row changed; recaptured |
| P2 README example missing `until`; `refs pick` in the help; NOTICE synth command; `swaps.fade` unit | accept | fixed |
| P2 claims beyond what is guaranteed ("30 seconds", "no downloads", tempo-changing tracks, "refs check enforces the rubric") | accept | 35 s; no *music* download, TTS is online; steady tempo only; `refs check` = structural rules, scoring is the director's |
| P2 music notice incomplete (excerpts are inside the committed MP4s) | accept | NOTICE lists both tracks, source links, CC BY 4.0 link, and the edits |
| P2 `.gitignore`: `.env.*`, `projects/*/refs/`, the `.gitkeep` exception that could not work | accept | rules rewritten |

**Known limits** (recorded, not fixed): macOS/Linux untested; no vertical layouts; Studio props must be regenerated
(`prai studio <p>`) after editing `prai.json`; beat alignment is a motion-detection metric (82 / 73 / 68 % on the three
examples — camera moves peak between beats by design); stills cannot approve voice sync or in-between frames; the Shipnote
tagline reading-time warning (2 s) is accepted for pace.
