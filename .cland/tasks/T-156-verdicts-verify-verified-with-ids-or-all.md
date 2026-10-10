---
id: T-156
kind: task
title: "Verdicts verify: --verified with ids or all on a verdict, failed criteria with notes, the Reviewer and QA clauses and skills verify by id"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-112
blocked_by:
  - T-155
topic: topic-86
branch: t/T-156-verdicts-verify-verified-with-ids-or-all
created: 2026-10-10T07:49:36.173Z
updated: 2026-10-10T14:25:22.109Z
---

## Parent

T-112 (Criteria that live), slice 3 of 5. Spec §3.4 (verified inside a verdict).

## What to build

A verdict verifies criteria. `cland task comment --verdict review|qa` and the verdict tools take `--verified C1,C3` or `--verified all`; a clear verdict with them writes verified marks carrying the verdict's run. A not-clear verdict may name failed criteria with notes. The Reviewer and QA clauses, and the `code-review` and `qa` skills, tell those roles to verify by id and to fail with a note. The verdict's message in the thread lists the criteria it marked.

## Acceptance criteria

- [ ] `--verified` with ids or `all` on a clear verdict marks those criteria verified with the run id; an unknown id refuses the verdict and names it.
- [ ] A not-clear verdict can fail criteria by id with notes, with the same effect as `task.criterion fail`.
- [ ] The verdict's message lists the criteria it marked.
- [ ] The Reviewer and QA default clauses and the `code-review` and `qa` skills describe verifying by id; the handover names the instance lines for `.cland/roles.toml`.
- [ ] `docs/review-and-qa.md` describes `--verified`.
- [ ] `npm run typecheck && npm test` pass.

## Blocked by

- T-155 (Marks the hub writes)

## Comments

### impl-156 · 2026-10-10T12:30:43.140Z

Implementation started at dev 95f88ee. Seams: real hub frame protocol, MCP spoke and CLI against fixture projects, as T-112 specifies. Package suites paused per Coordinator due to T-175; targeted node --test files and typecheck only until cleared.

### impl-156 · 2026-10-10T12:38:40.941Z

8955991 implements verified ids/all and repeatable CLI --failed C2=note / MCP failed [{criterion,note}]. One protected write records the verdict and marks; invalid ids and revoked grants refuse both. Message.criteria is structured and restart-persistent. npm run typecheck, verdict-criteria (4 tests), tracker-criterion-write (13 tests) pass. Package suites remain paused by Coordinator for T-175. Standards/spec self-review running against 95f88ee.

### rev-67 · 2026-10-10T12:46:34.488Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-156-1
commit: 0fae243d864c2abc0d90bac9e7cbe2ad2d11153b

Low, optional heuristic — hub/src/tracker/tracker.ts:1094 and :1404 (also :1102/:1405): verdict and standalone criterion paths duplicate run/note validation; shared validation could prevent future drift. No documented-standard breach or high/medium finding.

Standards: clear, 1 optional low suggestion. Spec: clear, 0 implementation findings. Unknown IDs name the missing criterion and abort before the single protected verdict/mark write. Both grants and writer provenance are rechecked before publication; failure shares standalone mark semantics. Bound-topic reports list marks and persist the exact message.criteria contract. Default clauses, skills, docs and A-609’s instance line satisfy verification by ID.

Pinned Node24 memory probes pass grant boundaries, MCP mapping, shared mark transformations/unknown ID and report history through Core recreation. Full write-pipeline source and targeted real-daemon tests reviewed. A-609 reports typecheck plus 30 targeted tests passing; full npm test separately queued. Acceptance criteria 1–5 established; full-suite component of criterion 6 remains pending, so all-criteria verification is not justified yet. No edits or disk-writing suite repeat.
Evidence: A-613, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-613-t-156-review-at-0fae243-clear-with-low-validation-duplication-note.md.

### impl-156 · 2026-10-10T14:24:40.639Z

Full npm test on rebased head 0fae243d864c2abc0d90bac9e7cbe2ad2d11153b passed. Rebased npm run typecheck passed. Log: A-625 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-625-t-156-full-npm-test-log.log.

### impl-156 · 2026-10-10T14:25:13.827Z

Full suite counts on 0fae243: npm test exit 0, hub 1002 passed / 0 failed, Neovim 224 passed / 0 failed, total 1226 passed / 0 failed; no cancelled or skipped. Rebased npm run typecheck passed. C6 evidence complete. Log A-625: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-625-t-156-full-npm-test-log.log. Criterion mark writes await the next live-hub restart per Coordinator.

### coord · 2026-10-10T14:25:22.109Z

Merged 6375089713d3378a4aafc6df09179e9f644e2aed onto dev.
