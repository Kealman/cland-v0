---
id: T-155
kind: task
title: "Marks the hub writes: task.criterion and cland task criterion for done, verify, fail, add, edit and remove, limited to the parties §3.4 names; ids never reused; the criterion marked event"
state: open
status: in progress
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
updated: 2026-10-10T09:16:47.198Z
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
