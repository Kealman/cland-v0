---
id: T-719
kind: task
title: "T2 projectHub tests start no git or ps probe: injected tracker reader and process table"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-677
blocked_by:
  - T-685
topic: topic-444
branch: t/T-719-t2-projecthub-tests-start-no-git-or-ps
created: 2026-10-16T20:09:33.790Z
updated: 2026-10-17T16:35:06.275Z
closed: 2026-10-17T16:35:06.275Z
---

## Summary

A T2 projectHub test still spawns infrastructure probes: about 6 git calls (configuration source commit, tracker branch tips) and 3 ps calls (lock identity, harness cleanup) per fixture, found by T-685's spawn census. A T2 test should start no child process unless the native boundary is its subject (memo §5.1, A-4143).

## What to build

projectHub and the in-process hub take narrow in-process answers for these probes in T2: the tracker reads branch tips and the configuration commit through an injected reader, and lock identity and cleanup use an injected process table. The real git and ps paths stay the production default and stay covered by their own T3 lifecycle files.

## Acceptance criteria

- [x] C1. A T2 projectHub test that launches, signals and stops a session through the in-process fake adapter shows zero child processes in its spawn census row, proved by a census test.
  - done: impl-719 · 2026-10-17T15:48:47.775Z
  - verified: rev-30 [reviewer] · run rev-20261017-719-final · 2026-10-17T15:49:19.646Z · commit 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a
- [x] C2. The production git and ps paths are unchanged and still covered by their existing lifecycle tests, with each T3 file's assertions unchanged in meaning.
  - done: impl-719 · 2026-10-17T14:30:10.101Z
  - verified: rev-30 [reviewer] · run rev-20261017-719-source · 2026-10-17T14:34:37.713Z · commit 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a
  - verified: rev-30 [reviewer] · run rev-20261017-719-final · 2026-10-17T15:49:19.646Z · commit 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a

## Comments

### impl-719 · 2026-10-17T14:26:46.754Z

Implementation at d99c2d2e (origin/dev merged before review): serveProject accepts injected Git/base readers and synchronous lock process table; projectHub has probes:'fake' preset. Census covers imports, all three fake adapters' launch/signals/stop, teardown, injected nonempty branch/provenance facts and reload with zero children. NO_PS moved unchanged to native-process.ts, with only import changes in eight native test files; cleanup self ps is lazy. Typecheck and tiers pass. Collecting serial 5/5 census medians and unchanged native-path receipts before review.

### impl-719 · 2026-10-17T14:32:42.264Z

Final source-review head 3964cc80 pushed to origin; review requested from Reviewer in topic-444. A-4548 is the updated durable evidence artifact: zero-child census 5/5, Mac median 0.315233s, load 3.8; duplicate-root refusal, all three fake adapters, injected branch/provenance and reload. 112 declaration audit rows include new census plus unchanged native tests; all existing declaration bodies/options unchanged. Supporting native-path checks green; exact-head Linux run follows clear source verdict. QA policy none/after-stage.

### rev-30 · 2026-10-17T14:34:37.713Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-719-source
commit: 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at3964cc80, fixed42ebe8a0; Standards0/Spec0 findings. All18files reviewed. Optional Git/base and synchronous lock-process readers preserve native defaults, commands/cache/ownership checks; async locks unchanged. Explicit projectHub fake preset uses PID liveness+nullstart conservative across native/injected readers, with duplicate-root refusal. Lazy cleanup self identity removes eager ps but retains native group/ancestor/start protections. NO_PS moved verbatim; all eight existing native files independently non-import-byte-identical. Tier manifest only one sortedT2entry, durations unchanged. A-4548 final census5/5 zerochildren in imports/threeadapterlifecycles/configreload/teardown; independent recorder0children/0gaps/0truncation. Before directly2Git+3ps, baseline descendant gaps disclosed/no speedup ratio. Eleven supporting native/config/freshness files128/128green before fake-preset-only hardening; unchanged native/default paths retained. C2 verified. C1 awaits exact-head droplet evidence; normal mode-free verification may run at this head. No Reviewer execution or per-item QA.

Criteria: C2 verified.

### impl-719 · 2026-10-17T15:12:08.455Z

Exact-head droplet run 122d1a12 (A-4563) is red solely on merge-policy.test.ts:105 with merge-changed gate inputs during lookup; Neovim was not reached. Owned census green in 0.948514552s, zero children, 5/5 load repeats; Linux timing supplement A-4568. Coordinator-requested whole-file comparison: task head 3964cc80 5/5 green, origin/dev a782a307 5/5 green, all receipts A-4569. No source changes or full rerun; gate disposition requested from lead T-719.

### rev-30 · 2026-10-17T15:49:19.646Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-719-final
commit: 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-719 final same-head evidence — clear

Reviewed/source-cleared head: 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a, independently still the branch tip.
Source review: A-4550 / rev-20261017-719-source.
Final receipt: A-4593, run a84746ad-5df5-4c43-917b-eb7557a66e79.
Read-only evidence review; no Reviewer execution, source edits or additional run.

## Standards
No remaining findings. The source-established preservation of native defaults, synchronous lock ownership protections, lazy native cleanup identity and unchanged T3 assertion meaning remains current. No source or manifest refresh was taken between source clearance and this authorized retry.

## Spec
C1 verified. A-4593 logs the owned projectHub fake-probes census ordinarily at 0.901545232 seconds (3456), explicitly 0 child processes across imports, launch, signals, stop and teardown (3457), and five fresh positive load repetitions (3867). This supplements the previously audited exact-head five serial Mac census receipts in A-4548. The fixture proves all three adapters, injected Git/config/base behavior and conservative duplicate-root lock refusal. The zero-child claim covers its recorded complete fixture lifecycle; no speedup ratio or baseline descendant completeness is inferred.

C2 remains verified and is supported by current-head Linux execution. All nine touched test files pass their 98 ordinary cases: accounts8, sessions11, CLI identity6, Codex12, daemon18, launch recovery4, OpenCode14, census1, stop races14. Supporting process-cleanup27, config-reload4 and freshness8 cases also pass. The source review independently checked eight native consumers' non-import bytes unchanged and preserved default Git/ps paths; these results exercise those retained native paths.

## Run and prior failure
The automatic mode is full because harness.ts is suite infrastructure. All phases complete: hub free135/135; hub machine1952 total,1947 pass,5 skip; Neovim394 total,391 pass,3 skip. Combined2481 total,2473 pass,zero fail/cancelled/todo,8 recorded skips. Finished exit0. All338 printed load-gate rows show5/5 passed. There are no hard duration-budget errors; budget, baseline and ratchet notices are report-only.

The previously failing merge-policy QA-satisfaction identity passes at1.194042373s (2820). Preserve the original A-4563 exit1 receipt and A-4567 audit; the non-reproducing paired comparison A-4569 is supporting evidence, not a causal proof or replacement for a green full run. Coordinator authorized this one same-head retry and classifies the cross-branch failure separately as T-740. The present fresh green A-4593 supplies final acceptance; no T-740 fix or duration refresh is claimed on this held head.

Host npm run check includes both typechecks and report lint (341 findings in198 files); droplet reuses host gate d289ae63603a7021287dda9767d6f73d473ecd97. Linux x64 6.8.0-142, Node24.21.0, Neovim0.12.5; c-8 lon1,2workers. Suite2044.96s; peak1mload11.92; load tail65.84s; lifetime2107s; cost$0.1463.

Final evidence clear, Standards0/Spec0 findings; C1/C2 verified at the exact source-reviewed head. No per-item QA or further task run requested.

Durable final review A-4596.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-17T16:35:06.275Z

Merged 6812b9406875b285b6ce07dcadb92ec4454e8727 onto dev.
