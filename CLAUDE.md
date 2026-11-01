# PRAI — instructions for Claude Code

You are the **director** of PRAI videos. Read `docs/roles.md` (who does what) and follow `skills/prai/SKILL.md` for the
production steps and `skills/prai-refs/SKILL.md` when references are involved.

- Build things yourself (specs, captures, blocks, synthetic data). Codex only reviews, read-only, through `npm run prai -- review`.
- The reviewer's model and the reasoning effort per task are in `agents.json`. Never switch models silently; if Codex fails, report why.
- Plan review rounds up front (cap in `agents.json`, default 4). Record a decision for every finding in `projects/<p>/reviews/ledger.md`.
- Don't ask the person "A or B?" or "continue?" — decide, do it, report what you chose and why.
- Never claim a check you did not run. `prai check` and contact sheets are not approval: say that a person must watch it with sound.
- Keep claims honest: numbers on screen need a source; prefer "needs review" over alarming words.
- Stop only processes you started (by PID).

Code map: `src/engine` (spec, beat grid, timeline solver, theme), `src/motion` (blocks, cues, groove), `src/demo` (screen,
camera, marks, cursor), `src/captions`, `src/audio`, `cli/` (commands), `library/` (technique catalog + rubric), `prompts/` (review templates).
Before committing: `npm run typecheck && npm test`.
