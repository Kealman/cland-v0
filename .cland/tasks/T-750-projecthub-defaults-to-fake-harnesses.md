---
id: T-750
kind: task
title: projectHub defaults to fake harnesses and fake probes; native probes become opt-in
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-459
branch: t/T-750-projecthub-defaults-to-fake-harnesses
created: 2026-10-17T18:44:08.555Z
updated: 2026-10-18T01:35:45.294Z
---

## Summary

T-748's first runtime trip list (A-4702, A-4703; run f6262d9d) found 424 report-only resource uses in 52 T1/T2 hub files. Most of route R1 (34 files) come from one root: projectHub's default native probes (git, ps, doctor bootstrap) run unless a test passes `probes: 'fake'`. Flipping the default removes the bulk at once.

## What to build

projectHub (and the fixtures built on it) default to `harnesses: 'fake'` and `probes: 'fake'`, with injected Git/readBase facts where a test needs branch state. Tests that really prove native behaviour opt in with an explicit `native` option and carry a T3 header. Every assertion keeps its meaning. The T3 native contract files stay native.

## Acceptance criteria

- [x] C1. The runtime tripwire (T-748) reports no child_process trip in the R1 projectHub files listed in A-4703 (session-*, lead-*, heartbeat, handover, item-lead, permissions, rule-cli, project-clock, in-process-spoke, fake-harness, adapter-composition, codex-*/opencode-native, skills-tracker, suite-protocol, suite-close-component), proved by a full droplet run's trip report.
  - done: impl-750 · 2026-10-17T23:43:59.643Z
  - verified: rev-30 [reviewer] · run rev-20261017-750-final · 2026-10-17T23:45:21.052Z · commit d3fda4f3c40dd3bc24776570a843a54a4844184c
- [x] C2. Every test that relied on native defaults either opts in explicitly in a T3 file or is rewritten with injected facts; the review request maps each, with Mac 5/5 medians before and after.
  - done: impl-750 · 2026-10-17T23:44:00.259Z
  - verified: rev-30 [reviewer] · run rev-20261017-750-final · 2026-10-17T23:45:21.052Z · commit d3fda4f3c40dd3bc24776570a843a54a4844184c

## Comments

### impl-750 · 2026-10-17T21:50:47.963Z

Initial origin/dev merge is current (9bd3425c). Reading A-4702/A-4703; serial Mac before measurements running for 23 R1/default-probe census files, gated on load1 <15. Inventory includes ~100 direct projectHub callers; requested scope decision for native opt-in churn and full droplet backstop. Implementation will preserve injected adapters/Git/readBase precedence.

### impl-750 · 2026-10-17T21:57:23.730Z

Coordinator decisions: named nativeProjectHub wrapper and import-only T3 opt-ins; 5/5 Mac only for R1/body rewrites, ~10 native import samples; authorized full droplet all at reviewed head. Native imports now mapped incl callback-only imports; direct native stdin CLI case moves to T3, resume uses T-745's transferred tempProject commit (8e45aca9), manual/post-merge stop assertions split T2/T3. Baseline suite-close proof A-4752 sent to T-751, which owns its shared remote fact migration.

### coord · 2026-10-17T21:58:24.990Z

Scope note (coord, 21:58Z): trips that reach R1 files through fixtures owned by T-751 are T-751's residual and are judged under T-751's C1. These fixtures are close-run-fixture and remote-fixture, for example in suite-close-component. T-750's C1 counts every other R1 row. The review request and full-run evidence name those rows as "T-751-owned residual".

### impl-750 · 2026-10-17T22:19:20.554Z

Source pushed at 9d8a037bf5febf9823d0bbafc559d2f58facd8ef after merging origin/dev 7ec8680f. A-4794 assertion/scope map and Mac medians; A-4795 every native caller; A-4796 full raw before/after samples; A-4797 targeted trip proof. All27 timing files5/5 and10 native import samples green; 21 owned R1 files zero trips under enforce. C1 awaits same-head droplet receipt with Coordinator-owned residual exceptions; C2 implementation mapped, T-753 merge-policy classification remains explicitly pending as Coordinator instructed.

### impl-750 · 2026-10-17T22:21:44.189Z

Supplemental durable raw reporter proof A-4801 contains all280 green whole-file outputs (27×5 before,27×5 after,10 native samples); environment values redacted. Reviewer measurement question answered with Coordinator decision06ae69bc, which exempts import-only native swaps from5/5 and requires about10 serial samples instead.

### rev-30 · 2026-10-17T22:22:44.260Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-750-source
commit: 9d8a037bf5febf9823d0bbafc559d2f58facd8ef
scope: full
findings: [{"severity":"low","text":"The item-lead after median is stale (5.789s); final A-4796 samples and A-4801 reporter bundle support 1.213s. Publish a supplemental correction; no source-head change needed.","file":".cland/artifacts/A-4794-t-750-review-evidence-defaults-assertions-caller-map-and-mac-medians.md","line":44}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear at 9d8a037b; A-4803. Standards: one low evidence-table discrepancy, no high/medium. Spec: no findings. Native production defaults preserved across territory/merge-lock/compatibility seams; 88 mechanically changed files are import-only, with relocated stop/CLI assertions retained. Caller map covers 89 native opt-ins. Primary 06ae69bc measurement population audited: A-4801 280 raw successful whole-file outputs, 1440 pass/0 fail/cancel/skip; 27 before/after five-run medians checked. C1 remains unverified until full-population exact-head droplet trip evidence; C2 remains unverified pending T-753 classification and runtime proof. Named T-751/T-752 residuals follow primary dispositions d5a3a80c/6621d69b/900f3777. Inspect normal mode-free dry-run, then submit at this head; if dependencies land, authorized integration needs fresh delta review before verification. Do not use all mode to bypass the role restriction.

### rev-30 · 2026-10-17T22:33:21.370Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-750-t753-delta
commit: 3430d7581147415ae2333fdfd3d400d6b5877e3f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-4810. Standards: no findings. Spec: no findings. Coordinator 05fc14b7-authorized integration adds exactly T-753's three T3 lifecycle headers and three manifest retags; bodies after headers and all native caller/production seam code remain unchanged. merge-policy classification is now T3. Previous low evidence discrepancy is resolved by audited A-4804 (item-lead after1.213s). Prior Mac evidence remains applicable; C1/C2 await current T-750 head runtime evidence. Old-head b12077e4 is historical for this final gate. Normal mode-free droplet verify may proceed at unchanged3430d758; no per-item QA.

### impl-750 · 2026-10-17T23:03:25.164Z

d9c6d298/A-4834 failed because the cleanup self-test still planted source assertions in the old combined component file after extraction. Reproduced on Mac; fixed only the cleanup guard to plant into stop-classification-fixture and use the current component driver. Both real runner failure/cancellation cleanup contracts retained. Pushed d3fda4f3; A-4835 contains raw 5/5 before (red, median0.329s) / after (green, median0.972s), load1<15. typecheck/tiers/lint pass; fresh delta review before new verification. Linux old-head owned R1 rows have zero trips, named external residuals remain, Neovim phase was not reached.

### rev-30 · 2026-10-17T23:04:20.506Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-750-cleanup-delta
commit: d3fda4f3c40dd3bc24776570a843a54a4844184c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Cleanup-guard delta source clear; A-4836. Standards/Spec no findings. Sole changed file plants the same assertion/cancellation contract into extracted stop-classification-fixture, runs it through current manual driver and proves helper/signal wiring. All held-work/finally distinction/fake-stop restoration/pending-wait/child-close/result/root-removal assertions remain. A-4835 five original failures→five corrected whole-file passes, median0.972s,maxadmission1.8955. No production/defaults/native-caller/allowance/baseline change. Parent A-4834 remains red historical evidence, not final green. C1/C2 await current-head full-population droplet proof; normal mode-free verify may proceed at this unchanged head.

### rev-30 · 2026-10-17T23:45:21.052Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-750-final
commit: d3fda4f3c40dd3bc24776570a843a54a4844184c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final full-population evidence clear under primary residual dispositions; A-4856. Independently matched original A-4703's exact 34-file R1 population to A-4854 execution: all 175 R1 cases pass; 22 T-750-owned files/115 cases have zero trips. Remaining 74 resource rows are explicitly delegated: 71 T-751 fixture/doctor/lock rows, two T-752 suite-protocol duration-context rows, one T-745 suite-tiers legacy-key row. Every residual identity is named in A-4856; this is not a zero-total-trip claim. Primary d5a3a80c/6621d69b/bac79924 establish scope, and latest d8972c4d permits final settlement on green d3fda4f3 after T-752 lands. Full run c8eaa828 exits zero: 2,494 passes, zero failure/cancellation, eight prerequisite skips; full Neovim completes. All 100 changed test files positively execute, including three native binary contracts. Native/injected caller mapping, accepted 280 raw Mac before/after/sample logs under 06ae69bc exemption, and cleanup 5/5 remain applicable to unchanged source. Three moved/new load gates pass 5/5; no hard budgets/new allowance. No findings; C1/C2 verified. No per-item QA.

Criteria: C1 verified, C2 verified.

### impl-750 · 2026-10-18T00:02:28.085Z

Coordinator-authorized conflict merge of dev b51907e6 pushed at69800204. All12 conflict blocks resolved; normalized11 conflicted test bodies match dev, native imports move to current support/scenario boundaries; T-702 T2 subscription carriers retain fake component fixtures. Kept T-752 durationContext alongside compatibility and forwarded supplied/null context from serveProject; suite-protocol passes null on every serve/reopen. A-4866 holds70 raw serial Mac runs:11 conflicted tests+suite-protocol5/5,9 moved native samples,1 protocol enforce pass with0trips. All load1<15; typecheck/tiers/lint pass (284 report-only findings163files). Native map regenerated. Fresh delta review then required exact-head mode-free droplet run; old d3fda4f3 receipt historical.

### rev-30 · 2026-10-18T00:04:29.021Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-750-conflict-delta
commit: 69800204639ddfb5b2e574f1e8c4feaecf569fb9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec source clear, no findings; A-4867. Primary ad4c4b1b authorizes integration and requires fresh mode-free gate. Independently verified all eleven conflicted tests match incoming dev after only native import alias normalization, all thirteen import-only proofs hold, and all 91 native import occurrences are mapped. T-702 component carriers retain fake facts; four native splits and T-707 scenario/shared setup explicitly retain native boundaries. Suites preserves durationContext plus compatibility; serveProject forwards explicit null while undefined keeps native Git, and protocol reopens all inject null. Raw A-4866 audit: 70 local outputs, 625 passes, zero fail/cancel/skip; protocol enforced eight-case run has zero trips. After-integration measurements remain distinct from original before/after data. No new allowance/timing baseline; incoming owners retained; own whitespace clean. C1/C2 final execution verification remains pending fresh exact-head droplet receipt; d3fda4f3 green evidence is historical. No per-item QA.

### impl-750 · 2026-10-18T01:33:54.051Z

Authorized single integration after T-703 landing pushed ddca0872 (dev parent90fad254). Six conflicts: daemon/dispatch/harness combine all process/Git/candidate/duration/openDatabase and compatibility/territory seams; incoming T2 ask-chain exact and old attribution carrier deleted; durations structurally equals dev minus only obsolete combined-stop allowance. A-4884:55 raw5/5 consumer passes across11 files, six additional enforce guards0trips, updated89-entry caller map. All load1<15; typecheck/tiers/lint pass (276 report-only findings157files). Fresh delta review before required exact-head normal droplet run.

### rev-30 · 2026-10-18T01:35:45.294Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-750-owner-integration
commit: ddca08721218b9f2a4057079f8e10136382c0c78
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec source clear, no findings; A-4885. Primary 58e623b2 authorizes single T-751/T-703 dev integration. Additive daemon/dispatch union preserves database/full Clock, Git/process/lock/candidate/duration seams plus compatibility/hasTerritory/territoryLock; native defaults and explicit null forwarding remain. Harness runtime fake/native behavior unchanged, option type gains opener. Incoming async territory and native PID-reaped migration sources are byte-identical; ask-chain exactly incoming T2 and attribution carrier deleted. All89 native imports mapped independently. Durations structurally equals dev minus only retired combined-stop allowance; no new allowance/baseline. Audited 61 raw local outputs: 541 passes, zero fail/cancel/skip; six enforced guards emit zero trips. Five-run medians agree; admission below15; own whitespace clean. C1/C2 final evidence remains pending required fresh normal mode-free droplet run at unchanged head; A-4876 is parent-only proof. No per-item QA.
