---
id: T-1717
kind: task
title: DigitalOcean volumes
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1712
  - T-1715
topic: topic-1418
branch: t/T-1717-digitalocean-volumes
created: 2026-11-06T10:48:46.395Z
updated: 2026-11-07T02:11:32.136Z
closed: 2026-11-07T02:11:32.136Z
---

## Summary

The DigitalOcean provider implements the volume operations on DigitalOcean Volumes. Create makes a 1 GiB volume, tagged like hosts, in the pool's region. Attach and detach are actions awaited to completion. Snapshot honours the one-per-10-minutes limit as a typed refusal with its retry time. Delete is confirmed by a GET, and list works by tag. The fake API gains volumes with one attachment at a time and the snapshot window.

Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/src/executor/droplet/api.ts` (volume calls), `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean-volumes.test.ts` (new)

## What to build

Volume calls on `DigitalOceanApi`, volumes in the fake API, and the provider's volume operations against them.

## Acceptance criteria

- [x] C1. Against the fake API, a volume created in lon1 with the `cland`, project and pool tags attaches to a droplet and detaches, each action awaited to `completed` (test).
  - done: impl-1717 · 2026-11-07T01:11:57.742Z
  - verified: rev-35 [reviewer] · run rev-35-1717-final-1 · 2026-11-07T01:34:42.426Z · commit 5a87f700eb04e5aa374ef178f24cbedda57ffe6c
- [x] C2. An attach to a second droplet while the volume is attached is refused as `attached elsewhere` (test).
  - done: impl-1717 · 2026-11-07T01:09:03.752Z
  - verified: rev-35 [reviewer] · run rev-35-1717-final-1 · 2026-11-07T01:34:42.426Z · commit 5a87f700eb04e5aa374ef178f24cbedda57ffe6c
- [x] C3. A second snapshot within 10 minutes is refused with its retry time, as the fake API's 429 says (test).
  - done: impl-1717 · 2026-11-07T01:11:57.985Z
  - verified: rev-35 [reviewer] · run rev-35-1717-final-1 · 2026-11-07T01:34:42.426Z · commit 5a87f700eb04e5aa374ef178f24cbedda57ffe6c
- [x] C4. A volume DELETE answered 404 while its GET answers 200 is reported not deleted (test).
  - done: impl-1717 · 2026-11-07T01:09:04.207Z
  - verified: rev-35 [reviewer] · run rev-35-1717-final-1 · 2026-11-07T01:34:42.426Z · commit 5a87f700eb04e5aa374ef178f24cbedda57ffe6c
- [x] C5. The volume cases of the contract suite pass against the fake API (test).
  - done: impl-1717 · 2026-11-07T01:09:04.545Z
  - verified: rev-35 [reviewer] · run rev-35-1717-final-1 · 2026-11-07T01:34:42.426Z · commit 5a87f700eb04e5aa374ef178f24cbedda57ffe6c

## Comments

### impl-1717 · 2026-11-07T00:58:16.550Z

Rule 20 consumer inventory (before changes): search of DigitalOceanApi, fakeDigitalOcean, CreateVolumeOptions, createVolume, snapshotVolume and unsupported-volume text covers hub/src/executor/droplet/{run,droplet,watchdog,snapshot-recovery,api,prepare,dependencies}.ts; host/provider/{provider,fake,digitalocean,registry}.ts; executor admission/deletion-confirmation/liveness/lock-liveness/safety/watchdog/droplet/deadline/prepare/snapshot-confirmation/prepare-component tests; digitalocean-pacing; host-provider-contract/digitalocean/volumes tests; fake-api, droplet-fixture, remote-fixture, account-fixture-env, suite-dry-run, suite-unit-fixture, startup-ready-component and daemon tests; docs/hub/host-providers.md. No web/nvim/shared or shipped skill consumers found. API methods and fake routes are additive; old machine/image/key wire shapes stay unchanged and existing endpoint/pacing/executor tests preserve those consumers. Remove only provider volume placeholders. Keep CreateVolumeOptions unchanged: configured provider pool or acquire input supplies the same pool source as machines; missing pool is a typed pre-wire refusal. Contract factory supplies pool explicitly. Creation pause includes volume creates; volume snapshot window returns rate limited with provider retryAt. New CreateVolumeResult refusal is additive; fake provider remains compatible; existing caller tests remain regression coverage.

### impl-1717 · 2026-11-07T01:00:26.775Z

Expanded field/function-name sweep adds executor/droplet/deadline.ts (Record keyed by Provider requires volume deadline argument entries), qa/briefs/T-271.md and qa/briefs/E-1538-stage-1.md (no volume wire consumers; old API calls unchanged). Persisted machine intent readers are local to digitalocean.ts; additive optional region records retain old shape readability, old records lacking region refuse attach conservatively.

### rev-35 · 2026-11-07T01:09:52.276Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1717-source-1
commit: 6887ae692beb4ec4512aa53630964801e0d7b0c6
scope: full
findings: [{"severity":"medium","text":"Delayed-action test waits for any FakeClock timer, including the scripted API's 15000ms transport timer. Its single 100ms advance can precede the actual provider poll wait; awaiting work (and the one-shot finally advance) can then stall without joining the operation before API/root closure. Observe the exact poll admission and prearm bounded release/drain ownership before triggering work.","file":"hub/test/host-provider-digitalocean-volumes.test.ts","line":54},{"severity":"medium","text":"After a snapshot 429 supplies retryAt, another snapshot enters #ownedVolume GET and waits in the shared token-budget cooldown rather than returning the known typed refusal. That can occupy the provider's serial tail for the remaining 10-minute window. Retain a volume-identity-bound refusal receipt and return it before wire admission until expiry; preserve exact retryAt and test repeated calls/no API work.","file":"hub/src/host/provider/digitalocean.ts","line":291},{"severity":"low","text":"Documentation claims all volume calls use the executor deadline wrapper, but this provider retains raw DigitalOceanApi; only action polling GETs receive an explicit deadline. Distinguish additive executor-wrapper compatibility from the provider's actual bounds.","file":"docs/hub/host-providers.md","line":213}]
finding_counts: {"high":0,"medium":2,"low":1}

A-17326 records separate Standards/Spec review and qualified A-17325 candidate evidence. Two medium findings: delayed-action timer/drain ownership and repeated snapshot refusal semantics; low inaccurate wrapper documentation. Other runtime criteria remain unverified. Fix, commit/push and request fresh source review before configured verification; no broader/native rerun requested for provenance.

Criteria: C1 failed (Delayed-action control cannot positively identify or safely drain its provider poll wait; exact action-completion proof is unreliable.), C3 failed (Repeated snapshot during an observed 429 window waits behind API pacing rather than returning the known typed retry refusal.).

### rev-35 · 2026-11-07T01:13:27.137Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1717-source-2
commit: 5a87f700eb04e5aa374ef178f24cbedda57ffe6c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-17328. Exact poll admission plus prearmed bounded fixture drain resolves C1 control; identity-bound known snapshot refusal resolves C3 repeated-call delay; raw-API documentation corrected. A-17327 candidate development evidence retains precommit/mixed-lint/typecheck-red provenance limits. C1–C5 remain runtime-unverified pending same-head configured verification and directed executor preservation. No QA claim.

### impl-1717 · 2026-11-07T01:33:49.438Z

Configured verification 17c0cff9 at unchanged reviewed 5a87f700eb04e5aa374ef178f24cbedda57ffe6c passed T0/T1/T2/Web, 5346/5346 no skips; fallback all T2, T3 in merge batch. A-17330 retains raw log, provenance tree5d62572ab5c692e06640702acc8038d911e0e39c, Linux x64 droplet c-8 lon1 Node24.21.0, Chrome for Testing156.0.8078.4 headless-shell1248, lifetime1087s cost$0.0755. Duration/lint budgets report-only, not enforcement. All nine volume named-case timing receipts pass; no duration allowance needed. Directed executor T3 files separately passed macOS at same head (A-17329). Source-clear A-17328; final criterion settlement requested from Reviewer; after-stage affected QA remains on integrated dev. Branch pushed; no head changes.

### rev-35 · 2026-11-07T01:34:42.426Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1717-final-1
commit: 5a87f700eb04e5aa374ef178f24cbedda57ffe6c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-17331. A-17330 run17c0cff9 exit0, hub5346/5346; exact head and independently reconstructed execution-tree projection match. Nine volume identities pass base+5 distinct load passes each (45/45); all C1–C5 mapped and verified. T0/T1/all fallback T2/Web complete on uncached Linuxx64; browser provenance retained Shell1248/CfT156. A-17329 same-head macOS directed executor preservation36/36 independently read with qualified original-tool exits. Configured T3/T4 not executed, remaining T3 merge-batch and after-stage affected QA remain separate; report-only diagnostics not gate failures.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-07T02:11:32.136Z

Merged 54607a4a4aa9471f8a56f6f0907f911dc138e3fd onto dev.
