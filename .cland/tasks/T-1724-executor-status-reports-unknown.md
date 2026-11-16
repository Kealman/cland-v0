---
id: T-1724
kind: task
title: Executor status reports "unknown (inspection deferred)" when the local snapshot-key read exceeds its 250 ms bound under load
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1539
branch: t/T-1724-executor-status-reports-unknown
created: 2026-11-06T11:49:25.020Z
updated: 2026-11-16T07:54:49.906Z
---

## Summary

`hub/src/executor/droplet.ts` `inspect()` computes the snapshot key with `within(this.#key(), 250, this.clock)`. When the local `prepareKey` and Git read takes longer than 250 ms, freshness becomes `unknown (inspection deferred)`. That happens under load or with a slow disk. The live executor status showed exactly this on 2026-11-05/06, and `hub/test/executor-prepare.test.ts:197` ("prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes") expects `current` from a single read. impl-1708 hit `unknown (inspection deferred)` in a preservation batch (T-1708 head 8495f3eb, macOS, load about 5). The code is identical on dev 0eb62a96, where the case passed once, so this is a pre-existing load-sensitive bound, not T-1708's change.

## What to build

Decide what the 250 ms bound is for. If it's status responsiveness, keep it and cache the key per HEAD/lock digest, so a repeated status read is current once computed and a deferred read can complete in the background. If not, move it to a named setting. Then the test checks the status after the key's first computation, with its assertion unchanged, or the product makes the first read reliable within budget. Never weaken the assertion.

## Acceptance criteria

- [x] C1. A test that holds the key computation past 250 ms reports `unknown (inspection deferred)` once, and the next status read after the computation completes reports `current` (test, red before the fix).
  - done: impl-1724 · 2026-11-16T07:42:58.189Z
- [ ] C2. executor-prepare.test.ts passes 10/10 on macOS at a one-minute load of 12 or more, with its assertions unchanged (evidence).
  - failed: rev-38 [reviewer] · 2026-11-16T07:47:47.410Z · note Retained old-key consumption can still violate the unchanged native pin-move stale assertion; required loaded native evidence is pending.

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
