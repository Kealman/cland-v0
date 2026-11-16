---
id: T-1724
kind: task
title: Executor status reports "unknown (inspection deferred)" when the local snapshot-key read exceeds its 250 ms bound under load
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1539
branch: t/T-1724-executor-status-reports-unknown
created: 2026-11-06T11:49:25.020Z
updated: 2026-11-16T14:02:12.143Z
closed: 2026-11-16T14:02:12.143Z
---

## Summary

`hub/src/executor/droplet.ts` `inspect()` computes the snapshot key with `within(this.#key(), 250, this.clock)`. When the local `prepareKey` and Git read takes longer than 250 ms, freshness becomes `unknown (inspection deferred)`. That happens under load or with a slow disk. The live executor status showed exactly this on 2026-11-05/06, and `hub/test/executor-prepare.test.ts:197` ("prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes") expects `current` from a single read. impl-1708 hit `unknown (inspection deferred)` in a preservation batch (T-1708 head 8495f3eb, macOS, load about 5). The code is identical on dev 0eb62a96, where the case passed once, so this is a pre-existing load-sensitive bound, not T-1708's change.

## What to build

Decide what the 250 ms bound is for. If it's status responsiveness, keep it and cache the key per HEAD/lock digest, so a repeated status read is current once computed and a deferred read can complete in the background. If not, move it to a named setting. Then the test checks the status after the key's first computation, with its assertion unchanged, or the product makes the first read reliable within budget. Never weaken the assertion.

## Acceptance criteria

- [x] C1. A test that holds the key computation past 250 ms reports `unknown (inspection deferred)` once, and the next status read after the computation completes reports `current` (test, red before the fix).
  - done: impl-1724 · 2026-11-16T07:42:58.189Z
  - verified: rev-38 [reviewer] · run rev-38-1724-evidence-1 · 2026-11-16T08:42:54.512Z · commit 97c53bd59cd835c9877d4b2e06f425b7d572e1bf
  - verified: rev-38 [reviewer] · run rev-38-1724-final-1 · 2026-11-16T10:31:57.537Z · commit 97c53bd59cd835c9877d4b2e06f425b7d572e1bf
- [x] C2. executor-prepare.test.ts passes 10/10 at a one-minute load of 8 or more, on macOS or in a Linux --init container (4 CPUs, no network), with its assertions unchanged (evidence).
  - done: impl-1724 · 2026-11-16T10:26:39.807Z
  - verified: rev-38 [reviewer] · run rev-38-1724-final-1 · 2026-11-16T10:31:57.537Z · commit 97c53bd59cd835c9877d4b2e06f425b7d572e1bf

## Comments

### coord · 2026-11-06T12:35:53.449Z

Second variant of the same family (impl-1708, 2026-11-06, T-1708 head 239362c9, macOS, under load). `hub/test/executor-prepare.test.ts:238` expected `stale: base|nvim` after a pin commit and push, but saw `current`, so freshness read stale state after the change. An alternating comparison afterwards at load of about 3 passed 5/5 on both the T-1708 head and dev 6c0e7703, twice each, so it's intermittent and not tied to T-1708. Both variants of this case (`unknown (inspection deferred)` at :197, and current-instead-of-stale at :238) should be covered by this item's fix.

### rev-38 · 2026-11-16T07:47:47.411Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1724-source-1
commit: 897b9b286ca5a01899341b84fe944a582b871e3b
scope: full
findings: [{"severity":"medium","text":"A completed deferred key is reused by provision alone after the committed base changes; snapshot A compared with retained key A reports current at base B. Validate the base identity at consumption and regress completion-before-change/consumption-after-change; the new test moves the base only after consuming the old observation.","file":"hub/src/executor/droplet/droplet.ts","line":282}]
finding_counts: {"high":0,"medium":1,"low":0}

Full pinned Standards/Spec review in A-19845. One medium Spec finding; no other findings. Lead-chain Coordinator clarification f7531824 explicitly rejects this stale-current interleaving, as relayed in 7815f20c. The exact 250ms response bound and existing assertions stay. Add changed-base invalidation and the crossing regression, then request fresh source review before native/load and configured verification. A-19836 is reported development-candidate red/green evidence, not same-head configured verification. No criteria verified in this source pass; C1 runtime and C2 load receipts remain pending. Reviewer performed read-only source/evidence review; no tests or probes.

Criteria: C2 failed (Retained old-key consumption can still violate the unchanged native pin-move stale assertion; required loaded native evidence is pending.).

### impl-1724 · 2026-11-16T07:48:34.182Z

Consumer sweep before adding optional DropletDependencies.prepareBase: searched executor.status / prepareKey / staleParts / snapshot.freshness / inspection deferred across hub/src, every hub/test tier, nvim, web, shared, .agents/skills, qa and docs. Production consumers: protocol.ts/shared wire and dispatch/web-authority keep existing frame/permission shape; droplet.inspect adds only internal base validation; spend-hubs reads spend only; prepareKey/prepareSnapshot and pool-image retain key shape/hash semantics; web VerifyLine/verification consumes spend only; CLI executor status renders existing summary. Test seams: scripted-machine supplies prepareBase; remote-fixture scripted branches inherit it, native branches use production base read; executor-prepare-component overrides held key/base and gains crossing regression. executor-prepare-retry held-key path uses same unchanged signature; native executor-prepare freshness assertions stay exact with completed-inspection readiness. Other matches (executor-liveness, executor-admission-lock, executor-droplet, executor-safety/component, executor-run, suite-close/component, state-inventory, demo-release-component, account-fixture-env, remote-scripted, prepare-key, droplet-fixture, web verification/record-verification and web-authority-unit) retain shapes and need no migration. QA T-271 and E-418/E-418-stage-2 use existing freshness/spend fields unchanged; E-415-stage-2/E-1533-stage-1 check key hashing unchanged; E-1532-stage-4 historical unknown observation unaffected; E-1537-stage-3 pool staleParts unchanged. Shipped skills have no matching status/key field examples. No wire or persisted shape changes, old snapshot compatibility regression remains. New optional read seam is additive; native/default implementations and one shared fake are the producers.

### impl-1724 · 2026-11-16T07:53:34.557Z

Status semantic sweep addendum (Coordinator 591dd4b7): current is now explicitly against local refs/remotes/origin/dev; summary adds local=origin/dev@short-SHA without changing JSON fields or freshness strings. CLI executor status prints summary, so receives the explicit local commit; command help updated. Neovim has no executor.status reader or parser in nvim/lua/cland; generic CLI forwarding receives same summary. Web VerifyLine consumes spend only through ExecutorStatus subset, so unaffected and no UI migration. Doctor's image checks use host pool-image staleParts rather than DropletExecutor.inspect, unchanged. QA T-271 reads JSON freshness and parses its existing snapshot fields; current/stale strings unchanged and pin changes followed by refresh/prepare remain coherent. E-418/E-418-stage-2 count status calls/read spend unchanged; other QA status captures render summary or costs/leases and retain their fields. docs/hub/running.md and hub/README/help now name local reference and refresh condition. prepareKey gains additive refresh=true argument; existing direct/native, pool and fake callers retain default behavior. Inspection requests refresh=false on a distinct in-flight identity, never sharing fetch-enabled work. Existing scripted prepareKey ignores extra argument safely; scriptedMachine centrally supplies new local-base identity. Native no-network Git wrapper test added with positive control (default prepareKey refuses fetch); not yet executed due native slot requirement.

### rev-38 · 2026-11-16T07:58:18.690Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1724-source-2
commit: ab0ce484ead2f4ef9d478a856dcf1585c47566ba
scope: full
findings: [{"severity":"medium","text":"Base validation starts while the retained key may still be pending: read base A, move to B, then complete key A within the same inspection budget; Promise.all accepts stale [A,A] as current. Read the base after key availability within the original total250ms and regress this pending-key crossing.","file":"hub/src/executor/droplet/droplet.ts","line":289},{"severity":"medium","text":"The new local-ref help line is absent from frozen commands.json EXECUTOR_USAGE; cli-usage-compatibility's exact deepEqual must fail. Update this command block while retaining other frozen exports/assertions.","file":"hub/src/cli/usage/executor.ts","line":2}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated full revised-design pass A-19860: original completed-before-change race is guarded, local-only status semantics and consumer/docs migration match Coordinator decisions, but pending-key base validation still precedes consumption. One medium Spec finding and one medium Standards/help-consumer finding; no others. Read current base after retained key availability under one exact250ms bound; fix the frozen help block and add the crossing control, then request fresh source review. C1/C2 runtime verification remains pending; candidate summaries/lint are not native/configured evidence. Reviewer read only and ran no tests.

Criteria: C2 failed (Pending-key consumption still admits an earlier base sample; frozen help consumer also remains unmigrated, and native loaded evidence is not yet executed.).

### rev-38 · 2026-11-16T08:04:57.113Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1724-source-3
commit: 97c53bd59cd835c9877d4b2e06f425b7d572e1bf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-19873 contains complete Standards/Spec assessment: base validation now begins after key availability within the original total250ms; pending/completed crossing controls and exact current/stale assertions remain; frozen EXECUTOR_USAGE now matches. Coordinator-approved local-ref-only status/default-refresh preparation behavior and consumer/docs migration remain consistent. No criteria verified in source pass. C1 executed evidence, C2 macOS10/10>=12 plus launch20/20>=8, native no-network wrapper/positive control and same-head configured verification remain pending. Prior C2 failed mark awaits actual evidence and done restoration. Run no further source changes; use assigned exclusive native slot and allowed mode-free verify window at this exact head. Reviewer read only; ran no tests/probes.

### impl-1724 · 2026-11-16T08:41:26.790Z

Configured verification green at unchanged reviewed97c53bd59cd835c9877d4b2e06f425b7d572e1bf: run726f9438-665b-4353-b8f4-23fedf631a7e, log A-19898. Tests6389/pass6389/fail0/cancelled0/skipped0. T0 local macOS exit0,60.753s; Linux x64 droplet c-8 nyc1, Node24.21.0: T1 exit0 (220 files/1659 tests), fallback T2 exit0 (425 files/4245 tests), Web exit0 (55 files/292 tests), changed native executor-prepare T3 one base execution6/6 passing identities (no repetitions); remaining T3 deferred to merge batch; T4 not executed. Duration budgets/ratchet and test lint remain report-only, not enforced; no allowances added. Droplet lifetime1301s, reported cost$0.0904. C2 macOS loaded10/10 (plus launch20/20) still pending; this Linux receipt is not that evidence.

### rev-38 · 2026-11-16T08:42:54.512Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1724-evidence-1
commit: 97c53bd59cd835c9877d4b2e06f425b7d572e1bf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial criterion evidence pass; C1 verified only. A-19904 independently reconciles A-19898/run726f9438 at exact source-clear head/tree6b69f7a:6389 ordinary passes plus separate225 load passes,0negative/skip/cancel. Three deferred/current/completed-crossing/pending-crossing names each ordinary+5/5; component21/21, changed native executor-prepare6/6 once including no-network positive control/current-stale assertions, help compatibility and reached consumers pass. T0 local macOS; T1/all-fallbackT2/changedT3/Web on Linuxx64 droplet Node24.21.0, HeadlessShell1248/CfT156.0.8078.4, uncached. Budgets/lint/ratchet report-only; remainingT3 merge-batch/T4 unexecuted. C2 macOS10/10>=12 and launch20/20>=8 remain pending; existing failed mark not settled by this receipt. No final-ready claim or rerun requested. Reviewer read only.

Criteria: C1 verified.

### coord · 2026-11-16T10:09:42.295Z

Coordinator, 2026-11-16 10:10Z: C2's load bar lowered from 12 to 8. A macOS loaded slot aimed at 12–14 reached 18.9 at 10:08Z with the crew's other work, and the live hub stopped answering its CLI for about 20 s. The fix's own proof is C1, which is deterministic and verified (A-19904). The first file at load 12.18 passed 6/6 (impl-1724's receipt) and stays counted. The remaining 9 run at a target of 8–10, with no new file above 13.

### impl-1724 · 2026-11-16T10:10:40.351Z

First macOS C2 slot at unchanged97c53bd59:1/10 complete native files, all6 generated cases pass, including no-network Git wrapper/default-prepare positive control. Node24.21.0 local macOS; entryload12.1807/end18.8999,53606ms including parent native close/cleanup (test runner53456.016625ms). No skipped/cancelled/timedout test; file2 refused above16, all10generators joined (SIGTERM child-close receipts), runner exit1 is load refusal rather than test failure. Coordinator10ddd896 stopped slot for hub3s-response degradation;9e427426 counts first receipt and changes remaining C2 bar to8, target8–10/start no new file above13. Partial native receipts retained; source/configured green unchanged. Evidence declared-output secret scan with Bearer positive control passed before artifact publication; no fixture HOME/env directories exported.

### coord · 2026-11-16T10:18:09.105Z

Coordinator, 2026-11-16 10:19Z: C2 may now run in a Linux --init container (4 CPUs, no network) as well as on macOS. A second macOS slot with 5 generators still reached a load of 18.6, and the hub CLI slowed, because the crew's background load on this Mac is already 6–9. The Linux container's load stays inside its VM, as the other E-1881 items' evidence did. The macOS receipt A-19955 (6/6 at 12.18) stays counted.

### impl-1724 · 2026-11-16T10:26:52.289Z

C2 complete at reviewed97c53bd59, worktree clean/source unchanged. Two accepted Mac files (A-19955 and A-19966) plus eight Linux arm64 Docker --init/--network none/--cpus4 files: all six generated names independently validated in every log,60/60 case passes,0failures/skips/cancellations/timeouts. Linux entries8.37/9.62/10.06/10.06/10.30/10.37/10.68/10.73, durations23938/23043/21738/26541/23571/24105/28397/26630ms. Node24.21.0; no browser in loaded evidence. 180s bound/file,12→8 burners joined; Docker owner exit0 and --rm container absence observed before lock release. Mac monitor~5.2–5.5. Source hashes for droplet.ts/prepare.ts/executor-prepare.test.ts match reviewed working tree. Packet secret scan positive control detected, no credential matches; only declared outputs exported, not scratch HOME/env/accounts. Validated aggregate factsA-19967. Coordinator9e427426 counts Mac1and lowers loadbar8;ed8a9da1 counts Mac2;3542dea8 permits Linux; final request follows for evidence settlement. Configured same-head verifyA-19898 green; C1 already verifiedA-19904.

### rev-38 · 2026-11-16T10:31:57.537Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1724-final-1
commit: 97c53bd59cd835c9877d4b2e06f425b7d572e1bf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1/C2 verified under current amended C2 (ten complete files, >=8 entry1mload, macOS or Linux --init/4CPU/network-none). A-19970 independently reconciles twoMac+eightLinux files/all60 exact case passes,0fail/cancel/skip/todo/timeout, per-file native0/null and Linux three-source-hash maps matching reviewed commit. High Mac end loads stopped later files; outer refusal exits1 are retained and not counted as passing producers. A-19969 retained launchers/cleanup joins and explicitly transcribed owner/absence facts checked; unknown binary paths/slot1 source/per-burner Linux native fields remain labelled, no provenance rerun. A-19904 supplies independently audited uncached same-head configured6389base+225load passes, allT1/all-fallbackT2/changedT3/Web, exact browser/platform; otherT3/T4 coverage remains deferred/unexecuted. Duration/lint/ratchet report-only, no performance pass. No findings, source edits or new run requested; no per-item QA required. Reviewer read only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T14:02:12.143Z

Merged 265afdb850b8b61018d06d834d02144eedbd6f93 onto dev.
