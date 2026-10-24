---
id: T-1221
kind: task
title: 'Landing crew preset: replace "Just me and one agent" with the smallest real crew'
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - site
assignee: null
parent: E-778
blocked_by: []
topic: topic-955
branch: t/T-1221-landing-crew-preset-replace-just-me-and
created: 2026-10-24T09:38:51.795Z
updated: 2026-10-24T09:50:45.008Z
---

## Summary

The human deferred Q-782 (a crew without a Coordinator) to a release after the public launch (General, 2026-10-24 09:38Z). The landing's crew presets in `site/src/pages/index.astro` still offer "Just me and one agent": one Implementer and no Coordinator. As Q-782 said, the preset becomes the smallest real crew instead: a Coordinator and one Implementer.

## Acceptance criteria

- [x] C1. The landing's solo preset shows a Coordinator and one Implementer, with wording that claims nothing a v0.2 crew can't do, and no page under `site/` describes a crew without a Coordinator (grep in the ready report).
  - done: impl-1221 · 2026-10-24T09:41:40.395Z
  - verified: rev-23 [reviewer] · run rev-20261024-1221-source · 2026-10-24T09:50:45.008Z · commit 2895651c790d7064e6f8276cef6e9ba1575804a9
- [x] C2. The site builds (`npm run build` in `site/`), and the change reaches cland.app only through `cland publish`, after the Coordinator's ask to the human.
  - done: impl-1221 · 2026-10-24T09:43:12.962Z

## Comments

### impl-1221 · 2026-10-24T09:40:51.823Z

Read item and audited site/ plus README.md. Change scoped to solo preset in index.astro: Coordinator ×1 and Implementer ×1; smallest-crew wording and role-accurate descriptions. Existing site install absent; will run root npm run check, skip site build per launch limit, and report missing C2 build evidence.

### rev-23 · 2026-10-24T09:50:45.008Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1221-source
commit: 2895651c790d7064e6f8276cef6e9ba1575804a9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1221 full source review — clear

Head 2895651c790d7064e6f8276cef6e9ba1575804a9; tree 39b473ebc17cdc5f6e7b6031e258c391444ee7cf. Fixed incorporated dev parent 85ccc7de454b96e08dd8d21fab81374d3064340f. Scope full; run rev-20261024-1221-source. Reviewed both axes in-session; findings [].

Standards: only site/src/pages/index.astro changes (4 additions/3 removals). The existing preset data/rendering seam now contains Coordinator ×1 and Implementer ×1. Stable solo tab id, responsive card rendering and other presets remain intact; no CSS, dependencies, runtime/config or unsupported automatic review/merge promise is added. Whitespace check clean.

Spec: C1 is source-verified. “Smallest crew” describes one Coordinator leading and one Implementer working tasks/reporting back; both role descriptions match the v0.2 responsibility boundary. Reviewed repository-head searches under site/src and README for the former “Just me”/“No crew” wording and broader Coordinator-free/optional/one-agent/minimal variants. Remaining single-harness wording describes installation credentials; crew.md's minimal reviewed crew explicitly includes Coordinator, Implementer and Reviewer. Aide's lack of crew duty and absent-Coordinator UI states do not advertise a Coordinator-free preset. No remaining unsupported crew claim found. A-10681 retains implementer's wording audit for the ready report.

Evidence: A-10684 reports exact-head local site npm run build exit0,23 pages,1.57s with retained completion excerpt; root npm check is separately attributed to the implementation tree before tracker-only integration, not Astro build evidence. Requested preservation of original native command/stdout/exit/chunk receipts without transcription reruns. No independent Reviewer build/browser/visual QA performed. Root check and configured task run cannot substitute for site build.

Coordinator decision 6a16fcc7 explicitly authorizes linking the existing root site install for the local build and says C2's cland publish happens after landing through the Coordinator's ask to the human; mark done on build and note the boundary. The linked dependency directory was removed after the completed build; no install/publish performed by Reviewer or claimed by implementer. Publication remains the Coordinator's post-landing step, not a source-review blocker or an accomplished deployment.

Source clear permits configured mode-free verification at this exact unchanged head. C2 final evidence settlement awaits retained build provenance and configured receipt; no publication/QA pass is claimed. QA none/after-stage. Reviewer used static source/Git/artifact reads only; no tests/probes/install/edits/Git mutation/browser/delegation. Standards zero findings; Spec zero findings.
Durable review A-10689.

Criteria: C1 verified.
