---
id: T-856
kind: task
title: On the human's ok the Aide commits the onboarding's files on `dev`, runs `cland push` and launches the Coordinator with "Work release R-<n>"
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-855
topic: topic-589
branch: t/T-856-on-the-human-s-ok-the-aide-commits-the
created: 2026-10-19T08:10:02.941Z
updated: 2026-10-19T14:39:17.052Z
closed: 2026-10-19T14:39:17.052Z
---

## Summary

"The start" now does what the prototype had to ask the human to do (Q-600 resolutions 1 and 2, §3.4 steps 9 and 10). On one ok, the Aide does three things:
- it commits on `dev` what `cland init` and the onboarding wrote;
- it publishes that commit with `cland push`;
- it launches the Coordinator with the brief "Work release R-<n>", then watches for its first report in General.

## What to build

- **SKILL.md §7.**
  - **The question.** "Ready to start? When you say ok, I commit what cland init and this onboarding wrote on dev, publish it with cland push, and launch the Coordinator with this brief: Work release R-<n>." Recommend yes.
  - **The commit.** On root `dev`, stage only cland's paths and the files the onboarding wrote: `AGENTS.md`, `CLAUDE.md`, `.cland/`, `.agents/`, `.claude/`, `docs/agents/`, and `.cland/welcome.md` when written. Never stage the human's own files, never use `git add -A`, and skip the commit when nothing is staged. The message is in English.
  - **The launch.** Then `cland push`, then `session.launch` or `cland session launch coord --role coordinator --brief "Work release R-<n>"`.
  - **What goes.** The refusal paragraph goes: pasting into a terminal and the launcher's space then l. A hub refusal is reported in one line with its reason, and the Aide offers no other route to the same act.
  - **With only a map.** The commit and push still happen on ok, and the launch is skipped with the existing sentence (open question 4).
  - **After the launch.** Watch with `who` and `history` (General) and say when the Coordinator runs.
- **WELCOME.md and §6** keep their order: the note is posted before the question.
- **T2 cases.**
  - An Aide in an in-process hub with a territory runs `push` after a commit on `dev`, and the territory's `dev` moves.
  - It runs `session launch coord --role coordinator --brief "Work release R-1"` against the fake harness, and the hub lists `coord` running as the Coordinator with that brief.

## Acceptance criteria

- [x] C1. SKILL.md §7 asks the one "Ready to start?" question naming the commit, the push and the brief "Work release R-<n>", and on ok runs them in that order (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-856-source · 2026-10-19T13:32:19.956Z · commit 6ec64819e8d3c3bd00690470fe036a694e0352aa
  - verified: rev-30 [reviewer] · run rev-20261019-856-final · 2026-10-19T13:52:45.840Z · commit 6ec64819e8d3c3bd00690470fe036a694e0352aa
  - done: impl-856 · 2026-10-19T13:53:00.408Z
- [x] C2. The commit step stages only cland's paths and the onboarding's files, never `git add -A` or the human's own files (source review and a T1 assertion that the skill names no `git add -A` or `git add .`).
  - verified: rev-30 [reviewer] · run rev-20261019-856-final · 2026-10-19T13:52:45.841Z · commit 6ec64819e8d3c3bd00690470fe036a694e0352aa
  - done: impl-856 · 2026-10-19T13:53:00.967Z
- [x] C3. No file of the skill asks the human to paste a command or press a launcher key to start the Coordinator or import issues (T1 assertion on the removed wording, and source review).
  - verified: rev-30 [reviewer] · run rev-20261019-856-final · 2026-10-19T13:52:45.841Z · commit 6ec64819e8d3c3bd00690470fe036a694e0352aa
  - done: impl-856 · 2026-10-19T13:53:01.444Z
- [x] C4. Run as an Aide against an in-process hub, `cland push` moves the territory's `dev` to root `dev`, and the launch line starts `coord` with role coordinator and the brief "Work release R-1" (T2 with the fake harness).
  - verified: rev-30 [reviewer] · run rev-20261019-856-final · 2026-10-19T13:52:45.841Z · commit 6ec64819e8d3c3bd00690470fe036a694e0352aa
  - done: impl-856 · 2026-10-19T13:53:01.999Z

## Comments

### impl-856 · 2026-10-19T13:29:00.527Z

Implementation started from 5afdda60. Read E-616 cut decisions; decision 4 governs map-only commit/push. Scope: §7 start flow, C3's stale import refusal wording, T1 source guards and T2 CLI component proofs.

### impl-856 · 2026-10-19T13:31:09.597Z

Committed and pushed 6ec64819. Evidence A-6054: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6054-t-856-implementation-and-criterion-evidence.md. C1–C4 have source/component evidence; targeted file passed 12/12 and npm run check passed. Fresh-fetch merge-tree against origin/dev passed. Source review requested from reviewer in topic-589; waiting before mode-free verification.

### rev-30 · 2026-10-19T13:32:19.956Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-856-source
commit: 6ec64819e8d3c3bd00690470fe036a694e0352aa
scope: full
findings: [{"severity":"low","text":"L1: The new source-guard title uses 'and' twice and combines staging/start/import in its name, contrary to the test-placement naming rule in docs/agents/tests.md. Give this guard a single-contract title so its failure is easier to locate.","file":"hub/test/skills-onboarding.test.ts","line":85}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with low L1; A-6055. Single approval enforces explicit-stage commit → cland push → exact Coordinator brief; map-only skips launch and every refusal stops without workaround. C1 verified; C2–C4 await exact-head mode-free evidence. L1 is test-title naming at line 85, no blocker. A-6054 targeted/check evidence inspected; preserve existing full-file output/duration for final review. No Reviewer execution.

Criteria: C1 verified.

### impl-856 · 2026-10-19T13:32:36.266Z

Reviewer source clear at unchanged 6ec64819 (rev-20261019-856-source, A-6055), with one nonblocking test-title note retained. Mode-free verify admitted as ea749abd-3c6a-447d-8b9f-428a539a3ebf, report topic-589 to Reviewer rev-30 and item lead impl-856. Waiting for hub result before final verdict.

### impl-856 · 2026-10-19T13:52:22.950Z

Same-head verification ea749abd passed 1546/1546; A-6073 retains all onboarding 5/5 load receipts (Linux x64 droplet, lifetime 1085s, cost $0.0753). Reviewer runtime audit A-6074 found four report-only T2 native-Git trips in C4's publication case. Coordinator decision c322ebda-6b84-40af-982a-ae197f14da7d accepts this required proof unchanged; separate Tech debt item T-877 owns allowed-tier/injected-seam cleanup for v0.1.5. No head change or rerun. Awaiting final Reviewer verdict; L1 naming note retained.

### rev-30 · 2026-10-19T13:52:45.841Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-856-final
commit: 6ec64819e8d3c3bd00690470fe036a694e0352aa
scope: evidence
findings: [{"severity":"low","text":"L1: The new source-guard title uses 'and' twice and combines staging/start/import in its name, contrary to the test-placement naming rule in docs/agents/tests.md. Give this guard a single-contract title so its failure is easier to locate.","file":"hub/test/skills-onboarding.test.ts","line":85}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear with retained low L1; C1–C4 verified. A-6074/A-6075 audit exact-head mode-free ea749abd/A-6073: ordinary 1546/1546, zero fail/cancel/skip/TODO, all 466 load groups 5/5. New staging/start/import source guard and Aide push/Coordinator launch controls each pass ordinary plus 5/5; all 12 onboarding tests pass. C4 actual territory dev movement and exact role/Work release R-1 brief proven. Four owned real-Git T2 trips are explicitly accepted by Coordinator decision c322ebda, tracked as T-877 (Tech debt, v0.1.5); they are not absent or generally waived. No head change/rerun per that decision. C1–C3 source requirements retained from A-6055. L1 remains hub/test/skills-onboarding.test.ts:85 (title uses 'and' twice). Native T3 is landing evidence. Claimant checkboxes were false at initial readback; record done marks separately if still outstanding.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T14:39:17.052Z

Merged 7d914750aeaf1d007057e070e6f8d79f8d819f62 onto dev.
