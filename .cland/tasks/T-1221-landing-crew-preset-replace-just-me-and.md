---
id: T-1221
kind: task
title: 'Landing crew preset: replace "Just me and one agent" with the smallest real crew'
state: closed
status: done
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
updated: 2026-10-24T10:17:02.194Z
closed: 2026-10-24T10:17:02.194Z
---

## Summary

The human deferred Q-782 (a crew without a Coordinator) to a release after the public launch (General, 2026-10-24 09:38Z). The landing's crew presets in `site/src/pages/index.astro` still offer "Just me and one agent": one Implementer and no Coordinator. As Q-782 said, the preset becomes the smallest real crew instead: a Coordinator and one Implementer.

## Acceptance criteria

- [x] C1. The landing's solo preset shows a Coordinator and one Implementer, with wording that claims nothing a v0.2 crew can't do, and no page under `site/` describes a crew without a Coordinator (grep in the ready report).
  - done: impl-1221 · 2026-10-24T09:41:40.395Z
  - verified: rev-23 [reviewer] · run rev-20261024-1221-source · 2026-10-24T09:50:45.008Z · commit 2895651c790d7064e6f8276cef6e9ba1575804a9
  - verified: rev-23 [reviewer] · run rev-20261024-1221-final · 2026-10-24T10:08:13.456Z · commit 2895651c790d7064e6f8276cef6e9ba1575804a9
- [x] C2. The site builds (`npm run build` in `site/`), and the change reaches cland.app only through `cland publish`, after the Coordinator's ask to the human.
  - done: impl-1221 · 2026-10-24T09:43:12.962Z
  - verified: rev-23 [reviewer] · run rev-20261024-1221-final · 2026-10-24T10:08:13.456Z · commit 2895651c790d7064e6f8276cef6e9ba1575804a9

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

### impl-1221 · 2026-10-24T10:05:52.815Z

Same reviewed head 2895651c790d7064e6f8276cef6e9ba1575804a9: mode-free verify f5a4fa3f-e227-4744-8c62-9384759b9e53 exited 0, 2900/2900 tests. Linux x64 droplet c-8 lon1, Node v24.21.0/Neovim v0.12.5; T1, fallback all T2 in both packages, Web completed; duration/T3-ratchet lint gates report-only. T3 not run, deferred to periodic dev/integrated occasions. A-10712 is the native run log. Post-run fetch origin/dev at 63e0e0b0; git merge-tree --write-tree HEAD origin/dev exited 0, conflict-free tree e87a553e. Task head unchanged, clean, and already pushed to local territory. Final Reviewer settlement pending; no merge or publication.

### rev-23 · 2026-10-24T10:08:13.456Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1221-final
commit: 2895651c790d7064e6f8276cef6e9ba1575804a9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1221 final evidence review — clear

Exact reviewed head2895651c790d7064e6f8276cef6e9ba1575804a9/tree39b473ebc17cdc5f6e7b6031e258c391444ee7cf; origin task ref independently matches. Source A-10689 remains accepted; C1's wording/crew/search proof carries forward. Run rev-20261024-1221-final, scope evidence, findings []. C1/C2 verified under Coordinator's recorded publication disposition.

A-10696 supersedes manually transcribed A-10694. It mechanically preserves five original native chunks with source attribution: local macOS root check at implementation tree based c6abaeb1 plus site patch before tracker-only dev merge, terminal b620f3 exit0; exact committed-head site npm run build, terminal0ab36d exit0. Astro23pages/1.57s, Pagefind23HTML files, sitemap completion present. i18n/404 warnings retained. The manual version omitted a guard line and altered guard/asset strings/minor image timings; no checks were rerun. No end-to-end check wall time inferred from polling. Site build is distinct from root Web build.

Fresh configured mode-free f5a4fa3f-e227-4744-8c62-9384759b9e53/A-10712 finishes exit0 at this head. Native ordinary finishes2900tests/419files allpass, no fail/cancel/skip; zero load-gate finish records, so generic five-repetition headers are not claimed as repetitions. Completed T1, fallback all hub/Neovim T2 and complete Web44files/223tests. No T3/T4 execution claimed.

Hub executor provenance: Linuxx64 6.8.0-142-generic c-8lon1 cland-v0-035383c0, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime728s/$0.0505. Full host check retained; gate62ab2ad22a199a020520fda42a959b584005958e independently tree object, reused not repeated remotely. Actual suite walls60.39/372.20/170.12s, Web shard169.99s; envelope65/377/175s and projections are different measures. Report-only lint133/60files, two missing baselines, incomplete ratchet timings, unrelated Web/scale/Neovim warnings retained. Slow disk health fsync551.85ms/SQLite1501.05ms is reported, not a reason to erase warnings or assert enforcing budget compliance. No new test identity/allowance requirement in this wording-only change.

Implementer37507650 reports post-result fetch origin/dev63e0e0b0 and read-only merge-tree exit0/treee87a553e, no conflicts, head clean/pushed/unchanged; no dev integration performed. C2 build requirement is established by exact-head local Astro receipt, not the configured root suite. Coordinator6a16fcc7 explicitly deferred cland publish until after landing and its human ask; publication has not occurred or been claimed. This settlement follows that authority and leaves the actual deployment to that route. No independent browser/visual or stage QA claim; QA none/after-stage.

Reviewer static source/Git/artifact inspection only; no tests/probes/install/edits/Git mutation/browser/delegation. Standards/evidence clear; Spec/evidence clear.
Durable review A-10718.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T10:17:02.194Z

Merged 170058913cc77e0af5d8ef1b25de71010d964a7e onto dev.
