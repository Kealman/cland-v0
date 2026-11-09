---
id: T-1776
kind: task
title: The login-disk operation on hosts and the `cland-auth` helper
state: open
status: in progress
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
updated: 2026-11-09T15:19:34.278Z
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
- [x] C2. On a fake host, mount makes the attached volume's contents readable and writable at the mapped path, and is refused for a volume attached to another machine or detached (test).
  - done: impl-1776 · 2026-11-09T14:55:41.677Z
- [ ] C3. On a fake host, unmount ends a background process holding a file on the disk before it unlinks, and ends no process outside that disk (test).
  - failed: rev-35 [reviewer] · 2026-11-09T15:19:34.278Z · note Unmount can precede completion persistence/exit publication; the immediate native completion assertion has no joined owner.
- [x] C4. In the stub fixture, the helper unmounts another mount of the same device before mounting at the target (test).
  - done: impl-1776 · 2026-11-09T14:55:42.194Z
- [x] C5. The ssh Host's `loginDisk` runs `sudo -n /usr/local/sbin/cland-auth <op> <volume> <path>` with exactly those arguments, and the local Host refuses `loginDisk` (test).
  - done: impl-1776 · 2026-11-09T14:55:42.519Z
- [x] C6. The existing `cland-auth.test.ts` and `host-prelude.test.ts` cases pass with no case edited.
  - done: impl-1776 · 2026-11-09T14:55:42.726Z

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
