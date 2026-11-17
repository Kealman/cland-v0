---
id: T-1930
kind: task
title: doctor-hosts.test.ts C1/C6 intermittently sees two DigitalOcean GET calls (droplets, account keys) that the doctor should not make
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: topic-1583
branch: t/T-1930-doctor-hosts-test-ts-c1-c6
created: 2026-11-17T02:42:21.720Z
updated: 2026-11-17T04:42:15.682Z
closed: 2026-11-17T04:29:28.953Z
---

## Summary

Periodic dev T3 0a3ff0ea at e76c3841d (Linux droplet c-8 ams3, A-20558) failed `hub/test/doctor-hosts.test.ts::C1/C6 doctor reads hub token presence=true without provider calls`: the fake provider recorded two calls where the test expects none. The file passes 5/5 alone on macOS at the same commit, and the case passes alone at every dev commit since the last green periodic run (96baaf13b), so the failure is intermittent or environment-dependent, not a deterministic break by one landing.

## Evidence

- Failure (A-20558): `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal`, actual `[{method:'GET', path:'/v2/droplets?tag_name=cland&per_page=200&page=1'}, {method:'GET', path:'/v2/account/keys?per_page=200&page=1'}]`, expected `[]`, at doctor-hosts.test.ts:89.
- Coordinator, macOS Node 24.21.0, detached worktree: the case alone passes at 96baaf13b, c74b7141f, 75e65f1d6, 297243fd9, 4496ae8ef, 6fa0c3390 and e76c3841d; the whole file passes 5/5 at e76c3841d.
- The two calls match the executor sweep and reap reads (tagged droplets, account keys). Hypothesis, not yet proven: since T-1705 (75e65f1d6) a fixture hub can resolve a provider token from its store, so a periodic or startup sweep may fire during the doctor case on a slower runner.

## Acceptance criteria

- [x] C1. Name the source of the two provider calls in the failing run, from the log or by reproducing it under load or with a fake clock, and quote the evidence.
  - done: impl-1930 · 2026-11-17T02:51:22.607Z
  - verified: rev-35 [reviewer] · run rev-35-1930-source-1 · 2026-11-17T02:55:11.975Z · commit 5cfd6add5073b613beb90b6909d0de47f7dae1a4
  - verified: rev-35 [reviewer] · run rev-35-1930-source-2 · 2026-11-17T03:05:22.497Z · commit 28cb8304430fe9517b234d05b11fe665a859e0d4
  - verified: rev-35 [reviewer] · run rev-35-1930-final-1 · 2026-11-17T03:39:58.399Z · commit 28cb8304430fe9517b234d05b11fe665a859e0d4
- [x] C2. The doctor case is deterministic: either no sweep or reap can run in its fixture, or it asserts only the doctor's own calls; 20/20 runs under the T2 runner pass (test).
  - done: impl-1930 · 2026-11-17T03:02:41.797Z
  - verified: rev-35 [reviewer] · run rev-35-1930-final-1 · 2026-11-17T03:39:58.399Z · commit 28cb8304430fe9517b234d05b11fe665a859e0d4

## Comments

### impl-1930 · 2026-11-17T02:45:14.299Z

C1 reproduced on macOS arm64 Node 24.21.0 using node --test --test-name-pattern=C1/C6 hub/test/doctor-hosts.test.ts with a bounded executor-sweep completion wait AFTER the baseline: presence=true failed with the exact GET /v2/droplets?tag_name=cland&per_page=200&page=1 and GET /v2/account/keys?per_page=200&page=1; absent token passed. A-20558 lines 21622–21645 quote the same deep-equal failure. Dispatcher startup recovery invokes sweep(true), which resolves the synthetic token and calls reap; FakeClock never advances, excluding scheduled sweeps. Product behaviour is correct: startup inventory is intentional and doctor adds no calls. Fix synchronises this test fixture on completed startup recovery before measuring doctor; asserts exact startup inventory reads and zero additional requests. Direct file run after fix: 11/11 passed locally; T2 runner repetitions pending.

### impl-1930 · 2026-11-17T02:51:41.325Z

Final source 5cfd6add5073b613beb90b6909d0de47f7dae1a4: C2 20/20 serial T2 file-runner passes (runs 9–28, after predicate type correction), 220/220 completed tests including both C1/C6 generated cases 20/20; macOS arm64 Node 24.21.0 local, no browser. A-20569 full receipts; A-20566 exact red reproduction and diagnosis. Hub typecheck and whole-source test:lint exit 0; existing report-only lint notices, zero refusals. No full verification yet. Local slot released and source review requested from Reviewer role.

### rev-35 · 2026-11-17T02:55:12.254Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1930-source-1
commit: 5cfd6add5073b613beb90b6909d0de47f7dae1a4
scope: full
findings: [{"severity":"medium","text":"The modified C1/C6 callbacks lack a whole-sequence owner before fixture acquisition; returned-resource hooks do not join the new startup wait and later doctor continuations or adopt late acquisitions before root/environment cleanup.","file":"hub/test/doctor-hosts.test.ts","line":73}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear; A-20573. One medium Standards finding at doctor-hosts.test.ts:73: compose the existing callback lifetime owner before acquisition and join/fence setup/body, including the new startup wait, before resource/root/environment cleanup. Lead confirms no earlier owner or approved disposition. No Spec finding in the synchronization: executor-sweep follows joined startup inventory and final lease read; exact baseline plus complete provider request equality across text/JSON doctor remain. C1 verified separately under this run from A-20558's exact two-GET failure, A-20566 reproduction and source trace. C2 failed for lifetime ownership. A-20569 independently contains 20 runs (9–28), each 11 positive tests and file pass, including both generated token cases; 220 completions total. These are same-final-source development receipts, with runs 9–20 precommit, no per-run tree attestation, excluded earlier runs/typecheck repair and custom scan limitations preserved in the lead's supplement. No configured verification or Reviewer runtime/edit.

Criteria: C2 failed (The modified callbacks lack pre-acquisition whole-sequence ownership joining the new startup wait, doctor continuations and late resources before cleanup.).

### impl-1930 · 2026-11-17T03:02:59.999Z

Lifetime ownership correction committed/pushed at 28cb8304430fe9517b234d05b11fe665a859e0d4. A-20578 contains 20/20 serial corrected-head T2 file runs (220/220 positive tests), native code0/signal null, launcher metadata, source/log hashes; macOS arm64 Node24.21.0 local, no browser, report-only tier/duration gates. Start load5.639–11.960, paused twice above12; slot released. Shared on-write redaction and positive-controlled bounded output scan, no matches; historical A-20569 provenance limits remain. Hub typecheck and whole-source test:lint pass with zero refusals and existing report-only notices. Fresh source review requested; configured verification pending clear verdict and Coordinator window.

### rev-35 · 2026-11-17T03:05:22.498Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1930-source-2
commit: 28cb8304430fe9517b234d05b11fe665a859e0d4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated full source review clear; A-20579, no findings. A-20573's lifetime medium is resolved: secretSequence precedes acquisition, owns the whole setup/body, immediately captures roots/late resources, fences waits and disposes the eventual hub before API/root cleanup. Exact startup and post-doctor request assertions are unchanged. C1 diagnosis refreshed at this head; C2 remains unverified until configured same-head post-verdict evidence. Independently parsed A-20578's 20 committed-source T2 runs: each code 0/signal null, 11 test passes plus file pass, both token identities pass; 220 repeated completions total, no non-pass finishes. All 20 log hashes and recorded test/guide source hashes match current durable bytes and clean pinned head/tree. Local Darwin arm64/Node24.21, no browser; report-only tier/duration notices, narrow scan claims and earlier historical provenance limits retained. No production/shared-contract change, dev merge, Reviewer runtime/edit or full verification claim.

Criteria: C1 verified.

### coord · 2026-11-17T03:10:06.481Z

More occurrences of the race on Linux droplets. Verify run 6d52172c (T-1840 at 308016c3b, 03:09Z) failed only on this case, with the identical two GET calls at doctor-hosts.test.ts:89. T-1586's full T2 run 97ccc4bc at bec32badf (base e76c3841d) passed it. So the frequency is high enough to stop several task verifies before T3 and Web: about 2 of the 4 full-T2 runs since e76c3841d. Landing T-1930 is the release's top fix-forward.

### rev-35 · 2026-11-17T03:39:58.399Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1930-final-1
commit: 28cb8304430fe9517b234d05b11fe665a859e0d4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-20596. Configured adffa205/A-20593 matches unchanged clean source-clear head: 6540 ordinary test/707 file positives, separate230 load positives, no fail/cancel/skip or unfinished start. T0/all224T1/all428fallbackT2/55Web complete. Both doctor token cases pass at15744/15755 and file15841, all11 ordinary cases. Together with independently audited A-20578's20/20 committed-source runs (220 repeated positives, native code0/signal null, matched log/source hashes), C2 is verified; C1 diagnosis refreshed. All269T3/17T4 unexecuted/deferred. Provenance37614 pins normalized verification tree e02ca4e06bb9798583985b2141d7e87bbcfaace4, uncached Linux x64/Node24.21/Nvim0.12.5; actual isolated HeadlessShell1248/CfT156.0.8078.4 at35047. Advisory gates and historical capture/scan limits retained. No full native/cloud/latency claim, source changes or Reviewer runtime.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T03:57:50.558Z

Another occurrence: T-1840's same-head resubmission 93559fdd at 308016c3b (03:57Z) failed only on this case again, with the identical two GETs at doctor-hosts.test.ts:89. T-1840 now holds, and gets this item's landed commit as a shared fix (rule 11) once batch 689a3fb2 lands.

### coord · 2026-11-17T04:29:28.953Z

Merged 20202e0c99d426bc1734788af5250aa1854cf16d onto dev.

### coord · 2026-11-17T04:42:15.682Z

Periodic dev T3 b9d4d0eb (A-20618) failed only on this case, at head 8b0876457. That's before this item landed (20202e0c9), so it's expected and not a regression of the fix. The next periodic dev run at or after 20202e0c9 is the post-landing check.
