---
id: T-1484
kind: task
title: Installed verify cannot parse duration identities with TypeScript pruned
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1243
branch: t/T-1484-installed-verify-cannot-parse-duration
created: 2026-10-30T11:58:34.958Z
updated: 2026-10-30T15:57:46.013Z
closed: 2026-10-30T15:57:46.013Z
---

## Summary

An installed `cland` (TypeScript pruned as a dev dependency) running `cland verify` on a project that has `hub/test/durations.json` source identities reaches `sourceTestIdentities`, whose lazy `import('typescript')` resolves against the installed hub and fails. The path is runSuiteCommand, then suite-candidate lintHubShards/lintHubShardTree, then lintDurationIdentities, then sourceTestIdentities. A second consumer has the same defect: a lazy `createRequire` of the compiler in `hub/src/test-lint.ts`, reached through suite-shards and the hub's suite test-lint paths on tiered, cland-shaped targets (T-1458, 12:07Z). A generic project without duration or tier manifests avoids both. Found by T-1458's packaging guard, 2026-10-30.

## What to build

The installed CLI handles that path without the compiler: either a non-TypeScript identity fallback, or a clear refusal naming the missing capability, with no stack trace. TypeScript stays a dev-only dependency.

## Acceptance criteria

- [x] C1. An install-shaped run of `cland verify` on a project with duration identities, with `typescript` unresolvable from the installed hub, either completes identity checks without the compiler or refuses with one line naming the cause, for both the duration-identity and the test-lint consumers, shown by a fixture; `typescript` stays in devDependencies.
  - done: impl-1484 · 2026-10-30T14:55:46.632Z
  - verified: rev-32 [reviewer] · run rev-20261030-1484-evidence1 · 2026-10-30T15:18:05.723Z · commit 426e37af0a8097fff897d17c71bc479f71c4475a
  - verified: rev-32 [reviewer] · run rev-20261030-1484-evidence2 · 2026-10-30T15:38:22.108Z · commit b370fa527d3a40f04fe945b3fb48ebb4b0a1b675
  - verified: rev-32 [reviewer] · run rev-20261030-1484-delta2-final · 2026-10-30T15:44:27.508Z · commit cce4671499db57b8706d46b512296cdcd29214fd
  - verified: rev-32 [reviewer] · run rev-20261030-1484-delta3-final · 2026-10-30T15:51:07.796Z · commit c6366488369174df5bf5f8a522854e706c7e7dae

## Comments

### impl-1484 · 2026-10-30T14:43:33.076Z

Consumer inventory (rule 20): suite-test-identities sourceTestIdentities is called by lintDurationIdentities (suite-shards checkout and immutable-tree admission) and suite-duration-context (baseline/current/candidate snapshots); test-lint syntax is used by lintTestSource/testLintFacts/lintTests and touchesMachineResources (suite-shards T1 admission), test-lint-policy (hub Suites warm/admission and territory merge), lint-tests CLI. Regression consumers: suite-tiers, suite-duration-context, suite-duration-budget, durations, test-lint, test-lint-policy, suite-dry-run and suite-admission-native tests; QA E-676/E-677 briefs use these admission paths. Field/function searches across hub/src, hub/test, nvim, web, qa, docs and skills found no wire-shape changes needed. Existing error envelopes remain unchanged; only missing-compiler diagnostics are sanitized. Red fixture observed duration module-not-found and test-lint multiline Require stack failures. TypeScript stays dev-only.

### rev-32 · 2026-10-30T14:46:54.765Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1484-source1
commit: 8487c15ed294ae2c0e0ed52b33e343eadcf02a97
scope: full
findings: [{"severity":"medium","text":"M1: SUITE_USAGE adds the compiler-capability line, but the owning hub/test/fixtures/cli-usage/commands.json row is unchanged. Static JSON comparison at the requested head confirms different bytes; unchanged cli-usage-compatibility and full/verify help consumers cannot pass. Reproduce the owning guards red, migrate only SUITE_USAGE, and retain original red/green output.","file":"hub/src/cli/usage.ts","line":11},{"severity":"medium","text":"M2: The new per-test document is absent from docs/agents/tests/index.md. The unchanged test-docs index contract requires every document be linked, so this head fails that guard. Add the owning row and retain unchanged guard red/green evidence.","file":"docs/agents/tests/hub-test-suite-admission-native.test.ts.md","line":1},{"severity":"medium","text":"M3: The installed fixture acquires its server before registering cleanup; listen has no error/abort/setup bound, and teardown awaits inspection and server.close without independent bounds or active-socket cancellation. Raw t.after is registered after tempProject's directory ownership hook rather than onCleanup, so resources are outside the before-directory drain chain. The CLI execFile promise is not a pre-owned cancellation/close obligation either. Pre-own one idempotent exchange/child disposer before listen/launch, bound setup and drainage separately, track/close sockets, cancel/join inspection and child native close on every exit, and fence root removal on incomplete drainage. Add omitted/aborted setup and held-inspection cleanup controls while retaining exact installed refusal assertions.","file":"hub/test/suite-admission-native.test.ts","line":123}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source review A-14452: production lazy compiler boundary covers both consumers and retains dev-only dependency, but M1 frozen SUITE_USAGE mismatch, M2 missing per-test index row, and M3 installed fixture setup/drain ownership block clearance. Static only; claimant macOS evidence is not configured runtime proof. Consolidated verdict; replacement exact-head full source review before verify.

Criteria: C1 failed (Installed refusal fixture lacks pre-owned bounded setup/drain and native child closure; source pass also has unchanged help/index guard failures.).

### rev-32 · 2026-10-30T14:51:47.374Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1484-source2
commit: 06879d987115b80d67cb2b78b1d304280ded1455
scope: full
findings: [{"severity":"medium","text":"M3 remains incomplete: run() returns an unbounded callback-plus-native-close promise. execFile's 30s timeout sends SIGKILL but is not a deadline on either callback or close (e.g. a descendant retaining inherited pipes); dispose's 45s deadline starts only when disposal is called, after the caller awaiting run can already hang. Bound the operation observation itself; on timeout/abort invoke the already-owned cancellation/drain and retain the root on incomplete closure. Keep native close as the completion receipt; add a deterministic missing-close/held-writer control.","file":"hub/test/admission-exchange.ts","line":88},{"severity":"medium","text":"M3 control ownership still has an early-failure hole: held inspection awaits entered/closed before release.resolve(), with no finally or pre-registered release owner. A setup/close observation failure leaves inspection awaiting release forever; onCleanup then times out after45s and retains the test's own gated work. Pre-own unconditional release plus joining before launching the client, own/destroy/join that client too, and keep independent setup/drain bounds and root fencing. Add an omitted/aborted observation control that fails before entered/closed while proving the held work settles.","file":"hub/test/suite-admission-native.test.ts","line":139}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated full source2 A-14463: M1 help fixture and M2 docs index closed; production boundary unchanged and sound. Continuing M3 has unbounded run observation despite execFile kill timer, and held-inspection control releases only on success instead of pre-owned/finally release+join. Owner-red in A14459 is missing-helper setup, not a reproduced lifecycle negative. No Reviewer execution. Restore claimant C1 done after correction; fresh exact-head full source review before configured verify.

Criteria: C1 failed (Installed CLI fixture run observation remains unbounded and held-inspection control can abandon its release gate on setup failure.).

### rev-32 · 2026-10-30T14:58:20.832Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1484-source3
commit: 426e37af0a8097fff897d17c71bc479f71c4475a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear A-14477. M1/M2 remain closed; continuing M3 now separates35s callback/native-close observation from30s kill and45s owned drainage, retains incomplete roots, and pre-owns held-control release/client closure with finally join. A14473 actual lifecycle negatives→8/8 local green correctly labelled synthetic missing-close versus native installed cases; A14459 missing-helper reds not reinterpreted. Production shared lazy boundary/both consumers/dev-only dependency unchanged and sound. C1 done restored/runtime-unverified. No Reviewer execution; one unchanged-head configured mode-free verify then original-record evidence request.

### rev-32 · 2026-10-30T15:18:05.723Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1484-evidence1
commit: 426e37af0a8097fff897d17c71bc479f71c4475a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Executed-head original-record final clear A-14499, rawA14496/a1fcdb49. Parsed4270ordinary/514file pass plus105separate loadtest/105loadfile pass; zero adverse outcomes. Exact installed duration/test-lint refusal identities pass. All8 changedT3 identities once/no repetitions, max.555s; synthetic missingclose/FakeClock not nativeSLA. T0/T1/allfallbackT2/changedT3/Web complete; remainingT3/T4 absent, hostgate reused, Web4workers/0newfiles. Lint/budget/ratchet reportonly. C1 verified only at426e37af0; disclosed usage/frozen-row dev conflicts and future authorized integration remain separate readiness gate. No Reviewer reruns.

Criteria: C1 verified.

### rev-32 · 2026-10-30T15:19:01.629Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1484-delta1
commit: b370fa527d3a40f04fe945b3fb48ebb4b0a1b675
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear A-14501 under Coordinatorc12f7278. Parents426e37af0+effffe1e7. Compiler boundary/consumers/installed owner+fixtures+guide unchanged. Both decodedSUITE help sets preserved, frozenSUITE exact; nonblank both-parent skills/docs/index retained. Incoming prerequisite/site bytes matchdevparent. LocalA14500 claims not configured current-head proof; predecessorA14496/A14499 remains predecessor-only. Current C1 runtime settlement awaits mandated fresh unchanged-head mode-free verify and original-record evidence request. No Reviewer execution.

### rev-32 · 2026-10-30T15:38:22.108Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1484-evidence2
commit: b370fa527d3a40f04fe945b3fb48ebb4b0a1b675
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence2 clear A-14518 against originalA14517/run16756c02. Parsed4282ordinary/515file passes +125separate loadtest/file passes, zero adverse outcomes. Both installed duration/testlint exact refusals and all8 changedT3 cases pass once/no repetitions (max.633s); synthetic missing-close not nativeSLA. T0/T1/allT2/changedT3/Web complete; remainingT3/T4 absent, hostgate reused, Web4workers,0newfiles. Report-only lint/budget/ratchet limits retained. PredecessorA14496/A14499 not reused currentgreen. C1 refreshed verified atb370fa527; disclosed docs integration/readiness remains separate and subject to Coordinator disposition. No Reviewer execution.

Criteria: C1 verified.

### rev-32 · 2026-10-30T15:44:27.508Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1484-delta2-final
commit: cce4671499db57b8706d46b512296cdcd29214fd
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta2+final waiver clear A-14529. Coordinatora2048d54/standingrule6 authorizes predecessorgreen carry plus docs/help delta+targeted only, no newverify. Own compiler/consumers/owner+fixtures unchanged; incomingcode exactdevparent. Five text conflicts retain both help/frozen/skill/docs contracts, intentional landed album README replacement. A14524 seven complete original local tool responses13passes; original39case capture truncated, superseded only by Coordinator5fd6bcda-authorized rawA14527 39/39 exit0 at successor. Total52 matching cases, zero adverse. C1 refreshed via labelled predecessor16756c02/A14517 atb370fa527 (A14518 audited4282passes/eightT3once) +targeted evidence; not successor execution. All report-only/platform/phase limits retained. No Reviewer execution.

Criteria: C1 verified.

### rev-32 · 2026-10-30T15:51:07.796Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1484-delta3-final
commit: c6366488369174df5bf5f8a522854e706c7e7dae
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta3+final waiver clear A-14537 under Coordinator0711b9bc. Only usage/frozen conflicts, both decoded help contracts retained/exact frozenrow; skills/docs bothparents retained. Owncompiler/consumers/exchange+installedfixtures identical executedb370fa527; incomingT1464 code exactdev, inspect usedbyC1 unchanged. A14536 complete raw eight sequential targeted files52/52 exit0/all namedpass+terminalcounts agree, zero adverse. C1 refreshed via explicitly labelled predecessor16756c02/A14517 atb370fa527 (A14518) +currenttargeted52; no successor fullrun/no newverify underwaiver. Prior platform/report-only/phase/native-synthetic limits retained. No Reviewer execution.

Criteria: C1 verified.

### coord · 2026-10-30T15:51:16.300Z

Enqueued at c63664883 under the Coordinator's standing rule 6 docs and help waiver. The merges since green run 16756c02 / A-14517 at b370fa527 resolved only docs, help and frozen-row conflicts (after T-1458, T-1460 and T-1464 landed); T-1484's own code is unchanged. A named reviewer cleared the delta, with targeted matching-text runs saved raw, including the roles-clauses rerun.

### coord · 2026-10-30T15:57:46.013Z

Merged 0e4e223cb9836d57314e57c0718e111a5cadb646 onto dev.
