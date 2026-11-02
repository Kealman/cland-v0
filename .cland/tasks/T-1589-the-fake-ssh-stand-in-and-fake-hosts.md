---
id: T-1589
kind: task
title: The fake ssh stand-in and fake hosts
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1327
branch: t/T-1589-the-fake-ssh-stand-in-and-fake-hosts
created: 2026-11-02T03:33:52.717Z
updated: 2026-11-02T09:32:25.946Z
closed: 2026-11-02T09:32:25.946Z
---

## Summary

A test-only Node stand-in for `ssh` and `scp`, selected by `CLAND_SSH_BIN` and `CLAND_SCP_BIN`, serves fake hosts that are directories on the same machine, each with its own `HOME`, run directory, boot-id file and host key. It honours the subset the carrier uses (a `ControlMaster` with `-N` and Unix-socket `-R`/`-L` forwards, `-O check|exit|forward|cancel` on the control path, a one-shot command with stdin, `-t`, and `scp` to the host) and refuses what the spec forbids.

Hot files: `hub/test/fakes/fake-ssh.ts` (new), `hub/test/fakes/fake-scp.ts` (new), `hub/test/fakes/fake-host.ts` (new: create, kill-master, gone), `hub/test/fake-ssh.test.ts` (new)

## Acceptance criteria

- [x] C1. A master started with the spec's options holds its `-R` and `-L` Unix forwards until it exits, and its exit (including SIGKILL) closes every forward and leaves its control socket file behind, as a real master does (test).
  - done: impl-1589 · 2026-11-02T06:38:57.103Z
  - verified: rev-36 [reviewer] · run rev-36-1589-final-1 · 2026-11-02T07:08:16.407Z · commit 92a86331ba39639b5a34d5822c2ceda9082e6268
- [x] C2. The stand-in refuses a connection without `StrictHostKeyChecking=yes` and a `UserKnownHostsFile` holding the fake host's pinned key, and refuses `ExitOnForwardFailure=yes` forwards it cannot bind (test).
  - done: impl-1589 · 2026-11-02T05:52:00.692Z
  - verified: rev-36 [reviewer] · run rev-36-1589-final-1 · 2026-11-02T07:08:16.407Z · commit 92a86331ba39639b5a34d5822c2ceda9082e6268
- [x] C3. It refuses any TCP listen forward (`-L` or `-R` with a port on the listening side), while a Unix-socket listener forwarding to a host loopback port is allowed (test).
  - done: impl-1589 · 2026-11-02T05:52:03.936Z
  - verified: rev-36 [reviewer] · run rev-36-1589-final-1 · 2026-11-02T07:08:16.407Z · commit 92a86331ba39639b5a34d5822c2ceda9082e6268
- [x] C4. `-O forward` and `-O cancel` add and remove a forward on a live master, and `-O exit` ends it (test).
  - done: impl-1589 · 2026-11-02T06:08:38.321Z
  - verified: rev-36 [reviewer] · run rev-36-1589-final-1 · 2026-11-02T07:08:16.407Z · commit 92a86331ba39639b5a34d5822c2ceda9082e6268
- [x] C5. A one-shot command runs as a process of the fake host, with that host's `HOME`, reading the given stdin. `scp` writes the file into the fake host's tree (test).
  - done: impl-1589 · 2026-11-02T05:52:10.352Z
  - verified: rev-36 [reviewer] · run rev-36-1589-final-1 · 2026-11-02T07:08:16.407Z · commit 92a86331ba39639b5a34d5822c2ceda9082e6268
- [x] C6. `fake-host.ts kill-master <host>` SIGKILLs that host's live master and `gone <host>` makes later connections fail as an unreachable host would; nothing in the stand-in opens a network socket (test).
  - done: impl-1589 · 2026-11-02T06:01:34.849Z
  - verified: rev-36 [reviewer] · run rev-36-1589-final-1 · 2026-11-02T07:08:16.407Z · commit 92a86331ba39639b5a34d5822c2ceda9082e6268

## Notes

Shared files: the fake-host control script (created here; 08 adds kill-agent, 27 adds reboot)

## Comments

### impl-1589 · 2026-11-02T05:44:15.928Z

Rule 20 inventory: new sshBinaries(env) in hub/src/host/ssh-binaries.ts returns {ssh, scp}; overrides only with nonempty CLAND_FAKE_HOSTS. New consumers: T-1595 real SSH carrier and T-1625 contract fixture (Coordinator notified); no existing selector/importers found (rg transport/CLAND_SSH_BIN/CLAND_SCP_BIN). Fake layout: CLAND_FAKE_HOSTS absolute directory, <id>/{home,boot-id,host-key.pub,client-key}; run at home/.cland-host/run. No wire/storage contract changed. Fake subprocess CLI is the agreed test seam. Loopback destination ports resolve through explicit fake host Unix-socket mappings; stand-ins never create TCP sockets.

### impl-1589 · 2026-11-02T05:46:11.460Z

Correction to earlier rule-20 layout note per Coordinator: CLAND_FAKE_HOSTS is comma-separated names; CLAND_FAKE_HOST_ROOT is absolute root. sshBinaries(env) honors overrides only with BOTH set. createFakeHost(root,name) returns directory/home/run/knownHosts/bootId/key. Stand-ins authenticate pinned key and listed name before operations. kill-master contacts the live Unix control endpoint to self-SIGKILL rather than trusting stored PIDs.

### impl-1589 · 2026-11-02T05:50:09.655Z

Expanded consumer inventory: existing executor/droplet/machine.ts directly honors CLAND_SSH_BIN/SCP_BIN; executor-contract.test.ts, executor-droplet.test.ts, executor-prepare.test.ts, remote-fixture.ts, fake digitalocean scripts, docs/executor-argv-audit.md consume that executor-specific seam. This predates the new Host carrier. Asked Coordinator whether its gate directive includes migrating executor behavior; holding that change pending decision.

### impl-1589 · 2026-11-02T05:50:42.501Z

Coordinator decision 7c473a2c: gate applies ONLY to new Host selector/carrier. Existing executor/droplet/machine.ts intentionally remains ungated for executor fixtures, with no executor consumer changed here. T-1626 owns its migration. README, skill and per-file guide explicitly distinguish the two.

### rev-35 · 2026-11-02T05:58:01.598Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1589-source-1
commit: 5942fece061d4d1aeb0e39d57c9035546e43bdff
scope: full
findings: [{"severity":"medium","text":"kill-master treats serialized master-control as authority without verifying the endpoint's host/boot identity. With two live fake hosts, copying B's control path into A's record makes kill-master A SIGKILL B. fake-ssh.ts also publishes this record before bind succeeds (75–76), so a failed launch can replace the live owner's record. Bind requests to the named live owner, publish only after readiness, and add fresh-owner plus copied/stale-record refusal controls.","file":"hub/test/fakes/fake-host.ts","line":51},{"severity":"medium","text":"The one-shot and SCP tests spawn children without a registered lifetime owner or cancellation cleanup and await unbounded close promises (22,40). A test timeout does not terminate those subprocesses; they can retain fixture writers/handles after cancellation. Register cleanup immediately on launch, stop/join the owned process tree with a bound before root removal, and exercise a held-command cancellation path.","file":"hub/test/fake-ssh.test.ts","line":18},{"severity":"low","text":"openStream asserts the full 'still live' value on the first data event. Unix sockets carry a byte stream and may split a write; accumulate until the expected byte length before the final equality assertion so valid partial chunks do not fail the control.","file":"hub/test/fake-ssh.test.ts","line":108}]
finding_counts: {"high":0,"medium":2,"low":1}

Not clear. Medium: fake-host.ts:51–52 accepts a copied/stale master-control path as termination authority; Control has no live host/boot identity check, and fake-ssh.ts:75 publishes that record before successful bind. Medium: fake-ssh.test.ts:18/38 one-shot/SCP children have no cancellation cleanup owner and unbounded close waits, allowing subprocesses to survive test timeout. Low: openStream:108 assumes one socket data event contains the entire write. Detailed standards/spec review and concrete two-host counterexample in A-15603 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15603-t-1589-source-review-at-5942fece0.md). C6 failed, C1–C5 unverified. Reverse-path unlink is allowed by explicit StreamLocalBindUnlink image policy, not a finding. Host-only binary gate matches Coordinator decision; executor excluded under T-1626. Reviewer ran no tests/browser; local reported six T3 passes/typecheck/lint are not queued verification. Fresh source review required after fixes and before verification.

Criteria: C6 failed (kill-master follows an unverified stored control path and can terminate a different fake host's live master.).

### impl-1589 · 2026-11-02T06:01:02.855Z

Review A-15603 remediation: regression first reproduced copied-control kill (assert.notEqual actual 0). Internal fake-only Control consumers are fake-ssh.ts (CLI sender and server) and fake-host.ts (kill sender), via fake-ssh-common.ts. All now share HostOwner canonical directory+boot; kill adds random master token. master-control changed from raw path to atomically published JSON after bind/mode; no production wire/persisted hub reader consumes it, external consumers use fake CLI. Failed-bind, copied record, stale same-host record and fresh kill tests pass. All subprocess tests now share native ownership registration, abort cleanup, separately bounded process-tree/close joins and preserved roots on incomplete cleanup; held writer cancellation passes. Chunk assertion now accumulates stream data. Eight targeted cases pass macOS local Node24; checks rerunning before new head/review.

### rev-36 · 2026-11-02T06:06:05.417Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1589-source-1
commit: bac9910eb239ae99b13f3b3b22a3f4575c34dd3f
scope: full
findings: [{"severity":"medium","text":"done starts a five-second native-close deadline at every launch, including masters intentionally kept live while readiness, forwarding and multiple controls run. It can reject (unhandled until master.done is later awaited) before exit is requested, making valid slow/load runs fail. Keep the native receipt armed at launch, but start the close/join bound only when exit/cancellation is triggered or awaiting shutdown; bound command/setup phases separately.","file":"hub/test/fake-ssh.test.ts","line":87}]
finding_counts: {"high":0,"medium":1,"low":0}

Fresh source not clear: medium fake-ssh.test.ts:87 starts five-second close timer at launch even for intentionally long-lived masters. Valid readiness/control/relay work can outlast it before exit request; done can reject unhandled until later awaited. Arm raw close receipt immediately but start bounded termination join at exit/cancel/cleanup; separate setup/one-shot end-to-end bounds (rule9). All three A-15603 findings otherwise resolved: live host/boot/token fence and post-bind atomic publication, shared native ownership/abort/retained-root cleanup, accumulated chunks. Selector/layout decisions retained. A-15615 eight local macOSarm64 Node24 cases/static summaries preliminary;no Reviewer execution. Fresh source review before verify.

Criteria: C1 failed (Native-close deadline starts at master launch and may fail before the test requests exit despite valid live forwards.), C4 failed (Dynamic forward/cancel/ownership steps consume the master launch-time close budget, producing invalid failures or unhandled rejection before exit.).

### impl-1589 · 2026-11-02T06:08:29.000Z

rev-36 finding reproduced with regression: child close incomplete: exit null; signal null; tail [empty], before shutdown requested. launch now arms nativeClose only, with no deadline. join() creates the close bound when called after exit/cancel; command/setup invoke their own join immediately and stop() bounds cleanup at request. Nine targeted T3 cases pass locally on macOS Node24, including master remains usable beyond the former launch close deadline (fixture durable completion receipt after 5.5s, then check/exit/native close). Prior ownership and held-writer regressions retained; docs updated. Fresh checks/source review next.

### rev-36 · 2026-11-02T06:15:22.352Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1589-source-2
commit: 2044f54e34e90cd3c2d05de5bca7a5dd9d87e468
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at the exact head. Lazy join starts the native-close bound at the awaiting phase, resolving the premature master lifetime deadline; the durable-completion regression and guide match. Prior ownership and cancellation fixes remain preserved. No findings. C1–C6 remain run-dependent and unverified until same-head verification evidence; reviewer ran no tests.

### rev-36 · 2026-11-02T06:37:10.569Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1589-evidence-1
commit: 2044f54e34e90cd3c2d05de5bca7a5dd9d87e468
scope: evidence
findings: [{"severity":"medium","text":"The deliberate >5s lifetime regression has no matching exact-case duration allowance, so queued T3 rejects it despite all nine assertions passing: 'master remains usable beyond the former launch close deadline 6.023 s > 5 s'. Run 185d5df3 exits1 and Web never executes. Resolve the approved duration allowance, source-review the changed head and rerun before final clearance.","file":"hub/test/fake-ssh.test.ts","line":225}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear. A-15663 run185d5df3 failed: exact diagnostic 'duration budget: hub/test/fake-ssh.test.ts::master remains usable beyond the former launch close deadline 6.023 s > 5 s'. Nine named assertions pass, but T3/overall exit1; cannot count as final pass. T0/T1/fallback T2 complete, Web unexecuted/browsernull, remaining T3/T4 unexecuted. Linux x64 droplet Node24.21.0/Neovim0.12.5, uncached exact head. Aggregate budget/lint/ratchet advisories remain report-only; this exact-case limit is enforcing. C1 failed; C2–C6 unverified. Lead to resolve allowance, fresh source review of changed head before rerun. No Reviewer execution.

Criteria: C1 failed (Required long-lived-master regression exceeds enforced exact-case duration limit (6.023s >5s); T3/overall exit1, Web unexecuted.).

### rev-36 · 2026-11-02T06:41:16.325Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1589-source-3
commit: 92a86331ba39639b5a34d5822c2ceda9082e6268
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Coordinator's no-allowance path uses shared Clock timer scheduling only for the regression master's close deadline; actual control liveness, positive timeout rejection and native exit assertions remain. Setup/cleanup/Date/subprocess I/O stay real. Prior ownership/cancellation fixes preserved; guide matches. A-15672 local9 passes/mutation/static summaries supplemental. C1–C6 remain run-dependent and unverified until a new exact-head mode-free run. Prior A-15663 remains failed. No Reviewer tests/browser.

### rev-36 · 2026-11-02T07:08:16.407Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1589-final-1
commit: 92a86331ba39639b5a34d5822c2ceda9082e6268
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged source-reviewed head. A-15694 runfe31cab0 independently streamed: uncached exit0,4708/4708, all nine fake-ssh generated outcomes pass. C1–C6 verified, no findings. Former duration-failing case now0.480s with enforcing per-case check passing and no allowance; old A-15663 remains failed. Linux x64 droplet c-8 lon1 Node24.21.0/Neovim0.12.5; isolated Chrome Headless Shell1248 Chrome for Testing156.0.8078.4. T0/T1/fallback all T2/changed T3/Web complete; remaining T3 merge batch, T4/repetitions unexecuted. Aggregate budgets/lint/ratchet/skip checks report-only, missing0. No Reviewer execution; task coverage only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1589 · 2026-11-02T07:08:41.788Z

Ready at 92a86331ba39639b5a34d5822c2ceda9082e6268 after clear source rev-36-1589-source-3 and final evidence rev-36-1589-final-1 (A-15695), C1–C6 verified. Run fe31cab0/A-15694 exit0, reported4708/4708; T0/T1/fallback all T2/changed T3/Web completed on Linux x64 droplet c-8 lon1 Node24.21.0/Neovim0.12.5, Chrome Headless Shell1248 Google Chrome for Testing156.0.8078.4. All9 fake-ssh pass receipts matched, formerly slow case0.480s, enforcing duration check passed without allowance. Remaining T3/T4/repetitions unexecuted; budget and skip-reason diagnostics report mode retained. Lifetime917s cost$0.0637. Prior A-15663 remains failed. Fresh origin/dev fetch succeeded after result; git merge-tree --write-tree HEAD origin/dev exit0, candidate tree760c24d07b7e6168cfb7c611864138d0b6ec205a. Worktree clean, reviewed head unchanged; no dev merge performed after first review. Claim retained for supervising merge gate.

### coord · 2026-11-02T09:32:25.946Z

Merged d92844ff63796f0bd0f7efb984a3113df421d6dc onto dev.
