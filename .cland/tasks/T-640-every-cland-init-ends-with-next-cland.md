---
id: T-640
kind: task
title: 'Every cland init ends with "next: cland setup", and --json carries next'
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-609
topic: topic-507
branch: t/T-640-every-cland-init-ends-with-next-cland
created: 2026-10-16T16:23:56.644Z
updated: 2026-10-18T13:00:48.324Z
closed: 2026-10-18T13:00:48.324Z
---

## Summary

`cland init` names the step after it: its last line is `next: cland setup`, and its `--json` report carries `"next": "cland setup"` (spec v0.1.4 §3.2, "What comes next"). `cland update` and `cland init --undo` print no such line.

## What to build

- In `hub/src/cli/init.ts`, after the report: the line `next: cland setup` for every `init` that provisions, and `next` in the JSON object beside `root`, `version` and `changes` (prototype/setup 5028220a holds the shape: a `NEXT` constant, so setup and the docs name the same command).
- A refused init (T-609's refusals, the shallow clone of the next ticket) ends with its refusal, not with the next step.
- The hub README's init section shows the closing line.

## Acceptance criteria

- [x] C1. `cland init` on a scratch folder prints `next: cland setup` as its last line, and `cland init --json` prints an object whose `next` is `cland setup` (init-roots.test.ts, on the scratch machine of ticket T-639).
  - done: impl-640 · 2026-10-18T12:34:30.601Z
  - verified: rev-30 [reviewer] · run rev-20261018-640-final · 2026-10-18T12:58:52.360Z · commit 3433a9e891a0fb85e09c3e347870d7354666b7b7
- [x] C2. `cland update` and `cland init --undo` print no `next` line and carry no `next` key in `--json`.
  - done: impl-640 · 2026-10-18T12:34:30.916Z
  - verified: rev-30 [reviewer] · run rev-20261018-640-final · 2026-10-18T12:58:52.360Z · commit 3433a9e891a0fb85e09c3e347870d7354666b7b7
- [x] C3. An init that T-609 refuses prints no `next` line.
  - done: impl-640 · 2026-10-18T12:34:31.343Z
  - verified: rev-30 [reviewer] · run rev-20261018-640-final · 2026-10-18T12:58:52.360Z · commit 3433a9e891a0fb85e09c3e347870d7354666b7b7

## Comments

### impl-640 · 2026-10-18T12:34:31.679Z

Implemented at 3433a9e891a0fb85e09c3e347870d7354666b7b7. Initial T2 init-next test failed on missing final next line; now covers first/repeated text+JSON init on scratchMachine. T1 init-roots covers no next on update/undo and no stdout on root refusals. Targeted files serial: init-roots 0.314s; init-next 0.882s. npm run test:lint and npm run typecheck passed after fetching/merging origin/dev (already current). README documents output. QA policy: none, after-stage.

### rev-30 · 2026-10-18T12:35:16.687Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-640-source
commit: 3433a9e891a0fb85e09c3e347870d7354666b7b7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5281. Init's final successful write alone includes NEXT in text/JSON; update/undo omit it and all refusal/error paths precede output. Fresh and already-current CLI init are tested in both formats, with in-process T1 update/undo/refusal controls and unchanged snapshots; established scratch-machine isolation and correct T2 CLI subject boundary retained. README matches spec §3.2. Local validation summary A-5280 reviewed; diff check clean. C1–C3 await exact-head mode-free droplet evidence. No reviewer execution or per-item QA.

### rev-30 · 2026-10-18T12:58:52.360Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-640-final
commit: 3433a9e891a0fb85e09c3e347870d7354666b7b7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, A-5304. Exact-head A-5303 hub-only plus Neovim smoke passes 2235 tests,0 failures/cancellations,5 prerequisite skips. Both changed files positively execute six ordinary cases, all six groups pass 30/30 repetitions. Fresh/repeated init text/JSON, update/undo omission and stdout-free unsafe-root refusal controls verify C1–C3 with unchanged source A-5281. Zero tier trips and no hard budgets. No reviewer execution or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-18T13:00:48.324Z

Merged e7bb37af2e898991be62c03f1cd8de7c8e5b2e76 onto dev.
