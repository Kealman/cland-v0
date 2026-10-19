---
id: T-844
kind: task
title: Setup starts the hub and launches `aide-1` with the onboarding brief
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-841
topic: topic-614
branch: t/T-844-setup-starts-the-hub-and-launches-aide-1
created: 2026-10-19T06:34:13.450Z
updated: 2026-10-19T19:18:54.016Z
---

## Summary

Tracer bullet 4, the hub half. Setup starts this project's hub, which outlives setup (ADR 0003). It then launches `aide-1` through the hub on the favourite harness with the brief `Run the onboarding skill; project: empty | existing; harnesses: <installed>; human's harness: <favourite>` (ADR 0001: a normal hub launch, never a harness started by hand).

## What to build

- **The hub step.**
  - `ok` with its pid when one runs.
  - Otherwise it is started as `cland hub start` does, in setup's environment, so the hub sees the installers' folders on its PATH. That gives `done`.
  - A start that fails is `fail`, naming the hub log's last lines and `cland hub start`.
- **The aide step.**
  - A running `aide-1` is `ok`.
  - A stopped one is resumed with its conversation, giving `done` "resumed".
  - Otherwise `aide-1` is launched with role `aide`, the favourite harness and the brief, giving `done` with the brief in the line.
  - A launch the hub refuses is `fail`, naming the equivalent `cland session launch` command.
- **The project kind** (question 13): `existing` when the root holds a file beside cland's own paths (tracked, or untracked and not ignored), else `empty`.
- **Flags.**
  - `--no-aide` gives `skip` for both steps: "cland starts the hub with the workbench".
  - Without a terminal, the hub step is `open` unless `--yes` (question 2), and the aide step is always `open`: "the Aide needs a terminal".
- The brief names the onboarding skill even before E-616 ships it (question 12).

## Acceptance criteria

- [x] C1. With an injected hub client and no hub running, the flow starts the hub and launches `aide-1` with role `aide`, the favourite and the exact brief, `project: empty` for a folder of cland's files only (T1).
  - done: impl-844 · 2026-10-19T16:18:29.774Z
  - verified: rev-30 [reviewer] · run rev-20261019-844-final · 2026-10-19T16:19:23.509Z · commit cdde6a6b8253f1dd535e0a45429183b3e8b82e0f
- [x] C2. A folder with one untracked file of the project's own gives `project: existing`, while an ignored file does not (T1 over the kind function on a temp repo, T2).
  - done: impl-844 · 2026-10-19T16:18:30.483Z
  - verified: rev-30 [reviewer] · run rev-20261019-844-final · 2026-10-19T16:19:23.509Z · commit cdde6a6b8253f1dd535e0a45429183b3e8b82e0f
- [x] C3. A second run with `aide-1` running reports `hub ok` and `aide ok` and launches nothing, while a stopped `aide-1` is resumed, not launched afresh (T1).
  - done: impl-844 · 2026-10-19T16:18:31.222Z
  - verified: rev-30 [reviewer] · run rev-20261019-844-final · 2026-10-19T16:19:23.509Z · commit cdde6a6b8253f1dd535e0a45429183b3e8b82e0f
- [x] C4. A real hub served in the test process (`projectHub`) receives `session.launch` for `aide-1` with the brief and lists it running (T2, in-process fake adapter).
  - done: impl-844 · 2026-10-19T16:18:31.828Z
  - verified: rev-30 [reviewer] · run rev-20261019-844-final · 2026-10-19T16:19:23.509Z · commit cdde6a6b8253f1dd535e0a45429183b3e8b82e0f
- [x] C5. `--no-aide` reports both steps `skip` and starts nothing, and without a terminal the aide step is `open` and nothing is launched (T1).
  - done: impl-844 · 2026-10-19T16:18:32.530Z
  - verified: rev-30 [reviewer] · run rev-20261019-844-final · 2026-10-19T16:19:23.509Z · commit cdde6a6b8253f1dd535e0a45429183b3e8b82e0f

## Comments

### impl-844 · 2026-10-19T15:48:44.822Z

Seams follow C1/C3/C5 (injected hub client), C2 (project-kind on scratch Git repo), C4 (projectHub socket protocol with in-process fake adapter). Hub/Aide remain separate ordered step modules. Avoiding T-874-owned favourite and launch helper.

### impl-844 · 2026-10-19T15:53:25.134Z

Implementation pushed at ff241fcfc468f3df5737c6fefdab22a78eb4916c. Evidence artifact A-6177: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6177-t-844-implementation-and-criterion-evidence.md. Root typecheck, tier lint, test lint and seven targeted setup files passed individually. Source review delivered to the Reviewer; waiting for clear before verification.

### rev-30 · 2026-10-19T15:54:55.363Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-844-source
commit: ff241fcfc468f3df5737c6fefdab22a78eb4916c
scope: full
findings: [{"severity":"medium","text":"M1: This new T2 test calls projectKind, which executes native git ls-files via child_process.execFile (project-kind.ts:13). T2 permits a subprocess only when the cland CLI itself is the subject; file-only .git fixture creation does not remove the native Git calls, and the tripwire reports/forbids them. Preserve ignored/untracked proof at a conforming injected boundary and any native contract at an allowed tier; the separate T-856/T-877 exception does not cover this test.","file":"hub/test/setup-project-kind.test.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-6179. Standards M1 at setup-project-kind.test.ts:21 is a new native Git subprocess in T2, contrary to docs/agents/tests.md and runtime tripwire. File-only .git setup does not avoid production execFile. Rest of source trace covers detached env handoff, authenticated launch/resume, exact onboarding brief, idempotence, no-aide/nonterminal policy and preserved existing flow assertions without another finding. C2 failed; no verify at ff241fcf. Fresh source review required after correction; no Reviewer execution.

Criteria: C2 failed (New T2 project-kind regression runs native git execFile outside the permitted cland-CLI boundary; correct placement/seam while retaining ignored/untracked assertions.).

### rev-30 · 2026-10-19T15:56:49.826Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-844-source-corrected
commit: cdde6a6b8253f1dd535e0a45429183b3e8b82e0f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-6184. M1 resolved with injected ProjectGit boundary and T1 inventory/argv/root/env checks; ignored/untracked assertions retained, cached-file/fallback cases added, no native subprocess reached. Default production execFile/options/NUL parsing unchanged. Prior A-6179 otherwise found no additional source issue; T1 flow/idempotence/policy controls and T2 actual hub/fake-adapter launch unchanged. A-6183 reports revised files/typecheck/tiers/lint green; no post-review dev merge or verify at rejected head. C1–C5 complete verification awaits corrected-head mode-free gate. No Reviewer execution.

### rev-30 · 2026-10-19T16:19:23.509Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-844-final
commit: cdde6a6b8253f1dd535e0a45429183b3e8b82e0f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear: A-6201 audits same-head run 69c65bc8/A-6199 (1584/1584, zero fail/cancel/skip/TODO; 504 groups 5/5). C1–C5 source and owned execution receipts established; corrected inventory controls have no owned tier trip. Four inherited T-856 Git rows remain covered by T-877/Coordinator disposition. T3 remains merge-batch landing evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-19T19:12:09.875Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-844-requirements-integration-source
commit: 4dfe7a07dfb3b92d54e023c805ae62a84a186da5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6351 Integration source clear. Compared all 16 task-delta files to original reviewed patch: only two requiredHarnesses fixture-method additions differ; assertions unchanged. Owned production modules byte-identical. Landed T-834 installer/login requirements compose with onboarding's required all-installed harness list. Coordinator 07a73582 authorized merge/repair. No current-head criteria verification until exact-head mode-free receipt; old runtime historical.
