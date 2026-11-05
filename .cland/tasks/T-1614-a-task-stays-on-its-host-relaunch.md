---
id: T-1614
kind: task
title: A task stays on its host; relaunch elsewhere from the pushed branch
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1609
  - T-1613
  - T-1696
topic: topic-1395
branch: t/T-1614-a-task-stays-on-its-host-relaunch
created: 2026-11-02T03:33:58.847Z
updated: 2026-11-05T19:58:13.567Z
---

## Summary

A relaunch of an item session goes to its own host while that host's tunnel is up, and a request naming another host is refused. When the original host is down, gone or rebooted, `session.resume` with `relaunch` and a `host` field (frame only, no CLI flag) relaunches elsewhere. The new host fetches the pushed task branch and adds the worktree, and the branch's lease moves to it under the territory lock; uncommitted edits are lost, as with a local worktree.

Hot files: `hub/src/adapters/requests.ts`, `hub/src/adapters/sessions.ts`, `hub/src/host/branch-leases.ts`, `hub/test/host-relaunch.test.ts` (new)

## Acceptance criteria

- [ ] C1. A relaunch of a session whose host is up goes to that host and reuses its worktree, and a resume naming another host is refused with a reason saying the task stays on its host (test).
  - failed: rev-35 [reviewer] · 2026-11-05T19:37:27.910Z · note A returning source host after irreversible detach leaves its current row fenced without durable move admission or restored supervision.
- [ ] C2. After `fake-host.ts gone f1`, a relaunch with `host: "f2"` adds the worktree on f2 at the territory's pushed tip, and the session runs there (test).
  - failed: rev-35 [reviewer] · 2026-11-05T19:37:27.910Z · note Move admission/publication are not one durable owner, and native facade capability detection rejects the actual dependency hook.
- [ ] C3. The lease moves from f1 to f2 under the territory lock: f1's pushes to the branch are refused, and f2's succeed (test).
- [ ] C4. A resume frame without `host` behaves as today, and the session-resume test file passes with no test edited.

## Notes

Shared files: `hub/src/adapters/requests.ts` (`session.resume` gains `host`), `sessions.ts`, the lease API

## Comments

### impl-1614 · 2026-11-05T18:58:26.481Z

Rule 20 sweep recorded in docs/evidence/T-1614-consumers.md before production edits: resume frames, schema/dispatch, CLI/web/nvim/setup/spoke, permission consumers, lease and persisted worktree readers/writers, fixtures and all test tiers. Existing wire clients remain unchanged; new optional host only. C1 starts at public resume-frame seam; native C2/C3 at fake SSH/git socket seam per launch brief.

### impl-1614 · 2026-11-05T19:09:49.688Z

Progress evidence on uncommitted T-1614 tree (base e786b48fe), local macOS Node v24.21.0, no browser: host-relaunch-component.test.ts plus unedited session-resume.test.ts passed 3/3 generated cases (C1 live-host refusal/same-host placement; in-process Claude resume restores role/item claim/clause; refused in-process Codex resume offers fresh artifact brief). This is targeted T2 evidence only; no verify/full suite/load/container coverage yet. Native scripted-worker case has not passed: setup repaired, latest failure 'f1 carrier down receipt: not within 15000 ms' after gone-only trigger; now triggers authenticated kill-master then gone. T-1696 prerequisite blocks real adapter handoff and final verification per Coordinator.

### impl-1614 · 2026-11-05T19:29:32.508Z

Correction to my earlier progress comment and A-16912: I mislabeled the initial base as e786b48fe. Actual prepared worktree parent is 91202c2636aee931a3579c633b80158ec04d20db, verified from first core commit 68a16a03d63bf65b6bf1c3f879f7339c55aa30d6. Initial head is pushed and source review routed to rev-35. Evidence remains targeted local macOS only; final checks wait for T-1696.

### rev-35 · 2026-11-05T19:37:27.910Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1614-source-1
commit: 68a16a03d63bf65b6bf1c3f879f7339c55aa30d6
scope: full
findings: [{"severity":"high","text":"Spec: the old adapter is irreversibly released before move admission is durable, then the worktree admission callback rechecks whether f1 is down and can refuse after f1 returns. The current old row is left fenced without restored supervision or a durable completion owner. Persist exact-generation admission before detach; drain outside the territory lock and retain a resumable or explicitly fenced outcome.","file":"hub/src/adapters/sessions.ts","line":1738},{"severity":"high","text":"Spec / durable publication: #launchNew commits the f2 process before ready worktree state, old intent completion and the generation warning are saved separately. A crash/write failure leaves a positively launched generation with adding ownership and an old-key retry receipt that normal resume of the new row never finishes. Publish these facts under one durable completion owner/atomic checkpoint.","file":"hub/src/adapters/sessions.ts","line":1756},{"severity":"medium","text":"Spec / integration: the `in` membership test rejects T-1696's native facade, which exposes the hook with a proxy get trap and declare-only class field. Check the callable capability without requiring an own/prototype property; the current structural mocks hide this failure.","file":"hub/src/adapters/sessions.ts","line":1734},{"severity":"high","text":"Spec / retry ownership: the prepared retry compares only record strings and invokes reuseOnly, whose agent reservation path captures no checkout identity. It neither binds the directory/Git admin identity nor reconciles an advanced territory tip; an advanced tip permanently refuses, while a replacement checkout can reach reinstall. Coordinator 6fba53f3 moves this retry work to T-1698: remove retry execution/claims here and leave known failed admission fenced and reported.","file":"hub/src/host/task-worktrees.ts","line":71},{"severity":"medium","text":"Spec / onward ownership: after a known f2 native refusal, onward transfer overwrites the sole worktree/prepared record with f3 and leaves f2's confirmed checkout/ref-watch without a retained owner; no f2 native row exists in that refusal case. Coordinator 6fba53f3 moves onward transfer obligations to T-1698; this item must refuse such retry rather than discard f2 ownership.","file":"hub/src/host/task-worktrees.ts","line":75}]
finding_counts: {"high":3,"medium":2,"low":0}

Initial independent core not clear; A-16916 records standards/spec review and all five findings. Coordinator 6fba53f3 narrows the correction: T-1614 owns durable admission before detach, atomic native/ready/warning/completion, and known failed admission left fenced/reported. Advanced-tip/checkout identity and onward retry move to T-1698; remove unsafe retry execution/claims here rather than implementing them now. Unknown preparation recovery remains excluded. C3/C4 remain unverified pending native/compatibility evidence; no criteria verified. T-1696 integration, native/preservation/load/T0 and configured verification remain pending. Reviewer performed read-only source inspection only.

Criteria: C1 failed (A returning source host after irreversible detach leaves its current row fenced without durable move admission or restored supervision.), C2 failed (Move admission/publication are not one durable owner, and native facade capability detection rejects the actual dependency hook.).

### rev-36 · 2026-11-05T19:52:31.633Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1614-source-1
commit: 4fb421df4e66f168c9d5f1939fc80bba5e0cf6c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Requested preliminary core source clear, Standards/Spec no findings. Independent review from prepared parent91202c263; Coordinator6fba53f3 scope split applied. Prior five findings resolved in core: durable exact-generation intent before irreversible release; drain outside serial/territory locks; atomic native/ready/warning/intent completion with rollback and post-commit accepted-owner handling; callable Reflect capability; unsafe prepared/onward retry removed and known failure left adding/fenced/reported. Shared state keys/types, old optional-wire compatibility, docs/skill and consumer inventory inspected. A-16920: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16920-t-1614-corrected-core-source-review-at-4fb421df4.md . NO C1–C4 runtime marks. T-1696 forward-drain integration/authorized dev merge and fresh integrated source review still required BEFORE configured verify; direct adapter call here is preliminary only. Native success cleanup failure is not coverage; native rerun, unedited preservation, loaded Mac/Linux checks, final T0/allowances and configured evidence pending. T-1698 owns retry reconciliation. Reviewer ran no tests.

### impl-1614 · 2026-11-05T19:58:13.567Z

Preliminary core source clear at4fb421df4 (rev-36-1614-source-1,A-16920). Exact-head local macOS arm64 Node24.21.0 native scripted-worker rerun now exit0,2/2: running7.459533208s/refused6.649596875s,file14.448625375s,no burners/browser/duration gate. Joined publisher flush fixes earlier agent cleanup incompleteness; lock owner-checked/released. Native record artifact posted; loaded runner prep A-16921 is syntax/secret-scan-only, not executed. T-1696 integration and final evidence remain pending, no runtime criterion verification claimed.
