---
id: T-1237
kind: task
title: The T0 child-environment guard does not cover nvim/test
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1052
branch: t/T-1237-the-t0-child-environment-guard-does-not
created: 2026-10-24T11:55:41.896Z
updated: 2026-10-25T12:48:54.162Z
closed: 2026-10-25T12:48:54.162Z
---

## Summary

The T0 child-environment guard that statically enforces rule 15 (sealed child environments) covers hub/test only. Neovim tests under nvim/test spawn native children (clients, launchers, QA subprocesses) that escaped it until T-1012 sealed them by hand. impl-1012 proposed it during T-1012.

## Acceptance criteria

- [x] C1. The T0 child-environment guard scans nvim/test as well as hub/test and refuses an unsealed child launch there (test).
  - done: impl-1237 · 2026-10-25T12:26:53.398Z
  - verified: rev-26 [reviewer] · run rev-20261025-1237-evidence-1 · 2026-10-25T12:43:16.315Z · commit 71eebe1ce86f71834e1d0580dc4d6cabcc1aa4c7
- [x] C2. The guard passes on dev after T-1012 lands, with no new exemptions (test).
  - done: impl-1237 · 2026-10-25T12:26:53.483Z
  - verified: rev-26 [reviewer] · run rev-20261025-1237-evidence-1 · 2026-10-25T12:43:16.315Z · commit 71eebe1ce86f71834e1d0580dc4d6cabcc1aa4c7

## Comments

### impl-1237 · 2026-10-25T12:23:16.708Z

Rule 20 consumer inventory before guard-scope change: production entry is package.json test:static (also npm run check / verifier T0); compiler cases and real --inventory are in hub/test/lint-child-environment.ts. Newly governed callers are all TypeScript/JavaScript sources under nvim/test, including harness.ts, launchers and QA subprocess helpers, using the existing trusted test-support/fixture-environment.ts builder. Existing hub/test callers and exemptions keep their contract. Documentation consumers: --help, hub/README.md child-environment section, docs/agents/tests.md guard scope, shipped .agents/skills/implement/SKILL.md. Repository-wide search found no persisted readers, wire clients, startup probes, QA brief examples or T1–T4 consumers parsing this guard's output. This adds source scope only: no wire/reply change, credential builder change, new exception or new permission. Existing role clause rule 15 already covers every test launcher and needs no new lines. Regression seam: existing T0 in-memory compiler cases + real source inventory; add scope-positive nvim/test and scope-negative controls, and run builder acceptance/refusal cases for both roots.

### impl-1237 · 2026-10-25T12:27:22.157Z

Implementation committed and pushed at f14aa797. TDD/local receipts: A-11902, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11902-t-1237-tdd-and-local-evidence.md. Local macOS arm64 targeted checks passed: T0 in-memory scope/compiler controls plus real inventory (316 launches, all 16 Neovim sites sealed), nvim/test/qa.test.ts 25/25 including sandbox tests, root typecheck, closed-wording and provenance guards. C1/C2 done. Source review requested from reviewer in topic-1052 and resolved to a Reviewer; mode-free verification waits for clear source verdict. No new runtime test cases or exemptions.

### impl-1237 · 2026-10-25T12:28:50.649Z

Reviewer M1 reproduced: test-docs.test.ts refused the T0 guidance page with “hub-test-lint-child-environment.ts.md: test file heading”. Corrected in 71eebe1c: removed invalid per-test document/index row, retained guidance in existing shared guard section, unchanged test-docs guard. Same targeted test now 3/3 green, closed-wording clean. Original TDD receipts A-11902 preserved; M1 evidence A-11904 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11904-t-1237-review-m1-correction.md). Pushed 71eebe1c and requested fresh source review; full verification held.

### rev-26 · 2026-10-25T12:29:32.670Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1237-source-1
commit: 71eebe1ce86f71834e1d0580dc4d6cabcc1aa4c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full Standards/Spec source CLEAR, A-11905, at corrected actual head 71eebe1c. Complete six-file diff from 0026fcd0 inspected. Preliminary M1 resolved: invalid T0 per-test guide/index removed, shared guard guidance retained and existing docs guard unchanged. Production glob and scope controls share both roots/extensions; same in-memory compiler matrix and real-file inspect path, detector/trust/exemption semantics unchanged. Sandbox probe keeps complete builder return/direct env and cached owned HOME; no new native launch or exemption. Both axes zero remaining findings. A-11902/A-11904 local inventory/red-green summaries inspected with source/capture limits; preserve originals without transcription reruns. C1/C2 final marks pending one ordinary mode-free configured receipt at unchanged 71eebe1c. No reviewer execution/delegation, Linux/QA/landing claim.

### impl-1237 · 2026-10-25T12:43:01.264Z

Configured verification 9a31ba8a-b070-47df-a1a1-13d122c4ae83 at unchanged source-clear 71eebe1c is green: T0, all T1, all T2 fallback, Web, changed T3 nvim/test/qa.test.ts only; 3224 pass / 0 fail / 3 skip. Linux droplet c-8 lon1, Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell 156.0.8078.4 (v1248). Log A-11926 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11926-suite-9a31ba8a-b070-47df-a1a1-13d122c4ae83-auto-at-71eebe1.log. Changed T3: 22 passed, three macOS sandbox skips; macOS targeted receipt previously had 25/25. Remaining T3/T4 deferred; budgets/test lint report-only, with Web wall warnings. No new runtime test identity was added; new controls are in-memory T0. Final evidence review requested; Reviewer retains settlement.

### rev-26 · 2026-10-25T12:43:16.315Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1237-evidence-1
commit: 71eebe1ce86f71834e1d0580dc4d6cabcc1aa4c7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR, A-11928; carry source-1/A-11905. Original A-11926 independently decoded: 3224 ordinary passes, three explicit unchanged macOS sandbox skips, 441 file passes, no load-gate records. T0 line73 confirms child-environment guard success; host prepared-tree guard blob equals reviewed commit, proving expanded real scan/compiler cases without new exemptions. T0/all T1/fallback all T2/changed Neovim T3/Web passed; docs guard 3/3. qa.test.ts is 22 pass/3 skip on Linux, not 25 Linux passes; earlier local macOS25/25 retains original source/capture limits. Remote typecheck not repeated, report-only lint/timing diagnostics retained. C1/C2 verified, zero findings on both axes; Coordinator owns enqueue/merge, no QA/landing claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T12:48:54.162Z

Merged bf26b423e19301a7ffe48cc5f2057b66d8866984 onto dev.
