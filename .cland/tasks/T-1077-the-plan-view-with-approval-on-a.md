---
id: T-1077
kind: task
title: The Plan view with approval on a
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1075
  - T-1054
topic: topic-843
branch: t/T-1077-the-plan-view-with-approval-on-a
created: 2026-10-21T17:32:16.973Z
updated: 2026-10-22T10:41:12.667Z
---

## Summary

The Plan view of the selected epic, with its changes since the human's last look and approval on `a` at desktop width.

## Parent

E-416 (v0.1 §3.13, §3.6; tracer step 6).

## What to build

The Plan view shows the selected epic's plan: its stages, lanes and QA policy, what starts and closes each stage, and the right column. The changes since the human's last look (the per-human plan marks of T-1054) show in the watch colour. `a` approves a plan waiting under `[plan] approval = "human"` at desktop width only, and `d` writes to the Lead in the epic's topic. There is no plan editing. `nvim/lua/cland/plan.lua` defines the behaviour.

## Acceptance criteria

- [x] C1. In a scratch project with `[plan] approval = "human"`, `a` in the Plan view approves a waiting plan, and `cland task plan show` reads it approved by the human (Web test).
  - done: impl-1077 · 2026-10-22T10:40:24.053Z
- [x] C2. A plan change made after the human's last look shows in the watch colour, and opening the view moves the plan's mark (Web test).
  - done: impl-1077 · 2026-10-22T10:31:36.822Z
- [x] C3. Below desktop width `a` is not offered (Web test).
  - done: impl-1077 · 2026-10-22T10:31:36.896Z

## Comments

### impl-1077 · 2026-10-22T10:30:59.694Z

Implemented Plan stages/lanes/gates, hub progress and right-column facts, history/watch highlights with per-human marks, human approval on a at >=1280px, and d discussion routed to the epic Lead. Red/green criterion cases in web/test/plan.test.ts; local macOS Headless Shell targeted run passes all C1-C3 plus observed teardown. Web typecheck/colour/contrast/hook checks pass. Desktop artifact A-9088. Source review and same-head queued verification remain.

### rev-26 · 2026-10-22T10:35:50.339Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1077-source-1
commit: 997126b87264102e7b73edda5affaeb76af1e45a
scope: full
findings: [{"severity":"medium","text":"M1: Plan-first entry never requests missing plan-member summaries. Closed tasks omitted from initial snapshot render unknown title/default○/unknown fractions and lack retained verdict facts until Tree loads them, violating midway plan lane facts. Cover closed/unloaded member with hideDone and use bounded summary reads without body fan-out.","file":"web/src/ItemsPlan.tsx","line":149}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear; A-9091 audits fixed81641915→997126b8/treeecf85ff5. Standards0;Spec M1medium: missing closed-member data on ordinary Plan-first path. Remaining approval authority/desktop guard, shared visit marks/watch/live changes, discussion/summary and docs reviewed with no further findings. Existing Web fixture covers only one open task, masks M1; implementer confirmed and will extend C1 red-first. No runtime criterion verified. Local macOS working-tree tests/check/screenshot supporting only; raw original receipts/provenance requested without reruns. Fresh corrected pushed-head source review before mode-free verify; after-stage QA separate.

Criteria: C1 failed (Plan scenario incomplete: required retained closed-member lane facts are unavailable on Plan-first entry; add closed/unloaded coverage with bounded summary resolution. Approval itself is not claimed to have failed.).

### rev-26 · 2026-10-22T10:39:22.166Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1077-source-2
commit: 0292cbf130584fbcf11d4b38511ef3f46551e528
scope: full
findings: [{"severity":"medium","text":"M1 remains: loadItems retains only missing batch IDs. An already-loaded open plan member is unretained; on close its delta removes the row. Plan opened from that selected task then loses owner and remounts empty, losing epic/visit. Retain the full required member set before filtering fetches and test selected-open-task→closed under Dhidden/no pages with final same-epic facts.","file":"web/src/connection.ts","line":123}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-9096 incorporates A-9091 and corrected0292cbf1. Closed-at-entry case now resolves bounded summaries and retains its later delta/no-body assertions, but M1 still affects initially present members transitioning closed. Implementer confirmed missing registration and will retain full required set plus selected-task closure regression. No additional findings; Standards0,Spec1medium. A-9094 original red/working-tree green4/4/rootcheck0 retained with explicit precommit provenance; no configured/Linux/load pass inferred. All runtime criteria unverified; fresh corrected pushed-head source review before verification. Keep original closed-at-entry/approval/watch/width assertions; stage QA separate.

Criteria: C1 failed (Plan membership lifecycle remains incomplete: selected open member closing drops its owner/Plan visit; approval assertion itself is not claimed to fail.).

### rev-26 · 2026-10-22T10:41:12.667Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1077-source-3
commit: 44e72f4d593f1d2d1b318e7e6f225f1c27269c09
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-9099 incorporates A-9091/A-9096. M1 resolved: retain all required Plan members before missing filtering, keep bounded <=100 summary reads/revision fence and subsequent closed deltas. Closed-at-entry and selected-open→closed regressions preserve full facts/no-body; same epic DOM visit/no extra marks.set prove no hidden reentry. Human approval/CLI, Lead discussion, watch/shared marks/live changes and 1279/1280/phone guards retained. Standards0;Spec0. A-9098 original residual-red followed by localmacOS HeadlessShell4/4green/check0 is qualified precommit working-tree evidence; no dirty-tree hash/exact-head configured proof inferred. All C1–C3 remain run-dependent/unverified. Submit mode-free verification at unchanged44e72f4d; no T3/T4/full-lifecycle/stageQA claim, changed head needs new source review.
