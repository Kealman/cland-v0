---
id: T-1251
kind: task
title: The merge queue demands a root npm install for a scripts-only package.json change
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: topic-1027
branch: t/T-1251-the-merge-queue-demands-a-root-npm
created: 2026-10-24T14:17:14.259Z
updated: 2026-10-25T10:25:07.846Z
---

## Summary

`dependencyInstall` in hub/src/dependency-install.ts flags any changed `package.json` or `package-lock.json` as "dependencies out of date … (required)". T-1204 (1d284bca) changes only the root `scripts.test:static` line, yet `cland merge queue` printed the required-install warning on 2026-10-24 14:16Z. A scripts-only change needs no install, and the false "required" wording pushes the Coordinator toward an `npm install` while shared readers run.

## Acceptance criteria

- [x] C1. A candidate whose package.json differs from dev only outside `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`, `overrides` and `workspaces`, with no lockfile change, gets no dependency-install warning in the queue, the merge result or the Agents topic.
  - done: impl-1251 · 2026-10-25T10:09:14.437Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1251-final · 2026-10-25T10:25:07.368Z · commit caad21251147f6d063a47e4581ccf5033214448a
- [x] C2. A change to any of those fields, or to a lockfile, still gets the warning, covered by a T1 test.
  - done: impl-1251 · 2026-10-25T10:06:02.332Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1251-final · 2026-10-25T10:25:07.368Z · commit caad21251147f6d063a47e4581ccf5033214448a

## Comments

### oc-1251 · 2026-10-25T09:59:28.022Z

Rule 20 consumer inventory for the dependency-install decision (the DependencyInstall wire shape is unchanged: files, command, cwd stay). Consumers searched and migrated or confirmed unaffected:
- hub/src/hub/merge-queue.ts candidate/enqueue: queue entry dependencies (moved to the async candidate read).
- hub/src/hub/merge.ts post-landing diff-tree: result.dependencies and the landing comment (reads the landed commit and its parent).
- hub/src/hub/dispatch.ts: batch landing notice merge-install-required.
- hub/src/hub/agents-topic.ts: lifecycle merge notice (Agents topic).
- hub/src/cli/merge.ts: queue and result text; hub/src/cli/usage.ts help line.
- hub/src/hub/store.ts: persists the optional entry.dependencies opaquely; no shape change.
- hub/src/protocol.ts and shared/wire/index.ts: type declarations unchanged.
- Tests: hub/test/merge-queue.test.ts (T2 queue surface), hub/test/merge-recovery.test.ts (T2 result + Agents notice), new hub/test/dependency-install.test.ts (T1 decision), hub/test/merge-queue-unit.test.ts (T1 queue candidate/enqueue).
- Docs/skills: hub/README.md merge gate, docs/agents/issue-tracker.md, .agents/skills/merge/SKILL.md, and the CLI usage line.
- web/src, nvim, shared/wire: no reader of DependencyInstall or MergeQueueEntry.dependencies (grep confirmed); no client migration needed.

### impl-1251 · 2026-10-25T10:05:43.702Z

Implementation and consumer audit complete. Repeated repository-wide searches (production/CLI/store, hub/bin startup probes, shared wire, web/nvim clients, all hub tests including T3/T4, shipped skills, docs and QA briefs) found no additional dependency-install decision readers beyond the inventory above. Internal queue candidate now computes optional dependencies before enqueue; TaskMerges forwards it. Landing reads landed commit/parent. Existing protocol/store/CLI/lifecycle/batch consumers retain the exact {files, command, cwd} shape; old literal wire-shape CLI regression remains unchanged. No protocol or role permission change; clause text stays at its byte reserve. No QA brief supplied; C1/C2 are covered at T1 plus existing T2 surfaces.
TDD: baseline scripts/version/metadata T1 failures returned an install object instead of undefined; queue candidate and landing scripts-only regressions failed with the same object before wiring. After wiring: dependency-install.test.ts 16/16, merge-queue-unit.test.ts 8/8, merge-queue.test.ts 30/30, merge-recovery.test.ts 19/19; files ran locally one at a time on macOS arm64, no browser. npm run typecheck passed. These are targeted receipts on the current uncommitted tree, not suite evidence; mode-free verification follows source review.

### rev-31 · 2026-10-25T10:07:54.267Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1251-source1
commit: 2ddec0441e530e6d59963f4fe26a23e509d86159
scope: full
findings: [{"severity":"medium","text":"M1: MERGE_USAGE changed but its frozen commands.json block did not; existing frozen-export and root --help byte guards deterministically disagree. Update only the intended frozen block and retain the guards.","file":"hub/src/cli/usage.ts","line":33}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1251 full source review — NOT CLEAR

Head 2ddec0441e530e6d59963f4fe26a23e509d86159, tree b9a99332ca2627e73325c5b5743e586456805a45. Compared dev...2ddec044 (merge-base diff); one task commit. Reviewed Standards and Spec personally; role disables delegation. No tests, builds, probes, edits, fetches or Git mutations performed.

## Standards

M1 (medium), hub/src/cli/usage.ts:33: MERGE_USAGE changes its dependency-install sentence while hub/test/fixtures/cli-usage/commands.json still contains the old sentence. The existing hub/test/cli-usage-compatibility.test.ts:10 deep-equals every production named export with frozenUsage(); hub/test/cli-help.test.ts:31 also compares root --help against those frozen command bytes. These assertions cannot match at the submitted head. Update only the intended MERGE_USAGE frozen block and retain the guards, export composition and help template. This is a deterministic static mismatch, not a claimed test execution. Anchor C1 to the matching help/regression obligation (rule 16); the candidate's underlying metadata-only decision is otherwise implemented.

No other Standards finding: pure T1 decision tests, injected Git candidate tests, T2 component/public CLI and landing/recovery surfaces fit the documented levels and existing sealed/drained fixtures. Canonical test heading/index/tier registration are present. The merge skill is cland-owned, not a kept upstream skill requiring a CHANGES entry. Existing permission boundaries and shared-install mutation prohibition stay unchanged.

## Spec

No additional Spec finding. The six exact fields are compared structurally; object-key ordering alone does not warn. Lockfiles always warn; unreadable/missing/malformed/non-object manifests warn conservatively. Queue manifest reads use the same merge-base/head as the triple-dot path list, avoiding attribution of independent dev updates. The final enqueue freshness/authority validation remains. Landing and resumed recovery read immutable landed parent/commit and propagate the unchanged optional {files,command,cwd} shape into results, durable comments and Agents/batch notices; no installer executes. Added tests cover six fields, metadata-only cases, conservative failures, public queue/CLI output, dependency positive controls and recovery. Rule-20 inventory covers wire/store/client/CLI/notice consumers, and the old wire CLI regression remains.

## Evidence and disposition

A-11673 is an implementation-time local macOS arm64 summary: four targeted files report 16+8+30+19 passes, and typecheck passed; not a configured suite, exact-commit rerun, Linux or browser receipt. It contains summary counts rather than complete original command outputs/exits/timings. Retain the original available tool outputs with their actual precommit source/platform attribution and explicit missing-record limits when preparing correction evidence; do not rerun just for transcription.

Full source NOT CLEAR, one medium Standards finding, zero additional Spec findings. C1 failed for M1; C2 remains done but runtime-unverified. Preserve all final assertions, correct the frozen command block, run the existing focused compatibility/help guards as needed, and request fresh source review at the pushed correction head before one ordinary mode-free configured verification. No dev merge is authorized by this review; QA policy remains none/after-stage.
Durable review: A-11677.

Criteria: C1 failed (M1: changed dependency-install help disagrees with the frozen command block consumed by existing compatibility/help guards.).

### rev-34 · 2026-10-25T10:10:56.926Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1251-source2
commit: caad21251147f6d063a47e4581ccf5033214448a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at caad2125. Standards: M1 resolved by updating only the intended frozen MERGE_USAGE block; existing compatibility/root-help guards, export composition and help template preserved. Full task source reviewed: structural comparisons cover the six specified manifest fields, lockfiles and conservative reads; queue uses merge-base/head and landing/recovery uses parent/commit. Warning consumers retain their wire shape. Spec: no findings. C1/C2 runtime requirements remain unverified pending successful configured verification at this exact head. No Reviewer tests or browser execution.

### rev-34 · 2026-10-25T10:25:07.368Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1251-final
commit: caad21251147f6d063a47e4581ccf5033214448a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged caad2125. Configured run e874d68b / A-11712 passed on Linux x64 droplet, Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell 156.0.8078.4 (v1248). T0/all T1/fallback all T2/Web completed: 3135 passes, no failures/cancellations/skips/todos. T3/T4 not run; duration/test-lint warnings are report-only. Checked recorded passing identities and 5/5 load receipts for all 16 dependency-install cases, both queue candidates, both landing cases and the public scripts-only queue/CLI case; frozen-export/root-help guards passed. Source2 plus these facts establish C1/C2. Standards: no remaining findings. Spec: no findings. No Reviewer rerun.

Criteria: C1 verified, C2 verified.
