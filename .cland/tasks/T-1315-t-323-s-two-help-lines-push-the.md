---
id: T-1315
kind: task
title: T-323's two help lines push the Artifacts help line off screen and break ARTIFACT-001
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
regression_of: T-323
found_by: cover
topic: topic-1057
branch: t/T-1315-t-323-s-two-help-lines-push-the
created: 2026-10-25T15:29:38.746Z
updated: 2026-10-25T15:54:55.803Z
closed: 2026-10-25T15:54:55.803Z
---

## Summary

T-323 (9b3ae9f9) added two explanatory lines to the Neovim help (`M.HELP` in nvim/lua/cland/init.lua): "Early plan navigation waits for task and tracker snapshots; missing items are reported" and "Late role defaults fill untouched launcher fields once role.list arrives". They push the Artifacts line ("␣v in artifact") below the visible help window, so the shipped QA case ARTIFACT-001 times out at its `wait_for … 'toggle in help'` step (INCONCLUSIVE). Fails 3/3 on dev 83d5c7fc and at 9b3ae9f9; passes at its parent 9f31a3b7 (Coordinator, local macOS). Caught by the Linux stage cover c915ca99 (A-12008). The help lists keys and commands; behaviour explanations belong in docs (project rule).

## Acceptance criteria

- [x] C1. The two behaviour lines leave `M.HELP`; their content lives in nvim/README.md or the docs instead. `nvim/test/qa-shipped.test.ts` "ARTIFACT-001 passes through the headless QA runner" passes locally 3/3 and in the item's mode-free verify on Linux, with the case unchanged.
  - done: impl-1315 · 2026-10-25T15:32:05.876Z
  - verified: rev-31 [reviewer] · run rev-20261025-1315-final · 2026-10-25T15:48:52.406Z · commit 79f3f2053cb32eb2d3690158ec168e2b9879b101

## Comments

### impl-1315 · 2026-10-25T15:30:21.361Z

Clean inherited worktree. C1 already names the agreed public seam: unchanged shipped ARTIFACT-001 through qa-shipped.test.ts. Reuse that existing regression for red/green rather than add a duplicate test. Scope is help text and README only; no shared wire/schema/admission contract change.

### impl-1315 · 2026-10-25T15:30:41.869Z

Red receipt on clean head 8d4d5650 (local macOS): unchanged `ARTIFACT-001 passes through the headless QA runner` fails, 5487.949 ms, result INCONCLUSIVE, exact message `wait_for timed out after 5000 ms: toggle in help`; assertion expected PASS. This matches C1's diagnosed help overflow. No test edits needed; reuse the shipped test unchanged.

### rev-31 · 2026-10-25T15:33:14.914Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1315-source1
commit: 79f3f2053cb32eb2d3690158ec168e2b9879b101
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR, Standards0/Spec0, A-12015. Exact tree1fcaa84b6726bddad241a1cb7cec3e621aa95aea, base8d4d5650. Only two behaviour prose lines leave M.HELP; early-plan wait/missing-item explanation added to README and delayed-role defaults already retained at README:78, preserving typed values/different harnesses. Actual key/command mappings and registered help generation unchanged. ARTIFACT-001.lua and qa-shipped.test.ts byte-identical; real keys/visible-grid/help/raw/rendered/palette/native-exit assertions intact. tiers.json maps init.lua to existing T4 shipped walk once, matching documented read-path selection and exact guide; no new identity/dependency/timeout/allowance. A-12014 local exact failure and three passing candidate-source invocations retained with summary/precommit/platform limits; no Reviewer execution. C1 remains runtime-unverified until required exact-head Linux mode-free verification and named ARTIFACT-001 evidence. Preserve original local outputs/exits/timings without transcription reruns; final review records actual mappedT4 phases/Neovim/browser/report-only limits. Affected after-stage QA remains separate.

### rev-31 · 2026-10-25T15:48:52.406Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1315-final
commit: 79f3f2053cb32eb2d3690158ec168e2b9879b101
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR, C1 verified; A-12020 carries full source A-12015 at unchanged tree1fcaa84b6726bddad241a1cb7cec3e621aa95aea. Original configured4ad40d51/A-12018 independently parsed3248 ordinary passes/no load additions/fail/cancel/skip/todo. Exact required shipped ARTIFACT-001 finish passes0.807988328s; unchanged wrapper asserts QA PASS and native exit0. All32 mappedT4 identities execute once, no repetitions; real-key/visible-grid/help/raw/rendered/palette assertions remain unchanged. Local3/3 and exact original help-overflow red retained in A-12014/manual transcript summary with precommit/platform/raw-capture limits; no transcription reruns. HostT0/allT1/fallbackallT2/mappedT4/Web complete; noT3/otherT4/providerQA/stage/allclaim. Actual Linux/Neovim/browser provenance, reused host gate TREE3d3b49ca and timing distinctions retained. Lint133/60, ten duration warnings/five missing baselines, actualWebwall172.807s vs40 and unchanged ratchet are report-only, not enforced-budget passes. No new identity/allowance/source change. Fresh conflict check/ready next, Coordinator enqueue/separate verification; affected after-stage QA remains separate. Reviewer read-only.

Criteria: C1 verified.

### coord · 2026-10-25T15:54:55.803Z

Merged fbb21716e1d9f6deb47b8d6d1f7d8eba73e96db4 onto dev.
