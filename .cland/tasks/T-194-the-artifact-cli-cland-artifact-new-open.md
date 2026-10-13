---
id: T-194
kind: task
title: "The artifact CLI: cland artifact new, open, keep, move, archive and
  promote, a folder promoted into the repository"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-195
parent: E-115
blocked_by:
  - T-193
topic: topic-118
branch: t/T-194-the-artifact-cli-cland-artifact-new-open
created: 2026-10-10T16:25:06.974Z
updated: 2026-10-11T08:57:59.477Z
---

## Parent

T-115, slice 5 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

`cland artifact new | open | keep | move | archive | promote`, including promoting a folder into the repository.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-195 · 2026-10-11T06:44:05.184Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-2 · 2026-10-11T06:46:03.758Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-3 · 2026-10-11T07:36:41.461Z
- [x] C2. Demo: the human creates a folder artifact from the shell and promotes it into `docs/`.
  - done: impl-195 · 2026-10-11T06:36:36.427Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-1 · 2026-10-11T06:42:36.311Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-2 · 2026-10-11T06:46:03.758Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-3 · 2026-10-11T07:36:41.461Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-195 · 2026-10-11T06:36:36.564Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-1 · 2026-10-11T06:42:36.543Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-2 · 2026-10-11T06:46:03.758Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-3 · 2026-10-11T07:36:41.461Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-195 · 2026-10-11T08:57:09.604Z
  - verified: rev-14 [reviewer] · run rev-20261011-194-4 · 2026-10-11T08:57:39.501Z

## Comments

### impl-195 · 2026-10-11T06:27:25.916Z

Claimed the artifact CLI slice. Implementing and testing through the existing cland CLI against a temporary project hub and its artifact frames, as prescribed by T-115. No Neovim UI change is planned.

### impl-195 · 2026-10-11T06:34:49.774Z

Implemented new (create alias), open, keep/release, move and archive CLI commands plus folder promotion. The CLI demo creates a folder, adds nested/binary files, promotes it into docs, and checks unchanged Git HEAD/index. Folder copy/index/authority failures roll back the entire destination. CLI refusal tests exposed an uncaught lifecycle authorization error; the handler now returns a result instead of stopping the daemon. No role clause changes. Typecheck and all 25 artifact lifecycle tests pass; remaining public CLI/frame regressions are running.

### rev-14 · 2026-10-11T06:42:36.706Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-194-1
commit: 2d8860f81e1cc27c17cbcc097c5c563f5cf18b97

Medium — hub/src/hub/dispatch.ts:772; hub/src/hub/artifact-lifecycle.ts:118: new recursive folder promotion inherits a protected-author check against captured caller.role. An Aide starting a human-folder promotion may become Coordinator during copy and still commit; a Coordinator starting it directly is forbidden. Use the current role at each authorization point and add CLI/frame transition coverage for refusal, unchanged metadata and full destination rollback.
Low Standards heuristic — hub/src/cli/artifact.ts:33: possible Repeated Switches across arity, allowed options and frame construction; optional command definition map.
Actual Dispatcher/Store/Lifecycle memory diagnostic confirms the medium finding. C1 failed; C2/C3 separately verified; C4 pending full package evidence. Standards: one low heuristic; Spec: one medium. Evidence A-1101 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1101-t-194-review-not-clear-at-2d8860f-protected-folder-current-role-authority.md.

Criteria: C1 failed (New folder promotion can commit a human artifact after an Aide becomes Coordinator during copy because protected provenance uses captured caller.role rather than current role.).

### impl-195 · 2026-10-11T06:43:44.517Z

Review rev-20261011-194-1 found C1's stale promotion-role check. Added a real CLI/frame regression for an Aide becoming Coordinator during human-folder copy; it failed with an unexpected successful promotion before the fix. Promotion now resolves current caller role before checking protected provenance on every authorization call. The regression checks forbidden, unchanged metadata, full partial-tree rollback, preserved sources and successful retry after restoring Aide authority. Current-head full-suite evidence will require a fresh run after the earlier pending run reports.

### rev-14 · 2026-10-11T06:46:03.758Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-194-2
commit: 2b4fa7d7aa4a1255b7d41ff00ac315f1e8ed6f27

No high or medium findings remain. A-1101 protected-folder authority gap is resolved: live current role now governs protected provenance, grant and admission checks at every promotion authorization point. Real frame regression checks Aide-to-Coordinator copy-time refusal, entire destination rollback, preserved source/metadata and authorized retry. Independent actual Dispatcher/Store/Lifecycle memory diagnostic confirms the correction. C1/C2/C3 verified; C4 pending complete current-head suite. Prior low optional CLI Repeated Switches heuristic remains unchanged. Incoming tracker/decision docs do not affect artifact behavior. Evidence A-1103 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1103-t-194-current-role-authority-correction-clear-at-2b4fa7d-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-195 · 2026-10-11T07:35:06.302Z

Coordinator authorized cancelling obsolete suite 676733d7. Verified PID 23295 and its job/start identity, then SIGTERM produced clean exit 143 and hub result A-1112; it is not C4 evidence. Fetched and merged current origin/dev before the final suite, advancing the pushed head to 8d45f225ea5951570bba106061e697732d87df69. No manual changes beyond the previously reviewed task patch; the current-role promotion fix remains intact. Requesting current-head review/C4 verification and submitting one fresh all suite.

### rev-14 · 2026-10-11T07:36:41.462Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-194-3
commit: 8d45f225ea5951570bba106061e697732d87df69

Standards: no new findings; carried low optional Repeated Switches heuristic at hub/src/cli/artifact.ts:33 remains unchanged.
Spec: no findings. T-185/T-205 integration preserves artifact CLI, recursive promotion, protected-author current-role checks and rollback. CLI/lifecycle/regression files are unchanged. Creation-chip placement refreshes current metadata while sent attachments retain publication facts; provenance and permissions remain unchanged. Upstream QA clause has exact T-185 handover lines.
C1–C3 reverified at this head. Actual Dispatcher/memory Store/ArtifactLifecycle diagnostic again confirms forbidden Coordinator control and copy-time role transition, rollback, unchanged metadata and authorized retry. HEAD/origin are pinned and worktree clean. C4 remains pending a complete current-head all suite; no exceptions. A-1112 is cancelled old-head evidence.
Evidence A-1114: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1114-t-194-t-185-t-205-integration-clear-at-8d45f22-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-195 · 2026-10-11T08:57:09.710Z

Final full suite 11e0a51a passed at unchanged clean head 8d45f225ea5951570bba106061e697732d87df69. A-1143 confirms typecheck, all 1159 hub tests and all 254 Neovim tests passed (1413 total, zero failures/cancelled/skipped). C4 marked done; requesting rev-14 verification from this complete current-head evidence. Durable log: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1143-suite-11e0a51a-7b9c-4748-9755-fa7a9b5dbc83-all-at-8d45f22.log.

### rev-14 · 2026-10-11T08:57:39.501Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-194-4
commit: 8d45f225ea5951570bba106061e697732d87df69

Standards: no new findings; carried optional low Repeated Switches heuristic at hub/src/cli/artifact.ts:33 remains nonblocking. Spec: no findings. Same-head A-1114 source/integration clearance remains applicable; no outstanding high or medium findings.
C4 verified from complete A-1143: hub/Neovim typecheck, hub 1159/1159 and Neovim 254/254; 1413 total, exit 0, zero failure/cancellation/skip/todo. No exceptions. Includes shell folder promotion demo and copy-time current-role refusal/rollback passing. C1–C3 retain rev-20261011-194-3 verification at this exact head.
HEAD/origin match the pinned SHA and worktree is clean. Evidence A-1144: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1144-t-194-final-c4-verification-clear-at-8d45f22-1413-tests.md.

Criteria: C4 verified.

### coord · 2026-10-11T08:57:59.477Z

Merged 0ed37748ad00a80b2ba2fec35cd3057841e246d4 onto dev.
