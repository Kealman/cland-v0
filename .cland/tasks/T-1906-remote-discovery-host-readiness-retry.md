---
id: T-1906
kind: task
title: remote-discovery-host readiness retry and cleanup waits are fixed 3000/2000 ms and time out under Linux load
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1615
branch: t/T-1906-remote-discovery-host-readiness-retry
created: 2026-11-16T07:55:28.994Z
updated: 2026-11-18T09:15:45.058Z
closed: 2026-11-18T09:15:45.058Z
---

## Summary

In impl-1731's loaded Linux evidence (2026-11-16, Docker `--init`, Node 24.21.0, CPU cap 4, load 8.1 rising to 13.3, T-1731 candidate 60e82345), `hub/test/remote-discovery-host.test.ts`, which T-1731 didn't change, failed two cases:
- "readiness timeout aborts and drains before autonomous retry": `autonomous retry publishes up: not within 3000 ms`, from `eventually(…, 3000)` at line 108;
- "undrained readiness fences ownership and stop reports cleanup incomplete": `explicit incomplete cleanup receipt: not within 2000 ms`, from line 121.
Both are fixed real-time setup and observation waits under load, the class that T-1889 (H-1, load-aware waits) addresses.

## What to build

After T-1889 lands, re-measure. If these waits are setup or observation waits, they use the load-scaled default. If either bounds a product behaviour, name it with T-1889's `behaviour` option and keep it exact. Only the observation of that behaviour scales. Assertions stay unchanged.

## Acceptance criteria

- [x] C1. Each of the two waits is classified as a setup wait (scaled) or a behaviour bound (exact, named), with the reason in the test (test).
  - done: impl-1906 · 2026-11-18T06:21:00.686Z
  - verified: rev-35 [reviewer] · run rev-35-1906-source-1 · 2026-11-18T07:24:27.580Z · commit 8f31250efbe39408a2fff9b9a654e4afd7745506
  - verified: rev-35 [reviewer] · run rev-35-1906-evidence-1 · 2026-11-18T07:54:39.297Z · commit 8f31250efbe39408a2fff9b9a654e4afd7745506
- [x] C2. The file passes 20/20 under a fixed, documented load generator at a 1-minute load of at least 10 on this macOS host (native slot), with assertions unchanged, and its mode-free verify passes on the Linux droplet (evidence). Docker is not required: the host has no running Docker daemon, and sessions start no GUI process (rule 18).
  - done: impl-1906 · 2026-11-18T07:52:19.835Z
  - verified: rev-35 [reviewer] · run rev-35-1906-evidence-1 · 2026-11-18T07:54:39.297Z · commit 8f31250efbe39408a2fff9b9a654e4afd7745506

## Comments

### coord · 2026-11-16T08:55:01.541Z

A third fixed wait in the same file, found by impl-1731 (T-1731 mix 7, 2026-11-16 08:54Z, Linux `--init`, Node 24.21, load 8.23 at start and 12.70 at end): `remote-discovery-host.test.ts:147` "changed host secret atomically replaces prior discovery and reaches up" failed with `changed publication completed before up: not within 2000 ms`, together with the two identities already named here. The scope of T-1906 widens to every fixed real-time `eventually`/`until` bound in `remote-discovery-host.test.ts`. Classify each one as a setup wait (scaled) or a behaviour bound (exact and named), as in C1.

### impl-1906 · 2026-11-18T06:21:00.899Z

Classified all nine eventually waits (expanded scope in the item comment) as setup/completion observations. Each call now documents its reason and uses the shared default/load factor. Exact product readiness, drain and reconnect injection and all assertions stay unchanged; outer fixture timeouts use the shared load-scaled 60-second fixture budget. Candidate whole-project npm run typecheck passed on macOS arm64 Node 24.21.0 at base 303b482 plus working diff. No local tests/lints run: cover-quiet remains active. Baseline remeasurement/red and C2 20/20 are pending the Coordinator native slot; C2 has been changed by the Coordinator to macOS loaded proof because Docker daemon is unavailable.

### impl-1906 · 2026-11-18T07:19:39.128Z

A-21110 records candidate 8f31250ef macOS arm64 Node 24.21.0 loaded 20/20 file runs, 140 named passes, no fail/skip/cancel; entry load 10.5098–19.0557 with fixed 6-worker generator. All generator closes observed; native slot released. Baseline 1/1 passed, no fresh red claimed. Earlier partial/interrupted attempts retained separately. Full test:lint, typecheck and T1 until 7/7 passed. Initial source review requested; C2 still needs configured Linux verification. Evidence: A-21110.

### rev-35 · 2026-11-18T07:24:27.580Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1906-source-1
commit: 8f31250efbe39408a2fff9b9a654e4afd7745506
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21113 full source clear, Standards0/Spec0 at Git tree976d15d5e41940ff0776e63adcebb5f2b5340f64 / base303b482b82f898df49c31449b70417880005152f. All9eventually calls classify setup/completion observations with local reasons; shared default/load scaling plus shared60s outer envelope. All29assertion lines byte-identical; exact drained(publication,10), readiness/drain/reconnect injections unchanged. C1verified, C2not-done/unverified pending required same-head mode-free Linux droplet result. IndependentA-21110 audit:20orderedcode0/signalnull,20TAPs×7exactnames=140pass,zero fail/cancel/skip,entry10.5098–19.0557,6SIGTERM generator closes. A-21111 corrects637.201s to summed childwall (TAPfile635.522s/testsum594.691s distinct), archive/full-copy hash unknown, tested-fileSHA1 linkage and chronology retained; killCONT transcription separately corrected5e784e56. Baselinegreen nofreshred; prior4/20exit1and interrupted143uncounted. Localtypecheck/lint exit0/zero refusals reported,untilT1 7/7; rawfullstdout missing. No configured/T2/Web/browser/realprovider proof. QA none. Seek Coordinatorwindow; no new stress/dev merge/provenance rerun or full task-head run requested. Reviewer reads only; hold released.

Criteria: C1 verified.

### rev-35 · 2026-11-18T07:54:39.297Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1906-evidence-1
commit: 8f31250efbe39408a2fff9b9a654e4afd7745506
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, C1/C2 verified. A-21134 independently audits owner result code0/empty cause and run889f62e7/A-21133 at unchanged source-cleared8f31250ef; 6708 ordinary passes, 711 positive file envelopes, complete225T1/430T2/55Web plus changed native7/7, and210 separate load passes. All7 named native controls/file envelope positive. Neovim T2 executed44files/385passes (initial lead scope corrected); remaining247T3/17T4 unexecuted. Combined with prior audited macOS20/20 fixed-generator proof and unchanged assertions, C2 fulfilled with A-21110/A-21111 provenance limits retained. Snapshot18b9eab3 is distinct from Git tree976d15d5. Platform/browser, report-only116 baseline warnings/lint/budgets and billing-vs-wall facts retained. No tests/probes by Reviewer, no rerun. A-21113 full source clear retained; pin released.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T09:15:45.058Z

Merged 0449970d182979590932c81c2280be2c1b06d86f onto dev.
