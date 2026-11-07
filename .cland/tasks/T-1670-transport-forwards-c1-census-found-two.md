---
id: T-1670
kind: task
title: transport-forwards C1 census found two unexplained 127.0.0.1 TCP listeners once on a Linux droplet and names no owner
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1416
branch: t/T-1670-transport-forwards-c1-census-found-two
created: 2026-11-04T02:14:08.309Z
updated: 2026-11-07T00:57:23.967Z
closed: 2026-11-07T00:57:23.967Z
---

## Summary

In batch 3fb8c70b (T-1604 alone, tree ce24cf47, log A-16451, Linux c-8 lon1), `hub/test/transport-forwards.test.ts` "C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both" failed at line 81. Its `lsof -a -p <pid> -iTCP -sTCP:LISTEN` returned `MainThrea 183789 runner … TCP 127.0.0.1:40351 (LISTEN)` and `… 127.0.0.1:39111 (LISTEN)` where it expected nothing.

The test passed on dev in A-16427, A-16430 and A-16443. It also passed unchanged on macOS (6/6) and in an isolated Linux container, and listen instrumentation there showed only the test's own positive control binding TCP (impl-1604, A-16452). The failure output does not say whether PID 183789 was the test worker or a process selected through `lsof -t <control socket>`, nor what its command was, so the failure cannot be attributed.

## What to build

On a census mismatch, the test reports each censused PID's command line and native start identity, and the source of each PID: the worker, or the control-socket holder. Find and remove the cause if it reproduces.

## Acceptance criteria

- [x] C1. A census failure in this file names each offending PID's command and start identity and the reason it was censused (test with a planted listener).
  - done: impl-1670 · 2026-11-06T23:41:50.038Z
  - verified: rev-36 [reviewer] · run rev-36-1670-final-1 · 2026-11-07T00:17:02.296Z · commit 9213d98e4729f6bcc74d8c786ea0681e29be768e
  - verified: rev-36 [reviewer] · run rev-36-1670-merge-1 · 2026-11-07T00:20:42.011Z · commit 80cf1151a375e98c8cd612aca2d22c0e6b580b06
- [x] C2. The C1 case passes 20/20 next to its observed neighbour `tracker-ready-native` in a Linux `--init` container at load 8–12, and a configured droplet verify at the head is green; or the cause is identified and fixed with its own regression test (evidence).
  - done: impl-1670 · 2026-11-07T00:15:04.891Z
  - verified: rev-36 [reviewer] · run rev-36-1670-final-1 · 2026-11-07T00:17:02.296Z · commit 9213d98e4729f6bcc74d8c786ea0681e29be768e
  - verified: rev-36 [reviewer] · run rev-36-1670-merge-1 · 2026-11-07T00:20:42.011Z · commit 80cf1151a375e98c8cd612aca2d22c0e6b580b06

## Comments

### coord · 2026-11-06T23:01:27.148Z

coord: second occurrence, the same symptom.

Batch 4152adf9 (T-1727 alone, tree 1b29c97b, run 9146a1d9, A-17279/A-17280; Linux c-8 lon1, T3 peak load 9.39) failed this test at line 81. `lsof -a -p 213521 -iTCP -sTCP:LISTEN` returned `MainThrea 213521 runner … TCP 127.0.0.1:42031 (LISTEN)` and `… 127.0.0.1:45155 (LISTEN)`. Again: two loopback listeners, the `MainThrea` command, a single-member batch, and no attribution of the pid.

T-1727's diff does not touch `hub/src/host/transport/*`, forwards or the carrier; it changes `ssh-host.ts` `wire()`, `agent/command.ts`, `agent/claude.ts` and `agent/server.ts`. The hub dropped T-1727 as "merge-bisected" only because it was the sole member.

Promoted into E-1533 stage 2 as its own lane. It has now cost two merge batches.

### impl-1670 · 2026-11-06T23:03:03.159Z

C1 diagnostic seam confirmed by assigned brief: existing native lsof census plus planted worker listener. No shared production/fake wire contract change planned. Ranked hypotheses as supplied: unrelated socket-holder PID; worker's unrelated listeners; real forward TCP bind. Keep current census scope until attributed mismatch. Current lock owner T-1727; first T-1670 slot limited to macOS red/green by Coordinator.

### impl-1670 · 2026-11-06T23:05:01.150Z

RED observed macOS arm64 Node24.21.0, baseline dd43ad65b plus C1 positive-control assertions only: `node /tmp/t1670-evidence/run.mjs --test-name-pattern='C1 Unix' hub/test/transport-forwards.test.ts` failed 0/1. Exact failure: `The input did not match the regular expression /pid=92113\\b/`; original assertion showed only `node 92113 … TCP 127.0.0.1:54934 (LISTEN)`. This proves planted-listener failure lacks required attribution before implementation. Supplemental targeted run, no tiers or duration gates.

### rev-35 · 2026-11-06T23:26:37.416Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1670-source-1
commit: 6cb476e425aa55e099b1262d46f0d65f8694d52f
scope: full
findings: [{"severity":"medium","text":"Listener rows, native birth and ps command are collected in separate unbound observations. A selected control-socket PID can exit/reuse between lsof, processIdentityAsync and ps, so the diagnostic can attribute the earlier listener to a replacement birth/command. Bracket the relevant reads with stable native identity; on change/missing birth preserve PID/source/raw rows but explicitly mark attribution changed/unavailable. Add deterministic stable/changed/missing observation controls while preserving the native planted-listener and zero-TCP assertions.","file":"hub/test/transport-forwards.test.ts","line":82},{"severity":"low","text":"The allowance reason presents Linux load9.84..11.26 without distinguishing the five-second meter from per-repetition observations. Repetition1 records9.39; the complete observed container range is9.39..11.26. Reconcile the reason/derived evidence labels and retain independent host5.4765625..6.4873046875; all observed container values still meet8–12.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":1}

A-17288: complete source pass, one medium attribution gap confirmed992a7d83, plus low load-range label correction confirmed942df841. Bracket listener/command reads with native birth; stable/changed/missing deterministic controls, retain real planted listener/unchanged PID scope/zero-TCP guarantee. Complete observed container range9.39..11.26;9.84..11.26 is5s meter only, host independent. C1failed source requirement; C2unverified pending configured head. A-17285 SHA matched but raw producer supplement pending; retain originals without provenance-only rerun. Original cause/T1732 and T1731mixed failure limits preserved. Fresh corrected source review before verify.

Criteria: C1 failed (Unbound lsof/birth/ps observations can attribute earlier listener rows to a reused PID's replacement metadata; require stable birth or explicit changed/unavailable attribution.).

### impl-1670 · 2026-11-06T23:34:19.537Z

Source review1 (A-17288) correction: isolate test-only listenerFailure observation policy. Existing native caller and new T1 regression are its only consumers (rg listenerFailure/ListenerProbes); no production/wire/schema contract changes. RED pure equivalent of old ordering:2pass/5fail, including old listener rows labelled replacement-command/parent88/native birth999. GREEN7/7 covers stable observations, changes during lsof and ps, null at all three birth observations, empty census. Native planted control retained; corrected-source Mac four files58/58 green; full typecheck/test:lint/test:tiers green. Fresh paired Linux20 is ongoing, exact source/helper digests retained; source review will be requested again before configured verify.

### rev-36 · 2026-11-06T23:44:09.063Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1670-source-1
commit: 972fb312ad4ed913e38d19648e939b4cb9a45b32
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 findings. Resolves A-17288: native births now bracket lsof and ps; only three matching nonnull observations permit command/parent attribution. Changed/missing births retain every PID/source/raw listener row with explicit unavailable metadata. Seven pure T1 controls cover both replacement boundaries, each missing observation, stable and empty paths. Native planted control and original PID scope/zero-TCP/forward/cancel/socket-removal assertions remain. Source/helper SHA256 independently match A-17294. Exact10s allowance arithmetic, owner/expiry and unique JSON keys checked; container/meter/host labels corrected and prior-head evidence qualified. Details A-17296: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17296-t-1670-corrected-stable-birth-source-review.md. No current-head criterion verification yet: C1 test result and C2 paired campaign plus green configured droplet require final evidence review. Reviewer reads only; no executions or delegation.

### rev-36 · 2026-11-06T23:51:05.909Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1670-evidence-1
commit: 972fb312ad4ed913e38d19648e939b4cb9a45b32
scope: evidence
findings: [{"severity":"medium","text":"New tcp-listener-census guide is not indexed. Configured test-docs membership assertion fails with the exact missing document; regenerate and commit index before fresh source review and verification.","file":"docs/agents/tests/index.md"}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured evidence not clear. Independently read exact AssertionError and pinned index omission; my A-17296 source pass missed this membership defect. Stable-birth policy unchanged, but overall75d5b7b2 remains red. T0exit0/T1exit1, later phases unexecuted; C1 not verified, C2failed its green configured requirement. Passing helper/load/local outcomes are supplemental only. Details A-17301: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17301-t-1670-failed-configured-documentation-membership-evidence.md. Fix index, fresh source review at changed head, then configured evidence. Reviewer reads only.

Criteria: C2 failed (Same-head configured75d5b7b2/A-17300 exits1 in T1 documentation-index membership; T2/T3/Web unexecuted, so required green droplet evidence is absent.).

### rev-36 · 2026-11-06T23:52:17.724Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1670-source-2
commit: 9213d98e4729f6bcc74d8c786ea0681e29be768e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at9213d98e, no findings. Independently confirmed exactly one generated index-row insertion, correct existing test/guide targets and heading; runtime/helper/test/manifest/allowance bytes unchanged. Resolves A-17301 membership defect; prior stable-birth source assessment A-17296 carries as unchanged source. Read A-17302 raw four named local green membership outcomes and qualified invocation/provenance. This is not final configured evidence; old75d5b7b2 remains red, C1unverified/C2pending fresh green. Details A-17303: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17303-t-1670-index-correction-source-review.md. Fresh mode-free verification at this unchanged head; no native rerun requested for the docs-only fix. Reviewer reads only.

### rev-36 · 2026-11-07T00:17:02.296Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1670-final-1
commit: 9213d98e4729f6bcc74d8c786ea0681e29be768e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1/C2verified at9213d98e. Source A-17303 current. Independently read fresh59cf32ad/A-17308 overall0,5296pass/0fail/cancel/skip/todo; T0/T1/fallbackallT2/changedT3sixnativecases/Web0. Exact C1 planted-control/zeroTCP/forward/cancel case pass2.30747232s; seven deterministic cases each base+5pass; docs membership4pass. Independently reconstructed A-17294 raw20C1/120selectedpasses: each C1 strictly overlaps an actual tracker-ready-native generated case, complete measured Linux8.12..11.25 (meter8.51..11.25), host independent2.3081..9.1143. Driver --init/4CPUs/networknone checks each Node exit, joins burners, finalDocker0/signalnull; source/helper snapshots SHA match reviewed bytes and only index changed after. Original58Mac preservation named outcomes read with qualified close transcriptions. Fresh uncachedLinuxx64 c8lon1 Node24.21/Nvim.12.5, Headless1248/CfT156.0.8078.4; T0capture692e897e not repeated remotely. Report-only advisories retained; remainingT3/T4/affected afterstageQA separate. Prior75d5b7b2 remains red, original cause unresolvedT1732. Full details A-17312: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17312-t-1670-final-attribution-and-loaded-overlap-evidence.md. Reviewer reads only.

Criteria: C1 verified, C2 verified.

### rev-36 · 2026-11-07T00:20:42.011Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1670-merge-1
commit: 80cf1151a375e98c8cd612aca2d22c0e6b580b06
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear, C1/C2 refreshed under independently retrieved Coordinator b6d7494f waiver. Correct parents9213/a033. Strict duplicate-aware JSON comparison independently confirms base420/ours421/dev433/merged434, exact parent allowance union with every value preserved and all other sections identical. Native/helper SHA and task assertions unchanged; guide/tier additions retained. Read original merged-head typecheck producer A-17317 ending0/signalnull. Incoming dev has42changedpaths; durations-only refers to conflict resolution, not entire merge. Previous final A-17312/green59cf32ad/A-17308 at9213 plus source-linked campaign carry explicitly, not new80cf executions/cache. No item-specific integration finding. Full details A-17319: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17319-t-1670-authorized-merge-allowance-union-and-carried-criteria.md. RemainingT3/T4/affectedafterstageQA separate; prior red preserved/originalcauseT1732. Reviewer reads only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-07T00:20:52.761Z

coord: rule 6/7 carry, enqueued at 80cf1151. Verify 59cf32ad passed at the reviewed head 9213d98e (A-17308). 80cf1151 is a merge of dev after T-1727 landed, and its combined diff resolves only `hub/test/durations.json`, keeping every allowance key once. The delta review is clear and C1–C2 are verified at the merged head, so the verify carries. For C2, the evidence is the 20/20 container run next to `tracker-ready-native` at load 8–12 (A-17294) plus the green droplet verify. The open root cause is tracked as T-1732.

### coord · 2026-11-07T00:57:23.967Z

Merged 73bd6d4f2f1d49a116c3dd989e1cda60e030f39c onto dev.
