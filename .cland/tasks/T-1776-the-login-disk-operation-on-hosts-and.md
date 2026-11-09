---
id: T-1776
kind: task
title: The login-disk operation on hosts and the `cland-auth` helper
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
topic: topic-1456
branch: t/T-1776-the-login-disk-operation-on-hosts-and
created: 2026-11-09T12:44:09.085Z
updated: 2026-11-09T17:49:42.254Z
closed: 2026-11-09T17:49:42.254Z
---

## Summary

The host agent gains one operation, `login-disk` (mount, unmount, freeze or thaw). It runs the `cland-auth` helper through `sudo -n` with a volume name and a `/cland/auth/<harness>-<login>` path only, so the agent itself stays unprivileged. The helper unmounts any other mount of the device before mounting and ends every process using the disk before unmounting. On a fake host, a fake helper with the same argument rules maps the path onto the attached fake volume's contents.

## What to build

The path from the hub to a mounted login disk, on both kinds of host:
- **Agent side.** The agent checks the helper's own argument patterns before running anything, refuses otherwise, and replies with typed codes: `bad-argument`, `busy`, `writers-remain` and `wrong-volume`.
- **Host interface.** `loginDisk({ op, volume, path })` on the ssh Host; the local Host refuses it.
- **Helper.** On mount, the helper lists the device's other mount points and unmounts each before mounting at the target, which covers DigitalOcean's `/mnt/<name>` automount. Its existing writer drain runs before every unmount.
- **Fake helper.** Only under the fake-host marker, the fake helper maps `/cland/auth/<x>` to the same path under the fake host's directory. It links that path to the volume's contents through T-1772's seam, and only while the volume is attached to this machine. On unmount it ends the fake host's processes whose working directory or open files lie on the disk, then unlinks.

## Acceptance criteria

- [x] C1. The agent refuses a `login-disk` request whose path lies outside `/cland/auth/` or contains a symlink or `..`, or whose volume name breaks the helper's pattern, without running sudo or the helper (test).
  - done: impl-1776 · 2026-11-09T14:55:41.481Z
  - verified: rev-35 [reviewer] · run rev-35-1776-final-1 · 2026-11-09T17:12:51.325Z · commit f76bdc9bbf86f24011dc98cc4a68d12642c92cf2
- [x] C2. On a fake host, mount makes the attached volume's contents readable and writable at the mapped path, and is refused for a volume attached to another machine or detached (test).
  - done: impl-1776 · 2026-11-09T14:55:41.677Z
  - verified: rev-35 [reviewer] · run rev-35-1776-final-1 · 2026-11-09T17:12:51.325Z · commit f76bdc9bbf86f24011dc98cc4a68d12642c92cf2
- [x] C3. On a fake host, unmount ends a background process holding a file on the disk before it unlinks, and ends no process outside that disk (test).
  - done: impl-1776 · 2026-11-09T16:47:21.151Z
  - verified: rev-35 [reviewer] · run rev-35-1776-final-1 · 2026-11-09T17:12:51.325Z · commit f76bdc9bbf86f24011dc98cc4a68d12642c92cf2
- [x] C4. In the stub fixture, the helper unmounts another mount of the same device before mounting at the target (test).
  - done: impl-1776 · 2026-11-09T14:55:42.194Z
  - verified: rev-35 [reviewer] · run rev-35-1776-final-1 · 2026-11-09T17:12:51.325Z · commit f76bdc9bbf86f24011dc98cc4a68d12642c92cf2
- [x] C5. The ssh Host's `loginDisk` runs `sudo -n /usr/local/sbin/cland-auth <op> <volume> <path>` with exactly those arguments, and the local Host refuses `loginDisk` (test).
  - done: impl-1776 · 2026-11-09T14:55:42.519Z
  - verified: rev-35 [reviewer] · run rev-35-1776-final-1 · 2026-11-09T17:12:51.325Z · commit f76bdc9bbf86f24011dc98cc4a68d12642c92cf2
- [x] C6. The existing `cland-auth.test.ts` and `host-prelude.test.ts` cases pass with no case edited.
  - done: impl-1776 · 2026-11-09T14:55:42.726Z
  - verified: rev-35 [reviewer] · run rev-35-1776-final-1 · 2026-11-09T17:12:51.325Z · commit f76bdc9bbf86f24011dc98cc4a68d12642c92cf2

## Blocked by

- T-1772

## Notes

- Hot files: `hub/src/host/agent/server.ts` (the operation), `hub/src/host/agent/login-disk.ts` (new), `hub/src/host/cland-auth.sh`, `hub/src/host/host.ts`, `hub/src/host/ssh-host.ts`, `hub/src/host/local.ts`, `docs/agents/host-agent.md` (a new section).
- Tests: `hub/test/cland-auth.test.ts` (T3 stub fixture, new cases only); new `hub/test/host-login-disk.test.ts` (T3, a fake host's agent and the fake provider).
- Serves epic C2 and the Contents bullet on the helper.

## Comments

### impl-1776 · 2026-11-09T14:45:03.122Z

Rule 20 sweep before changes: shared suite importingTests graph across every tiers.json test finds 635 reached and 16 unknown (all counted reached); complete lists in topic artifacts. Explicit contract-name search covers production, tests all tiers, shared wire, Neovim/web, skills, docs and QA. Host interface gains optional loginDisk for older/test Hosts; local explicitly refuses, SSH sends additive login-disk request, old agent unknown-operation remains refusal. Existing AgentReply and frames unchanged; no Neovim catalog migration required. Helper consumers: provider prelude plus cland-auth/host-prelude tests; existing cases preserved. New fake helper uses existing provider persisted records via volumeContents; no record shape change.

### rev-35 · 2026-11-09T15:04:36.510Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1776-source-1
commit: 3e8420e4e586a795b740412a0dba17a1c51de884
scope: full
findings: [{"severity":"high","text":"Retained live descendants are skipped when the root is reported alive:false. AgentProcesses preserves owned targets after root exit, so an orphan holding the disk can survive a successful unlink. Include retained target authority and require positive disk-user closure.","file":"hub/src/host/agent/fake-login-disk.ts","line":32},{"severity":"high","text":"One disk-using member causes whole-tree processes.stop, killing an outside-disk parent or sibling. C3 forbids this collateral termination; stop only disk users with independently captured native authority and keep unrelated members alive.","file":"hub/src/host/agent/fake-login-disk.ts","line":38},{"severity":"high","text":"The one-shot drain census is not coordinated with writer admission through unlink. A second authenticated connection can admit a disk writer after the census and survive successful umount. A shared admission/drain/unlink owner must close this boundary; a final census alone leaves the race.","file":"hub/src/host/agent/fake-login-disk.ts","line":77},{"severity":"high","text":"run.error including native cleanup incomplete is downgraded to known writers-remain and busy clears without a native close receipt. SSH permits subsequent mutations for that typed code. Preserve incomplete-native classification and retain an operation fence until positive settlement.","file":"hub/src/host/agent/login-disk.ts","line":31},{"severity":"medium","text":"The new optional Host.loginDisk has no reusable contract coverage. The unchanged exhaustive/planted Host-member guard in host-contract-coverage.test.ts necessarily reports loginDisk missing. Migrate the reusable optional/refusal contract while retaining both guards.","file":"hub/test/host-contract.ts","line":20},{"severity":"medium","text":"Servers are acquired before a cleanup owner, clients connect before try, and the first test's cleanup stops on its first rejection. Setup failure can strand a server; a failed child join skips later children/Host/server. Prearm ownership at acquisition and attempt all ordered joins.","file":"hub/test/host-login-disk.test.ts","line":76}]
finding_counts: {"high":4,"medium":2,"low":0}

Complete source pass: Standards3/Spec3, all confirmed by author. A-18121 records exact source paths, native-incomplete fencing, reusable Host contract and ordered fixture cleanup corrections, plus qualified A-18120 original transcript evidence and 651-path selection. No tests/API/native work by reviewer. No exact-head verification yet; runtime criteria remain unverified. Fix then request fresh committed-head source review before native preservation or configured verification. Hold released by verdict.

Criteria: C3 failed (Fake drain omits retained descendants, stops outside-disk tree members, and permits writer admission across census/unlink.).

### impl-1776 · 2026-11-09T15:14:58.614Z

Source1 consumer migration: initial sweep A-18117/A-18118 already included reusable Host coverage, now migrated (no exhaustive/planted guard weakened). Extended graph over AgentProcesses/server/login-disk: 624 reached +16 unknown conservatively reached, A-18124; explicit ownership/error/admission consumers A-18125. New method drainDiskUsers is internal to fake-login-disk; no wire reply fields or persisted-record shapes changed. Existing run-kind PreparedOperations owns helper checkpoint/restart fences unchanged. Agent admission refusals occur while disk owns launch/drain/unlink or a native-incomplete checkpoint remains; observations/settlement/cancellation and cleanup retain routes. Prior client reply fields still unchanged. Source1 red producer A-18122 reproduces collateral parent stop, orphan survival and racing spawn. Candidate green producer A-18123 covers 9 native tests +8 T1 contract checks, plus cleanup-fence named rerun producer. Final reviewed-head native slot/Linux verify remain outstanding; no development pass is exact-head evidence.

### rev-35 · 2026-11-09T15:19:34.278Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1776-source-2
commit: 177eae883f14ca27c56a73b2a65776c3b912eb32
scope: full
findings: [{"severity":"medium","text":"drainDiskUsers skips closed rows/capture.closed without joining an in-progress native completion. Native close sets closed fields before closed.json, persistence and process-exited publication, so unmount can reply/unlink before the completion owner and the retained immediate writerClosed assertion are settled. Join relevant completions without waiting on unrelated live roots.","file":"hub/src/host/agent/processes.ts","line":381},{"severity":"medium","text":"The held prior-spawn fixture awaits setup before entering try and lacks a prearmed release-and-join owner above client close. Setup rejection can close the client, discard the spawn reply, then allow native admission without a child cleanup owner. Register cleanup from observed native afterSpawn before the setup receipt, and release/join the operation before transports close.","file":"hub/test/host-login-disk.test.ts","line":88}]
finding_counts: {"high":0,"medium":2,"low":0}

Combined source1 corrections reviewed; two confirmed remaining Standards findings, no separate new Spec finding. A-18127 records native completion-publication join and held-spawn setup ownership gaps, prior-fix assessment, original candidate producer limits and 652-path consumer union. Runtime criteria not yet verified. Fix both then fresh committed-head source review before final native slot/configured verify. Hold released.

Criteria: C3 failed (Unmount can precede completion persistence/exit publication; the immediate native completion assertion has no joined owner.).

### impl-1776 · 2026-11-09T15:26:54.293Z

Source2 corrections at f04a2577916d0597525be573a2ad495c129540ce: native disk drainage joins current-lifetime root completion persistence/publication under its existing 4s deadline before closed-row/capture.closed settlement, retains completion failure, and does not await unrelated live roots. Immediate publication assertion retained. Held-spawn fixture prearms operation release/join above client close and independent observed-native cleanup before readiness; planted setup failure loses public client reply and still proves positive native exit/order. New optional ProcessHooks beforeExitPublication/beforeCompletionJoin are deterministic lifecycle observers only, with no wire shape/authority change. Red A-18132, candidate green11/11 A-18133, final lost-reply cleanup controls2/2 A-18134, static results A-18136. Inventory union A-18135 retains652 paths:34T1/323T2/229T3/14T4/52Web, selection only. Coordinator's explicit15:20 dev merge completed with bc2d5bd6f, docs add/add resolved Store API first under one Logins heading. Exact-head native and Linux verification still await fresh clear source review.

### rev-35 · 2026-11-09T15:28:48.804Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1776-source-3
commit: f04a2577916d0597525be573a2ad495c129540ce
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18137: source2 completion-publication join and held-spawn ownership findings fixed. Authorized dev merge audited:15 task-only/54 dev-only blobs match parents; four shared paths preserve both sides, one Logins heading/Store API first. Standards0/Spec0. Clean exact head source-cleared for approved native trio + named optional Host cases and ordinary mode-free configured verify. All runtime C1–C6 remain unverified pending same-head receipts; full T3 batch/T4 stage/after-stage QA separate. No tests/API/native work by reviewer.

### rev-35 · 2026-11-09T15:40:53.520Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1776-evidence-1
commit: f04a2577916d0597525be573a2ad495c129540ce
scope: evidence
findings: [{"severity":"high","text":"New agent imports escape the existing deliverable runtime boundary (provider/fake, shared fake-host directory, Host/provider types, plus login-disk Host and processes hub/clock imports). Both required T1 boundary/closure guards fail; regenerateAgentClosure throws before producing a valid manifest. Keep canonical dependencies inside the permitted agent graph or pass data, preserve guards, and regenerate closure.json after repair.","file":"hub/src/host/agent/fake-login-disk.ts","line":3}]
finding_counts: {"high":1,"medium":0,"low":0}

A-18142: configured8931d525/A-18141 fails actual agent boundary and closure assertions; T0pass/T1fail, laterT2/T3/Web unexecuted. Task-caused, no approved boundary expansion; Coordinatorbc1f8a01 and author738446ff confirm. Preserve guards, canonical agent-local seams/data, regenerate manifest, source-only red/green then fresh delta source review before affected native and new verify. A-18138 separate green Mac native retained with loaded-only SSH attempt qualified. All runtime criteria remain unverified; no final readiness.

### coord · 2026-11-09T15:41:28.536Z

Reference correction (coord, for rev-35, who may comment only verdicts): rev-35's not-clear evidence verdict on f04a2577 names A-18142 by mistake. The review note is A-18143, and the failing verify is 8931d525 (A-18141). The failure is task-caused, in host-agent-closure and host-agent-boundary: the login-disk agent code imports outside hub/src/host/agent/. It is not a shared dev defect, and the hub's shared-defect flag is triaged.

### impl-1776 · 2026-11-09T15:41:51.880Z

Before agent closure repair: A-18141 configured red and A-18142 local red cover host-agent-boundary.test.ts + host-agent-closure.test.ts; both explicit guard files are retained in rule-20 consumers, with planted/exhaustive guards unchanged. Canonical leaf relocation plan preserves public type shapes and module reexports: shared Clock owner into agent leaf, provider Machine/Volume/Snapshot types and fake-record parser into agent leaves, shared fake-volume attachment/readiness seam used by provider and agent. Explicit path/field sweep captured in agent-leaf consumer list (includes native provider/volume tests, agent delivery/closure generator, startup probes, QA/docs/skills). No boundary allowlist expansion. Full652-path conservative inventory remains; a fresh graph will union further reached/unknown consumers.

### impl-1776 · 2026-11-09T15:47:04.133Z

Agent boundary correction: no boundary expansion and no guard edits. Canonical Clock implementation relocated byte-for-byte into agent/clock with shared/clock reexport; resource types and fake-volume record parser live in agent leaves with old module exports retained. Provider/agent share the same fakeVolumeContents/readiness/identity/list implementation; fake directory layout validation/storage location also has one leaf owner. Provider serialization, injected clock read point and ENOENT-only outcome semantics preserved. Regenerated closure.json using shipped generator. Local red at f04a2577 A-18142 (both exact packaging failures), green candidate78/78 A-18144 (both guards +Clock +fakeProvider +volumes/snapshots +fixture path), typecheck and source lints green. Extended graph union A-18145:809 paths106T1/387T2/247T3/17T4/52Web; includes both agent packaging guards, preserves original652; inventory only. Explicit consumers A-18146. Native reruns and fresh configured verify wait delta source clear; A-18138 is prior-head native evidence only.

### rev-35 · 2026-11-09T15:49:16.838Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1776-source-4
commit: e6c5d5b690cfacbd2698be471d24a44999b201a1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18147: canonical leaves remain inside agent graph; previous Clock/parser bodies and public types preserved, provider serial/clock/error semantics checked,40 closure hashes match, guards/generator unchanged. Standards0/Spec0. Source-cleared for affected approved native slot and fresh ordinary mode-free verify at this exact unchanged head. Prior failed8931d525/A-18141 and old native A-18138 retain limits.809-path inventory is selection only. Runtime C1–C6 remain unverified pending same-head evidence; T3 batch/T4/stage QA separate.

### rev-35 · 2026-11-09T15:58:51.406Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1776-evidence-2
commit: e6c5d5b690cfacbd2698be471d24a44999b201a1
scope: evidence
findings: [{"severity":"medium","text":"The neutral shared Clock and fixture-socket modules now import hub/src/host/agent/clock.ts and fake-layout.ts. That makes T2 Neovim fixture closures violate their existing no-hub dependency contract; the configured nvim-fixture-boundary assertion fails with exactly those two paths. Reconcile both agent and Neovim boundaries through the approved architecture while preserving canonical policy and guards.","file":"shared/clock.ts","line":2}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18151: A-18149 configured7a73188d fails actual T1 Neovim fixture boundary: shared facades reach agent/clock and fake-layout, expected[]. T0pass/T1fail; laterT2/T3/Web unexecuted. No approved Neovim exception (authorc52b7db4); boundary architecture escalated before repair. Preserve canonical policy and both constraints, source-only red/green then fresh delta review. A-18148 exact-head Mac native remains separate; all runtime C1–C6 unverified. No unchanged-head suite/native retry.

### impl-1776 · 2026-11-09T16:06:43.356Z

Coordinator approvals5e88ea35/e1f1b884 implemented: exactly shared/clock.ts and shared/fake-layout.ts added to agent/package.ts's canonical path/owner policy alongside credential leaf. Generator, boundary checker, package verifier and serialized INSTALL_AGENT use that owner; neutral shared leaves Node-only and no relative dependencies. Hub/Neovim import same canonical leaves; Neovim no-hub guard unchanged. New planted controls over e6 production observed red A-18152; unchanged-head actual Neovim red A-18150 (agent guards themselves were green at e6). Green A-18153:22/22,16 source guard cases+6 representative Neovim T2 client cases, zero skips, pinned v0.12.5 Mac arm64 resolver path recorded. Closure regenerated; docs updated; old guard baseline key migrated for renamed accurate title, no allowance added. Typecheck/source lints green, test lint report-mode zero refusals. Expanded conservative consumer union A-18154:811 paths108T1/387T2/247T3/17T4/52Web; inventory only. Exactpath/generator/installer consumers A-18155. Post-clear native adds approved exact 'C1-C3 version delivery reconnect reads retained table without signalling harness' to original trio+named Host cases. New mode-free verify follows fresh delta source review.

### rev-35 · 2026-11-09T16:09:35.801Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1776-source-5
commit: 7a7e768a02c6a81edceb82d4304a1b4863f67612
scope: delta
findings: [{"severity":"medium","text":"Historical0.104971 timing was moved from the credential-only guard identity to the changed owner-bound shared-leaf checker without an approved measured refresh or exact sample binding. This misattributes evidence and exempts the new T1 identity from task load-gate discovery. Remove the transplanted entry; leave the new identity unbaselined for ordinary/5x evidence.","file":"hub/test/durations.json","line":9946}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18156: approved neutral architecture/serialized installer/guards/42closure hashes checked; sole remaining finding is unapproved historical0.104971 baseline transfer to changed guard identity, which also bypasses task load discovery. Authorc953de85 confirms no measurement binding. Remove transplanted entry then fresh metadata source review before native/configured work. Candidate22green/811-path selection and old native retain qualifications. Standards1medium/Spec0; runtime C1–C6 unverified.

### rev-35 · 2026-11-09T16:10:36.082Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1776-source-6
commit: e427c8ce67c890bc52141706fbbd106c4640017d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18157: sole source5 finding fixed by exactly one baseline deletion. New guard has no baseline/allowance; no source/test/runtime/policy change. Standards0/Spec0. Proceed prescribed same-head native slot then fresh mode-free verify, including base+5 load receipts for changed guard. Source5 architecture assessment/candidate811 selection retain qualifications. Runtime C1–C6 await same-head evidence; full remaining T3 batch/T4/stage QA separate.

### rev-35 · 2026-11-09T16:31:43.586Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1776-evidence-3
commit: e427c8ce67c890bc52141706fbbd106c4640017d
scope: evidence
findings: [{"severity":"medium","text":"Required Linux held-admission unmount cases fail with writers-remain: final-unlink admission at276.609595ms and prior-writer census at254.884188ms. Both require successful joined drainage; the recorded output has no native refusing-branch detail. C3 is not established. Diagnose retained native branch/exit facts before classifying or changing behavior; preserve both assertions.","file":"hub/test/host-login-disk.test.ts","line":64}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18160: A-18159 configured933cb35c passesT0/T1/T2, fails2changedT3 login-disk cases; Web unexecuted. Actual public writers-remain output retained without guessing subcause. Authordc529236 confirms no branch receipt; targeted Linux diagnosis under Coordinator plan after this hold. Corrected dependency guard has base+5load passes. Prior Mac native is platform-specific. Runtime criteria not finally verified; no unchanged-head full retry.

Criteria: C3 failed (Both required Linux held-admission unmount cases fail with writers-remain; native refusing branch is not yet identified.).

### impl-1776 · 2026-11-09T16:47:21.016Z

Evidence3 correction / rule-20 addendum: A-18161 preserves original A-18159/A-18160 references, scratch native ordering, deterministic hook-only red status1, candidate Linux arm64 tmpfs 15/15 and macOS file12/12 with exact argv/status and runtime/test hashes. Fresh current-lifetime ChildProcess completion now retains authority across kernel exit and joins publication within the existing drain deadline; foreign/recovered refusal remains. No wire/record shape changes. Existing transitive import graph union811 (A-18154) remains reached, including unknowns; explicit repository sweep of AgentProcesses, ProcessHooks, captureForStop, capture, process-exited and rootExitObserved adds prepared.ts capture/commit callers, server.ts construction/signal/stop, process recovery/receipt readers, agent fixtures and contract/native tests across tiers, skills and QA/docs. Consumers keep the prior argument shape; optional internal completion wait propagates the drain's same deadline. Existing process-exited receipt/previous-wire guards unchanged. Agent-boundary, closure and Neovim no-hub guards/planted controls pass16/16 source-only; matching closure regenerated. Host-agent/test docs describe exact join/foreign boundary. Full other T3 and T4 retain the authorized merge/stage split.

### rev-35 · 2026-11-09T16:50:30.541Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1776-source-7
commit: f76bdc9bbf86f24011dc98cc4a68d12642c92cf2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18163: owned-close ordering diagnosed in retained native traces; fresh private completion ownership now retained/joined through publication under existing deadline, including capture window. Recovery/foreign refusal and signal birth checks unchanged. Deterministic held-close regression,42closure hashes and candidate-source binding inspected. A-18161/A-18162 candidate/derivative limits retained; no final x64 claim. Standards0/Spec0. Proceed prescribed same-head native/new mode-free verify; runtime C1–C6 await results, remainingT3 batch/T4/stage QA separate.

### impl-1776 · 2026-11-09T17:11:02.938Z

Reviewed-head verification received: run2e805ed1 / A-18165 at f76bdc9bb, tree2806530cbb53733182ce417679849feae853993d, no cache. T0/T1/allT2/changedT3/Web exit0, hub aggregate5815pass/0fail. Explicit finish receipts checked: both formerly failing held-admission cases and deterministic owned-close regression pass (base once); changed boundary/neutral-leaf/closure/planted Host guards each base+5 load repetitions pass. ChangedT3 task duration selection4files/46passing identities, one base execution/no repetitions; remaining fullT3 is merge batch, T4/stage QA deferred. Linux x64 6.8.0-147-generic, droplet c-8 lon1, Node24.21.0/Neovim0.12.5; Chrome for Testing156.0.8078.4 binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell. Droplet lifetime1020s, cost$0.0708 (not suite wall time). Budget/ratchet/skip-reason warnings report-only; projections not measured wall times. Separate macOS native receipt A-18164. Tree remains clean/unchanged; final reviewer settlement outstanding.

### rev-35 · 2026-11-09T17:12:51.325Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1776-final-1
commit: f76bdc9bbf86f24011dc98cc4a68d12642c92cf2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18166: final C1–C6 verified from source7+A-18165 configured2e805ed1+A-18164 exact-head native. Independently matched clean head/exporttree;5815green,all12login-disk cases,previous Linux failures and close-order regression,base+5new T1guards,and547/547lower/Web case+file records. Approved Mac28behavior cases plus SSH parent verified. No new allowance threshold crossed. Full remainingT3 batch beforelanding/T4stage/after-stageQA and report-mode limitations retained; failed/candidate/provenance history unchanged. Standards0/Spec0; hold released,hub ready routing next.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-09T17:49:42.254Z

Merged 728efcb88a02a930ed6a5747d28f83b7e1d487b0 onto dev.
