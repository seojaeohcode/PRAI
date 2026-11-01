# PRAI — instructions for coding agents (Codex and others)

PRAI turns a JSON spec into a beat-synced product video with Remotion. Code map: `src/engine` (spec schema, beat grid,
timeline solver), `src/motion` (blocks), `src/demo` (screens, camera, marks), `cli/` (commands), `library/` (technique cards).

**If you were called through `npm run prai -- review`, you are the reviewer**: read-only, find problems, never edit
files, never make the final call. The task-specific instructions are in the prompt (from `prompts/<kind>.md`). Roles and
rules: `docs/roles.md`. Settings (model, reasoning effort per task, round cap): `agents.json`.

If you are maintaining the code instead:
- Times in specs are beats; frames come only from `frameOfBeat` (one rounding place). Keep the CLI and the composition on the same solver (`src/engine/timeline.ts`).
- A block's lead and content end live in `src/motion/meta.ts`; update it when you add or change a block.
- Validate inputs in `src/engine/spec.ts` (zod) rather than guarding inside components.
- Run `npm run typecheck && npm test` before proposing changes.
