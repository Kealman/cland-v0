---
id: T-253
kind: task
title: Fail fast on a serving-time tracker storage stall (T-103 follow-up)
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - hub
  - v0.1.2
  - ready-for-agent
assignee: null
parent: E-273
blocked_by: []
topic: topic-268
branch: t/T-253-fail-fast-on-a-serving-time-tracker
created: 2026-10-12T01:35:46.890Z
updated: 2026-10-15T04:45:54.246Z
---

## Parent

Follow-up to T-103 (v0.1.1). T-103 chose fail-fast over fencing tokens for a stalled tracker storage write. A native rename or link already handed to the OS can't be cancelled by an in-process token, so a late write could still publish. T-103 detects and reports stalls (`tracker-storage-stalled`, `hub status`) and bounds hub stop. It deliberately leaves out automatic termination during serving.

## What to build

When a tracker storage operation stalls past its deadline while the hub is serving, the hub fails fast. It logs the abandoned operation, tells sessions and the workbench, and exits non-zero, so a supervisor or the human restarts it, instead of queueing tracker work behind a write that may never finish.

## Acceptance criteria

- [x] C1. A held write past the fail-fast deadline during serving makes the hub exit with a clear error naming the operation and the item; a test proves it.
  - done: impl-253 · 2026-10-15T03:50:29.400Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-253-4 · 2026-10-15T04:45:52.164Z · commit 506796dd69df6260f5657ad80d36409dd8adcaae
- [x] C2. No tracker mutation admitted after the stall commits before the exit.
  - done: impl-253 · 2026-10-15T03:50:31.308Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-253-4 · 2026-10-15T04:45:52.165Z · commit 506796dd69df6260f5657ad80d36409dd8adcaae
- [x] C3. hub/README.md describes the behaviour and the restart path.
  - done: impl-253 · 2026-10-15T03:50:33.826Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-253-1 · 2026-10-15T03:52:30.138Z · commit b34ccb741d34cdb38daa018933951713a4f83b1e
  - verified: rev-23 [reviewer] · run rev-2026-10-15-253-3 · 2026-10-15T04:15:55.001Z · commit 506796dd69df6260f5657ad80d36409dd8adcaae
  - verified: rev-23 [reviewer] · run rev-2026-10-15-253-4 · 2026-10-15T04:45:52.165Z · commit 506796dd69df6260f5657ad80d36409dd8adcaae

## Comments

### impl-253 · 2026-10-15T03:47:58.337Z

Implementation freezes tracker admission/continuations synchronously at serving stall, logs a fatal diagnostic and broadcasts an Agents notice before shutdown. First real hub/spoke/CLI fail-fast regression passed; extending coverage per Coordinator decision to explicit outstanding-call rejection and both held/released native-write races. Acknowledged writes are checked through task.view after restart.

### rev-23 · 2026-10-15T03:52:30.138Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-253-1
commit: b34ccb741d34cdb38daa018933951713a4f83b1e
scope: full

Source clear at b34ccb741d34cdb38daa018933951713a4f83b1e. Standards and Spec: no high or medium findings. Fatal stop freezes admission and guarded native/index continuations synchronously before notification; active/queued callers receive operation/item stall errors and the real queue tail never advances on abandonment. Daemon publishes warning/Agents notice and stderr diagnostic, then closes; CLI bounds fatal cleanup and exits 1 even if the held operation returns. Already-issued native publication remains explicitly uncertain. New real foreground hub/UI/spoke/CLI regressions check both held and released native writes, exit/diagnostic, notifications, caller refusals, queued/late absence and acknowledged-write durability across restart. Ordinary bounded stop/detection coverage is retained. Reviewed against Coordinator c0d9b15c's completed/acknowledged versus outstanding-work interpretation. C3 README/restart path verified; C1/C2 remain run-dependent pending exact-head no-mode local verification. A-2666 records detailed review. Submit cland verify --executor local with no mode at this source-cleared head; no per-item QA required.

Criteria: C3 verified.

### rev-23 · 2026-10-15T04:15:01.474Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-253-2
commit: b34ccb741d34cdb38daa018933951713a4f83b1e
scope: evidence

Medium — hub/src/cli/hub.ts:14: eager STORAGE_STOP_MS import pulls tracker/index-db/node:sqlite into database-free hub commands; A-2675 proves hub status imports SQLite and loads 35 modules against unchanged budget 18. Keep the dependency in serve(), retain assertions/budgets, then request corrected-head source review. This import boundary was missed in A-2666 source review. Gate e7cba09b/A-2675 is not clear: typecheck passes; 1698/1700 hub cases pass, two cli-imports failures, exit 1, Neovim not reached. Both new held/released stall tests and ordinary bounded stop pass, but C1/C2/final gate remain pending. C3 source mark remains applicable. No unrelated-flake retry or assertion weakening; no C1-C3 failure inferred for this separate import contract. A-2676 records finding/evidence.

### impl-253 · 2026-10-15T04:15:28.212Z

Fixed gate e7cba09b's own-diff CLI import regression at 506796dd69df6260f5657ad80d36409dd8adcaae: moved STORAGE_STOP_MS import into serve(), preserving database-free hub commands and existing import budgets. Reproduced two failing import checks before fix; cli-imports now 3/3 (hub status 16 modules, budget 18), tracker-async 37/37 and typecheck green. Fresh origin/dev integrated; branch pushed. New source review requested before another gate.

### rev-23 · 2026-10-15T04:15:55.002Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-253-3
commit: 506796dd69df6260f5657ad80d36409dd8adcaae
scope: delta

Corrected source clear. Standards and Spec: no high or medium findings remain. The only source delta moves STORAGE_STOP_MS from eager import to dynamic import inside serve(), restoring the database-free command boundary; import tests and budgets unchanged. Tracker/daemon/journal behavior, tests and README remain unchanged. Incoming dev contains tracker metadata, stage QA briefs and the no-mode verification docs correction, no production/test delta. A-2677 reports cli-imports red 1/3 to green 3/3, hub status 16 modules under unchanged budget 18, no SQLite; tracker-async 37/37 and typecheck green. A-2678 records review. C3 refreshed; C1/C2 remain pending a new exact-head local no-mode gate. Earlier e7cba09b/A-2675 stays red on the now-corrected own import regression; no flaky retry used.

Criteria: C3 verified.

### impl-253 · 2026-10-15T04:45:38.029Z

Required local verification 47bc08d3-915d-4187-9d2a-4d9e967b5f40 passed at source-reviewed 506796dd69df6260f5657ad80d36409dd8adcaae: typecheck and 2087/2087 tests green, exit 0, full selection (hub plus Neovim), macOS arm64. Log A-2685: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2685-suite-47bc08d3-915d-4187-9d2a-4d9e967b5f40-auto-at-506796d.log. No source changes; awaiting exact-head final reviewer verdict.

### rev-23 · 2026-10-15T04:45:52.165Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-253-4
commit: 506796dd69df6260f5657ad80d36409dd8adcaae
scope: evidence

Final clear at unchanged source-reviewed 506796dd. Standards and Spec: no high or medium findings remain. A-2685/47bc08d3 local no-mode selects full: root typecheck and all 2087 tests pass (37 free hub, 1663 machine hub, 387 Neovim), zero failures/cancellations/skips/todos, exit 0. Both real foreground held/released stall regressions pass, establishing C1 actual non-zero exit/diagnostic and C2 frozen continuations, explicit active/queued refusals, absent later commits and acknowledged-write durability across restart. Ordinary bounded stop and both previously failed CLI import guards pass. C3 README/restart proof unchanged. All claimant done marks checked; branch/log/tracker head agree. Earlier e7cba09b/A-2675 remains red on the corrected own eager-import regression, followed by source review A-2678 and this new-head green gate; no flaky retry used. A-2686 details evidence and accepted uncertain already-issued native publication limit. C1-C3 verified.

Criteria: C1 verified, C2 verified, C3 verified.
