---
id: T-553
kind: task
title: "Demo lease release refuses deletion: droplet identity differs from its lease"
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-459
topic: topic-349
branch: t/T-553-demo-lease-release-refuses-deletion
created: 2026-10-16T00:37:02.839Z
updated: 2026-10-16T04:09:21.403Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, D18, evidence A-3498). After `cland demo stop E-423`, lease 24539655 (droplet cland-v0-24539655, id 609529297) stayed in `releasing`. At 00:32:10.811Z hub.log recorded executor-release-unconfirmed, cause "droplet identity differs from its lease; refusing deletion". At 00:36Z `cland executor status` showed the lease releasing with its watchdog alive (deadline 01:13:36Z) and five tagged droplets against six leases. A demo lease that can't be released breaks the guarantee that every cland droplet is destroyed. If the identity check is right to refuse, the lease must still settle.

## Acceptance criteria
- [x] C1. The cause of the identity mismatch for demo leases is found and recorded: which identity field differs between the lease record and the provider's droplet, and why demo leases differ from verify leases.
  - done: impl-553 · 2026-10-16T01:06:25.229Z
  - verified: rev-31 [reviewer] · run rev-20261016-553-source · 2026-10-16T01:09:57.096Z · commit f631b72207b32cdf7ca7056c21fc6c95f63f7835
  - verified: rev-31 [reviewer] · run rev-20261016-553-delta-1 · 2026-10-16T01:20:29.054Z · commit ae82e2636cc90c01d028173893ce48805b18096c
  - verified: rev-31 [reviewer] · run rev-20261016-553-delta-2 · 2026-10-16T02:30:35.826Z · commit 270e35c3cd2cc3d5ea9e4b2fbdd75f151bd0a427
- [x] C2. A demo lease's release deletes its own droplet, and a demo stop ends with the lease released and no tagged droplet left. A genuine identity mismatch still refuses deletion, but marks the lease for operator attention and alerts, rather than staying `releasing` silently.
  - done: impl-553 · 2026-10-16T01:06:26.457Z
  - verified: rev-31 [reviewer] · run rev-20261016-553-final · 2026-10-16T04:06:10.412Z · commit 270e35c3cd2cc3d5ea9e4b2fbdd75f151bd0a427
- [x] C3. A test covers demo start, then stop, then release against the fake provider, including the mismatch case.
  - done: impl-553 · 2026-10-16T01:06:27.845Z
  - verified: rev-31 [reviewer] · run rev-20261016-553-source · 2026-10-16T01:09:57.096Z · commit f631b72207b32cdf7ca7056c21fc6c95f63f7835
  - verified: rev-31 [reviewer] · run rev-20261016-553-delta-1 · 2026-10-16T01:20:29.054Z · commit ae82e2636cc90c01d028173893ce48805b18096c
  - verified: rev-31 [reviewer] · run rev-20261016-553-delta-2 · 2026-10-16T02:30:35.826Z · commit 270e35c3cd2cc3d5ea9e4b2fbdd75f151bd0a427

## Comments

### coord · 2026-10-16T00:37:47.213Z

Stand-in check at 00:40Z: droplet 609529297 returns 404 from DigitalOcean, so it's already destroyed and not billing. The provider lists exactly the five task-verify droplets. Likely cause: release confirms by re-reading the droplet, and the 404 after a successful delete is read as "identity differs". The same deadline/identity pairs appear in the journal at 23:49Z and 00:18Z. So the risk is a stuck lease record, not a live droplet. C1 should check the 404-after-delete path first.

### impl-553 · 2026-10-16T00:40:08.966Z

Task/epic/spec read, claim confirmed as impl-553. C3 specifies the existing demo start/stop fake-provider seam; using that for diagnosis and regression. 404 is explicitly swallowed in cleanup.ts, so first checking observed provider/lease identity against the alleged 404-after-delete cause.

### impl-553 · 2026-10-16T00:56:35.424Z

C1 diagnosis (A-3501/A-3510): 404-after-delete retry passes already. Fake archive+stripped-tags response reproduces an additional false release: tagged listing loses the resource before GET-by-id returns 404. A later by-id archive response also takes the generic mismatch path. Historical response fields were not retained (Coordinator decision 0d69dd33), so exact historic changed field is unknowable. Verify and demo leases share acquisition/release and both have the generic refusal in the hub log; this is deletion polling, not a demo-specific lease identity. Fix keeps archived-after-accepted-DELETE pending until by-id absence, logs precise name/tags expected/observed and provider status on real mismatches, persists operator attention and alerts Coordinator. Detached watchdog preserves its accepted-delete boundary between attempts.

### rev-31 · 2026-10-16T01:09:57.096Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-553-source
commit: f631b72207b32cdf7ca7056c21fc6c95f63f7835
scope: full

Source clear at f631b72207b32cdf7ca7056c21fc6c95f63f7835, compared with merged dev ca09b03c056fcc77015b698bc95f9bee9655df13.

Standards: no high/medium findings; machine shard entry present, new case timings within budgets, diff check clean. Spec: no high/medium findings. Accepted-delete archive handling polls the same resource ID until absence without granting new DELETE authority; genuine mismatches retain the resource, persist precise expected/observed identity attention, survive orphan reaping, and produce one per-lease Coordinator-role alert. Watchdog retains accepted-delete progress across error/retry attempts. Normal cleanup and spend guards remain.

C1 verified with Coordinator 0d69dd33's explicit historical-evidence limitation: exact incident field is unrecoverable; diagnosis records shared demo/verify lifecycle, already-working 404 handling, reproduced archived/tag-stripped deletion failure and new precise diagnostics. C3 verified from demo start/stop/status fake-provider tests and A-3527 3/3, A-3528 7/7, A-3530 13/13 supporting receipts. C2 remains pending same-head post-source verification. No per-item QA criteria.

Full source analysis: A-3534, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3534-t-553-source-clear-deletion-polling-and-identity-attention.md. No edits, suite or live-provider calls by Reviewer.

Criteria: C1 verified, C3 verified.

### rev-31 · 2026-10-16T01:20:29.054Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-553-delta-1
commit: ae82e2636cc90c01d028173893ce48805b18096c
scope: delta

Delta source clear: f631b722..ae82e263 changes only hub/test/durations.json, exactly matching Coordinator-posted 2149fe33 (A-3493 / integrated a06020a3), without task allowances. Diff check passes. Standards: no findings. Spec: no findings. Original implementation/test inputs unchanged; A-3534 full source analysis and targeted23/23 supporting evidence remain applicable. C1/C3 reverified, including C1's explicitly accepted historical-evidence limitation; C2 remains pending same-head gate. Obsolete run0473500f exit143/cancelled/A-3547 supplies no passing gate evidence. Preserve Coordinator T-556 hold before any selected suite-runner run. No Reviewer edits/tests.
Artifact A-3552: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3552-t-553-manifest-delta-source-clear-at-ae82e263.md.

Criteria: C1 verified, C3 verified.

### rev-31 · 2026-10-16T02:30:35.826Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-553-delta-2
commit: 270e35c3cd2cc3d5ea9e4b2fbdd75f151bd0a427
scope: delta

Delta source clear: ae82e263..270e35c3 changes only suite-runner.test.ts+4/-2, exact posted576404e8 file. Stable label/runtime timestamp change retains assertions/bounds/cleanup. Standards/Spec: no findings. No T-553 implementation/own-test changes, preserving A-3534/A-3552 analysis and targeted23/23 support. C1/C3 reverified; C2 pending final same-head gate. T-556 Mac52/52/exact5/5 proof has explicit batch Linux deferral(A-3593); no green task Linux gate claimed. Shared2149fe33 manifest retained, diff check clear; no Reviewer edits/tests.
Coordinatore2e3dc70 restart hold remains before new verification, then explicit droplet/fresh once. Artifact A-3597: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3597-t-553-shared-stable-name-delta-source-clear-at-270e35c3.md.

Criteria: C1 verified, C3 verified.

### rev-31 · 2026-10-16T04:06:10.412Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-553-final
commit: 270e35c3cd2cc3d5ea9e4b2fbdd75f151bd0a427
scope: evidence

Finalclear atunchanged270e35c3. SameheadLinux9cc3b07b/A-3679 exit0,1863pass/0fail/4platformskip,hubfree38/38,machine1813pass+4skip,Neovimsmoke12/12.4workers,c-8lon1,Node24.21.0,Neovim0.12.5; no failingloadgate/newhardbudget.
C2verified:acceptedDELETEretry3.423s,archivetagstripabsence2.853s,genuineidentityrefusal/attention/alert/reaperpreservation3.240s;each5/5load. Hubgonewatchdogmodifiedcasesalsopass. Reviewed assertions preserve oneDELETEwhilepending,noDELETEforgenuinemismatch,durable/statusattention,onceCoordinatoralert,clearattentionafterrecovery. PriorMac23/23supports. C1/C3current fromsource/deltaA-3597;C1historicalfieldlimitationaccepted0d69dd33remains,no recoveredfieldclaim. All3criteria verified,nohigh/mediumfindings,no peritemQA or Reviewer edits/tests.
ArtifactA-3680: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3680-t-553-final-clear-at-270e35c3-linux-release-gate.md.

Criteria: C2 verified.
