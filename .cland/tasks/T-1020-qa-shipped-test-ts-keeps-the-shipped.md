---
id: T-1020
kind: task
title: qa-shipped.test.ts keeps the shipped-case catalogue on one line, so every case addition conflicts
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1216
blocked_by: []
topic: topic-950
branch: t/T-1020-qa-shipped-test-ts-keeps-the-shipped
created: 2026-10-20T18:14:40.036Z
updated: 2026-10-24T09:39:48.192Z
---

## Summary

`nvim/test/qa-shipped.test.ts` keeps the whole shipped QA case catalogue on one long line, so any two items that each add a shipped case (ARTIFACT-001, PANELS-017, PANELS-018 on 2026-10-20) conflict and invalidate otherwise green, reviewed heads. Reported by impl-796.

## What to build

One case per line (or per-feature lists) so independent additions merge cleanly, keeping the curated shipped set and its order checks.

## Acceptance criteria

- [x] C1. The shipped catalogue lists one case per line, and two branches that each add a different case merge without conflict (demonstrated with a scratch merge in the item topic).
  - done: oc-1020 · 2026-10-24T09:23:10.168Z
  - verified: rev-31 [reviewer] · run rev-20261024-1020-source2 · 2026-10-24T09:24:13.837Z · commit 93c922131ebd63730c327b484b8245924780d22a
- [x] C2. qa-shipped.test.ts runs the same cases as before (test).
  - done: oc-1020 · 2026-10-24T09:23:10.267Z

## Comments

### oc-1020 · 2026-10-24T09:18:05.100Z

Catalogue layout changed at 5e1b70d4 (pushed): the T4 walk keeps the curated set in a CATALOGUE list, one case per line, grouped by feature (artifacts, explorer, graph, items, panels, thread) and ascending within a group, with the same 31 cases, test names and assertions. Added two cheap guards: each case is alone on its own line, listed once, with its qa/cases file present; and a scratch Git repository (disposable root, sealed fixture environment) where three branches each add a case to a different feature and merge with no conflict.

Evidence, local macOS arm64: the guards were red on the old one-line catalogue (both failed with 'ARTIFACT-001 is alone on its own catalogue line' / 'the catalogue keeps ARTIFACT-001 alone on its own line') and green after; `node --test nvim/test/qa-shipped.test.ts` is 33/33 passing, 0 failed, 0 skipped (31 shipped cases + 2 guards); `npm run check` passes (typecheck, web build, static lints, test lint refusals 0). The item-topic scratch merge adds ARTIFACT-003, PANELS-021 and THREAD-011 on three branches and merges them with 0 unmerged paths. Evidence artifact A-10628 in topic-950.

Scope: additions in different feature groups merge cleanly (the reported ARTIFACT-001 versus PANELS-017/018 pattern, and the demo adds three). Two additions inside one feature group still share that group's last line and conflict there, resolved by keeping both one-line entries; the old whole-catalogue reformat is gone.

Docs: docs/agents/tests/nvim-test-qa-shipped.test.ts.md and its row in docs/agents/tests/index.md. Note the brief named hub/test/qa-shipped.test.ts; the file is nvim/test/qa-shipped.test.ts (as the item says) and the targeted run used that path.

### rev-31 · 2026-10-24T09:20:18.571Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1020-source
commit: 5e1b70d49ccbae49008d5514626cf664d123aa85
scope: full
findings: [{"severity":"medium","text":"M1: Both new catalogue guards are in T4 although source inspection needs T0/T1 and the scratch Git contract needs at most a named T3 boundary. docs/agents/tests.md:170/331/343 require the lowest adequate tier. Keep the shipped walk in T4; move retained permanent guards to appropriate boundaries or retain the scratch merge only as durable task evidence.","file":"nvim/test/qa-shipped.test.ts","line":62}]
finding_counts: {"high":0,"medium":1,"low":0}

A-10637 records the full source audit at 5e1b70d4/tree b4dd01e6. Standards: M1 medium tier placement; Spec: no findings. Independently confirmed identical 31 unique case IDs, runner names, PASS/exit assertions and skip condition. Per-feature merge limitation is explicit and consistent with the item. A-10628 is local summary/excerpt evidence, not complete native transcripts or configured verification. Correct the guard placement and request fresh source review before verification; no Reviewer execution.

Criteria: C1 failed (M1: new catalogue layout and Git merge guards need lowest-adequate-tier placement before source clearance.).

### oc-1020 · 2026-10-24T09:23:04.135Z

Review M1 fixed at 93c922131ebd63730c327b484b8245924780d22a (pushed). The T4 walk keeps only the 31 shipped runner identities; the layout/set guard is now hub/test/qa-shipped-catalogue.test.ts at T1 (repository files only, classified in hub/test/tiers.json); the scratch Git merge is retained as durable evidence in this topic, rerun at this head. Raw original output (T1 guard, T4 walk, npm run check, scratch merge) is A-10644; docs updated in docs/agents/tests/nvim-test-qa-shipped.test.ts.md. Fresh full source review requested from the Reviewer.

### rev-31 · 2026-10-24T09:24:13.837Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1020-source2
commit: 93c922131ebd63730c327b484b8245924780d22a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear at 93c92213/tree da653a82; no findings. A-10648 resolves A-10637 M1: source guards now T1 with manifest/header, repository reads only; permanent native Git fixture removed. T4 retains all original 31 IDs, runner names, skip and PASS/exit assertions. A-10644 visibly retains 2/2 T1, 31/31 actual local T4 named passes, check output with zero refusals and ordinary scratch merges preserving three feature additions/no conflicts. Request supplies local Darwin arm64 exact-head commands/exit attribution; raw packaging lacks individual invocation/exit headers, explicitly qualified. C1 verified, same-feature insertion limitation accepted; C2 final settlement pending ordinary configured mode-free same-head evidence. No Reviewer execution/enqueue.

Criteria: C1 verified.

### oc-1020 · 2026-10-24T09:39:48.192Z

Verify run 9e969299-f28c-4910-b8c9-065047f590f6 passed at 93c922131ebd63730c327b484b8245924780d22a (artifact A-10673): mode-free task run on a droplet c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, 2 workers, 737 s, $0.0512. T1 exit 0 (811 tests), T2 exit 0 (1738, task fallback all T2), Web exit 0 (223): 2867/2867 pass, 0 fail, 0 skipped. T3 deferred to periodic dev and integrated occasions (batch tiers exclude it, queue enabled); the local macOS arm64 T4 walk is 31/31 at the same head (A-10644), reported separately because the host defers T4. Report-only duration and lint lines unchanged (133 findings), no gate. No conflicts: git merge-tree --write-tree origin/dev HEAD exit 0 (tree 519ac3ee) against origin/dev c6abaeb1. Ready reported to the Coordinator; C2's verified mark requested from rev-31.
