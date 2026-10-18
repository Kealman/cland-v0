---
id: T-641
kind: task
title: cland init refuses a shallow clone with "the territory needs the full history" and the command that fetches it
state: open
status: review
size: XS
criterion_seq: 3
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-609
topic: topic-509
branch: t/T-641-cland-init-refuses-a-shallow-clone-with
created: 2026-10-16T16:23:57.093Z
updated: 2026-10-18T13:31:51.639Z
---

## Summary

Today a shallow clone fails deep inside the territory step with Git's "shallow update not allowed", after init has already written files. Init now checks first and refuses a shallow clone before writing anything, with the line "the territory needs the full history" and the command that fetches it (spec v0.1.4 §3.2; Q-600 resolution 6).

## What to build

- In `hub/src/cli/init.ts`, beside T-609's root checks and before `provision`: `git rev-parse --is-shallow-repository` in the target; `true` refuses with exit 1 and the line `cland init: the territory needs the full history: run git fetch --unshallow, then cland init again`.
- `cland update` on a shallow project with a territory refuses the same way; one without a territory is left to update as today.
- The hub README's init section names the refusal.

## Acceptance criteria

- [x] C1. `cland init` in a shallow clone exits 1 with a line holding "the territory needs the full history" and `git fetch --unshallow` (init-roots.test.ts, on ticket T-639's shallow clone).
  - done: impl-641 · 2026-10-18T13:06:54.295Z
- [x] C2. After the refusal the clone is byte-identical to before (ticket T-639's `snapshot`): no `.cland/`, no remote renamed, no file written.
  - done: impl-641 · 2026-10-18T13:06:54.723Z
- [x] C3. After `git fetch --unshallow` in the same clone, `cland init` succeeds and the territory holds `dev`.
  - done: impl-641 · 2026-10-18T13:06:55.199Z

## Comments

### impl-641 · 2026-10-18T13:03:39.152Z

Implementation started: use scratchMachine shallowClone and byte snapshots to prove preflight refusal and unshallow recovery before provisioning. Public seam is init/update; no host init runs.

### impl-641 · 2026-10-18T13:07:11.075Z

Source review requested at 73857d73, pushed to origin. Evidence A-5310. T1 roots 6/6 in 0.288 s; T3 init-machine file 3.508 s, added case 1.222 s; next-step contract 0.835 s. test:lint, typecheck, diff check passed. Coordinator-approved local-main fixture isolates shallow recovery from T-650/T-651 default-branch work. Await source verdict before one mode-free droplet verify.

### rev-30 · 2026-10-18T13:08:32.827Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-641-source
commit: 73857d73ca50497abd8c6e283095d9893560bffe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5311. Shallow check precedes provisioning/report writes, applies to init and territory-bearing update, and preserves undo/non-territory update. Required refusal/recovery text and README match spec. T1 tests inject the fact and snapshot all scratch state; existing T3 poisoned-HOME file carries bounded real clone→refusal→unshallow→init/dev proof under Coordinator's approved split. Local main normalization authorized by 348b3e97 preserves C3 while T-650/T-651 own general branch handling. A-5310 validation summary reviewed, diff check clean. C1–C3 await exact-head mode-free droplet evidence. No reviewer execution or new allowance.

### impl-641 · 2026-10-18T13:08:57.427Z

Source clear rev-20261018-641-source at 73857d73 (A-5311), no findings. Submitted one mode-free droplet verification baead1a4-65cc-4f7e-857d-849bdb0d150d, reporting to reviewer and item lead in topic-509. Head unchanged; waiting for hub result.

### impl-641 · 2026-10-18T13:31:05.112Z

Verification baead1a4 at reviewed 73857d73 failed: 2250 pass, 1 fail, 5 skip. Sole failure suite-accounting.test.ts:178 parallel-acquire spend cap test received budget.lock 60000 ms acquisition deadline rather than cap refusal. Shared-defect candidate reported to lead; holding diagnosis/head pending Coordinator disposition. T-641 roots cases and init-machine recovery self-test passed on Linux (0.318 s roots total; 1.944 s machine wrapper). Receipt A-5325; c-8 lon1 lifetime 1276 s, cost $0.0886.

### impl-641 · 2026-10-18T13:31:51.639Z

Coordinator classified first verification failure as unrelated, tracked T-802, and authorized one same-head retry under flaky rule. Submitted mode-free droplet run 2e327538-64a0-43b2-8027-cdb2f938a428 at unchanged reviewed 73857d73. Hold if suite-accounting.test.ts:178 repeats; Reviewer receives result directly.
