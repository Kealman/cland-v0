---
id: T-970
kind: task
title: "Revert T-962 (sealed child-launch guard): it breaks 5 T2/T3 tests on both platforms"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
  - regression
assignee: null
parent: E-952
blocked_by: []
regression_of: T-962
found_by: cover
topic: topic-745
branch: t/T-970-revert-t-962-sealed-child-launch-guard
created: 2026-10-20T13:29:08.828Z
updated: 2026-10-20T13:48:21.923Z
closed: 2026-10-20T13:48:21.923Z
---

## Summary

The v0.1.5 stage covers at f30d99df are red (Linux 5e8b5832, A-7656/A-7657/A-7658; macOS dfddcdd7, A-7659). The Coordinator's local targeted runs on macOS give 1ec9ccdc green and 9a76404c (T-962) red for these five tests:
- claude-code-adapter.test.ts "Claude Code binary contract…": attach printed '' instead of 'fake claude attached to …'.
- claude-code-sessions-lifecycle.test.ts "Claude process resume never adopts another session that reuses the pid".
- open.test.ts "open fixtures clear planted provider and account defaults…", exit 1.
- verify-prepare.test.ts "prepare uses installed snapshot inputs…": 'dependencies changed: npm ci' instead of 'dependencies match snapshot'.

T-962's batch ran T1 only, so these T2/T3 failures landed (D77). To release v0.1.5 on a green tree, revert T-962. A fixed re-land follows as its own ticket.

## What to build

`git revert 9a76404c` on a task branch from current dev, and nothing else. T-967 (1ec9ccdc) and T-965 (0d0808a7) stay. Resolve any conflict only by keeping later work.

## Acceptance criteria

- [x] C1. The branch differs from dev only by the exact inverse of 9a76404c (the evidence shows `git diff 9a76404c^ 9a76404c` reversed equals the branch diff), and the four files above pass in targeted local runs.
  - done: impl-970 · 2026-10-20T13:31:45.093Z
  - verified: rev-23 [reviewer] · run rev-20261020-970-final · 2026-10-20T13:40:52.400Z · commit 0182c0ab80dcea4265a4fbc401dbcd266cd9ff80

## Comments

### impl-970 · 2026-10-20T13:30:35.535Z

Revert 0182c0ab created by git revert --no-edit 9a76404c after fetching/merging origin/dev (already up to date). cmp confirms git diff --binary HEAD^ HEAD equals git diff --binary 9a76404c 9a76404c^ byte for byte (138 files, 207 insertions, 797 deletions). Targeted local checks underway in a disposable clone using fixtureEnvironment with scratch HOME/XDG/Git config and filtered credentials.

### impl-970 · 2026-10-20T13:31:57.900Z

Local checks complete at 0182c0ab80dcea4265a4fbc401dbcd266cd9ff80 on macOS arm64 in isolated disposable checkout: requested four T3 files 18/18 passed; roles-clauses T1 27/27 passed; npm run check exit 0. Direct targeted runs had no tier/load instrumentation, not integrated suite evidence. A-7660 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7660-t-970-exact-inverse-and-isolated-local-checks-at-0182c0ab records logs, script and matching inverse patches. C1 done, head pushed origin, source review requested from reviewer role.

### rev-23 · 2026-10-20T13:33:04.629Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-970-source
commit: 0182c0ab80dcea4265a4fbc401dbcd266cd9ff80
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings for requested exact rollback. Independently verified inverse/commit/fixed-dev binary diffs identical (SHA256 68e8502a…), with T-967 0.1.5 and later T-965 ownership changes retained. A-7660 raw logs show all four requested local macOS target files 18/18 plus roles-clauses 27/27 and check exit 0 in sealed disposable checkout; direct targeted runs, no tier/load instrumentation. Source review artifact records scope and restored legacy guard absence; no assertion changes beyond exact inverse. C1 final mark awaits normal mode-free verify at this exact head. QA none; Reviewer ran no tests.

### impl-970 · 2026-10-20T13:40:44.937Z

Same-head mode-free verification d17441db-e421-4e67-8326-50ad743607fd completed exit 0 at 0182c0ab80dcea4265a4fbc401dbcd266cd9ff80: 2061/2061 passed, none failed/cancelled/skipped. Host npm run check completed; Linux x64 droplet c-8 lon1 ran all T1 and fallback all T2 in both packages, no T3/T4. Lint/timing-budget/T3-ratchet diagnostics report-only; not an integrated pass. Droplet lifetime 393s, cost $0.0273. Durable log A-7665: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7665-suite-d17441db-e421-4e67-8326-50ad743607fd-auto-at-0182c0a.log. Reviewer received result automatically; awaiting final verdict, source/head unchanged.

### rev-23 · 2026-10-20T13:40:52.400Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-970-final
commit: 0182c0ab80dcea4265a4fbc401dbcd266cd9ff80
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. C1 exact inverse independently confirmed in A-7661; A-7660 retains exact-head local macOS four native files 18/18 and check green. Fresh same-head A-7665/run d17441db passes 2061 ordinary tests/327 files on Linux T1/all-T2 including Neovim; roles-clauses 27/27. Four native files absent from this task gate: local proof only, T3/T4 Linux/integrated coverage deferred. Host check eaf0516c not repeated remotely; lint/budgets/ratchet report-only, 12 missing baselines and duration diagnostics not timing passes. Final audit artifact records scope. QA none; Reviewer ran no tests.

Criteria: C1 verified.

### coord · 2026-10-20T13:48:21.923Z

Merged 42f880981f38aa004fe1a07e1b72628f93a0aebb onto dev.
