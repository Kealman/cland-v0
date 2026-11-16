---
id: T-1768
kind: task
title: projectHub T2 fixtures reach native sysctl through the default lock identity
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1557
branch: t/T-1768-projecthub-t2-fixtures-reach-native
created: 2026-11-09T06:56:35.201Z
updated: 2026-11-16T21:22:25.576Z
closed: 2026-11-16T21:22:25.576Z
---

## Summary

A T2 test that starts `projectHub` without an explicit `lockIdentity` reaches native `child_process.execFileSync`, along the chain `fixtureLockIdentity` (`hub/test/harness.ts:462`) → `lockHostIdentity` → `sysctl`. The T2 tier tripwire forbids that, and its enforce-mode probe catches it. Found by impl-1751 during T-1751 (2026-11-09). T-1751 injects a fixture identity only in its own cases.

## Acceptance criteria

- [x] C1. projectHub under T2 defaults to a fixture lock identity with no native process call; native identity stays opt-in, used explicitly by T3 and by the T2 files whose native CLI reads the lock, which T-1915 then classifies (test).
  - done: impl-1768 · 2026-11-16T16:11:08.464Z
  - verified: rev-35 [reviewer] · run rev-35-1768-final-1 · 2026-11-16T16:47:14.687Z · commit 710cc489a1dab540384009fe988af9cbc10054fe
- [x] C2. An enforce-mode tripwire run over the projectHub-based T2 files reports no native process call from projectHub's own default hub lock path (lock identity or process-start probe); other native calls the run finds are recorded in an artifact for a follow-up item (test).
  - done: impl-1768 · 2026-11-16T16:11:08.911Z
  - verified: rev-35 [reviewer] · run rev-35-1768-final-1 · 2026-11-16T16:47:14.687Z · commit 710cc489a1dab540384009fe988af9cbc10054fe

## Comments

### coord · 2026-11-09T06:56:47.853Z

Probable cause (coord): `fixtureLockIdentity` falls back to native `sysctl` when `CLAND_TEST_LOCK_IDENTITY` is unset, and the suite runner sets that variable. impl-1751's probe was a direct `node -e` run outside the runner. This looks like the same direct-run class as T-1766 (project-probes); see also T-1640. Triage could fold both into one fix: test files fail loudly, or self-provide the runner env, when run directly.

### coord · 2026-11-09T06:59:01.530Z

A second producer of the same class, found by impl-1751 (T-1751): a projectHub restart in T2 runs Dispatcher startup sweep → DropletExecutor.sweep → sweepProjects → spend.locked → acquireLockWithRetry → native processStartedAsync, because the droplet executor's dependencies.processes is absent. projectHub takes droplet dependencies separately from hub options.processes. T-1751 injects droplet.processes in its own fixture. A shared fix would default both fixture facts under T2.

### impl-1768 · 2026-11-16T14:43:08.879Z

Red captured before fix on macOS, Node 24.21.0, direct project-probes.test.ts: new standalone fixture test persisted actual host identity instead of fixture-host/fixture-boot; existing child census failed with actual { execFileSync: 1 }, expected {}. No suite run. Fix keeps runner-provided identity but standalone fallback is synthetic; explicit lockIdentity: 'native' is the T3 opt-in (nativeProjectHub sets it). Production files untouched.

### impl-1768 · 2026-11-16T14:47:58.862Z

Rule 20 consumer sweep searches projectHub/nativeProjectHub/fixtureLockIdentity/CLAND_TEST_LOCK_IDENTITY/lockHostIdentity across production, hub/nvim/web tests (T3/T4 included), helpers, scripts, shipped skills, docs and QA briefs. Full per-file inventory staged for artifact. Native wrapper callers now opt into lockIdentity:'native' centrally; release's probes:'native' fixture and worktree-cli's native status/start fixtures opt in explicitly; task-migrate and telegram-polling-restart already inject lockHostIdentity(). Doctor helper uses shared fixtureLockIdentity. Other embedded fixtures retain fixture identities; production identity readers and wire shapes unchanged.

### impl-1768 · 2026-11-16T14:52:09.620Z

Complete per-file rule 20 sweep published as A-20184 (use the complete consumer sweep artifact in topic-1557; earlier malformed inventory artifacts archived). Native wrapper callers grouped by tier, plus explicit identity controls and fixture-default/unchanged reader consumers. Production, scripts, skills, docs and QA briefs included.

### impl-1768 · 2026-11-16T14:52:20.073Z

Inventory artifact id correction: A-20185, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20185-t-1768-complete-consumer-sweep-by-tier-and-identity-choice.md.

### impl-1768 · 2026-11-16T15:16:06.157Z

Coordinator narrowed scope after 239-file census: ten existing native CLI reader files explicitly opt into shared nativeIdentityProjectHub (auth-mode, config-reload-component, config-set, hub-priority, hub-status-component, merge-queue, roles-component, startup-ready-component, suite-protocol, suite-wait-metrics). Their T2 classification and remaining findings move to T-1915. Default fixture remains synthetic; runner-provided identity is retained. Findings A-20205, raw A-20206, original dev/head comparisons A-20200. Typecheck now passes locally (macOS Node 24.21.0).

### rev-35 · 2026-11-16T15:33:02.074Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1768-source-1
commit: 036abd7bb154f3a4c6797a86555cc5bcd230d8a8
scope: full
findings: [{"severity":"medium","text":"Final ...options overwrites probes.processes for valid {processes:undefined}, despite earlier fake fallback computation. serveProject/acquireLock then uses native processStarted. Normalize resolved fake-probe process table after options while preserving explicit tables/native opt-in; add owned zero-child explicit-undefined control. No documented exclusion/owner (claimant confirmed).","file":"hub/test/harness.ts","line":527},{"severity":"medium","text":"Three new callbacks (standalone identity, two-lifetime ledger loop, lifecycle native identity) have no whole admitted-work fence/join before root disposal; late projectHub/startup/until/readFile/next loop can race teardown. Existing resource stops/census do not join body. Register shared owner before acquisition, adopt late resources, fence/join before disposal/env restoration, retain roots on missing settlement; add owned held-work/startup-failure control.","file":"hub/test/project-probes.test.ts","line":59}]
finding_counts: {"high":0,"medium":2,"low":0}

Complete full21-file pass A-20219 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20219-t-1768-full-fixture-lock-source-review-at-036abd7bb.md. Synthetic/runner defaults/native wrappers/ledger injection otherwise consistent; production unchanged. Coordinator70e9ae33/a1c5a8d7 ten-file native compatibility exception and T-1915 scope honored. A-20185 all653 path tiers independently match; A-20205/06 239direct census is212exit0/25completedfail/2incomplete, not tier pass or current-head universal coverage. A-20212–14 positives and A-20218 original producer/capture/unknowns retained; dynamic Claude caller remains unknown. C1failed,C2done/unverified. Hold released for consolidated fixes/fresh head source request before verification; no Reviewer runtime or broad/full/all request/dev merge.

Criteria: C1 failed (Optional undefined process table can restore native probing; new regression sequences lack failure-path whole-work ownership.).

### rev-35 · 2026-11-16T15:54:07.303Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1768-source-2
commit: bfd6c195327c29a3322ba279adda2a89596cb5eb
scope: full
findings: [{"severity":"medium","text":"The three corrected callbacks and held controls still await tempProject before constructing their work owner. Cleanup during initial account/root acquisition can finish before a late root is adopted. Compose the existing test-support fixtureWork before acquisition, capture late root/resources before the next fenced step, and join the whole sequence before removal/restoration; retain a held initial-acquisition control. This is the remaining part of the previous lifetime finding.","file":"hub/test/project-probes.test.ts","line":64}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete seven-file repair pass recorded in A-20230. processes:undefined normalization is fixed; explicit tables/native defaults and accepted ten compatibility exceptions preserved. Sole remaining medium is pre-root acquisition ownership; implementer confirms no earlier owner. A-20227 positive normal/post-root receipts retained with stated provenance limits, not proof of initial-root closure. C2 remains done/unverified. Pin released for consolidated correction using shared owner, then fresh source review at a clean committed head before verify; no dev merge required.

Criteria: C1 failed (Regression fixtures still lack ownership over initial tempProject acquisition; post-root controls do not prove this failure path.).

### rev-35 · 2026-11-16T16:12:44.591Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1768-source-3
commit: 710cc489a1dab540384009fe988af9cbc10054fe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Complete six-file repair pass clear A-20236. Shared admitted-work core composed before first async acquisition; late root remover/guard captured before abort check, full body and late resources joined before restoration/removal, failed settlement retains root. Owned held-initial-acquisition/startup/read controls retain positive final assertions. Earlier processes:undefined normalization and explicit/native compatibility choices unchanged; production untouched. A-20235 independently confirms 7/7 enforce zero-child and5/5 native selected-file completions, code0/signalnull/no timeout; exact test/launcher hashes match. Local macOS Node24.21/no browser; no full-tier/configured claim, atomic birth/tree/raw-chunk limits retained. Historical census failures/incomplete results and T-1915 scope retained. C1/C2 done but unverified until configured same-head evidence. Hold released; mode-free verify at exact head in Coordinator window may proceed, no final landing claim.

### rev-35 · 2026-11-16T16:47:14.687Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1768-final-1
commit: 710cc489a1dab540384009fe988af9cbc10054fe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear A-20290, detailed named/992manifest ledger A-20286. A-20277 independently6488 ordinary tests/709files, separate235load tests/files, no negatives/skips; all224T1/427T2/55Web plus3changedT3files31identities. Required7probes+5lifecycle cases positive; five newT2identities each base+5, ten compatibility files and27identity/5env cases pass. Remaining266T3/17T4 unexecuted. C1/C2verified under narrowed own-default-lock scope: finalMac enforceA-20235 seven zero-child cases+source normalization and original scoped enforce census/other-owner dispositions; no all239green/currentfullMac claim. Old212exit0/25fail/2incomplete census and original source/native/raw/hash limits retained forT-1915. Exact head/provenance37453 normalized85ba9f32, Linuxx64Node24.21Nvim0.12.5uncached; actualWeb34863 isolatedHeadlessShell1248/CfT156.0.8078.4. Report-only duration/lint/ratchet notices not enforced passes. Source unchanged/clean, original653consumer paths retained. Hold released; Coordinator owns readiness/enqueue/landing. No Reviewer runtime or extra run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T21:22:25.576Z

Merged 84f58ecdb674ca273974fc32c0a270e41dc7dbb2 onto dev.
