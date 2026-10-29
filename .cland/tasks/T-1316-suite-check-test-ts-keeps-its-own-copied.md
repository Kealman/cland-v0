---
id: T-1316
kind: task
title: suite-check.test.ts keeps its own copied fixture environment instead of the shared builder
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1210
branch: t/T-1316-suite-check-test-ts-keeps-its-own-copied
created: 2026-10-25T20:54:33.494Z
updated: 2026-10-29T19:07:47.019Z
closed: 2026-10-29T19:07:47.019Z
---

## Summary

`hub/test/suite-check.test.ts` builds its own fixture environment: a copied PATH/HOME/XDG/Git/npm allowlist plus `withoutExecutorCredentials`, instead of the shared `fixtureEnvironment` builder rule 15 names. It is sealed today, but a second copy of the launcher policy drifts when the shared builder changes. Found aside by impl-543 during T-543 (2026-10-25); out of scope for that item.

## Acceptance criteria

- [x] C1. suite-check.test.ts launches its fixtures through the shared `fixtureEnvironment` (plus `scratchGitEnvironment` where Git runs), with no local allowlist copy; the file passes unchanged in assertions on Linux and macOS, and the T0 child-environment guard covers it.
  - done: impl-1316 · 2026-10-29T18:38:51.619Z
  - verified: rev-31 [reviewer] · run rev-20261029-1316-final1 · 2026-10-29T18:57:53.803Z · commit fe49808567d68290addde9609457f1b52cc7ab13

## Comments

### impl-1316 · 2026-10-29T18:37:44.583Z

Scope: replace suite-check.test.ts’s copied launcher environment with fixtureEnvironment and scratchGitEnvironment, preserve existing lifecycle assertions, remove child-env exemptions so T0 inspects both launches. Pre-agreed seam for this maintenance item is the T0 child-environment source guard plus existing native suite-check fixtures; no production wire/schema/authority contract changes. Parent E-1444 is a backlog sweep with no additional v0.3 spec sections.

### impl-1316 · 2026-10-29T18:39:01.683Z

Committed/pushed fe49808567d68290addde9609457f1b52cc7ab13; source review requested. Coordinator clarified scratchGitEnvironment means where needed: this fixture requires no deliberate excludes override, so both launches use fixtureEnvironment directly. T0 inventory identifies both as sealed builder, no exemptions. Local macOS targeted T3: 3/3 unchanged cases pass (A-13962). Root npm run typecheck passed. Fresh origin/dev fetch + merge was already up to date. Linux verification pending source clearance.

### rev-31 · 2026-10-29T18:40:16.102Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1316-source1
commit: fe49808567d68290addde9609457f1b52cc7ab13
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source1 clear, Standards/Spec0. Both native launches now use shared fixtureEnvironment with explicit scratch TMPDIR, no copied allowlist or guard exemptions. Scratch dirs match builder; lifecycle/receipt/reaping/root assertions unchanged. Coordinator9fb64020 explicitly clarifies no unnecessary scratchGitEnvironment excludes override here; shared builder already seals Git. Existing tier/identity/QA refs unaffected. A-13963 full audit and local macOS3/3/source-guard evidence limits. C1 final verification awaits same-head configured Linux/T0/changedT3 receipts; no Reviewer execution.

### impl-1316 · 2026-10-29T18:57:22.198Z

Verification 58863425-98e0-47db-b84a-dd2f9fb3f545 at unchanged reviewed head fe4980856 passed: host/macOS T0, Linux droplet T1/all fallback T2/Web plus changed T3, 4198 pass/0 fail. A-14004 original log: all three suite-check identities pass at lines 21734/21739/21744 (2.475s/0.845s/0.567s). Remaining T3/T4 deferred; budget/ratchet report-only. Droplet lifetime 860s, $0.0597. Final evidence review requested; clean tree and fresh origin/dev merge-tree exit 0 (prospective tree b285d299d5f61bee81abd2feeed4ffc227bc93b9).

### rev-31 · 2026-10-29T18:57:53.803Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1316-final1
commit: fe49808567d68290addde9609457f1b52cc7ab13
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1 verified. A-14007 audits original 58863425/A-14004 at unchanged reviewed head: 4198 ordinary passes plus 75 separate unrelated load samples; all three unchanged suite-check cases pass once on Linux. T0 child-environment guard is macOS host evidence, not Linux T0; reused host typecheck and separate local working-tree macOS receipts retained accurately. All T1/fallback T2/changed T3/Web completed, remaining T3/T4 absent. Report-only budget/lint warnings remain. No new identities/allowance or Reviewer executions.

Criteria: C1 verified.

### coord · 2026-10-29T19:07:47.019Z

Merged 76e569981e84f30ba0eb8826b8ac85f270edc9e2 onto dev.
