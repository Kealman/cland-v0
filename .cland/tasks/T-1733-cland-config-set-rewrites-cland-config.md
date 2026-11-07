---
id: T-1733
kind: task
title: "`cland config set` rewrites `.cland/config.toml` without its `[hosts]` tables, deleting every configured host and pool"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
regression_of: T-1716
found_by: qa
topic: topic-1419
branch: t/T-1733-cland-config-set-rewrites-cland-config
created: 2026-11-07T03:22:01.675Z
updated: 2026-11-07T04:48:30.324Z
closed: 2026-11-07T04:48:30.324Z
---

## Summary

qa-678 found this in the E-1533 stage-2 QA run at dev 08bf3e54, scratch row E1533S2-50. In a project with two `[hosts.*]` pool tables, `cland config set verification.provision setup.sh` exited 0 and printed `applies now`, and both host tables were gone from `.cland/config.toml` afterwards. `hub/src/init/config-set.ts:66–68` parses the document through `ProjectConfig` and writes it back with `renderConfig`. `hub/src/init/config.ts` validates `doc.hosts` (line 259) but `renderConfig` never renders hosts. Any `config set` therefore silently deletes every configured SSH host and every pool, which `cland host prepare` and `cland host create` depend on. The code predates stage 2 (unchanged since stage 1), but T-1716 made pools live in these tables, which turns it into data loss for the v0.4 host flow.

## What to build

- `config set` preserves every table and key it does not change. That covers `[hosts.*]` and anything else `renderConfig` does not model: either a minimal edit of the one key, or full rendering of `hosts` with a round-trip test over every section.
- A test with SSH host tables and pool tables (harness pins, provider, size, region) shows them byte-preserved, or equal after reparsing, across a `config set` of an unrelated key. Red before the fix.
- Rule 20 sweep: every writer of `.cland/config.toml` (`config set`, `cland init` re-runs, setup and onboarding paths) gets the same check.

## Acceptance criteria

- [x] C1. After `cland config set verification.provision setup.sh` in a project with two pool tables and one SSH host table, all three tables and their keys remain, and `cland host prepare` still lists both pools (test, red before the fix).
  - done: impl-1733 · 2026-11-07T03:32:00.970Z
  - verified: rev-35 [reviewer] · run rev-35-1733-final-1 · 2026-11-07T04:04:58.204Z · commit 6705435ee6f531f5f9d30227eddc6d4d82e7f25d
- [x] C2. Every other writer of `.cland/config.toml` found by the sweep preserves the `[hosts.*]` tables (test per writer).
  - done: impl-1733 · 2026-11-07T03:32:01.235Z
  - verified: rev-35 [reviewer] · run rev-35-1733-final-1 · 2026-11-07T04:04:58.204Z · commit 6705435ee6f531f5f9d30227eddc6d4d82e7f25d

## Comments

### impl-1733 · 2026-11-07T03:28:43.081Z

Writer/consumer sweep (rule 20): config-set.ts prepareConfigValue serves config.set (CLI/web/hub), auth mode/reset via prepareAuthMode, and setup remotes/discord fallback writes. provisionConfig serves init re-runs, update, setup project provisioning and onboarding's init instruction. setup/steps/harnesses.ts rememberDecline and setup/steps/accounts.ts decline saving are separate renderConfig writers. cli/config.ts uses rendering only for defaults, not writes. cli/qa-fixture.ts is an explicit fixture replacement, not a preserving editor; executor/scratch.ts creates a new isolated verification config; site screenshot capture creates a new fixture. No other production config writers found by renderConfig/config.toml searches. Existing tests in init-config, config-set, config-reload(-component), setup-flow/accounts/remotes/CLI, host-prepare/host-ssh-registry and skills-onboarding consume these paths; wire shapes and ProjectConfig remain unchanged.
Approach: full faithful semantic rendering, merging the original TOML document with normalized modeled values, including hosts and unknown sections/fields. This avoids inventing a partial TOML source editor while preserving the consumer parser's normalization and current template upgrades. Round-trip tests compare the complete TOML document, including extras in every section. Comments/formatting may be regenerated as with the existing writer. Each existing-file writer will explicitly pass its source document to the shared renderer.

### impl-1733 · 2026-11-07T03:31:14.477Z

Red evidence A-17344: macOS, Node 24.21.0, local targeted T1/T2 at pre-fix tree. Four failures: config CLI whole-document diff omitted hosts/future; managed provisioning omitted hosts and future fields; setup account and installer decline checks reported actual undefined for hosts. All tests used scratch roots; no browser, native host or provider network.
Implemented source-aware semantic rendering at every existing-file writer. Complete original TOML fields are merged with canonical runtime settings; comments/formatting are regenerated. Added shared literal host/pool/pin fixture, complete document comparison after config CLI, both fake pool preparation receipts, full-section provisioning round trip/idempotence, and setup writer preservation assertions. Auth mode uses the same writer and has its own complete-document test. No wire or ProjectConfig shape change.
Rule proposal for Coordinator: every existing-document config writer must retain the original document alongside the runtime projection, and a new config section must be covered by an existing-document round-trip test (a default-template parse/render test alone cannot detect loss of unmodeled fields).

### rev-35 · 2026-11-07T03:33:56.800Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1733-source-1
commit: 8a164d84f40b9cb18b0065d22e6b3eb3399d67e3
scope: full
findings: [{"severity":"medium","text":"CONFIG_USAGE changes without migrating its frozen expected bytes. cli-usage-compatibility.test.ts deep-compares all exports with fixtures/cli-usage/commands.json, and cli-help.test.ts composes --help from the same frozen block. Read-only comparison confirms unequal bytes, so this head will fail those unchanged guards. Keep the old help text or explicitly migrate the expected block and its shared consumers while preserving complete assertions.","file":"hub/src/cli/usage/config.ts","line":2}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17347: medium omitted frozen-help consumer migration; independently decoded production CONFIG_USAGE differs from commands.json, which unchanged usage-compatibility/full-help tests require. Preserve old bytes or explicitly migrate expected block/shared consumers, retaining full assertions. No further source finding in the preservation implementation/writer sweep. C1/C2 remain runtime-unverified rather than incorrectly marked failed for this separate help issue. A-17344/A-17346 qualified original red/green/static evidence read; no current-head configured verification yet. Fresh committed source request required before verify.

### impl-1733 · 2026-11-07T03:34:07.896Z

Source review finding A-17347: the CONFIG_USAGE help clarification missed its frozen consumer. Supplement to consumer sweep before migrating expected bytes: hub/src/cli/usage/config.ts is re-exported by cli/usage.ts, consumed by aggregate CLI help and config --help; hub/test/fixtures/cli-usage/commands.json is loaded by frozenUsage() in cli-usage-fixture.ts, and cli-usage-compatibility.test.ts plus cli-help.test.ts compare exports and rendered whole-help bytes. help.txt contains a CONFIG_USAGE placeholder; exports.json retains the unchanged export name. Migrate the one CONFIG_USAGE literal in commands.json; keep all assertions and unrelated help bytes unchanged. No reply or protocol shape changes.

### rev-35 · 2026-11-07T03:34:47.293Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1733-source-2
commit: 8bd48c8af8e74c511c3de58f99a06e890d8576f4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear. Fixture-only change migrates exactly CONFIG_USAGE; independently decoded expected block matches production, unchanged export/help composition assertions retained. Prior A-17347 finding resolved; preservation source/writer review unchanged. A-17348 has8/8 qualified candidate help passes; A-17344/A-17346 provenance limits retained. C1/C2 remain runtime-unverified pending exact-head configured verification. No QA claim.

### rev-35 · 2026-11-07T03:40:53.981Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1733-evidence-1
commit: 8bd48c8af8e74c511c3de58f99a06e890d8576f4
scope: evidence
findings: [{"severity":"medium","text":"Configured run a9781493/A-17350 fails the unchanged exact-byte config assertion after semantic rendering regenerates comments. Reconcile this consumer with the intended preservation contract, preserving custom-ladder, skipped-category and empty-tracker assertions, or preserve original bytes for an unchanged document. T1 is red; fresh correction source review is required before rerun.","file":"hub/test/init-categories.test.ts","line":126}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17351 records actual same-head red evidence: T0 exit0, T1 exit1; T2/Web unexecuted, no browser proof. Sole retained failure is init-category no-root-category byte assertion (0.289998081s); its shown diff removes comments, not established host/ladder data loss. C1/C2 remain unverified, not falsely marked failed for serialization alone. Completed-before-interruption and runner totals retained separately. No Reviewer runtime run; after-stage affected QA remains separate.

### impl-1733 · 2026-11-07T03:41:16.729Z

Configured run a9781493 / A-17350 at 8bd48c8af: Linux x64 droplet c-8 lon1, Node 24.21.0, lifetime 241 s, cost $0.0167. T0 passed; T1 failed; T2/Web unexecuted, T3 deferred. Actual failure: init-categories exact bytes lost '# Sign-in mode; change through cland auth, never config set.' and other comments. This is a formatting consumer conflict, not host/ladder loss. Reproduced locally via unchanged init-categories case. Preserve the annotated template when the merged source is semantically identical to the modeled template; otherwise retain semantic rendering of all unknown fields. No assertion or fixture changes; exact custom ladder and no-item/no-category checks remain. Existing test is the regression; no new test necessary.

### rev-35 · 2026-11-07T03:42:14.001Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1733-source-3
commit: 6705435ee6f531f5f9d30227eddc6d4d82e7f25d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17353: corrected source clear. Complete deep equality after source merge selects annotated template only when no unmodeled content exists; otherwise full source-aware serialization remains. Existing category raw-byte/custom-ladder/skipped-category/empty-tracker assertions untouched, as are preservation/help guards. A-17352 candidate red/82green/typecheck evidence qualified; prior configured A-17350 remains red. C1/C2 runtime-unverified pending fresh exact-head verify; no QA claim.

### impl-1733 · 2026-11-07T04:04:18.608Z

Same-head configured verification e6a03301 / A-17354 passed at 6705435ee6f531f5f9d30227eddc6d4d82e7f25d: T0, T1, all fallback T2 (hub/Neovim), Web; 5349/5349. Linux x64 6.8.0-147-generic droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5, workers 2; lifetime 1227 s, cost $0.0852. T3 deferred to merge batch, T4 unexecuted; budget/lint findings are report-only. This is a real run, not a cache hit. Reviewer receives the result directly and settles criteria/final verdict.
Verified recorded facts beyond exit status: `config set preserves SSH hosts and both pools before host prepare` passed base at 1.065 s and all five load-gate repetitions (max 1.254 s); the test compares the full parsed document and successful first/second fake-pool prepare replies. `managed provisioning preserves hosts and unknown keys across every section`, `auth mode writer preserves the complete config document`, setup account decline and installer decline cases all have pass receipts. No new case crosses the Linux 4 s allowance threshold. Source head remains unchanged and pushed; no merge requested by Implementer. After-stage affected QA remains on dev, separate from this task receipt.

### rev-35 · 2026-11-07T04:04:58.204Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1733-final-1
commit: 6705435ee6f531f5f9d30227eddc6d4d82e7f25d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17355 final same-head clear. e6a03301/A-17354 exit0,5349/5349; exact head and independently reconstructed execution-tree projection match. C1 CLI whole-document/dual-pool prepare and C2 provision/auth cases base+5/5 each; both existing setup decline paths pass with preservation assertions. Prior category-byte and frozen-help guards now pass unchanged. T0/T1/all fallback T2/Web complete, uncached Linuxx64 with explicit Shell1248/CfT156. Four empty failure arrays;5213 base timings distinct from hub total. Previous A-17350 remains red; remaining T3/after-stage affected QA separate, no T4 claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-07T04:48:30.324Z

Merged 945b974cef3badd17e582c6d3f88f7c0b73fba30 onto dev.
