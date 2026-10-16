---
id: T-633
kind: task
title: cland config set writes one value of config.toml and refuses what the hub cannot read
state: open
status: review
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-390
branch: t/T-633-cland-config-set-writes-one-value-of
created: 2026-10-16T16:04:12.209Z
updated: 2026-10-16T16:12:24.226Z
---

## Summary

`cland config set <section.key> <value>` sets one value of `.cland/config.toml` through the hub and refuses a key or value the hub cannot read, so the onboarding records "I approve epic plans" as `plan.approval = "human"` and the stack's verification commands without a hand edit (spec v0.1.4 §3.5, §3.7).

## What to build

- **Keys.** Any key the managed config template writes, by its dotted path: `plan.approval`, `verification.workers`, `verification.droplet.regions` and the rest. The set of keys comes from the template and the config parser, never a second list, so the `[verification]` commands that "Verification for any stack" adds become settable with no change here. An unknown section or key is refused with the section's known keys.
- **Values.** Parsed as TOML, as `cland crew set` does: numbers, booleans and lists in TOML syntax, a bare word as a string. The candidate file is checked by the parser the hub uses at start. A value the parser today ignores without a word (a budget of the wrong type, say) is refused too: the command never writes a value the hub would not apply.
- **The write.** The managed file is rewritten through its template with every other value kept, as `cland update` keeps them, atomically, refusing when the file changed since it was read. A `config.toml` without the managed mark is the project's own: it is left unchanged and the refusal says so.
- **When it applies.** The output prints the value as the hub reads it and says whether it applies at once (the keys `cland hub reload` applies) or at the next hub start.
- **Who.** The human, the Coordinator and an Aide may run it from their shells; other roles are refused with a reason shown in Agents. `--json` prints `{key, value, applies}`. The usage text lists the command.

## Acceptance criteria

- [x] C1. `cland config set plan.approval human` writes `[plan] approval = "human"` and keeps every other value of config.toml, read back by the hub's config parser (new CLI test against a temporary project's hub).
  - done: impl-633 · 2026-10-16T16:11:59.697Z
- [x] C2. `cland config set verification.workers 3` and `cland config set verification.droplet.regions '["lon1"]'` write a number and a list that the parser reads back.
  - done: impl-633 · 2026-10-16T16:12:00.282Z
- [x] C3. An unknown section or key is refused with the section's known keys, and an invalid value (`plan.approval maybe`, `verification.workers 0`) with the parser's reason, config.toml unchanged.
  - done: impl-633 · 2026-10-16T16:12:00.986Z
- [x] C4. A value the parser would ignore silently (`verification.budget two`) is refused, config.toml unchanged.
  - done: impl-633 · 2026-10-16T16:12:02.396Z
- [x] C5. The output says whether the value applies at once or at the next hub start, matching what `cland hub reload` applies.
  - done: impl-633 · 2026-10-16T16:12:03.553Z
- [x] C6. The human, the Coordinator and an Aide may run it from their shells, while an Implementer, a Reviewer, QA and a Lead are refused (frame-protocol test).
  - done: impl-633 · 2026-10-16T16:12:05.203Z
- [x] C7. A config.toml without the managed mark is left byte-identical and the refusal says it is the project's own.
  - done: impl-633 · 2026-10-16T16:12:06.813Z

## Comments

### impl-633 · 2026-10-16T16:08:45.060Z

Implemented the CLI → config.set frame → hub settings write path. Writable keys derive from renderConfig (including optional droplet worker and visibility parser vocabulary); strict parser mode rejects legacy silently ignored values during writes. Startup-only keys report restart; reloadable writes attempt reload and report now only on success, otherwise saved/not-applied with the refusal. Initial CLI test is green; adding remaining acceptance/race/role coverage before review.
