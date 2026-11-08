---
id: T-1744
kind: task
title: Waiting launches
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1743
  - T-1741
topic: topic-1438
branch: t/T-1744-waiting-launches
created: 2026-11-07T16:01:57.997Z
updated: 2026-11-08T07:12:42.214Z
closed: 2026-11-08T07:12:42.214Z
---

## Summary

A launch that no host of its pool can take, with no room for a new host, waits in the hub instead of being refused. The reply returns at once, `{ waiting: { reason, since, pool } }`, with no process, and `cland session launch` prints "waiting: <reason>". The hub holds the launch with its current reason; "waiting for a host" here, and T-1746 adds "waiting for host <id> to boot". The launch shows in four places:
- `cland session list`;
- the inbox frame, as a status line outside needs-you and never an ask;
- Agents, with one notice when the wait starts, one per reason change and one when it ends;
- the session name's reservation.

The wait ends by placement, when a session on the pool's host exits, a host becomes ready or memory frees, or by `cland session stop <name>`. A launch refused by the memory floor waits as if the host were full. In this ticket the waits live in memory; T-1745 makes them durable.

## What to build

The waiting-launch record and its reason tracking, never repeated per poll. Placement is retried on capacity events. The waiting reply covers `session.launch`, the CLI and the Coordinator's tool. Cancellation goes through `session.stop` and the `session.stop` tool, with no new verb. A new Agents lifecycle kind records the wait.

## Acceptance criteria

- [x] C1. With the pool's only host full and `max_hosts` reached, `session.launch` answers at once with a waiting reply of "waiting for a host", and `cland session list` shows the launch with that reason and no process (test).
  - done: impl-1744 · 2026-11-08T05:18:07.858Z
  - verified: rev-35 [reviewer] · run rev-35-1744-final-1 · 2026-11-08T05:41:22.608Z · commit 7da843f6e1a51600145afebd801d3968ad983b7f
  - verified: rev-35 [reviewer] · run rev-35-1744-merge-1 · 2026-11-08T05:44:49.371Z · commit 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4
  - verified: rev-35 [reviewer] · run rev-35-1744-fixtures-1 · 2026-11-08T06:36:44.976Z · commit 7c1693aa81ecaa94b4f96de26732cf65ac2e3514
- [x] C2. The inbox frame carries the waiting launch as a status line with name, role, pool, reason and since, it does not count toward needs-you, and no ask is opened (test).
  - done: impl-1744 · 2026-11-08T05:18:08.192Z
  - verified: rev-35 [reviewer] · run rev-35-1744-final-1 · 2026-11-08T05:41:22.608Z · commit 7da843f6e1a51600145afebd801d3968ad983b7f
  - verified: rev-35 [reviewer] · run rev-35-1744-merge-1 · 2026-11-08T05:44:49.372Z · commit 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4
  - verified: rev-35 [reviewer] · run rev-35-1744-fixtures-1 · 2026-11-08T06:36:44.976Z · commit 7c1693aa81ecaa94b4f96de26732cf65ac2e3514
- [x] C3. Agents gets one notice when the wait starts and one when its reason changes, and none for repeated scheduler passes with the same reason (test).
  - done: impl-1744 · 2026-11-08T05:18:08.399Z
  - verified: rev-35 [reviewer] · run rev-35-1744-final-1 · 2026-11-08T05:41:22.609Z · commit 7da843f6e1a51600145afebd801d3968ad983b7f
  - verified: rev-35 [reviewer] · run rev-35-1744-merge-1 · 2026-11-08T05:44:49.372Z · commit 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4
  - verified: rev-35 [reviewer] · run rev-35-1744-fixtures-1 · 2026-11-08T06:36:44.976Z · commit 7c1693aa81ecaa94b4f96de26732cf65ac2e3514
- [x] C4. When a session on the full host exits, the waiting launch is placed there, its line ends, and Agents records the session start (test).
  - done: impl-1744 · 2026-11-08T05:18:08.855Z
  - verified: rev-35 [reviewer] · run rev-35-1744-final-1 · 2026-11-08T05:41:22.609Z · commit 7da843f6e1a51600145afebd801d3968ad983b7f
  - verified: rev-35 [reviewer] · run rev-35-1744-merge-1 · 2026-11-08T05:44:49.372Z · commit 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4
  - verified: rev-35 [reviewer] · run rev-35-1744-fixtures-1 · 2026-11-08T06:36:44.976Z · commit 7c1693aa81ecaa94b4f96de26732cf65ac2e3514
- [x] C5. `cland session stop <name>` cancels a waiting launch and ends its line, and a second launch of a waiting name is refused naming the wait (test).
  - done: impl-1744 · 2026-11-08T05:18:09.062Z
  - verified: rev-35 [reviewer] · run rev-35-1744-final-1 · 2026-11-08T05:41:22.609Z · commit 7da843f6e1a51600145afebd801d3968ad983b7f
  - verified: rev-35 [reviewer] · run rev-35-1744-merge-1 · 2026-11-08T05:44:49.372Z · commit 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4
  - verified: rev-35 [reviewer] · run rev-35-1744-fixtures-1 · 2026-11-08T06:36:44.976Z · commit 7c1693aa81ecaa94b4f96de26732cf65ac2e3514
- [x] C6. A launch the host agent refuses for the memory floor waits as "waiting for a host" with no session row and no failure notice, and is placed when the host's next memory report is above the floor (test).
  - done: impl-1744 · 2026-11-08T05:18:09.393Z
  - verified: rev-35 [reviewer] · run rev-35-1744-final-1 · 2026-11-08T05:41:22.609Z · commit 7da843f6e1a51600145afebd801d3968ad983b7f
  - verified: rev-35 [reviewer] · run rev-35-1744-merge-1 · 2026-11-08T05:44:49.372Z · commit 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4
  - verified: rev-35 [reviewer] · run rev-35-1744-fixtures-1 · 2026-11-08T06:36:44.976Z · commit 7c1693aa81ecaa94b4f96de26732cf65ac2e3514

## Blocked by

- T-1743
- T-1741

## Notes

- Hot files: `hub/src/adapters/sessions.ts`, `hub/src/host/pool-runtime.ts`, `hub/src/hub/inbox.ts`, `hub/src/hub/agents-topic.ts` (new lifecycle kind), `hub/src/protocol.ts` (inbox type, waiting reply), `hub/src/hub/dispatch.ts`, `hub/src/cli/session.ts`.
- Tests: new `hub/test/waiting-launch.test.ts` (T2); `hub/test/inbox*.test.ts` (T2, edit).
- Serves epic C2 and C3.

## Comments

### impl-1744 · 2026-11-08T03:09:02.399Z

Rule-20 pre-change inventory published in item topic: session.launch/stop/list, Inbox, LIFECYCLE_KINDS, placement and memory refusal consumers across hub, nvim, web, shared, all test tiers, docs, skills and QA. Additive waitingLaunches/list waiting fields preserve existing arrays; launch and stop gain no-process alternatives. Requests and CLI migrate; generic tools forward results. Existing capacity assertions in session-pool-placement migrate; explicit pins stay refusal. Ticket-approved T2 seams: launch/list/stop frames, inbox frame and Agents notices.

### impl-1744 · 2026-11-08T03:12:19.580Z

ProvisionRecords subscription consumer/writer sweep before change: production provision-host.ts writes creating/booting/connecting/cloning/ready/failed/destroying/destroyed; records.ts revoke directly rewrites provision state; host-leases.ts expiry writes through save. Tests: host-destroy, host-lease, host-provision-records, host-provision-recovery, session-pool-placement, waiting-launch. Subscribe Sessions after committed writes, isolate listener failures, unsubscribe on close. Coordinator approval 423d0ae2-49f7-4e96-a190-97aa78125926.

### impl-1744 · 2026-11-08T03:23:04.436Z

Additional rule-20 details: Host gains optional onCapacityChanged subscription (production ssh-host emits existing agent memory report; Sessions owns unsubscribe; other Host implementations unaffected). Core name reservations take a trusted internal retry bypass, and credential-proven launch hello keeps its admitted name; ordinary names stay reserved. session.stop existed in role grants but was absent from spoke tool schema/handler and SPOKE_SESSION_REQUESTS: migrated all three, with Coordinator MCP regression red at unknown tool session.stop before the fix. No role grants broadened.

### impl-1744 · 2026-11-08T03:26:49.134Z

Source review requested from reviewer for e45b6f194; implementation note A-17718. A-17715 mentioned a speculative downstream inbox item number: discard that number; decision 8 assigns rendering to E-1534, with no downstream task number asserted here. Ten new T2 waiting cases and 21 placement cases pass locally on macOS Node 24.21.0. Source importer T1/T2 receipts and serial T3 checks are targeted runs, not a full verification receipt. Full mode-free verification follows source clear at exact reviewed head.

### rev-35 · 2026-11-08T03:33:06.521Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1744-source-1
commit: e45b6f194eb542b5e333e37a6dd25ad4502e451a
scope: full
findings: [{"severity":"high","text":"Queue insertion has no post-selection recheck; capacityChanged discards events while rows are empty, and placement promise release emits no wake. Capacity can free between failed selection/add or after an unpublished concurrent launch fails, leaving an eligible waiter asleep indefinitely. Add insertion recheck and exact reservation-release notifications; author8a946bde confirms.","file":"hub/src/adapters/waiting-launches.ts","line":13},{"severity":"high","text":"Shutdown joins waiting retries before calling adapter.close. A retry held in adapter I/O can require that close/abort to settle, causing circular shutdown wait. Cancel/drain producer authority before joining retries, retaining ownership through closure; author99cbe989 confirms no safe ordering owner.","file":"hub/src/adapters/sessions.ts","line":2944},{"severity":"medium","text":"New unconditional nameRefusal precedes item/worktree claim checks and regresses T-1743's deferred name-admission precedence. Unchanged lead-launch.test.ts:79 reproduces claimed-by expectation vs1–24-character refusal. Defer item name admission without weakening claim assertions; authors66d9888e/845c515f confirm.","file":"hub/src/adapters/sessions.ts","line":133},{"severity":"medium","text":"Floor evidence is attempt-local while #memoryBlocked retains only a Set. A same-capacity/config wake sees PoolCapacityUnavailable and rewrites an unchanged memory wait to generic, emitting spurious reason changes. Retain typed Host/byte evidence until real memory/readiness change; author66d9888e confirms.","file":"hub/src/adapters/sessions.ts","line":137},{"severity":"medium","text":"Pending-stop positive stopped checkpoint and retained-generation positive native closure free counted capacity without notifying waiting launches. Earlier process publication can occur while capacity remains fenced; no later wake is guaranteed, leaving waiters stuck. Notify exact release checkpoints and regress pending/retained cases; author845c515f confirms.","file":"hub/src/adapters/sessions.ts","line":1370},{"severity":"medium","text":"Cancelling idle queued B joins global #work owned by unrelated held retry A, so B cannot release its name/return until A completes. Track/join only the cancelled entry's admitted flight while preserving serial placement; author99cbe989 confirms.","file":"hub/src/adapters/waiting-launches.ts","line":33},{"severity":"medium","text":"Held-retry cleanup restores adapter.spawn only after awaited stop succeeds, skips explicit retry join before stop is assigned, and armed eventually observers have no prearmed cancel/join on early failure. Use ordered resource ownership and finally restoration; authors8a946bde/0719f89e confirm.","file":"hub/test/waiting-launch.test.ts","line":208},{"severity":"medium","text":"SESSION_USAGE changed but frozen cli-usage/commands.json did not. frozenUsage() still feeds exact-byte cli-usage-compatibility and rendered session-help assertions, so consumers are inconsistent. Migrate expected bytes via existing procedure while preserving compatibility assertions; author845c515f confirms no other migration.","file":"hub/src/cli/usage/session.ts","line":1}]
finding_counts: {"high":2,"medium":6,"low":0}

A-17720 complete source pass:2high+6medium, all confirmed. Spec: lost insertion/promise wake, shutdown join-before-adapter-abort, early item-name precedence regression, lost memory reason evidence, absent pending/retained release wake, global rather than per-entry cancellation join. Standards: armed observer/held retry restoration+join gaps and unchanged frozen help bytes. Existing Lead assertion reproduced unchanged by author. Outer adapters/index close only independently drains unregistered factories; ordinary registered adapters have no fallback (author d69f81c9 corrects withdrawn d1dd1750). C2/C6 remain runtime-unverified; no criteria verified. A-17719 retained raw/completion evidence inspected with candidate/mixed-source and stable additional-pin limits, not full/Linux verification. No Reviewer tests/probes/edits/delegation. Address one combined replacement pin then fresh source review before configured verify; no extra fullsuite/unchanged-source/provenance rerun or devmerge requested. Affected after-stage QA separate.

Criteria: C1 failed (Early item-name admission regresses unchanged claim refusal order; queue insertion can miss the capacity release needed for progress.), C3 failed (Attempt-local floor evidence allows same-capacity wake-ups to emit artificial reason changes.), C4 failed (Promise release and positive pending/retained cleanup checkpoints do not reliably wake waiting launches.), C5 failed (Cancellation joins unrelated work; shutdown joins retries before aborting registered adapters, and fixture retry/observer cleanup is unowned.).

### impl-1744 · 2026-11-08T03:44:48.703Z

Review repair adds retained authorization for admitted waits: rule-26 identity sweep found the current callback pins the originating socket, so a disconnected Coordinator wait was dropped on placement (new T2 red: admitted disconnected actor launch published: not within 15000 ms). Consumers: dispatcher session closure (sole production answerSession caller), answerSession test callers (optional trailing parameter preserves them), Sessions.launchOrWait (retry authorization only), and T-1745 durable successor seam. Reuse Dispatcher.asSession durable-id resolution and the same permission validator; initial request keeps live-transport authorization and retries recheck current grants by admitted session id.

### rev-35 · 2026-11-08T03:52:54.836Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1744-source-2
commit: 2131fdbc72da15e31b81a695ea3ae272b87ae06d
scope: full
findings: [{"severity":"medium","text":"Completion-window wake remains stranded: after final while check, a notification/add can set #again while old #work is non-null, then chained finally clears #work without rearming. Preserve pending wake ownership across finalizer handoff and regress that exact window; authorbf422a82 confirms no fence.","file":"hub/src/adapters/waiting-launches.ts","line":55},{"severity":"medium","text":"Wait row.pool is captured once but retry rereads current role pool, so role edits can place an admitted wait on another pool while list/Inbox/Agents still name the old one. Coordinator334da05a now explicitly requires pinned admitted pool; removing it must end once naming that pool and release name. Apply policy to retry selection and controls; authorbf422a82/493704fe confirm current gap.","file":"hub/src/adapters/sessions.ts","line":171}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17722 corrected full pass: earlier eight repairs inspected, but two medium spec gaps remain, confirmedbf422a82. Completion-window #again must survive finalizer handoff. Apply Coordinator334da05a accepted-pool pin policy: role edits affect only new launches; removal ends once naming launch/pool/reason, active row disappears (6a7e386e clarification: no terminal list tail/field required). Frozen help equality independently matches, fixture cancellation/restoration and source admission compatibility repaired; per-entry cancellation/adapter-before-join ordering, memory evidence and exact release checkpoints inspected. New stable-id actor callback preserves current grant revocation after disconnect. All criteria runtime-unverified; prior repaired failed marks must be re-marked done by Implementer on replacement pin. A-17721 candidate narrative qualified;77 corrected-head T1/T2 files reported green, native capture still running—not full verification. No Reviewer tests/probes/edits/delegation. Complete pinned pass closed; one combined source request before configured verify, no extra fullsuite/provenance/unchanged-source run or devmerge requested. After-stage affected QA separate.

Criteria: C1 failed (Retry can follow a changed role pool while admitted waiting facts retain the old pool; accepted-pool pin policy is not implemented.), C4 failed (A completion-window notification can be lost before the old pass finalizer clears #work.).

### rev-35 · 2026-11-08T04:08:34.277Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1744-source-3
commit: 813f3c69e6c32f41bda8472485d782243175be15
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17729 combined corrected source clear. A-17722 finalizer handoff fixed by rearming pending #again after clearing old #work; approved exported-owner T1 retains actual placed receipts within32microtask work bound. Private admitted-pool marker now controls retry selection and final authorization; role edits affect new launches, removal ends once naming pool and releases active row/name, no terminal tail. New pin/removal controls and archive waiting[] compatibility inspected. Frozen help equality independently matches, four CLI formats unchanged. Earlier eight ownership/compatibility repairs and durable-id actor/current-grant checks remain intact. A-17728 candidate54/typecheck/lint narrative qualified; A-17725 exact2131 raw112-file receipts remain predecessor/source-not-clear evidence, not813 coverage. C1–C6 done now present but all runtime-unverified pending exact-head mode-free verify after authorized checks. No Reviewer tests/probes/edits/delegation, extra fullsuite, provenance-only repeat or devmerge requested. After-stage affected QA separate.

### rev-35 · 2026-11-08T04:24:21.528Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1744-evidence-1
commit: 813f3c69e6c32f41bda8472485d782243175be15
scope: evidence
findings: [{"severity":"medium","text":"New optional Host.onCapacityChanged has no reusable contract exercise. Configured exhaustive/planted guard at host-contract-coverage.test.ts:23 actually returns ['uncovered','onCapacityChanged'] rather than ['uncovered'], enforcing T1 exit1. Add absence/report-delivery/unsubscribe coverage while preserving both exhaustive guards; authorc5f7cb81 confirms task-local omission.","file":"hub/test/host-contract.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17732 actual A-17731 result inspected: T0exit0, T1exit1 for missing reusable onCapacityChanged contract exercise; task-local consumer omission, not report-only/shared-defect. LaterT2/T3/T4/Web unexecuted. Independent exact source projection79aecec9a4baa3f4e2598c9a506b9968f26f7d53 matches provenance. Counts retained1553/1552pass/1fail, interruption1563/1562/1 and parsed1551/1550/1 kept distinct; one failure array identifies exact guard. New finalizer owner base+5distinct load pass. Linuxx64 .147 Node24.21/Nvim0.12.5, uncached/skips[], browsernull/Webunrun;198s/$0.0138 resource metrics. A-17730 local79/1071 and35/539 all nativecode0/signalnull audited with argv-head/clean-surrounding limits; targeted selection omitted this consumer and cannot replace configured failure. C6failed, rest runtime-unverified. Keep exhaustive/planted guards, add proper optional contract coverage, fresh source review before mode-free retry. No extra/unchanged-source/provenance-only run or devmerge requested; affected after-stageQA separate.

Criteria: C6 failed (The new Host capacity subscription is uncovered by the reusable contract; enforced T1 guard fails before waiting runtime phases.).

### impl-1744 · 2026-11-08T04:30:21.446Z

Configured run 124a4c7d stopped in T1 at the exhaustive Host AST contract reader: actual [uncovered,onCapacityChanged], expected [uncovered]. This was a missed read-then-parse consumer, not a shared defect. Additional sweep covers host/host.ts path readers and host-contract.ts importers: host-contract-coverage (T1), host-flush (T1), host-local-contract (T3), host-ssh-contract (T3), host-agent (T3). Preserve exhaustive/planted guards; add shared optional capacity absence/report/unsubscribe contract with broken-delivery and leaky-unsubscribe positive controls; reuse it against the real fake-SSH agent memory report in the existing C6 case. Production source remains unchanged.

### rev-35 · 2026-11-08T04:39:41.715Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1744-source-4
commit: 25f3f5e037ccf2843eebd968ab3662e9720b9fd3
scope: full
findings: [{"severity":"medium","text":"Added shared subscription exercise gives each of two observed() waits a fresh MEMORY_BEHAVIOUR_MS60s inside the unchanged single60s behaviour allocation (outer setup60+behaviour60+cleanup60). No shared remaining deadline bounds these plus prior memory/admission work, so outer can preempt allowed phase waits/cleanup. Share one behaviour deadline after setup, pass remaining bounds and retain an explicit phase completion assertion; author5b112db1 confirms.","file":"hub/test/host-agent.test.ts","line":494}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17736 complete contract-repair pass. Actual missed Host consumer is repaired: shared optional absence/exact-report/unsubscribe contract, fresh second-subscriber receipt, dropped-delivery/leak controls and real fake-SSH reuse inspected. Existing exhaustive/planted guard prefix independently unchanged; production bytes unchanged. One medium Standards blocker remains: new two observed waits each receive a fresh60s inside the existing one60s behavior allocation, plus prior work. Author5b112db1 confirms no shared deadline. Start one behavior deadline after setup, use remaining budgets and explicit final phase completion assertion, preserving setup/cleanup and report semantics. A-17735 candidate code0/signalnull full contract wrappers plus selective memory case retained with precommit/selection limits; A-17731 remains failed, later phases unexecuted. C6failed, rest runtime-unverified. Fresh corrected source request before mode-free retry; no Reviewer tests/probes/edits, extra fullsuite/provenance/unchanged-source run or devmerge requested. After-stage affected QA separate.

Criteria: C6 failed (New native subscription contract uses two fresh60s waits inside one60s behavior allocation; shared phase ownership is missing.).

### rev-35 · 2026-11-08T04:48:30.090Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1744-source-5
commit: d3f1b96f2a03af24c2e58fb47767612d5b1a4628
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17739 corrected combined source clear. A-17736 shared phase finding resolved: one realClock behavior deadline starts after setup; both contract observations, original memory event and raw agent requests consume remaining time; writes/spawn authorization check it and final assertion covers completion after native exit receipts. Separate setup check and existing cleanup/outer allowances retained; guide matches. Clean exact head and two-file-only delta independently confirmed; production unchanged from813f, reusable Host contract and exhaustive/planted guards retain reviewed repairs. A-17737 selective candidate narrative and prior A-17735 qualified consumer receipts do not establish queued runtime coverage. A-17731 remains red at813f, later phases unexecuted. C1–C6 all done but runtime-unverified pending fresh mode-free exact-head verification after authorized checks. No Reviewer tests/probes/edits/delegation or extra fullsuite/provenance/unchanged-source rerun/devmerge requested. After-stage affected QA separate.

### rev-35 · 2026-11-08T05:05:28.478Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1744-evidence-2
commit: d3f1b96f2a03af24c2e58fb47767612d5b1a4628
scope: evidence
findings: [{"severity":"medium","text":"session.list now includes waiting[], but both exact-byte legacy expectations omit the additive field (active and archived shapes). Configured assertion fails on the extra waiting:[] key. Migrate both expected shapes/types while retaining complete compatibility assertions; author539a48bd confirms no approved exception.","file":"hub/test/connection-snapshot.test.ts","line":51},{"severity":"medium","text":"New session.stop MCP tool is absent from DOCUMENTED_TOOLS and spoke-lazy-tools' exhaustive calls map. Three configured tests fail (45 vs44 and extra session.stop); adding only the name would leave handler coverage incomplete. Migrate the shared inventory and actual stop call through existing exhaustive forwarding assertions; author539a48bd confirms.","file":"hub/test/harness.ts","line":44},{"severity":"medium","text":"Unconditional async close and always-present waiting drain change no-flight construction rollback from synchronous failure to rejected promise. projectSessions catches/logs that promise rather than returning its cleanup error, so original factory error masks the required adapter-construction-and-cleanup AggregateError. Preserve no-flight synchronous failure semantics and abort-before-join for real flights, without weakening rollback assertions; author539a48bd confirms no other owner.","file":"hub/src/adapters/sessions.ts","line":2960}]
finding_counts: {"high":0,"medium":3,"low":0}

A-17741 actual A-17740 inspected: T0/T1exit0, fallbackallT2exit1 with5failures, three medium task-local compatibility/ownership gaps confirmed539a48bd. Migrate both waiting[] exact-byte list shapes; shared DOCUMENTED_TOOLS plus actual session.stop call map; restore synchronous no-flight cleanup error semantics while retaining adapter-abort-before-join for real waiting flights. Preserve all complete assertions. Independent projection c3c0d06c2fb96dfd24171959ebf39b789bbcbfe7 matches exact d3 provenance; clean head.20 waiting base+100load, owner1+5 and repaired optional capacity1+5 pass, but aggregate remains red; T3/T4/Web unexecuted. Counts4823/4818/5 retained,5043/5038/5 interruption,4748/4743/5 parsed kept distinct. Linuxx64 .147 Node24.21/Nvim.12.5 uncached/skips[], browsernull;814s/$0.0565 resource metrics. C1/C5failed, rest runtime-unverified. New combined source request before fresh mode-free verify; no extra fullsuite/unchanged-source/provenance-only run/devmerge requested. After-stage affected QA separate.

Criteria: C1 failed (Additive waiting[] session.list field was not migrated into active/archived exact-byte compatibility consumers; configured T2 fails.), C5 failed (session.stop is absent from exhaustive MCP inventory/call coverage, and no-flight close changed construction cleanup error aggregation; configured T2 fails.).

### impl-1744 · 2026-11-08T05:07:28.117Z

Rule-20 repair sweep before edits: session.list waiting consumers connection-snapshot.test.ts has two exhaustive active/archive JSON byte expectations to migrate (waiting test already asserts archived waiting empty; CLI old-wire fallback retained). DOCUMENTED_TOOLS consumers: resilience.test.ts (T3), resilience-component.test.ts (T2), spoke-identity.test.ts (T2), surface.test.ts (T3), spoke-lazy-tools.test.ts (T2), its per-test doc, and T-1608 skill note; all use central list, only lazy-tools has independent exhaustive calls to migrate. Sessions.close direct production consumers: adapters/index.ts construction cleanup (synchronous throw aggregation and async drains), hub/server.ts and hub/daemon.ts await or collect its void-or-Promise drain; test consumers await close or register cleanup callbacks and accept either return. WaitingLaunches.close owner test cleanup also accepts either. Restore synchronous no-flight completion; actual pending retries still cancel then adapters abort before joins. Existing fake-harness regression is the durable red assertion (A-17740), and waiting-launch shutdown case protects held retries. No shared-defect classification; no unchanged-source repeat.

### impl-1744 · 2026-11-08T05:18:26.021Z

Repaired all three A-17741 gaps at pushed 7da843f6e1a51600145afebd801d3968ad983b7f. Active/archive session.list retain full byte checks including waiting:[]; DOCUMENTED_TOOLS and actual exhaustive native session.stop call map migrated; no-flight WaitingLaunches/Sessions close is synchronous again, while active retries cancel before adapter abort and join. A-17742 preserves 84 full T1/T2 files (1103 pass), 37 serial T3 files (544 pass), and T0 npm run check. macOS arm64 local Node24.21, no browser/provider API, no skips. Candidate-tree receipts before commit; configured verification and T4/Web remain pending, criteria done marks restored but no runtime-verified claims. Per-file tiers, commands, raw native completions, environment/redaction and evidence limits in artifact README. Preservation owner checked and lock released. No source changes during producers; no unchanged-source/provenance-only run or dev merge.

### rev-35 · 2026-11-08T05:19:39.178Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1744-source-6
commit: 7da843f6e1a51600145afebd801d3968ad983b7f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17743 combined source clear. Both active/archive waiting[] exact-byte list shapes and type repaired; DOCUMENTED_TOOLS plus actual session.stop exhaustive lazy call/frame expectations migrate together. Waiting close returns void with no work; Sessions.close preserves that synchronous path so projectSessions retains construction+cleanup aggregation. Actual waiting flights still cancel first, begin registered adapter abort before joining and retain storage owner. Existing rollback/all-closed, held-retry, finalizer and Host exhaustive/planted assertions unchanged. Eight-file delta, exact clean HEAD and diff check independently confirmed. A-17742 individually audited122 code0/signalnull receipts:84 component1103passes,37 native544passes,check0; raw counts match, zero fail/cancel/skip/todo. Precommit candidate/argv-head/native wrapper limits retained, not exact-head configured proof. A-17740 remains red predecessor. C1–C6 restored done but runtime-unverified pending fresh mode-free exact-head configured result after authorized checks. No Reviewer tests/probes/edits/delegation or extra fullsuite/provenance/unchanged-source repeat/devmerge requested. After-stage affected QA separate.

### rev-35 · 2026-11-08T05:41:22.609Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1744-final-1
commit: 7da843f6e1a51600145afebd801d3968ad983b7f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17745 final same-head audit clear; C1–C6 verified against source6/A-17743 and configured4020bf56/A-17744. Independent execution projection d56434195f05c89dae89d135650c19f270dfc378 matches provenance; clean exact head. Aggregate5544/5544 and parsedbase5406/5406 distinct, six empty failure arrays, zero fail/cancel/skip/TODO. All20waitingbase+100distinctload passes; finalizerowner1+5 and optionalcapacity1+5 pass. Exact five predecessor failures now individually pass. Real fakeSSH memoryfloor1.542791041s/failedsetup1.030467313s, hostagent21/21 once. T0/allT1/fallbackallT2/selectedT3hostagent+roles25once/mappedT4guard1base/Webexit0; remainingT3batch, noT4reps. Linuxx64 .147 Node24.21/Nvim.12.5, uncached/skips[], Shell1248/CfT156.0.8078.4,1155s/$0.0802 resource metrics. Report-only budgets/lints retained. Qualified precommit Mac preservation A-17742 unchanged; historical reds A-17731/A-17740 remain red. No Reviewer tests/probes/edits/delegation or rerun requested. Affected after-stage QA remains separate on dev.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1744 · 2026-11-08T05:43:42.121Z

Coordinator-authorized rule-11 merge complete: 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4, parents 7da843f6e and origin/dev 5033d6f0 (contains T-1748 debeaca4). README was the only conflict; both lane lines kept. Automatic incoming watchdog/provision/fixture source unchanged; post-commit ready/capacity seams retained. A-17747 preserves requested merge-tree checks: npm run typecheck exit0 (4.049s); waiting-launch T2 20pass (3.063s); owner T1 1pass (.084s); host-create-ready T3 11pass (25.343s), alone under matching preservation lock, no skips. macOS arm64 local Node24.21, no browser or provider API. Precommit candidate source receipts with explicit argv-label limitation; no provenance-only repeats. Source clean and pushed. Requesting delta review; prior configured A-17744 carries forward under Coordinator decision if delta clear; no new verify submitted.

### rev-35 · 2026-11-08T05:44:49.372Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1744-merge-1
commit: 6fa0e9f8efe8d740ca526b64e3779a0b4bbc58d4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17748 merge delta clear, C1–C6 renewed. Parents independently match verified7da843f6e and dev5033d6f0; clean HEAD/diff check. README sole combined conflict retains both lane links; task code/tests byte-identical firstparent and incoming watchdog/provision/fixture byte-identical secondparent, except inspected additive index/tiers unions. Final registration-guarded ready checkpoint/postwrite onChange capacity wake and nonready exclusion remain intact next to watchdog arm/retirement. Coordinator9fe40928 explicitly authorizes carry with these conditions. A-17747 independently audited four childcode0/signalnull/errornull:waiting20+owner1+create-ready11 rawpasses, typecheck0; stated precommit chronology/argvdebeaca4 versus actualdev5033 limit retained. Configured4020bf56/A-17744 ran firstparent, carried by explicit decision, not a new merge execution/cache. Earlier full criteria and evidence limits A-17745 remain; remainingT3batch/T4reps/afterstageQA separate. No Reviewer tests/probes/edits/delegation or extra verify/provenance repeat requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-08T05:44:57.173Z

Rule 6/7 carry (coord): enqueued at merge head 6fa0e9f8, parents 7da843f6 and dev 5033d6f0, which contains T-1748's debeaca4. Verify passed at 7da843f6. The merge conflicted only in README; both lane lines were kept and the incoming watchdog, provision and fixture changes were taken unmodified. Typecheck is green, the waiting-launch T1/T2 tests pass 21/21, host-create-ready passes 11/11 run alone under the lock (A-17747), and the delta review is clear.

### impl-1744 · 2026-11-08T06:23:30.751Z

Batch 2b726018 red receipt A-17750 says: AssertionError [ERR_ASSERTION]: live hub protocol drifted; run npm run test:nvim-fixtures; actual inbox adds waitingLaunches: []. This is the missed recorded consumer, not a shared-defect/flake. Before fixture changes, rule-20 sweep: nvim/test/frame-fixtures.ts replay/packed catalogs; fixtures/live-protocol-frames.json; fixtures/protocol-frames.json and every per-file protocol-frames/*.json slice; hub/test/record-nvim-frames.ts, nvim-frame-source.ts and nvim-fixture-check.ts; T3 scenarios/workbench checkLiveFrames/checkRecordings; runtime stub readers nvim/test/stub-hub.ts. Inbox/component readers: inbox-actions, inbox-requests, inbox-sections, needs-you, shell-component, events, layers-component, graph, remotes, stub-control, shell; indirect recorded import/launch consumers are enumerated by full recorder. Web sweep: inbox, asks, phone-inbox, phone, phone-approvals, phone-disconnected, phone-notifications, notifications, pairing read live frames/selected fields and have no committed inbox frame recording; web/test/fixtures/verification.json is unrelated verification data. Existing inline old optional shapes remain compatibility controls. Coordinator explicitly requests full fixture regeneration, workbench alone then recorded inbox/component consumers, T0 and delta review. Existing deterministic snapshot assertion plus positive actual field is the tight red signal; no additional reproducer, bisection, ranked speculative hypotheses or instrumentation is needed for this exact data-only drift.

### impl-1744 · 2026-11-08T06:30:46.325Z

Fixture-only repair pushed at 7c1693aa81ecaa94b4f96de26732cf65ac2e3514 (parent 6fa0e9f8e), exactly 25 regenerated JSON files. Full npm run test:nvim-fixtures: 49 consumers plus attach check, 50 complete TAP blocks, 489pass/no failures/skips. Full workbench alone under lock: 6pass. Eight inbox/component replay files: 110pass, no skips. T0 npm run check exit0. A-17753 preserves red source A-17750, raw receipts, whole consumer list, semantic diff and candidate/platform limits. Live attach baseline adds only waitingLaunches:[]. Shared 5910 main catalog records and all shared slices unchanged; full capture adds 147 result-frame inputs, omits 12 previous capture inputs, with corresponding generated slices. All catalog outputs validate against hub producers and replay checks pass. Web snapshot search found live inbox consumers but no committed inbox recordings. No production/test/generator/docs changes, no dev merge, no new configured verify. Coordinator b975b728 says other evidence carries; fresh delta review requested before re-enqueue.

### impl-1744 · 2026-11-08T06:35:33.616Z

Coordinator39f8d27 ordinary replay condition now satisfied at fixed 7c1693aa. A-17754 preserves 42 additional ordinary (no recorder preload) full-file runs: 33T2,6T3,3T4; 381pass, no fail/cancel/skip/TODO; every native code0/signalnull/errornull. Set equality verifies these42 plus seven catalog-reading ordinary files from A-17753 cover all49 runtime consumers exactly; union488 direct tests pass. A-17753 extra stub-control utility and standalone workbench6/6 are separate. T0/check0 and full capture489/489 remain A-17753. All49 listed with tier and result in new artifact; first seven retain precommit limits,42 at committed unchanged head. Mac arm64 local Node24.21, no browser/provider API, serial preservation owner checked/released. No missing input observed, regeneration/patch unnecessary. Semantic source/data audit unchanged; no new configured verify or dev merge. Supplemental evidence sent to ongoing delta reviewer before carry/re-enqueue.

### rev-35 · 2026-11-08T06:36:44.976Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1744-fixtures-1
commit: 7c1693aa81ecaa94b4f96de26732cf65ac2e3514
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17755 fixture delta clear; C1–C6 renewed under Coordinatorb975b728/39f8d27 explicit carry conditions. Clean exact head/parent/diffcheck,25generatedJSONonly; production/test/generator/docs unchanged. Independent packed-data audit:live onlywaitingLaunches[],5910sharedmain and allsharedslice records unchanged,147new result inputs/12removed prior variants. Static AST inventory exactly49consumer paths. Capture mode bypasses lookup: initial eight replays covered only seven consumers, stubcontrol extra; supplementalA-17754 closes42remaining gap. Independently checked42complete nativecode0/signalnull/errornull and381rawpasses; union with sevenA-17753 equals49/noomission/duplicate,488ordinarypasses. Workbench6,utility3 separate; recorder489capture/check0 retained with precommit/argvhead limits. No fixtureedit/missinginputrepair during replay. A-17744 configured7da and A-17747/A-17748 merge evidence carry explicitly, not newfixtureheadexecution/cache; A-17750 stays historical failed batch. No extra verify/devmerge/provenancerepeat requested; Coordinator re-enqueue and afterstageaffectedQA separate. No Reviewer tests/probes/edits/delegation.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-08T06:36:53.044Z

Re-enqueue carry (coord): head 7c1693aa = merge head 6fa0e9f8 plus regenerated Neovim recorded fixtures only (25 JSON files; the live attach baseline adds only inbox.waitingLaunches). This fixes batch 2b726018's workbench drift (A-17750). All 49 catalog consumers pass ordinary replay, 488 passes (A-17753, A-17754); workbench 6/6; T0 green; delta review clear. Verify at 7da843f6 and the merge-head receipts (A-17747) carry.

### coord · 2026-11-08T07:12:42.214Z

Merged 48e11d905672b5ad0a9d6fb7a811c94c71fc4af3 onto dev.
