---
id: T-1691
kind: task
title: "host-reboot-native: the fake-host reboot CLI exits non-zero under heavy load (macOS load gate 4/5)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1613
topic: topic-1392
branch: t/T-1691-host-reboot-native-the-fake-host-reboot
created: 2026-11-05T15:07:14.237Z
updated: 2026-11-05T17:08:34.603Z
closed: 2026-11-05T17:08:34.603Z
---

## Summary

The E-1532 stage-5 macOS cover df57f563 at e786b48f (A-16872, local darwin arm64, peak 1m load 15.2) passed every base test. Its load gate, which runs five repetitions alongside the phase, passed `hub/test/host-reboot-native.test.ts` "reboot retires one host without stop or signals and bootstraps a fresh supervisor and agent" only 4/5. Repetition 1 failed in 3.96 s with `Command failed` from a child process. The fixture's separate `fake-host.ts reboot` CLI exited non-zero; its stderr is redacted in the receipt. T-1686 measured this test 10/10 under 5 burners on macOS and 10/10 in a Linux container (A-16838). The earlier failing cover 5768d4e4 also showed a reboot-native load-gate failure.

## What to build

Find why the reboot CLI command exits non-zero under heavy load. Candidates: the authenticated controller connect or `controlRequest` timeout (the reboot path uses an explicit 15000 ms), the supervisor or master restart racing the CLI, or a fixture-lifetime ownership check. Fix the cause in the fixture or product, keeping every assertion. Also make the failure keep the CLI's own stderr, redacted but present, so the next failure names its cause.

## Acceptance criteria

- [x] C1. The failing step and its cause are named, with a reproduction under CPU load (evidence).
  - done: impl-1691 · 2026-11-05T15:18:50.391Z
  - verified: rev-36 [reviewer] · run rev-36-1691-final-1 · 2026-11-05T15:50:54.980Z · commit 584350248781aee1e13024c2636f0c4b7b3ccaf3
- [x] C2. After the fix, host-reboot-native passes 10/10 under heavy CPU load on macOS (load 12 or more) and in a Linux container run with `docker run --init`, with assertions unchanged (evidence).
  - done: impl-1691 · 2026-11-05T15:22:34.810Z
  - verified: rev-36 [reviewer] · run rev-36-1691-final-1 · 2026-11-05T15:50:54.980Z · commit 584350248781aee1e13024c2636f0c4b7b3ccaf3

## Comments

### impl-1691 · 2026-11-05T15:09:09.879Z

Rule 20 pre-change consumer sweep: searched all hub/test, docs, qa, .agents and shared for fake-host, serveFakeReboots, hostControl, controlRequest, reboot-control, master-control, hostOwner and sameOwner (169 matches). Direct reboot consumers: host-reboot-native and host-reboot-controller plus fake-ssh documentation. Other controls: fake-ssh.ts, fake-ssh.test.ts, host-supervisor, host-agent-restart, host-push-on-ref-move, host-survival-native, host-ssh-contract, transport-forwards and transport-contract-fixture. createFakeHost consumers include ssh-host-fixture, host-records, fixture-socket-path and host-ssh-registry. Production shares only fake-host-directory and boot-source policy. QA stage-2/4 briefs and implement skill document those controls. No wire shape changed by initial CLI diagnostics; further migrations assessed after reproduction.

### impl-1691 · 2026-11-05T15:12:23.044Z

Consumer assessment: fixture control frames/records, authentication, owner/age policy, fake boot source and non-reboot actions unchanged. Existing clients (including previous request shape in host-reboot-controller) remain unchanged and exercised. Only reboot completion now waits for positive empty writer census before clearing run/new boot. Updated native and fake-SSH file guides. All other sweep consumers unaffected. Source head 28e56df4b pushed; requested review concurrently with required evidence per assignment.

### rev-36 · 2026-11-05T15:15:25.123Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1691-source-1
commit: 28e56df4b8b75dc82b840ca2ae7d2f01c43d0193
scope: full
findings: [{"severity":"medium","text":"Success and failure stderr are clipped before shared redaction; a credential crossing the last-8192 boundary leaves an unmatched suffix. Redact complete captured stderr first, then bound; retain a planted boundary control and native code/signal.","file":"hub/test/host-reboot-native.test.ts","line":84},{"severity":"medium","text":"New ps launch inherits process.env instead of the owned sealed fixture environment. Thread the fixture root/env and use the shared builder after final options; OS-only lint exemption does not waive rule15.","file":"hub/test/fakes/fake-host.ts","line":144}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards: two medium findings at listed lines (rules15/17), detailed A-16878: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16878-t-1691-source-review-at-28e56df4b.md . Spec: positive empty census remains before run removal/new boot, no added signal authority, native assertions unchanged; requested redaction guarantee incomplete. C1 exact survivor remains unobserved; loaded reproduction names writers-remain but sleep explanation is hypothesis. Coordinator permits honestly labelled no-survivor-observed campaign outcome. C2 load/preservation/configured runtime evidence pending. Reviewer ran no tests. Fresh source review required at corrected head before verification.

Criteria: C1 failed (Requested retained redacted CLI cause is unsafe at truncation boundary; stderr must be redacted before clipping and its native diagnostic launch sealed.).

### rev-36 · 2026-11-05T15:19:39.234Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1691-source-2
commit: 584350248781aee1e13024c2636f0c4b7b3ccaf3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: Standards and Spec no findings. Both A-16878 medium findings resolved: full stderr redacted before bounding on success/failure, shared helper keeps code/signal and excludes argv message; pure planted clipping-boundary test proves old suffix exposure and preserved reporter receipt. New ps child uses fixtureEnvironment(host.directory, env), no exemption. Positive empty census, native assertions, authentication and production unchanged. C-216 allowance 24→28 s follows ceil(1.5×reported macOS18.307176458 s), expiry unchanged Nov11, timeout60 s; documented measurement source28e56df4b distinct from current diagnostic fixes. A-16880: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16880-t-1691-corrected-diagnostic-source-review-at-584350248.md . C1/C2 runtime unverified: retained reproduction/cause assessment, 10×macOS load>=12 and Linux Docker --init/preservation/configured receipts pending. Exact survivor not observed in reported ten Mac samples; do not assert inferred sleep as observed. Reviewer ran no tests.

### impl-1691 · 2026-11-05T15:26:59.173Z

Evidence complete pending configured run18835ff0: A-16877 reproduction; A-16879 macOS10/10 load13–23 at28e56df4b; A-16882 Linux--init10/10 at584350248; A-16883 provenance; A-16884 retained drivers/exit limitations/retrospective hashes; A-16885 preservation/T0 at584350248. Mac survivor was not observed in ten loaded samples; exact trailing writer remains inference, not asserted as observed. Preservation files unchanged, required35/35 named cases pass plus13 supplemental cases, no skips/failures. Typecheck/build/test:lint and lint-tiers exit0; existing report-only findings retained. No browser. Source clear rev-36-1691-source-2, head584350248 clean/pushed. CLI verification submission timed out waiting(reply exit75), but durable hub admission18835ff0 received; not resubmitted.

### impl-1691 · 2026-11-05T15:27:10.571Z

Correction to preceding count: required preservation cases total34 (18+1+4+10+1), all pass; supplemental13. Per-file receipts/counts were correct.

### rev-36 · 2026-11-05T15:50:54.980Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1691-final-1
commit: 584350248781aee1e13024c2636f0c4b7b3ccaf3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no outstanding Standards/Spec findings. C1 verified at bounded diagnosis: retained loaded failure names immediate post-cleanup residual-writer census before run removal/new boot; fix waits for positive empty census without extra signal authority. Exact survivor not captured and not observed in ten later Mac samples; polling-child explanation remains inference, per Coordinator c52a4c27's explicit assessment scope. C2: independently read ten named Mac passes at source28e56df4b (14 burners/10 CPUs, every start load13.109–23.25) and ten Linux arm64 Docker --init passes at584350248 (2 burners/4 CPUs), original assertions/census unchanged across diagnostic fixes. Source linkage retrospective/timeline, not contemporaneous hashes; per-child native exit pairs unprinted, not claimed independent zero receipts; named full case outcomes prove coverage. A-16885 47 local preservation/consumer passes and T0 check exit0. Same-head configured18835ff0/A-16888 exit0, hub5154/5154; T0/T1/all-fallbackT2/one nativeT3/Web pass, reboot5.514323747s. RemainingT3 merge batch, T4/repetitions unexecuted here. Uncached Linuxx64 c8sfo2 Node24.21/Nvim0.12.5, isolated HeadlessShell1248/Chrome156.0.8078.4; report-only advisories retained. A-16889 full evidence/limits: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16889-t-1691-final-campaign-and-configured-evidence-review.md . Prior failure stays failed. Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-05T17:08:34.603Z

Merged 23edd64f39810fadf76223057a9700a7252748bb onto dev.
