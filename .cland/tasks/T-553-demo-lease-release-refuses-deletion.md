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
updated: 2026-10-16T01:06:27.845Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, D18, evidence A-3498). After `cland demo stop E-423`, lease 24539655 (droplet cland-v0-24539655, id 609529297) stayed in `releasing`. At 00:32:10.811Z hub.log recorded executor-release-unconfirmed, cause "droplet identity differs from its lease; refusing deletion". At 00:36Z `cland executor status` showed the lease releasing with its watchdog alive (deadline 01:13:36Z) and five tagged droplets against six leases. A demo lease that can't be released breaks the guarantee that every cland droplet is destroyed. If the identity check is right to refuse, the lease must still settle.

## Acceptance criteria
- [x] C1. The cause of the identity mismatch for demo leases is found and recorded: which identity field differs between the lease record and the provider's droplet, and why demo leases differ from verify leases.
  - done: impl-553 · 2026-10-16T01:06:25.229Z
- [x] C2. A demo lease's release deletes its own droplet, and a demo stop ends with the lease released and no tagged droplet left. A genuine identity mismatch still refuses deletion, but marks the lease for operator attention and alerts, rather than staying `releasing` silently.
  - done: impl-553 · 2026-10-16T01:06:26.457Z
- [x] C3. A test covers demo start, then stop, then release against the fake provider, including the mismatch case.
  - done: impl-553 · 2026-10-16T01:06:27.845Z

## Comments

### coord · 2026-10-16T00:37:47.213Z

Stand-in check at 00:40Z: droplet 609529297 returns 404 from DigitalOcean, so it's already destroyed and not billing. The provider lists exactly the five task-verify droplets. Likely cause: release confirms by re-reading the droplet, and the 404 after a successful delete is read as "identity differs". The same deadline/identity pairs appear in the journal at 23:49Z and 00:18Z. So the risk is a stuck lease record, not a live droplet. C1 should check the 404-after-delete path first.

### impl-553 · 2026-10-16T00:40:08.966Z

Task/epic/spec read, claim confirmed as impl-553. C3 specifies the existing demo start/stop fake-provider seam; using that for diagnosis and regression. 404 is explicitly swallowed in cleanup.ts, so first checking observed provider/lease identity against the alleged 404-after-delete cause.

### impl-553 · 2026-10-16T00:56:35.424Z

C1 diagnosis (A-3501/A-3510): 404-after-delete retry passes already. Fake archive+stripped-tags response reproduces an additional false release: tagged listing loses the resource before GET-by-id returns 404. A later by-id archive response also takes the generic mismatch path. Historical response fields were not retained (Coordinator decision 0d69dd33), so exact historic changed field is unknowable. Verify and demo leases share acquisition/release and both have the generic refusal in the hub log; this is deletion polling, not a demo-specific lease identity. Fix keeps archived-after-accepted-DELETE pending until by-id absence, logs precise name/tags expected/observed and provider status on real mismatches, persists operator attention and alerts Coordinator. Detached watchdog preserves its accepted-delete boundary between attempts.
