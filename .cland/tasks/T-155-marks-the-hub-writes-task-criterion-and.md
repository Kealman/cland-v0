---
id: T-155
kind: task
title: "Marks the hub writes: task.criterion and cland task criterion for done, verify, fail, add, edit and remove, limited to the parties §3.4 names; ids never reused; the criterion marked event"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-112
blocked_by:
  - T-154
topic: topic-71
branch: t/T-155-marks-the-hub-writes-task-criterion-and
created: 2026-10-10T07:49:36.076Z
updated: 2026-10-10T12:29:52.739Z
---

## Parent

T-112 (Criteria that live), slice 2 of 5. Spec §3.4 (Marks and who sets them), §3.9 (task events).

## What to build

The hub writes criteria marks. A new tool `task.criterion` and the CLI `cland task criterion <id> <op> …` take the operations done, verify, fail (with a note), add, edit and remove. Each is limited to the parties §3.4 names: done by the claimant Implementer, the Coordinator or the human; verify and fail by a Reviewer or QA; add, edit and remove by the Coordinator or the human (an Aide's rights arrive with T-111, whichever lands second). The hub writes the mark sub-items and mirrors done in the checkbox. Ids are assigned at the first touch of the section, in order, and never reused, even after a removal. `failed` removes `done`, carries its note and returns the task to `in progress`. Subscribers get the `task` event "criterion marked".

## Acceptance criteria

- [ ] `task.criterion` and `cland task criterion` set done, verified and failed marks in the item file in the §3.4 format, and the checkbox mirrors done.
- [ ] Each operation is refused for a party §3.4 does not name, with the reason; tests cover each role.
- [ ] The first touch assigns ids to a legacy section; a removed criterion's id is never reused.
- [ ] `failed` needs a note, removes done, and moves the task to `in progress`.
- [ ] Subscribers receive a "criterion marked" task event naming the item, the criterion and the mark.
- [ ] A concurrent hand edit and a hub write keep both changes, or the hub write is refused and retried, never silently lost.
- [ ] The tool is added to the role grants in the default roles; the handover names the instance lines for `.cland/roles.toml`.
- [ ] `hub/README.md` and `docs/agents/issue-tracker.md` describe the operations.
- [ ] `npm run typecheck && npm test` pass.

## Blocked by

- T-154 (Criteria in the view)

## Comments

### impl-155 · 2026-10-10T08:51:08.507Z

Implemented the first MCP/CLI done slice and role-scoped operations through the tracker queue. Integration coverage now exercises verification/failure, criteria edits, durable id allocation across restart, and live-claim authorization; concurrent hand-save refusal and documentation are next.

### impl-155 · 2026-10-10T09:08:01.000Z

Implementation is pushed to origin at 1a54ebd164f69056c5383abfd53c54ef1192d81b. Both code-review axes are clear after fixing the reproduced late in-place-save race; final criterion integration file passed 10 tests. Artifact A-515 records changes, recovery-source retention, exact role-grant lines and pending verification: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-515-t-155-implementation-and-self-review-suite-pending.md. Full npm test remains queued behind the machine-wide suite lock (T-148 runner pid 93025); keeping in progress until it finishes.

### rev-8 · 2026-10-10T09:16:47.198Z

verdict: review
result: not clear
by: rev-8 [reviewer]
run: rev-8-20261010-155-1
commit: 3ac2edf572c2de768df524325a30965ad3be834f

Medium — hub/src/tracker/tracker.ts:908: rename-to-capture removes the live item path until line 914 links its replacement; a crash in between makes startup omit the item because .conflict sources are ignored and not recovered, breaching README:904 atomicity/process-crash behavior.

Medium — hub/src/tracker/tracker.ts:1253: only literal human gets human criterion rights; an unknown-name human --as alice becomes cli:alice and is refused done/add/edit/remove, contrary to README:916's free human --as contract. Reproduced using actual actorOf and criterionRefusal.

Medium — hub/src/tracker/tracker.ts:1289: add appends at sectionEnd=EOF inside an unclosed fenced example, so it can report success/allocate an id while the new criterion is absent from criteria. Independent parser probe reproducing the production insertion confirmed C2 invisible and no warnings.

Standards: 2 medium; Spec: 1 medium. Task-only scope accepted per Coordinator. No reviewer edits or suites run; full suite remains pending. Artifact A-517: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-517-t-155-review-durability-human-alias-and-fenced-insertion-gaps.md.

### impl-155 · 2026-10-10T09:25:54.584Z

Pushed 0258ec70b075f1c739aabf491763741d2e1303fe addressing A-517's three mediums: durable startup capture recovery, free-name human CLI rights, and refused insertion into an unclosed fence. All three regressions red->green; typecheck and 31 targeted tests pass. Full suite queued behind machine lock; final review/handover pending.

### rev-8 · 2026-10-10T09:31:43.912Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-155-2
commit: 330f45e93b553d6505062c1cf67d17dae5a63fee

No high, medium, or low findings. Standards and Spec clear for the full item. All three A-517 findings are resolved: startup capture recovery precedes indexing and preserves existing live files, named human CLI callers retain done/manage rights, and add refuses open-fence insertion. The intermediate cli: session-id regression is also resolved by explicit Actor.human provenance and reauthorization comparison; actual helper/policy probes confirmed named-human, Reviewer/QA and roleless-session outcomes. Read-only review, no reviewer suites or edits; full suite remains queued. Artifact A-532: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-532-t-155-re-review-capture-recovery-and-actor-provenance-clear.md.

### rev-8 · 2026-10-10T10:44:52.651Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-155-3
commit: 37dbb8c94222d94a31cdb102cba83b04998b41e1

No findings in requested 376752e→37dbb8c delta. Only hub/test/daemon.test.ts changes. Lines 34–36 require both exact production recovery patterns and exempt only those strings; every other tasks prefix, including broad tasks/ and tasks/* ignores, remains rejected. Other protected-file and provisioning assertions remain intact. Standards and Spec clear. Read-only inspection; no edits or suites.

A-569: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-569-t-155-daemon-provisioning-test-delta-clear.md

### impl-155 · 2026-10-10T10:45:27.434Z

Latest pushed37dbb8c94222d94a31cdb102cba83b04998b41e1 has current review clear rev-8-20261010-155-3 (A-569). Full npm test at376752e: hub961/964 passed, all criterion13 and both ready fixtures passed; three failures (A-568). Fixed our recovery-ignore provisioning assertion. Complete daemon14/14 and handover4/4 passed twice each on new head; the other two were baseline timing races per Coordinator's instructed check. Waiting for suite requeue signal.

### impl-155 · 2026-10-10T12:04:36.266Z

T-148 landed first, so T-155 now integrates Aide criterion done/manage rights without a claim, with verify/fail refused. Rebased onto dev2ff6681 and pushedfe61b8b235ff6ae63958daf00993bd3157c3b04f; typecheck and targeted24 pass, public-boundary Aide regression red->green. External delta review and own full suite on this rebased head pending Coordinator slot. New artifact records five exact role tool-line replacements; instance roles file untouched.

### rev-8 · 2026-10-10T12:09:40.220Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-155-4
commit: fe61b8b235ff6ae63958daf00993bd3157c3b04f

No high, medium or low findings. Standards: clear, zero findings. Spec: clear, zero findings. Aide done/manage needs no claim; verify/fail remain hard-refused by the Reviewer/QA rule. Range-diff preserves previously reviewed recovery and explicit human provenance, T-148 hard boundaries, and artifact.promote. Native read-only policy probe passed 90 cases plus grant parity/addressing/provenance checks. Fresh full suite on this rebased head remains pending Coordinator scheduling; A-592 reports typecheck and targeted24 pass. Evidence A-595: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-595-t-155-review-fe61b8b-rebase-and-aide-criterion-rights-clear.md.

### coord · 2026-10-10T12:29:52.739Z

Merged 9eabb8ac76d2de55721e68d6f45f66a8a6cbee02 onto dev.
