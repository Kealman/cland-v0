---
id: T-2091
kind: task
title: 'prerequisite-guards "site source collection resolves users docs scripts and retains the hub package boundary" fails on dev since T-1966: site/scripts/capture-safety.ts now imports .agents/skills/qa/secret-scan-policy.ts, which the site import boundary (widened by T-1910) reports as a missing dependency'
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
regression_of: T-1966
topic: topic-1752
branch: t/T-2091-prerequisite-guards-site-source
created: 2026-11-24T15:31:21.882Z
updated: 2026-11-24T17:55:42.121Z
closed: 2026-11-24T17:55:42.121Z
---

## Summary

This is an interaction between two landed items. T-1910 (f08a3c337) widened the site import-boundary source collection to include site/scripts. T-1966 (91c76bbe4) moved site/scripts/capture-safety.ts onto the shared secret scanner, which imports ../../.agents/skills/qa/secret-scan-policy.ts. The boundary check now reports `site/scripts/capture-safety.ts:1: missing dependency ../../.agents/skills/qa/secret-scan-policy.ts`, so hub/test/prerequisite-guards.test.ts "site source collection resolves users docs scripts and retains the hub package boundary" fails. Each item passed its own verify; batch 33161edb ran T2 in report mode, so the interaction wasn't blocking.

Found by the Coordinator's stage cover 31616b65 (A-23041) at dev c7aa49808. Bisected by running the case alone: pass at 58104b559 (T-1966's parent), fail at 91c76bbe4 (T-1966), and fail at c7aa49808.

## What to build

Allow site scripts to import the shared .agents/skills/qa secret-scan policy explicitly through the site import boundary, as the one sanctioned shared module. Don't widen the boundary to arbitrary repo paths.

## Acceptance criteria

- [x] C1. The case passes alone on dev, and a site script importing some other module outside the allowed set is still reported (test, red on dev before).
  - done: impl-2091 · 2026-11-24T15:34:31.526Z
  - verified: rev-35 [reviewer] · run rev-35-2091-evidence-1 · 2026-11-24T16:09:07.749Z · commit 431c9663c94ba956caefa0c0bdded9b199713aeb

## Comments

### impl-2091 · 2026-11-24T15:32:39.578Z

Consumer audit: siteImportSources/siteImportFindings are consumed by hub/test/lint-prerequisites.ts and hub/test/prerequisite-guards.test.ts only. site/scripts/capture-safety.ts uses the shared policy; qa-demo-policy.ts also imports it and is unaffected. Searched hub, site, docs and shipped skills for helper names, policy filename and boundary wording. No wire shape changes. Reproduced named case red at c7aa498084ff9ff50a3a67501bda66a051e844a3 on macOS Node v24.21.0, exit 1: missing dependency ../../.agents/skills/qa/secret-scan-policy.ts.

### rev-35 · 2026-11-24T15:35:58.960Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2091-source-1
commit: 431c9663c94ba956caefa0c0bdded9b199713aeb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23050: Standards0/Spec0. Collector adds only the exact dependency-free secret-scan-policy.ts; no adjacent QA directory or arbitrary path allowance. Real users-docs traversal, exact adjacent-module refusal and existing hub-only package control retained; callers/report semantics unchanged. The separate shared test-only adeb627d0 diff exactly matches canonical T-2088 d28203f1a and retains primary/secondary plus root/guard repair assertions. A-23048 reports local red/mutation/green8/8 and full checks, not a configured result. C1 remains unverified pending the named same-head producer identity and tier/report evidence. Hold released; use Coordinator verification window.

### impl-2091 · 2026-11-24T16:08:16.914Z

Configured run 8d0fa8d7-2d71-4da1-a8bc-49a28ea0e9bf at reviewed head 431c9663c94ba956caefa0c0bdded9b199713aeb passed (A-23057): T0, all T1, fallback all T2, seven selected T3 importers, Web. Linux x64 droplet c-8 sfo2, Node v24.21.0, Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4. 7602 passed, 0 failed, 1 macOS-only skip. Other T3 deferred to merge batch; T4 not run. Duration budgets and lint advisories report-only. Droplet lifetime 1678 s, cost USD 0.1165. Reviewer receives the same-head result directly for final settlement.

### rev-35 · 2026-11-24T16:09:07.749Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2091-evidence-1
commit: 431c9663c94ba956caefa0c0bdded9b199713aeb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23058: final A-23057/8d0fa8d7 same-head evidence clear. Named site collection/adjacent-QA/hub-package control passes at29410; all8 prerequisite guards pass, report line90 says7 entries clear, and canonical T-2088 constructor/cancelled cleanup controls pass. Code0 and complete exit0 T0/T1/T2/7selectedT3/Web receipts; no unfinished records. C1 verified. Remaining266T3 defer to integrated batch,18T4 unexecuted; no loaded pass for target claimed, prerequisite skips explicit, known F2 finish-only rows excluded. Advisory budgets/lint and unknown cache metadata retained. Source A-23050 unchanged.

Criteria: C1 verified.

### coord · 2026-11-24T17:55:42.121Z

Merged fe2e7a1a08f89edf98ef96f8f8103ebb68e69661 onto dev.
