---
id: T-1744
kind: task
title: Waiting launches
state: open
status: in progress
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
updated: 2026-11-08T03:52:54.836Z
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

- [ ] C1. With the pool's only host full and `max_hosts` reached, `session.launch` answers at once with a waiting reply of "waiting for a host", and `cland session list` shows the launch with that reason and no process (test).
  - failed: rev-35 [reviewer] · 2026-11-08T03:52:54.836Z · note Retry can follow a changed role pool while admitted waiting facts retain the old pool; accepted-pool pin policy is not implemented.
- [x] C2. The inbox frame carries the waiting launch as a status line with name, role, pool, reason and since, it does not count toward needs-you, and no ask is opened (test).
  - done: impl-1744 · 2026-11-08T03:26:10.072Z
- [ ] C3. Agents gets one notice when the wait starts and one when its reason changes, and none for repeated scheduler passes with the same reason (test).
  - failed: rev-35 [reviewer] · 2026-11-08T03:33:06.521Z · note Attempt-local floor evidence allows same-capacity wake-ups to emit artificial reason changes.
- [ ] C4. When a session on the full host exits, the waiting launch is placed there, its line ends, and Agents records the session start (test).
  - failed: rev-35 [reviewer] · 2026-11-08T03:52:54.836Z · note A completion-window notification can be lost before the old pass finalizer clears #work.
- [ ] C5. `cland session stop <name>` cancels a waiting launch and ends its line, and a second launch of a waiting name is refused naming the wait (test).
  - failed: rev-35 [reviewer] · 2026-11-08T03:33:06.521Z · note Cancellation joins unrelated work; shutdown joins retries before aborting registered adapters, and fixture retry/observer cleanup is unowned.
- [x] C6. A launch the host agent refuses for the memory floor waits as "waiting for a host" with no session row and no failure notice, and is placed when the host's next memory report is above the floor (test).
  - done: impl-1744 · 2026-11-08T03:26:11.471Z

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
