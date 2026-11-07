---
id: T-1741
kind: task
title: The host agent's memory floor
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
topic: topic-1431
branch: t/T-1741-the-host-agent-s-memory-floor
created: 2026-11-07T16:01:57.416Z
updated: 2026-11-07T22:08:53.345Z
closed: 2026-11-07T22:08:53.345Z
---

## Summary

The host agent refuses a `spawn` when the host's available memory is below 1.3 GB, the typecheck reserve, whatever the slots say. The refusal carries a typed code, `memory-floor`, in the agent reply, and the hub's ssh Host surfaces it as a typed launch refusal. A fake host can report a set amount of free memory, so tests and the QA demo can trigger the refusal.

## What to build

One reading of available memory: `MemAvailable` on Linux, and on a fake host an override file in the fake host's directory. The agent reads the override only when its environment carries the fake-host marker. The agent checks the reading before a spawn and keeps reporting it in the existing `memory` event. The hub-side error type lets T-1744 treat the refusal as "host full".

## Acceptance criteria

- [x] C1. The host agent refuses a spawn with code `memory-floor` when available memory is below 1.3 GB and spawns when it is at or above it (test).
  - done: impl-1741 · 2026-11-07T17:40:41.536Z
  - verified: rev-35 [reviewer] · run rev-35-1741-final-1 · 2026-11-07T18:14:52.851Z · commit 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab
  - verified: rev-35 [reviewer] · run rev-35-1741-merge-1 · 2026-11-07T21:31:53.071Z · commit 042be2f5770d864c3ae90687ea5745a80c9d8acc
- [x] C2. A fake host set to report 1.2 GB free refuses the spawn, and its `memory` event reports that amount (test).
  - done: impl-1741 · 2026-11-07T17:40:41.896Z
  - verified: rev-35 [reviewer] · run rev-35-1741-final-1 · 2026-11-07T18:14:52.851Z · commit 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab
  - verified: rev-35 [reviewer] · run rev-35-1741-merge-1 · 2026-11-07T21:31:53.071Z · commit 042be2f5770d864c3ae90687ea5745a80c9d8acc
- [x] C3. The ssh Host raises a typed memory-floor refusal that names the host and the free memory, distinct from a spawn failure (test).
  - done: impl-1741 · 2026-11-07T17:40:42.123Z
  - verified: rev-35 [reviewer] · run rev-35-1741-final-1 · 2026-11-07T18:14:52.851Z · commit 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab
  - verified: rev-35 [reviewer] · run rev-35-1741-merge-1 · 2026-11-07T21:31:53.071Z · commit 042be2f5770d864c3ae90687ea5745a80c9d8acc
- [x] C4. The memory override file is ignored by an agent without the fake-host marker (test).
  - done: impl-1741 · 2026-11-07T17:29:05.129Z
  - verified: rev-35 [reviewer] · run rev-35-1741-final-1 · 2026-11-07T18:14:52.851Z · commit 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab
  - verified: rev-35 [reviewer] · run rev-35-1741-merge-1 · 2026-11-07T21:31:53.071Z · commit 042be2f5770d864c3ae90687ea5745a80c9d8acc

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/agent/server.ts`, `hub/src/host/agent/processes.ts`, `hub/src/host/agent/protocol.ts` (reply code), `hub/src/host/ssh-host.ts` (typed refusal).
- Tests: `hub/test/host-agent.test.ts` (T3, edit), or a new T2 agent-operations test with an injected memory reader.
- Serves epic C2.

## Comments

### impl-1741 · 2026-11-07T17:23:56.308Z

Pre-change contract sweep: searched AgentReply, availableBytes, prepare-spawn, commit-prepared, settle-prepared, PreparedOutcome, AgentProcesses, serveAgent, agent-client and ssh-host across production, all test tiers, docs/QA and shipped skills. Producer server/processes plus prepared.ts (durable failures) and client/ssh-host must migrate: additive optional code/availableBytes/floorBytes preserves protocol 1 and old failure shapes. Memory events keep original fields. HostRegistry and scheduler consume memory events unchanged. Direct wire readers and tests retain old error/string contracts; client regression will retain prior wire shape. Full matched file inventory will be attached with evidence before review.

### impl-1741 · 2026-11-07T17:31:42.990Z

Pre-change Claude launch contract sweep: searched run-host, runCommand, launchClaude, claudeAdmission and CLAND_AGENT_ADMISSION_REFUSED across hub/src, all hub/test tiers, docs/QA, shipped skills. Agent server run-host -> PreparedOperations.runCommand -> claude.launch owns launch execution; SSH host.run/launchClaude and ClaudeCodeAdapter rollback consume non-admission. All must preserve durable refusal identity; generic run-command operations must remain usable below the floor. Plan: share the memory admission function with native spawn; persist typed failed run outcomes and let SSH map identical memory-floor details. Adapter rollback must recognize positive memory-floor non-admission in addition to its previous code. Tests/fixture consumers using old run result/claudeAdmission shapes remain compatible; raw old reply regression stays. Full search inventory will be committed before new source review.

### rev-35 · 2026-11-07T17:34:45.873Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1741-source-1
commit: 2639f4ff0d983184fbbac21ca2ec96518a720271
scope: full
findings: [{"severity":"high","text":"Actual Claude launches use run-host/claude.launch and bypass both new spawn-path memory checks, so Claude can start below the promised floor and does not produce the common typed refusal. Coordinator9cb1f4c7 confirms every harness launch is in scope and requires one shared launch admission boundary, including run-command.","file":"hub/src/host/agent/server.ts","line":149},{"severity":"medium","text":"The committed closure omits memory.ts and retains stale hashes for prepared.ts/processes.ts/protocol.ts/server.ts. Delivered runtime verification/closure guards reject this head. Regenerate the complete source graph once after final agent repairs and retain the source-only closure control.","file":"hub/src/host/agent/closure.json","line":2},{"severity":"medium","text":"The fake override accepts bare digit strings, contrary to Coordinator2695224a's explicit byte-unit field/format and unitless-refusal requirement. Use the approved JSON availableBytes contract and cover malformed/unitless/negative/exact-boundary cases; docs and fixture producers must agree.","file":"hub/src/host/agent/memory.ts","line":28},{"severity":"medium","text":"Using os.freemem on non-Linux hosts creates false low-memory refusals; the retained importer run demonstrates them on macOS. Coordinator57f24b36 requires no memory verdict/admission refusal on non-Linux absent override, Linux MemAvailable otherwise, fake override precedence, and deterministic shared fake-host seeding.","file":"hub/src/host/agent/memory.ts","line":35},{"severity":"medium","text":"The new native fixture admits server/client/sshHost before its try/cleanup owner, so setup failure can leak an accepted server/root. Its sequential finally skips remaining cleanup after a rejected stop/close. Prearm ordered fixture ownership before acquisition, attempt every cleanup, and preserve roots when native drainage is incomplete.","file":"hub/test/host-agent.test.ts","line":480},{"severity":"medium","text":"The fixed15000ms whole-test timeout can preempt the load-scaled until wait alone (default15000ms, droplet30000ms), after setup and before native launches/cleanup. Derive a named outer envelope covering setup/behavior/cleanup without weakening event/native-receipt assertions.","file":"hub/test/host-agent.test.ts","line":472}]
finding_counts: {"high":1,"medium":5,"low":0}

Source not clear; A-17549 records complete Standards/Spec pass and six findings: high Claude launch bypass (Coordinator9cb1f4c7); medium stale runtime closure (four SHA mismatches plus missing memory.ts); medium unitless override format; medium non-Linux freemem false refusals/shared fake seed (Coordinator57f24b36); medium unowned setup/sequential cleanup; medium fixed outer timeout preempting load-scaled wait. C1/C2/C3 failed, C4 runtime-unverified. Inspected A-17546:34 command results,10 failed files, not a green preservation receipt; stale closure and actual low-freemem failures present. A-17545 focused/native red wrapper0 is qualified; A-17547/48 original static output retained. Correct together, fresh source head before verify, then authorized affected/importer preservation. No provenance-only rerun/full-tier run/dev merge requested. After-stage affected QA separate.

Criteria: C1 failed (Actual Claude run-host/launchClaude admission bypasses the floor; every harness launch is explicitly in scope.), C2 failed (Fake override lacks the required named-byte JSON format and the approved deterministic memory-source policy is missing.), C3 failed (The actual Claude launch route lacks the common typed memory-floor refusal.).

### impl-1741 · 2026-11-07T17:40:31.885Z

Combined correction committed/pushed at 3d2ca1a6e. All six A-17549 findings addressed: shared guard covers native spawn/Claude run-host (generic commands remain usable), durable run refusal and adapter typed propagation/rollback, regenerated closure; JSON availableBytes validation; Linux-only native/no-verdict non-Linux; shared 8 GiB fake seed; prearmed shared fixture owner and failed-client-setup teardown control; named setup/behavior/cleanup envelope. C1–C4 remain done with updated tests. T2 injected policy and legacy fieldless failure regressions pass. Corrected focused native cases pass incl unchanged kill-agent supervisor. T0 test:lint/test:tiers/full typecheck exit0 (report-only lint findings retained). Full 53-file direct-import regression running serially at exact head; no configured verify submitted before fresh source review. host-ssh-contract.test.ts remains unedited and runs alone.

### rev-35 · 2026-11-07T17:45:00.934Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1741-source-2
commit: 3d2ca1a6e3e8ebd9eaf9a9b90805e6a2da871c34
scope: full
findings: [{"severity":"low","text":"The overview still says memory is reported without enforcing a launch floor, contradicting this feature and the accurate T-1741 section below. Update the overview; nonblocking.","file":"docs/agents/tests/hub-test-host-agent.test.ts.md","line":3}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low guide correction; A-17557 records Standards/Spec pass and resolution of all six A-17549 findings. Shared guard now covers actual Claude/native launches; typed durable refusal survives SSH and adapter rollback; JSON units, Linux/non-Linux policy, shared fake seed, prearmed fixture ownership/envelope and all33 closure hashes checked. C1–C4 remain runtime-unverified. A-17551 mixed native1 and A-17552 Claude red remain qualified; A-17553/54 candidate focused greens are not exact-head full evidence. Complete authorized53-file preservation, then mode-free verify at the reviewed head; final result inspection and after-stage affected QA remain separate. No reviewer native run or provenance-only rerun.

### rev-35 · 2026-11-07T17:45:57.166Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1741-source-3
commit: 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17558: one guide overview line only from source-clear3d2ca1a6e; correct fake-carrier and shared memory-floor facts resolve the sole low finding. Runtime/test/config/closure/timing bytes unchanged; A-17557 full source review carries. C1–C4 remain runtime-unverified. Preserve53-file predecessor attribution, then mode-free configured verification at this exact new head. Final receipt inspection and after-stage affected QA separate; no reviewer tests or native probes.

### rev-35 · 2026-11-07T18:14:52.851Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1741-final-1
commit: 0b2a3f8f759baca1a9c5d60102a378bf1d4021ab
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17587 final evidence audit:18088b31/A-17584 exact reviewed head and independently matching projectionfc0d3f73780c37385018aaea84f2ec117c4ae0d8. Hub5481/5481; parsed5344 base passes, five empty failure arrays. Actual direct/prepared/event/typedSSH/marker/invalidJSON/setup-owner/Claude below+exact-floor case records pass; injected policy base+5 distinct load passes. C1–C4 verified. T0/allT1/fallbackallT2/two changedT3 files66identities once/Web complete; remainingT3 deferred,T4 unrun. Linuxx64 .147 Node24.21/Nvim0.12.5/Shell1248 CfT156, uncached,skips[]. New max3.065s<4s so no allowance. A-17559 remains52green commands+1T-1735 failure at3d predecessor; A-17560 solo same signature also failed. Coordinator47a54e7b's explicit known-T-1735 nonblocking disposition retained, neither called green. All new cases/unedited supervisor/standalone SSH contract passed locally. After-stage affected QA separate. No reviewer tests/native probes.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-35 · 2026-11-07T21:31:53.071Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1741-merge-1
commit: 042be2f5770d864c3ae90687ea5745a80c9d8acc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17631 merge delta clear. Parents prior-final0b2a3f8f7/dev5a359016d; combined docs preserve memory+role-pool+spend lanes.13 critical memory source/test/fixture blobs unchanged;33 closure hashes match. Factory retains T-1735 self-ignore and JSON8GiB seed. Semantic pool/slots integration checked: directed valid custom pools slots8 and injected HostPool uses shared parser. A-17629 two native0/null commands: provision-gate3/3/create-ready11/11,14reported passes/no skips; A-17630 root typecheck complete0 per original completion. Both labelled identical merge-candidate contents, not embedded commit receipts. Coordinator2038642b/db297c43 expressly carries A-17584/18088b31 at0b2a3f8f7 across this integration, no new configured run claimed. Renew C1–C4 under that carry plus directed checks. HistoricalT-1735/remaining-tier limits preserved, after-stage affected QA separate. Worktree clean; no reviewer tests/native probes.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-07T21:32:09.066Z

Rule 6/7 carry (coord): enqueued at merge head 042be2f5 (parents 0b2a3f8f and dev 5a359016). Verify 18088b31/A-17584 passed at 0b2a3f8f. The merge resolved two docs conflicts only and changed no fixture or production code. Semantic HostPool/slots sweep is clean. Typecheck exit 0 (A-17630); host-provision-gate 3/3 and host-create-ready 11/11 alone under the lock (A-17629); delta review clear A-17631.

### coord · 2026-11-07T22:08:53.345Z

Merged 1a9e4ea6e687d28cdab60cd72bdaf6aa8212127c onto dev.
