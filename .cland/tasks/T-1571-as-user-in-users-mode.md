---
id: T-1571
kind: task
title: "`--as <user>` in users mode"
state: open
status: ready
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1562
topic: topic-1319
branch: t/T-1571-as-user-in-users-mode
created: 2026-10-31T23:47:53.293Z
updated: 2026-11-02T03:15:32.049Z
---

## Summary

In users mode the CLI's `--as` on `cland topic answer`, `topic create` and `topic send` must name an existing active user. The request is then recorded as that user's, and the acting user must be an admin, which every user is for now. In single mode `--as` keeps its stand-in meaning. A launched session's shell still cannot act as a person.

Hot files: `hub/src/cli/inbox.ts`, `hub/src/cli/actor.ts`, `shared/frame-actor.ts`, `hub/src/hub/dispatch.ts` [Host] (`topic.answer`, `topic.create`, `topic.send` stand-in handling), `hub/src/cli/usage/topic.ts`.

## Acceptance criteria

- [x] C1. In users mode `cland topic answer <ask> 1 --as <user>` records that user as the answerer in the outcome and the journal.
  - done: impl-1571 · 2026-11-02T02:48:33.947Z
  - verified: rev-35 [reviewer] · run rev-35-1571-final-1 · 2026-11-02T03:15:31.542Z · commit 90717aea72320079295b31fdd9d503f63b0e6979
- [x] C2. `--as` naming an unknown or invited-only user is refused with a message naming the user.
  - done: impl-1571 · 2026-11-02T02:48:34.126Z
  - verified: rev-35 [reviewer] · run rev-35-1571-final-1 · 2026-11-02T03:15:31.542Z · commit 90717aea72320079295b31fdd9d503f63b0e6979
- [x] C3. Without `--as` the CLI's request is recorded as the first user's.
  - done: impl-1571 · 2026-11-02T02:53:47.933Z
  - verified: rev-35 [reviewer] · run rev-35-1571-final-1 · 2026-11-02T03:15:31.542Z · commit 90717aea72320079295b31fdd9d503f63b0e6979
- [x] C4. In single mode `--as <stand-in name>` records a stand-in answer exactly as today.
  - done: impl-1571 · 2026-11-02T02:48:34.618Z
  - verified: rev-35 [reviewer] · run rev-35-1571-final-1 · 2026-11-02T03:15:31.542Z · commit 90717aea72320079295b31fdd9d503f63b0e6979
- [x] C5. A shell with `CLAND_SESSION_*` set still acts as its session whatever `--as` says.
  - done: impl-1571 · 2026-11-02T02:48:34.926Z
  - verified: rev-35 [reviewer] · run rev-35-1571-final-1 · 2026-11-02T03:15:31.542Z · commit 90717aea72320079295b31fdd9d503f63b0e6979

## Comments

### impl-1571 · 2026-11-02T02:44:29.186Z

A-15078 A10 and Coordinator confirmation extend scope to approval.answer and artifact.create. topic.send and approval.answer have no CLI verbs today: covered at production frame seam; existing topic create/answer and artifact create get CLI coverage. Rule-20 complete field/function consumer inventory published in the item topic; previous wire shapes remain unchanged. QA is after-stage under E-1536; Coordinator confirms source and evidence reviews only for this item.

### impl-1571 · 2026-11-02T02:46:28.674Z

Consumer inventory: A-15543 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15543-t-1571-consumer-inventory.md. Red C1: CLI --as alex persisted jane (actual 'jane' !== expected 'alex'); unchanged single-mode stand-in case passed. Six new T2 matrix cases now cover named/default identity, unknown/invited/display-name refusals, both stored-role checks and shell authority. Docs/help updated inside existing sign-in subsystem sections. No role permission or protocol fields added.

### rev-35 · 2026-11-02T02:50:49.574Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1571-source-1
commit: cd8a091fc7fcaf9614ad0c823844f4ba47c8cae2
scope: full
findings: [{"severity":"medium","text":"Frozen TOPIC_USAGE and ARTIFACT_USAGE (line50) retain superseded help bytes. Complete-export compatibility comparison and aggregate native help built from frozenUsage mismatch shipped output. Independently migrate intended expected blocks, retain full assertions and inventory these help consumers.","file":"hub/test/fixtures/cli-usage/commands.json","line":46},{"severity":"medium","text":"topic.create still passes HUMAN_SESSION into core.createTopic, so topic-created journal by remains human for selected/default users. Audit has the selected user, masking missing operation attribution in current tests. Use admitted user identity in the creation journal and assert exact named/default topic-created receipts, retaining single-mode/session behavior.","file":"hub/src/hub/dispatch.ts","line":1853}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear: two medium findings. Standards: frozen topic/artifact help consumers not migrated (commands.json46/50). Spec: topic-created operation journal still uses human at dispatch1853/core3230 despite selected/default user audit; C3 failed for this path. Coordinator scope extension confirmed; other identity/role/shell/source paths inspected. C1/C2/C4/C5 remain runtime-unverified, local six-case/static receipts supplemental only. A-15545 details changes, consumers and required exact journal/help assertions. Fresh source review before verify. No Reviewer execution/browser/edits; QA after-stage separate.

Criteria: C3 failed (Users-mode topic create without --as still journals topic-created.by as human instead of the first user; named selection has the same operation-journal gap.).

### impl-1571 · 2026-11-02T02:52:09.031Z

Addressing source findings A-15545. Red topic-created journal assertions reproduced 'human' !== 'jane' (default) and 'human' !== 'alex' (named), while single/session receipts retain legacy human attribution. Red full CLI usage compatibility test reproduced the two expected help block mismatches. Review-fix consumer inventory A-15546 covers frozen help and createTopic/topic-created consumers. Optional trailing createTopic userId preserves existing callers and old journal rows.

### rev-35 · 2026-11-02T02:54:43.480Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1571-source-2
commit: 90717aea72320079295b31fdd9d503f63b0e6979
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear, no findings. A-15545 resolved: independently migrated only intended TOPIC_USAGE/ARTIFACT_USAGE fixture bytes with complete help assertions retained; topic.create carries admitted name/id through compatible trailing argument to topic-created journal. Exact topic-id named/default frame+CLI receipts added; single/session legacy assertions retained. Expanded A-15546 consumers include frozen help/journal/direct callers and prior omitted-field events. Previous user/role/credential/source conclusions and Coordinator scope remain. C1–C5 runtime unverified pending exact-head queued mode-free verification/named6 matrix plus identity/artifact/message/CLI/help/event controls. Reported local/static passes supplemental only. A-15548 source review. No Reviewer tests/browser/edits; QA after-stage separate.

### rev-35 · 2026-11-02T03:15:31.542Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1571-final-1
commit: 90717aea72320079295b31fdd9d503f63b0e6979
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C5 verified, no findings. Exact-head uncachedff5cd0e1/A-15549 exit0,4662 pass, zero fail/cancel/skip/todo. Actual named cli-as-user6 establishes selected/default answer+journal, refusals/current roles, single stand-in and credentialed session-shell authority plus topic-created journal. Recorded unchanged answer2/artifact4/message1/asksCLI6, frozen compatibility1/nativehelp5/commandhelp18, events7/rolepolicy6/web-authority46 pass. cli-identity has no remote rows: deferred T3, no native/current-head pass claimed; C5 directly established by new CLI matrix. Linux x64 droplet Node24.21/Neovim0.12.5/isolated HeadlessShell1248 Chrome156.0.8078.4, treeffecb897edb99c71284c9510c63dde67d9c0e00f. T0/T1/allT2/mappedT4base/Web complete; T3 deferred/T4reps skipped, advisories report-only. A-15550 details scope. Source unchanged; merge-batch/QA affected after-stage separate. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
