---
id: T-196
kind: task
title: "Epics close by QA (D16): criteria marks on containers, and task.close
  requires a clear QA verdict with every criterion verified"
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1
  - ready-for-agent
assignee: impl-196
parent: E-117
blocked_by: []
topic: topic-98
branch: t/T-196-epics-close-by-qa-d16-criteria-marks-on
created: 2026-10-10T16:41:01.014Z
updated: 2026-10-10T20:11:40.029Z
closed: 2026-10-10T20:11:40.248Z
---

## Parent

T-112 (Criteria that live). From D16 (the human, 2026-10-10): an epic closes when all its children are closed and QA has run its definition-of-done demo on dev with a clear verdict recorded on the epic, criteria verified by id, in the same gate shape as items.

## What to build

Today criteria operations refuse anything but a task (`criteria operations require a task`, tracker.ts). A container closes as soon as its children are closed, with no verdict check. D16 needs both to change:
- Criteria marks (verify and fail, done where it applies) work on containers (epics and releases), so a QA verdict on an epic can pass `--verified` with the epic's Definition-of-done checkbox ids.
- Closing an epic (`task.close` / `cland task close`) requires a current clear QA verdict on it with every criterion verified, in addition to no open children, and refuses naming what is missing. The human's `--override` skips it, logged as for merges.
- Releases keep their own path through `cland release --item` (T-117).

## Acceptance criteria

- [x] C1. QA can record `--verified C1,…` on an epic's clear verdict, and the epic's criteria show the marks.
  - done: impl-196 · 2026-10-10T17:29:37.065Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-1 · 2026-10-10T18:08:07.787Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-3 · 2026-10-10T18:17:22.684Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-4 · 2026-10-10T18:41:11.172Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-5 · 2026-10-10T19:38:29.444Z
- [x] C2. `cland task close T-<epic>` refuses without a current clear QA verdict with all criteria verified, naming the missing ones; it succeeds once they are present.
  - done: impl-196 · 2026-10-10T18:15:51.368Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-3 · 2026-10-10T18:17:22.684Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-4 · 2026-10-10T18:41:11.172Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-5 · 2026-10-10T19:38:29.444Z
- [x] C3. Closing an epic with open children still refuses as today.
  - done: impl-196 · 2026-10-10T17:29:37.509Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-1 · 2026-10-10T18:08:07.899Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-3 · 2026-10-10T18:17:22.684Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-4 · 2026-10-10T18:41:11.172Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-5 · 2026-10-10T19:38:29.444Z
- [x] C4. Docs (docs/agents/issue-tracker.md, docs/review-and-qa.md, the QA clause) describe epic closure by QA.
  - done: impl-196 · 2026-10-10T17:29:37.624Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-1 · 2026-10-10T18:08:07.996Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-3 · 2026-10-10T18:17:22.685Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-4 · 2026-10-10T18:41:11.172Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-5 · 2026-10-10T19:38:29.444Z
- [x] C5. `npm run typecheck && npm test` pass.
  - done: impl-196 · 2026-10-10T20:11:05.791Z
  - verified: rev-14 [reviewer] · run rev-20261010-196-6 · 2026-10-10T20:11:31.535Z

## Notes

High: it blocks closing epics under D16 the gated way. Until it lands, the Coordinator closes an epic by hand after QA's clear verdict on it lists the verified checkboxes in its text. Size S to M.

## Comments

### impl-196 · 2026-10-10T17:22:20.743Z

Claimed T-196. Implementing container criterion marks and epic close validation against a current hub-written QA verdict on dev, with every criterion verified. Preserve open-child refusal and release path; cover gate behavior through tracker/CLI integration tests.

### impl-196 · 2026-10-10T17:29:37.723Z

Container/epic behavior implemented; C1–C4 marked done. Nine epic-close regressions pass, including CLI/MCP marks, exact dev freshness, missing/partial QA, open children, audited human overrides, task.edit closure, concurrent commits, reopening failed demos, and hand-written/deleted verdict provenance. Hierarchy fixture updates pass targeted checks. Full typecheck + suite is still required before handoff.

### rev-14 · 2026-10-10T18:08:21.787Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-196-1
commit: f7b67f19c490758f67dd9ff45a76502eeaeafe8b

Medium — hub/src/tracker/tracker.ts:1507: configured second-level names such as initiative skip QA closure; close/edit, default verdict attribution and view/list/event freshness hardcode epic instead of the levels[1] role (T-119, T-196 C2).
Medium — hub/src/tracker/tracker.ts:1742: task.import open→closed writes check children/kinds but omit QA evidence, allowing an existing epic to close without the D16 gate or audited override.
Low (heuristic) — hub/src/tracker/tracker.ts:1351 and :1507: duplicated edit/close evidence refresh may drift; consider a shared helper.
Standards: one low heuristic, no additional documented breaches. Spec: two medium findings. Independently ran read-only container source guard: exit 1, pass 1/2, eleven literal violations; C5 cannot pass on this head. C1/C3/C4 verified separately by source/test inspection. No repository edits or disk-writing tests. A-701 contains both axes and evidence at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-701-t-196-review-at-f7b67f1-epic-qa-gate-bypasses.md.

Criteria: C2 failed (Literal epic gates bypass configured second-level containers; task.import can also close an existing epic without QA evidence.), C5 failed (Read-only tracker-container-source test fails at this head: 1/2 pass, with eleven literal epic violations.).

### impl-196 · 2026-10-10T18:10:45.866Z

Addressed rev-20261010-196-1 findings. Configured planning containers now use one tracker.levels[1] predicate consistently for close/edit, verdict default/response attribution and all freshness surfaces. Existing-container import closure now checks current dev QA against both the original and proposed criteria, refuses deletion of unverified criteria and preserves no-open-child validation. Shared epicCloseEvidence consolidates the build/source concurrency guard. Renamed/import targeted regressions, source guard (2/2) and typecheck pass. Full verification will be rerun on the corrected head after the earlier invocation ends.

### rev-14 · 2026-10-10T18:14:07.703Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-196-2
commit: b53a9138b162037a1980a3edc953682998456fe1

Medium — hub/src/tracker/tracker.ts:1333/:1350: task.edit {kind:'task',status:'done'} closes an open planning container without QA, because close/evidence guards only run for explicit state:'closed'. Actual Tracker memory-only reproduction: initiative/open with unverified C1 and zero verdicts became task/closed/done with zero verdicts. Derive closure intent/result including status:done, then guard original/proposed planning kinds.
Both A-701 findings and the low duplication suggestion are resolved. Independently source guard 2/2 passes; unchanged C1/C3/C4 marks carry forward. C5 remains unverified until fresh full suite completes. Standards: 0 findings; Spec: 1 medium. No filesystem writes or repository edits. A-707 includes the reproduction at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-707-t-196-re-review-at-b53a913-status-driven-closure-bypass.md.

Criteria: C2 failed (task.edit kind:task plus status:done closes an open planning container without QA; close guards only run for explicit state:closed.).

### impl-196 · 2026-10-10T18:15:52.130Z

Fixed rev-20261010-196-2 / A-707: edit now determines closure from the final resulting state, including status:done, and gates the original configured planning kind. The original source is captured before changes; evidence is prepared after body, kind, state, status and other fields are applied. Targeted status-conversion, explicit edit and renamed-level regressions pass 3/3, zero skips; typecheck passes. C2 marked done again. Full C5 remains pending on this corrected head.

### rev-14 · 2026-10-10T18:17:22.685Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-196-3
commit: 144ee9a03f684652858e8986f30592e15b98d21f

No remaining findings. hub/src/tracker/tracker.ts:1353 evaluates resulting closure after all edit fields/status, preserving the original planning kind/source. A-707's kind:task/status:done bypass is resolved. Independently exercised actual Tracker using memory-only filesystem/SQLite in default and renamed hierarchies: missing QA and open children refuse with source unchanged; current QA verifying all criteria permits conversion. A-701's configured-role and import-original/proposed criteria fixes carry forward; low duplication resolved. Standards: 0 findings; Spec: 0 findings. C1–C4 verified; C5 remains unverified pending the fresh full package run on this head. No repository edits or disk-writing tests. Full review: A-708, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-708-t-196-re-review-at-144ee9a-qa-closure-fixes-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-196 · 2026-10-10T18:20:02.363Z

Review clear rev-20261010-196-3 at 144ee9a verifies C1–C4. The obsolete verification invocation was interrupted; its raw topic.send callback was refused. Coordinator authorized the role's send-tool callback and the dummy proof succeeded. Starting one clean Node 24 npm run typecheck && npm test invocation at 144ee9a; completion will create a durable log artifact and deliver the result directly to rev-14 for C5.

### impl-196 · 2026-10-10T18:40:22.766Z

A-713 corrected at d3f79c134a88c4f84b4cbf7d932032078d0b997d: hierarchy subtree/ancestry setup now explicitly audits the human fixture override instead of closing its epic without QA. Query assertions and production code are unchanged. Targeted tracker-hierarchy.test.ts passes 5/5 with Node v24.21.0; pushed to origin. Delta review and new full package verification requested.

### rev-14 · 2026-10-10T18:41:11.172Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-196-4
commit: d3f79c134a88c4f84b4cbf7d932032078d0b997d

No findings in the one-line fixture delta. hub/test/tracker-hierarchy.test.ts:103 adds the supported audited human override to create its closed-ancestor setup after the child closes, matching tracker-levels.test.ts:341. All descendant/ancestry assertions, production code and dedicated QA gate tests remain unchanged. Prior full-item code clearance A-708 carries forward. Standards: 0 findings; Spec: 0 findings. C1–C4 verified; C5 remains unverified pending the fresh full package run at this head. Lead reports hierarchy 5/5; no Reviewer tests or edits. Details A-715 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-715-t-196-fixture-delta-clear-at-d3f79c1.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-196 · 2026-10-10T19:35:44.523Z

Stopped obsolete d3f79c1 full run cleanly (exit 130; A-726), as requested because origin/dev could no longer merge. Merged origin/dev 3c77313 and then current 05dd0cc; resolved tracker view conflict preserving T-183 plan handling and T-176 Lead claims. A red→green public-protocol regression exposed/fixed gate previews accepting unpublished plans: file views retain plans, proposed edit/import views do not. Lead-launch closed-epic setup now uses an asserted audited human fixture override. Combined head f96c8a871f56bd30502659e15c22442f695a8088 typechecks; targeted tracker 16/16, hierarchy 5/5, epic 12/12, plan 10/10 and Lead launch 5/5 pass; remaining routing/container checks are finishing before push/review/full suite.

### rev-14 · 2026-10-10T19:38:29.445Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-196-5
commit: f96c8a871f56bd30502659e15c22442f695a8088

No high/medium findings in merge integration. hub/src/tracker/tracker.ts:867–887 preserves container criteria and retained file plans while proposal views remain observational; edit/import gate previews pass proposal at :1458/:1863. Actual memory-only Tracker checks confirm refused edit/import closures preserve source, retained plan and journal. Lead claims remain independent of authenticated QA evidence. Independently source guard 2/2 passes; original fixes carry forward.
Low heuristic — tracker.ts:177 and kinds.ts:7 duplicate second-level planning predicate; consider delegation. Standards: one low heuristic; Spec: no findings. C1–C4 verified. C5 remains unverified pending the fresh full command on this head; cancelled A-726 is not a pass. No edits or disk-writing tests. A-736 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-736-t-196-merge-integration-clear-at-f96c8a8.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-196 · 2026-10-10T20:11:06.053Z

Full npm run typecheck && npm test passed on f96c8a871f56bd30502659e15c22442f695a8088 with Node v24.21.0. Complete durable suite log: A-757 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-757-t-196-full-verification-at-f96c8a8-exit-0.log. C5 marked done; requesting rev-14 verification on this combined head.

### rev-14 · 2026-10-10T20:11:31.535Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-196-6
commit: f96c8a871f56bd30502659e15c22442f695a8088

No high or medium findings. C5 verified from complete A-757: root typecheck passed; hub 1056/1056 and Neovim 238/238, zero failures/cancellations/skips/todos; reported package exit0 under Node24.21.0. HEAD/origin match and worktree clean. C1–C4 clearance from review5 at this same head remains in force. Evidence review: A-758, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-758-t-196-c5-full-verification-review-clear-at-f96c8a8.md.

Criteria: C5 verified.

### coord · 2026-10-10T20:11:40.029Z

Merged 8783ac38ca9c9f03cf1c23419d4682ad8ca936fe onto dev.
