---
id: T-1767
kind: task
title: digitalocean-pacing T2 cases run native process cleanup through the fake API close
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1581
branch: t/T-1767-digitalocean-pacing-t2-cases-run-native
created: 2026-11-09T06:51:21.971Z
updated: 2026-11-17T04:28:40.446Z
closed: 2026-11-17T04:28:40.446Z
---

## Summary

Two HTTP cases in `hub/test/digitalocean-pacing.test.ts` run native process cleanup (`ps`) through `fake-api.close` → `process-cleanup`: the 429 cleanup case and the missing-header case. The T2 resource lint reports it (report-only). The file therefore isn't process-free T2 evidence. Found aside by impl-1756 during T-1756 (2026-11-09).

## Acceptance criteria

- [x] C1. The fake DigitalOcean API's close in those cases uses a scripted, no-native HTTP teardown, or the file moves to the lifecycle tier that matches its native work (test).
  - done: impl-1767 · 2026-11-17T02:13:05.915Z
  - verified: rev-35 [reviewer] · run rev-35-1767-final-1 · 2026-11-17T02:46:23.748Z · commit cf34f73a5ab4bcc338b282f9023de5f3ac13cc30
- [x] C2. The T2 resource lint reports zero tier-resource findings for `digitalocean-pacing.test.ts` (test).
  - done: impl-1767 · 2026-11-17T02:13:06.399Z
  - verified: rev-35 [reviewer] · run rev-35-1767-final-1 · 2026-11-17T02:46:23.748Z · commit cf34f73a5ab4bcc338b282f9023de5f3ac13cc30

## Comments

### impl-1767 · 2026-11-17T02:11:18.981Z

Current dev already separates scripted machine ownership from native cleanup, but HTTP listener creation is still tied to process machines. Plan: add an opt-in HTTP transport to scripted machines; use it in the two pacing HTTP cases while preserving loopback HTTP and all 429 assertions. Consumer inventory searched fakeDigitalOcean, fake-api import paths, machine/scripted, and cleanup/census names across hub/web/nvim tests, production, docs and skills. Direct consumers: pacing; executor admission/deletion/safety/droplet/snapshot/prepare/component tests; host-provider tokens/DigitalOcean/prepare/volumes tests; hosts-state; setup/doctor-hosts; startup-ready-component; daemon; suite-dry-run/unit-fixture; remote-fixture/droplet-fixture; integrated-v04. Existing callers retain the derived transport default and machine ownership unchanged. No production wire/persisted contract changes.

### impl-1767 · 2026-11-17T02:13:45.659Z

Implemented and pushed cf34f73a5ab4bcc338b282f9023de5f3ac13cc30. A-20536 contains the complete targeted runner receipt (24/24, zero runtime tier-mismatch lines); A-20537 records positive baseline and after evidence. macOS arm64, local Node 24.21.0, report-only T2 tripwire, no browser/real provider. Hub typecheck and npm run test:lint passed (0 refusals; closed-item wording 0 findings; existing report-only findings remain). Full source review requested from reviewer role; no full verification yet. No per-item QA required by current policy.

### rev-35 · 2026-11-17T02:19:39.861Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1767-source-1
commit: cf34f73a5ab4bcc338b282f9023de5f3ac13cc30
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 findings, Spec 0 findings. A-20542 records the complete three-file review against base e76c3841d, source tree 68cb3ac720e6b465371515e5517f85b6534612b5. Transport selection preserves both existing defaults; the changed HTTP cases retain real loopback HTTP and all assertions while scripted machine ownership excludes native boot hooks and process census. Listener shutdown and admitted-handler drainage precede root removal. Read A-20536's 24 positive test finishes and A-20537/A-20541's two positive baseline tripwire findings, original native exit 0 excerpts and patch-to-commit limitations. Both C1/C2 remain unverified test criteria pending configured same-head post-source-verdict evidence; this is not a full verification pass. No source changes or new runtime runs were made by Reviewer.

### rev-35 · 2026-11-17T02:46:23.748Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1767-final-1
commit: cf34f73a5ab4bcc338b282f9023de5f3ac13cc30
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-20567. Uncached configured da1306c6/A-20564 matches source-clear cf34f73a5 and clean source tree. Independently parsed 6540 ordinary test/707 file positives, separate230 load positives,0fail/cancel/skip; T0/all224T1/all428fallbackT2/55Web completed. All24 pacing identities pass, including HTTP/scripted retry cases at14321/14325 and missing-header14353, file14411. Zero pacing tier-mismatch findings; instrumentation is positive with64report-only findings in25otherpaths, and A-20537/A-20541 retain the original two positive pacing controls. C1/C2 verified. All269T3/17T4 unexecuted/deferred; no process-compatibility/full-tier/latency claim. Provenance37602 pins normalized verification tree bd73fbb10324d6f2a611da7a13097b7b42895d55,Linuxx64/Node24.21/Nvim0.12.5; actual isolated HeadlessShell1248/CfT156.0.8078.4 at35043. Timing/lint/ratchet/skip checker advisories and older provenance gaps retained. No Reviewer runtime or source changes.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T04:28:40.446Z

Merged f496cec9e1ddc2a88bbc3caf23a665c1f2589c79 onto dev.
