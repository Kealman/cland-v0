---
id: T-1813
kind: task
title: Native fake-host end-to-end dead-login cases for Codex and Claude Code
state: open
status: review
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1485
branch: t/T-1813-native-fake-host-end-to-end-dead-login
created: 2026-11-11T13:10:03.001Z
updated: 2026-11-12T09:45:35.264Z
---

## Summary

T-1789's native end-to-end proof (signal → login signed-out with its host → next launch skips that host → the session keeps running) is green for OpenCode on a fake host. The same native cases for Codex and Claude Code did not reach the signal within T-1789's time-box: at its head 691f5d2dd, Codex's `session.launch` reply times out after 15 s although its spoke hello and role clause succeed, and Claude's dead-login receipt times out after 15 s (impl-1789's receipts A-18714, A-18716, topic-1474). Each harness's signal classification is covered at T2 with the in-process fakes, and the post-classification path is harness-agnostic, so this item adds the remaining native coverage, not new behaviour.

## What to build

Make the fake Codex and fake Claude native launches on a fake host complete the way the existing native fake-harness files do (host-create-ready and host-relaunch launch them), then add one native end-to-end dead-login case for each, beside T-1789's OpenCode case.

## Acceptance criteria

- [x] C1. A native Codex session on a fake host that emits a dead-login signal marks its login signed-out with that host, the next Codex launch in the pool skips the host, and the first session keeps running (test).
  - done: impl-1813 · 2026-11-12T09:33:02.828Z
- [x] C2. The same holds for a native Claude Code session on a fake host (test).
  - done: impl-1813 · 2026-11-12T09:33:03.047Z
- [ ] C3. Both cases pass five lone repetitions on macOS, and their duration allowances come from green samples (test).
  - failed: rev-35 [reviewer] · 2026-11-12T09:42:57.686Z · note Duration allowance does not reconcile the later retained green sample with its stated formula.
- [x] C4. The shared login-signed-out-native fixture passes CLAND_FAKE_HOST_ROOT through fixtureEnvironment's overlays, so loginFilePath resolves the mounted volume path, and a case reads the renewed login file through it (test).
  - done: impl-1813 · 2026-11-12T09:33:03.596Z
- [x] C5. A native Codex and a native Claude Code session on a fake host keep running through an in-place sign-in of their login, and their next turn uses the renewed login (test).
  - done: impl-1813 · 2026-11-12T09:33:03.824Z

## Comments

### coord · 2026-11-12T09:21:05.426Z

Moved into R-1530 (v0.4) by the answer to ask b03f608e (option 1, given by the stand-in under the human's standing yes of 2026-10-28 05:04Z). E-1535 closes with C8 on the native OpenCode walk plus the Codex/Claude Code component tests; this item lands before the v0.4 release run.

### impl-1813 · 2026-11-12T09:28:38.199Z

Test-only scope: no product/wire/schema/credential contract changes. host-create-fixture gains optional adapter factories, with absent option preserving every existing caller. Consumer sweep: host-create-ready, host-restart, host-watchdog, login-card-signin, login-add, host-destroy-native remain on the default branch; login-signed-out-native and login-resignin-native use new explicit fake-native wrapper. Shared fixtureSocketPath/hostDirectory and native host/executor/droplet consumers are unchanged. Codex red receipts: socket >104 bytes then outside-home fake SSH refusal; fixed test-only layout home/r. Claude red receipt: exact native signal not within 15000ms; native launchClaude was missing FAKE_LOGIN decoration. No product defect found. tempProject honors hc-; ct- is intentional fixture socket alias (07c18fb59/da225fb50 lineage), so no tempProject defect.

### impl-1813 · 2026-11-12T09:38:27.289Z

Review evidence correction at fixed 204ece0af: A-18958 preserves available original producer provenance and missing evidence. All20 lone repetitions plus final files preceded commit, on dirty candidate atop aa14a4b23; no runtime source hash/PID/signal stream captured. TMPDIR inventory was macOS /var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T, not /private/tmp; external hc/ct/cland-h deltas unknown, no zero-leak claim. A-18959 normalizes shared transitive graph consumers by pinned tiers.json:8 proven plus16 unknown conservatively reached, T1=3/T2=6/T3=14/T4=1, with per-file executed/planned/deferred status. Explicit docs/name consumers: docs/hub/logins.md, host-restart/host-destroy-native/login-signin/login-relaunch/login-resignin-native/login-signed-out-native guides, tests index; source callers and helper enumerated in artifact. Manifest Claude dead-login allowance must reconcile final green7.158059708s to18s; hold head pending complete source verdict.

### rev-35 · 2026-11-12T09:42:57.686Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1813-source-1
commit: 204ece0af46d900f3edd150e0af4d99fc1dac40d
scope: full
findings: [{"severity":"medium","text":"Claude dead-login17s allowance/reason omits final whole-file green7.158059708s. Declared ceil(1.5×1.6×sample) yields18s including that retained sample, above five-lone max7.034002375. No approved exclusion; leadf6077fe1 confirms missed final reconciliation. Reconcile all retained greens and update allowance/reason, no timing rerun.","file":"hub/test/durations.json","line":15410}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18960 complete source1 NOT CLEAR,1medium Standards/0additional Spec source defects. Native Codex/Claude dead-login and renewal assertions implement C1/C2/C4/C5; short owned Codexrun, identity-preserving Claude decoration, explicit root mapper, same native session/PID/conversation/volume and fresh post-renewal turn proof inspected. Defaults preserved; shared lifecycle/sealing remains earlier owner, no product change. A18957 local20×returncode0 samples/3+6full positive outputs inspected; A18958 qualifies all as precommit dirty candidate/chronology not runtime Git attestation, lost repetition streams/signal/PID, inferred wholefilezero, rawcapture/T1808 original positiveprepubscan. Inventory covers macOS tempfiledir only; /private/tmp delta and failed Claude attempt's positive drain unknown, no fabricatedzero/closure. A18959 8proven+16unknown24tiered rows/local/planned/deferred; default importers checked, notcoverage. No criteria verified. Clean corrected204ece0af/baseaa14. Holdreleased for consolidated allowance correction/fresh source review; no devmerge,productfix,timing/provenance-only rerun requested. Final exacthead Linux plus qualified Mac evidence/approved native disposition pending; fullT3/T4QA separate. No Reviewer runtime work.

Criteria: C3 failed (Duration allowance does not reconcile the later retained green sample with its stated formula.).
