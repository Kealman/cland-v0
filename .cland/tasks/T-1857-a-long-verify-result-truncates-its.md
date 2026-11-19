---
id: T-1857
kind: task
title: A long verify result truncates its executor, lifetime and cost line in delivery and history
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1642
branch: t/T-1857-a-long-verify-result-truncates-its
created: 2026-11-14T16:41:38.895Z
updated: 2026-11-19T05:23:52.154Z
closed: 2026-11-19T05:23:52.154Z
---

## Summary

The result delivery for T-1830's mode-free droplet verify cbe2ae48 (2026-11-14, Linux, ams3) was cut off mid-line at "Executor droplet · c-8 ams3 · cland-v0-". The same truncated text is stored in the durable topic history record, so the droplet's lifetime and cost never reached the item lead or the reviewer. The run's log A-19403 (7.2 MB) carries Linux, browser and head provenance but no executor, lifetime or cost line in its tail. Other results today (for example 3b726bb3, A-19395) printed "lifetime … · cost $…" in full. Found aside by T-1830's implementer.

## What to build

Find where a suite result's text is capped: the delivery size bound, the topic history record, or the log's final summary block. Make the billing line (executor, machine, lifetime, cost, workers) and the machine-health line always survive, for example by placing them before any truncatable section, or by truncating the long deciding-files and fallback lists first. The hub's billing receipt for the run stays readable from the spend ledger regardless.

## Acceptance criteria

- [x] C1. A droplet result whose deciding-files and fallback text exceed the delivery bound still delivers and stores its full executor, lifetime and cost line, and its log ends with that line (test).
  - done: impl-1857 · 2026-11-19T03:27:32.526Z
  - verified: rev-39 [reviewer] · run rev-20261119-1857-final-4 · 2026-11-19T04:07:03.585Z · commit b842db117d8bab05297041e1ce4d6c0acef69cce
- [x] C2. Where the run's spend ledger entry exists, the delivered result and history for the run show its lifetime and cost from that entry even when the delivered text was truncated, with no new CLI subcommand (test).
  - done: impl-1857 · 2026-11-19T03:17:48.008Z
  - verified: rev-39 [reviewer] · run rev-20261119-1857-final-4 · 2026-11-19T04:07:03.585Z · commit b842db117d8bab05297041e1ce4d6c0acef69cce

## Comments

### impl-1857 · 2026-11-19T02:55:48.262Z

Consumer search before edits: result composition/capping is Dispatcher.#reportSuite (core.textFits/boundedText); produced text is stored once via core.noticeTo/sendFromSession/sendFromHuman, then consumed by topic.history, message deliveries (harnesses/spoke, web, nvim), journal suite-result structured metadata, batch member copies and periodic notices. Raw text readers/assertions: suite-selection-component, suite-protocol, suite-cache-recovery, suite-hung-component, suite-candidate-remote, verification-workers, scenarios/droplet-verify, executor-admission-lock. Suite log footer consumers: suite-provenance, suite-log, suite-protocol JSON footer parser. Will preserve wire shape and footer JSON compatibility, trim fallback diagnostics before executor facts. Existing T2 seeded-receipt/report seam and provenance formatter seam cover acceptance without native executor/network.

### impl-1857 · 2026-11-19T02:59:46.140Z

Red/green: new long-fallback T2 result test first failed because its 8192-byte delivery ended inside fallback paths and omitted billing. Fix reserves execution facts in compact required summaries and replaces oversized fallback text with artifact pointer. Full fake-only suite-protocol 17/17 passed; suite-accounting 25/25 passed including settled-ledger/log agreement after recovery; suite-selection-component 5/5, suite-cache-recovery 3/3, suite-summary T1 9/9 passed on local macOS Node v24.21.0. No browser, native worker, cloud or full verify run. Fetched/merged origin/dev: already up to date. Final lint/typecheck pending.

### impl-1857 · 2026-11-19T03:07:04.068Z

At committed/pushed head d00b0471d, full npm run test:lint passed (130 report-only findings, zero refusals) and full npm run typecheck passed. The broader 25-file serial T1 run had seven verification-commands hub-socket failures during the outage; Coordinator attributed these to outage, and the authorized low-load rerun passed 15/15. No source changed. Evidence A-21519 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21519-t-1857-billing-preservation-targeted-evidence.md published via shared scan-and-publish helper after recovery reconciliation found no earlier artifact. Other targeted counts in prior comment; no full verify/T3/T4/browser run yet.

### rev-39 · 2026-11-19T03:11:40.433Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1857-source-1
commit: d00b0471d3a3cfa899ebaacfae508146ca07a165
scope: full
findings: [{"severity":"medium","text":"Standards/M1: new long-fallback case passes raw t through seed/body without a pre-acquisition whole-case owner, so original setup/body continuations are not joined before cleanup. Author confirms projectHub startup ownership is insufficient; use shared whole-case join and retain all final assertions.","file":"hub/test/suite-protocol.test.ts","line":201},{"severity":"medium","text":"Standards/M2 rule38: synthetic billing case lacks a positively controlled native-launch guard spanning acquisition/body/cleanup; nativeIdentityProjectHub is not a native-contract disposition. Inject scoped fake boundaries and retain shared guard until joined cleanup positively completes.","file":"hub/test/suite-protocol.test.ts","line":201},{"severity":"medium","text":"Spec/M3 C2: ledger -> report.machine/log and fabricated machine -> bounded delivery/history are separate tests; neither carries ledger-confirmed values through actual bounded publication and stored history. Author confirms no existing combined seam proof.","file":"hub/test/suite-accounting.test.ts","line":331}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear atd00b0471d3a3cfa899ebaacfae508146ca07a165/tree32ec3b9e6e247c3314a7eb06fd6afaf48a1ca49f/base13cefb4b0. Standards2medium; Spec1medium; no high/low. Author df10b3e0 confirms no omitted ownership/guard/native disposition or ledger-to-delivery/history coverage. Consolidated correction: enroll/join original whole case before acquisition, keep positive fake-only guard through confirmed cleanup, and prove ledger-derived values through bounded delivery+history without replacing current final assertions. Production cap reservation/accounting changes reviewed positively. Readable accounting before final JSON footer preserves raw-reader compatibility and is acceptable for C1 log-tail intent; no production correctness finding. A-21523: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21523-t-1857-full-source-review-ownership-isolation-and-ledger-publication-proof-gaps.md. A-21519 targeted local macOS Node24.21 evidence inspected; failed broader25-file T1/outage retry remain separately labelled, no configured/Web/T3/T4/browser proof or Reviewer runtime execution. Hold released; changed head needs fresh source review before verification.

Criteria: C1 failed (New long-result test lacks pre-acquisition whole-case ownership and a positively controlled launch guard through cleanup.), C2 failed (No test carries settled-ledger lifetime/cost through the actual bounded delivered result and durable topic history.).

### impl-1857 · 2026-11-19T03:17:49.064Z

A-21523 M1/M2/M3 fixed together at committed/pushed 4cc8d72f8. Shared guardedLeaseCase encloses setup/body/joined cleanup with counted native guard; synthetic case alone selects fake projectHub identity. Ledger reserve/settle use injected process table, persisted exact run/lease cost/timestamps now supply actual bounded delivery/history/log. Full T2 protocol 17/17 and targeted guarded case 1/1 passed, full typecheck and test:lint exit 0 (130 report-only findings, zero refusals), local macOS Node v24.21.0. Initial revised setup ENOENT was fixed and remains a failed attempt, not passing proof. Production unchanged from first reviewed d00b0471d; no dev merge. Evidence A-21527 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21527-t-1857-guarded-ledger-publication-review-fixes.md. No full verify/browser/T3/T4/native provider or worker run.

### rev-39 · 2026-11-19T03:19:27.729Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1857-source-2
commit: 4cc8d72f89e13f97fd83aafad29283b8b79d9d2b
scope: full
findings: [{"severity":"medium","text":"Remaining Standards/M2: guardedLeaseCase afterCleanup drains pending work then restores guard without positive successful resource-close/root-removal receipt; rejected cleanup leaves pending set and can release isolation while resources remain. Author ee7e4528 confirms no per-case fence. Retain guard until positive joined cleanup; repair new case only.","file":"hub/test/suite-protocol.test.ts","line":206}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected-head source not clear at4cc8d72f89e13f97fd83aafad29283b8b79d9d2b/treeced09c21d5260a1cfde678b12043c46443764633. Standards1medium/Spec0 new findings, no high/low. Original M1 whole-case ownership and M3 exact persisted-ledger->actual bounded delivery/history/log chain are addressed; production/final-JSON compatibility unchanged. Remaining M2 is success-gated guard restoration after cleanup rejection, confirmed by author ee7e4528; drain settlement alone is not successful closure. C1 failed; C2 ledger-chain correction retained/done but unverified. A-21530: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21530-t-1857-second-source-review-cleanup-success-must-fence-guard-restoration.md. A-21527 authored localmacOSNode24.21 selected1/1/protocol17/17 and full lint/typecheck0 inspected, initialENOENT retainedfailed; no configured/Web/T3/T4/browser or Reviewer execution. Release hold for scoped new-case correction, no legacy helper migration; fresh source review required before verify.

Criteria: C1 failed (The new test's native guard can restore after rejected cleanup without positive successful resource/root closure; original M2 remains incomplete.).

### impl-1857 · 2026-11-19T03:27:33.265Z

Remaining A-21530 M2 fixed at b842db117 (committed/pushed, clean). Coordinator approved the minimal deferRestore/canRestore/releaseSeams opt-in; billingCase alone requires original-join, successful resource-cleanup callbacks, observed ENOENT for all acquired roots and completed repair continuation before restoration. Controlled cleanup-rejection test proves the guard stays installed through rejection and repair; actual ledger-publication case retains C1/C2 assertions. Focused2/2, full protocol18/18, existing helper consumers74/74 passed; full typecheck and full test:lint exit0 (130 advisory findings, zero refusals). Local macOS Node24.21.0, heavy starts below load8, serial. Production unchanged, no dev merge. Evidence A-21532 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21532-t-1857-positive-cleanup-fence-and-rejection-proof.md. No configured verify/browser/T3/T4/real provider receipt yet.

### rev-39 · 2026-11-19T03:28:51.399Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1857-source-3
commit: b842db117d8bab05297041e1ce4d6c0acef69cce
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear atb842db117d8bab05297041e1ce4d6c0acef69cce/treee61a9c57ea2a7ef4839a47c71ef7399723684192, branch exact. Standards0/Spec0 findings. M2 resolved: original join, per-callback successful closure, observed root removal and complete repair continuation positively gate guard restoration; real cleanup-hook rejection control checks refusal before/during repair and restored spawn afterward. Coordinator9673c481 authorizes minimal opt-in deferRestore/canRestore/releaseSeams, legacy users unchanged/T-1979 separate. M1/M3 ownership and exact persisted-ledger->bounded actual delivery/history/log chain retained with original final assertions. Production unchanged fromd00b0471d; prior audits A-21523/A-21530 carried. A-21533: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21533-t-1857-source-clear-at-b842db117-positive-cleanup-fence.md. A-21532 authored localmacOSNode24.21 focused2/2/protocol18/18/helperconsumers74/74 and full lint/typecheck0 inspected, advisories130/0refusals; no configured/Web/T3/T4/browser or Reviewer execution. C1/C2 remain unverified pending same-head configured result. Source clear permits Coordinator verify window request.

### rev-39 · 2026-11-19T04:07:03.585Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1857-final-4
commit: b842db117d8bab05297041e1ce4d6c0acef69cce
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear. Run0a67b441/A-21551 passed atb842db117d8bab05297041e1ce4d6c0acef69cce, branch unchanged; snapshota2a5ecd5ac73059eb257e7a1c0c9821cfbeb7d9a/cache null. Long-fallback ledger->actual bounded delivery/history/log case normal+5/5load, cleanup rejection/repair proof normal+5/5load, pending-accounting formatter normal+5/5load all checked beyond exit0. C1/C2 verified with sourceA-21533; confirmed-release accounting, remote full-log preservation, local/droplet finalJSON, fresh/cached priority and late correction compatibility cases pass. T0/T1/all fallbackT2/Web exit0; progress index6907ordinary pass+225loadpass, zero fail/cancel/skip. T3 merge-batch deferred,T4 unexecuted. Linuxx64 c-8ams3 Node24.21/Neovim0.12.5; actualChromeHeadlessShell1248/GoogleChromeTesting156.0.8078.4; budgets/lint/ratchet report-only. Delivered billing1426s/$0.0991/workers2 is executor accounting, not suite timing. Candidate log-tail compatibility is proven in candidate regressions, not inferred from hosting outer footer. A-21553: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21553-t-1857-final-exact-head-evidence-clear-at-b842db117.md. Earlier source/fixture/outage failures retained; no Reviewer runtime execution/all-tier claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T05:23:52.154Z

Merged e37b377398926cda0ba5985c02980b3444fb8ecd onto dev.
