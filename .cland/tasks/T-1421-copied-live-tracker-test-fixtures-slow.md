---
id: T-1421
kind: task
title: Copied live-tracker test fixtures slow down as the tracker grows
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1193
branch: t/T-1421-copied-live-tracker-test-fixtures-slow
created: 2026-10-28T10:09:57.493Z
updated: 2026-10-29T17:22:54.364Z
closed: 2026-10-29T17:22:54.364Z
---

## Summary

The copied live-tracker fixtures read the whole project tracker, now about 1,420 items, and their tests slow down as the tracker grows. On droplet runs, web/test/items.test.ts "the Items tree reads the copied live tracker snapshot" took 58.3 s (A-13194), and T-1419 needed allowances of 88 s for that test and 105 s for its file. The same pattern appears in nvim/test/closed-pages.test.ts (30.6 s) and hub/test/item-summary-lua.test.ts (34.3 s) in periodic dev T3 A-13191.

## Acceptance criteria

- [x] C1. The copied-tracker fixtures read a bounded snapshot (a fixed item count or a pinned copy) whose size does not grow with the live tracker, and each test keeps the behaviour it checks.
  - done: impl-1421 · 2026-10-29T16:17:20.443Z
  - verified: rev-31 [reviewer] · run rev-20261029-1421-final1 · 2026-10-29T17:13:03.096Z · commit 699b3b2322a159b9caad9ef15f0a7d4a92f25422
- [x] C2. The T-1419 allowances for web/test/items.test.ts are removed or reduced to the new measured timing at 1.5x.
  - done: impl-1421 · 2026-10-29T16:44:02.897Z
  - verified: rev-31 [reviewer] · run rev-20261029-1421-final1 · 2026-10-29T17:13:03.096Z · commit 699b3b2322a159b9caad9ef15f0a7d4a92f25422

## Notes

Follow-up of T-1419 (shared defect, 2026-10-28). Allowances owned by E-1311 expire 2026-11-04.

## Comments

### impl-1421 · 2026-10-29T16:08:24.502Z

C1 red observed on dev baseline: `AssertionError: default differential uses at most 64 pinned tracker items` at original full-copy boundary (1443 inputs). Baselines macOS arm64: Lua 21.633s/22.387s file; nvim closed-pages 19.678s/20.323s file; startup copied-live 7.293s/13.174s file (including unchanged thousand-row case 5.300s). Plan: fixed 24-item JSON corpus (21 shape-selected originals with ancestor closure + 3 explicit missing-shape rows), shared copier; retain identical all-live Lua oracle as separate T4 file. No hub/src or wire contract changes. Full-copy startup probe remains explicit/manual.

### rev-31 · 2026-10-29T16:17:05.483Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1421-source1
commit: 8e904fdde7436948bd360b95f8f6e2da5397cc09
scope: full
findings: [{"severity":"medium","text":"M1: scale guide and companion hub-status-component guide still describe complete live-copy T3/current removed allowance, contradicting the pinned fixture and deleted allowance. Replace superseded descriptions or label them historical, explicitly separating generated scale, pinned startup, full-live T4 Lua and manual probe (rule16).","file":"docs/agents/tests/hub-test-startup-replies-scale.test.ts.md","line":37}]
finding_counts: {"high":0,"medium":1,"low":0}

Source1 not clear, Standards 1 medium / Spec 0 implementation findings. Consolidated audit A-13779: four default consumers bounded; exact original Lua driver/frame/assertions retained at T4; seeded paging/Web/startup/generated-scale assertions unchanged. Obsolete T-1419 caps removed; Linux measurements must precede any replacement per Coordinator. No Reviewer execution; local summaries not configured evidence.

Criteria: C1 failed (Current startup-fixture guidance contradicts the implemented bounded corpus and retained full-copy boundaries; resolve M1 before verification.).

### rev-31 · 2026-10-29T16:18:01.816Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1421-source2
commit: c312b89616e889fb778456d60315b67be6f5da56
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear; M1 resolved in two-guide-only correction, prior full source audit unchanged. A-13780. Standards/Spec 0 remaining findings. C2 source-established by removal of obsolete T-1419 88/105s caps; C1 final runtime verification awaits same-head original configured named receipts including changed T3/T4. Linux-first sizing per Coordinator remains required before adding replacements; any subsequent head needs source review. No Reviewer execution.

Criteria: C2 verified.

### rev-31 · 2026-10-29T16:43:54.548Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1421-evidence1
commit: c312b89616e889fb778456d60315b67be6f5da56
scope: evidence
findings: [{"severity":"medium","text":"E1: original Web22976 enforces the new pinned parent duration9.404423108s>5s with no allowance; Web/suite exit1 despite4156 ordinary+5 load passing tests. Approved manifest correction requires fresh source review and changed-head verification; failed receipt cannot settle final evidence.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence1 not clear at c312b896, original b2015b9d/A-13809 retained failed. Native case/assertion passes are distinct from Web/suite1. T0/T1/allT2/changedT3/T4 succeeded; all8 Items cases pass, pinned measurements retained, no behavioral failure diagnosed. Full audit A-13810. Coordinator da798b54 approves15s Web/15.2s generated startup R-1278 and T4 allowance removal; source review of actual manifest successor precedes retry. No Reviewer execution.

Criteria: C2 failed (Configured run failed enforced duration gate for renamed pinned Web parent; complete approved measured allowance correction and fresh passing evidence before final settlement.).

### rev-31 · 2026-10-29T16:55:29.435Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1421-source3
commit: 699b3b2322a159b9caad9ef15f0a7d4a92f25422
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at manifest-only successor; Standards/Spec0. Exact Coordinator da798b54-approved15s Web/15.2s generated startup R-1278 caps cite actual Linux sizing and failed suite attribution; T4 allowance removed. Seven-day expiry2026-11-05 respects unchanged validator179–182 versus Coordinator's approximate two-week suggestion; reported distinction retained. All source2 fixtures/assertions/docs/tier mappings unchanged. A-13824. Prior A-13809/A-13810 remain failed historical evidence; final C1/C2 verification awaits new configured same-head receipt. No Reviewer execution.

### rev-31 · 2026-10-29T17:13:03.096Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1421-final1
commit: 699b3b2322a159b9caad9ef15f0a7d4a92f25422
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear C1/C2, source3 unchanged. Original A-13844/046d0944 exacthead4156 ordinary+5 load passes; T0/T1/allT2/changedT3/T4/Web all0. Corpus1+5/5, pinnedLua24+3/0differences0.6917s, pages1.7589s, startup0.3609s, Webparent9.3939s<15cap, generated9.6603s<15.2cap, unchanged full-liveT4 1444+3/0differences30.8541s. All8 Items cases pass. Prior A-13809 remains failed historical sizing, not relabeled. Original advisory stanza not committedcap. Linuxc8lon1 Node24.21/nvim0.12.5 CHS156/v1248 host73911332 reused/report-onlywarnings and absent remainingtiers retained. A-13845 includes exact case/load lines and local-vs-Linux table; no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T17:22:54.364Z

Merged 615857a88686546bad7e23e42245165c1cb56d9d onto dev.
