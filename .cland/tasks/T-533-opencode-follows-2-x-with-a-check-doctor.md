---
id: T-533
kind: task
title: "OpenCode follows 2.x with a check: doctor messages per version and a release-time range check"
state: open
status: review
size: M
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-337
branch: t/T-533-opencode-follows-2-x-with-a-check-doctor
created: 2026-10-15T20:59:18.770Z
updated: 2026-10-15T23:43:57.030Z
---

## Summary

E-424 slice 3 (tracer step 3). The adapter follows OpenCode 2.x with a check. The doctor gives each version a fitting message, and a release-time check script re-verifies the tested range and moves its upper bound.

## What to build

See E-424's "The check at each release" and "What the doctor says per version" bullets.

- **Doctor messages per version.**
  - A 2.x inside the range passes.
  - A 2.x newer than the range is reported as newer than tested.
  - 1.x gets `opencode upgrade --major`.
  - A missing binary gets the v2 installer (`https://opencode.ai/v2/install`).
  - 3.x gets a refusal naming the tested range.
- **Check script.** It lives in the repository and is built from the research's `openapi-digest.mjs`, its event-name grep and its P1 probe. It fetches the newest 2.x OpenAPI document and compares the adapter's ten operations and its event names with the tested document. It also runs a smoke against the fake provider.
- **Pass or fail.** A pass moves the upper bound in `hub/src/doctor/ranges.ts` just above the newest version that passed. A failure keeps the range and files a Bug.
- **Release skill.** The script reaches the network, so it is never part of `npm test`. The `release` skill (`.claude/skills/release/SKILL.md` and the copy `cland init` writes) runs it before the dry run.

Code: `hub/src/doctor/toolchain.ts`, `hub/src/doctor/ranges.ts`, the research probes in `docs/research/opencode-v2/` on research/opencode-v2.

## Acceptance criteria

- [x] C1. With fake binaries reporting 1.19.0, a 2.x newer than the range and 3.0.0, and with none, `cland doctor` prints the `--major` upgrade, the newer-than-tested note, the refusal naming the range and the v2 installer.
  - done: impl-533 · 2026-10-15T23:42:58.316Z
- [x] C2. The check script compares the newest 2.x OpenAPI document's operations and event names with the tested one, runs the fake-provider smoke, and on a pass moves the range's upper bound.
  - done: impl-533 · 2026-10-15T23:43:32.727Z
- [x] C3. The check is not part of `npm test`, and the `release` skill (both copies) runs it before the dry run.
  - done: impl-533 · 2026-10-15T23:43:53.153Z

## Comments

### impl-533 · 2026-10-15T22:55:44.552Z

Implemented separate OpenCode version classification, v2 installer guidance and release-only network checker. Newest stable upstream is 2.0.30; read-only ten-operation wire comparison and all 15 adapter event names are compatible with 2.0.24. Offline CLI fixtures cover successful advancement and contract/smoke failures filing Bugs without changing the range. Hub typecheck is green. Waiting for the assigned Mac slot (after T-477) to run targeted files and isolated real-binary fake-provider smoke before review.
