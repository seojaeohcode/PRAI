# `prai.json` reference

One file per video: `projects/<name>/prai.json`. Your editor autocompletes it from `schema/prai.schema.json`
(regenerate with `npm run schema`). The source of truth is `src/engine/spec.ts`.

## Time

Inside a scene every time is a **beat**, counted from the scene's first beat (0):

| you write | means |
|---|---|
| `3` | beat 3 |
| `2.5` or `"5/2"` | the off-beat after beat 2 |
| `"2:1"` | bar 2, beat 1 (both 1-based; in 4/4 that is beat 4) |

Seconds appear only for audio: `music.trim`, measured voice lengths, subtitle timings. PRAI starts the song on a beat,
so beat 0 of the video is frame 0. Accents are global: bar 1 of the song is bar 1 everywhere.

A cue's `at` is when it **arrives**: it starts moving a few frames earlier (its lead) and lands on the beat.
`until` is an exclusive end: the cue is gone on that beat.

## Top level

| field | default | |
|---|---|---|
| `video` | `{ title, width: 1920, height: 1080, fps: 30, lang: "en" }` | everything is laid out in 1920×1080 and scaled to the output |
| `theme` | blue brand | `brand`, `brand2`, `ink`, `ink2`, `ground`, `accent`, `ok`, `warn`, `danger`, `info`, `font`, `headFont`, `fonts[]` (`{ family, src, weight }` from `public/`), `logo` |
| `music` | — | `src` (in `public/`), `url` (for `prai music`), `credit`, `bpm`/`offset`/`downbeat` (override the analysis), `meter` 4, `trim` (s), `bed` 0.34, `duck` 0.14, `fadeOutBeats` 4 |
| `grid` | — | `{ bpm, meter }` for a silent video (`music` or `grid` is required) |
| `voice` | edge | `provider` `edge` / `command` / `file`, `voice`, `rate`, `pitch`, `command`, `lead` `"1/2"` (beats before a demo line starts), `tail` 1 (beats after) |
| `captions` | `{ headline: true, subtitles: false }` | `maxChars` per subtitle line (0 = 22 for CJK, 42 otherwise) |
| `timing` | `{ snap: 2, minBeats: 4 }` | `auto` scene lengths are a multiple of `snap` beats |
| `scenes` | — | at least one |

## Scenes (both kinds)

| field | |
|---|---|
| `id` | letters, digits, `-`, `_` |
| `type` | `motion` or `demo` |
| `purpose` | `problem` / `proof` / `benefit` / `brand` / `cta` (used by the reference rubric) |
| `beats` | a number, or `"auto"` (default): long enough for the voice + tail, every cue's content and `timing.minBeats` |
| `say` | a line, `{ text, at, id }`, or a list. Lines without `at` follow each other |
| `headline` | the scene's one-line message (pill at the bottom; a chip at the top when subtitles are on) |
| `transition` | `punch` (default: cut on the beat + 3 % punch-in) or `cut` |
| `cues` | motion blocks (also allowed over demo scenes) |
| `sfx` | `[{ at, src, volume }]` your own sound files |

### `motion` scenes

`bg` (`brand` / `light` / `dark`), `intensity` (`low` / `medium` / `high`: how hard accents hit), `cues`.

### `demo` scenes

| field | |
|---|---|
| `shot` | the first screenshot (`public/shots/<shot>.png`) |
| `device` | `browser` (frame with an address bar) or `none` (full bleed) |
| `url` | text in the address bar |
| `camera` | `[{ at, to, pad, move }]` — `to`: `"full"`, `"key"` (in this scene's shot), `"shot.key"`, a list (their union) or `{ "box": [x, y, w, h] }`. Each move takes `move` beats (1) and lands on `at` |
| `marks` | `[{ at, until, on, label, tone, style, pad }]` — `style`: `box`, `spotlight`, `underline`. The label goes to the first side that fits in the camera window |
| `clicks` | `[{ at, on }]` — one cursor travels between clicks and touches down on the beat |
| `swaps` | `[{ at, shot, fade }]` — the next screenshot is complete on `at`; `fade` is in **frames** (default 4); `0` is a cut |
| `typing` | `[{ at, until, text, title, done }]` — a large card that types `text` until `done` |

## Blocks

Common fields: `at`, `until`, `enter` (`pop` `rise` `drop` `slide` `scale` `cut` `type`), `exit` (`fade` `cut` `sink`), `x`, `y`
(1920×1080 design space, centre-based).

| block | fields | notes |
|---|---|---|
| `title` | `text` (`"A\|B\|C"`), `step`, `size`, `color`, `align`, `weight` | one chunk per `step` beats; `enter: "type"` types it |
| `kicker` | `text`, `tone` | small pill label |
| `counter` | `from`, `to`, `roll`, `prefix`, `suffix`, `size`, `note` | rolls for `roll` beats and stops on the beat with a punch |
| `chips` | `items`, `step`, `tone` | glossy pills; `step` 0 = together |
| `bars` | `axis` `["08:00","13:00"]`, `ticks`, `items` `[{label, from, to}]`, `overlap {at, label}` | the overlap is computed from the items |
| `cards` | `tags`, `step` | a fan of document cards |
| `beam` | `beats`, `top`, `bottom` | scan line |
| `ripples` | `count` | rings from x/y |
| `wipe` | `to` | circle that covers the frame exactly on `at`; later cues sit on the new background |
| `logo` | `src` (default `theme.logo`), `width`, `rings` | |
| `tagline` | `text`, `size` | |
| `marquee` | `text`, `size`, `dir` | giant outline type stepping one notch per beat |
| `orbs` | — | glossy spheres bouncing on the groove |
| `ribbons` | — | flowing ribbons |
| `credits` | `lines` | small text at the bottom |
| `stat` | `title`, `value`, `suffix`, `note`, `items[]` | a result card over a dimmed frame |
| `screen` | `shot` | the product screen grows in over one beat: hand-off into the first demo |

## Files next to `prai.json`

| file | made by | |
|---|---|---|
| `capture.json` / `capture.mjs` | you | how to shoot the screens |
| `public/shots/*.png`, `rects.json` | `prai capture` | screenshots at 2× and element boxes in CSS px |
| `prai.lock.json` | `prai beat`, `prai voice` | measured BPM/first beat/bar phase/energy, voice files and lengths |
| `public/music/`, `public/voice/` | `prai music`, `prai voice` | not committed by default (licences) |
| `refs.json`, `style.json` | you / `prai refs` | references and the techniques you picked |
| `reviews/` | `prai review` | Codex answers, prompts, and the decision ledger |
