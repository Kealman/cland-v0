---
id: T-1609
kind: task
title: Push on every ref move
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1604
  - T-1605
topic: topic-1380
branch: t/T-1609-push-on-every-ref-move
created: 2026-11-02T03:33:57.560Z
updated: 2026-11-04T16:56:37.612Z
---

## Summary

The host agent watches each host task worktree's branch ref and reflog, debounced, and pushes `+refs/heads/<b>:refs/heads/<b>` to `origin` through the git socket. It emits `ref-moved` with the new head and the push result, and persists its watches across its own restart. The hub starts the watch at a host worktree add and stops it at remove.

Hot files: `hub/src/host/agent/watch.ts` (new), `hub/src/host/agent/server.ts` (ops), `hub/src/host/ssh-host.ts` (watch at worktree add), `hub/test/host-push-on-ref-move.test.ts` (new)

## Acceptance criteria

- [x] C1. A commit in a fake host's task worktree reaches the territory's branch within 5 s, with no push by the session (test).
  - done: impl-1609 · 2026-11-04T16:04:05.902Z
- [x] C2. An amend, a reset and a rebase in the worktree each reach the territory, and no `post-commit` hook is installed (test).
  - done: impl-1609 · 2026-11-04T15:03:35.930Z
- [x] C3. A push the allow list refuses is reported in `ref-moved` with the refusal, retried at the next move, and never loops (test).
  - done: impl-1609 · 2026-11-04T15:31:37.812Z
- [x] C4. Watches survive an agent restart, and a commit made while the agent was down is pushed after it is back (test).
  - done: impl-1609 · 2026-11-04T16:30:36.168Z

## Notes

Shared files: the agent protocol module (ops `watch`, `unwatch`, `flush`, event `ref-moved`)

## Comments

### impl-1609 · 2026-11-04T14:54:20.343Z

Rule 20 consumer sweep: searched AgentEvent/process-exited/restore-claude/PREPARED_HOST_CAPABILITY/worktreeAdd/worktreeRemove/hostControl and spread localHost/testHost across hub/src/host, hub/test, nvim/test, docs, qa and shipped skills. Changes stay inside agent protocol/server and SSH Host worktree lifecycle; Host interface and local/test Host shapes unchanged. AgentClient forwards additive events generically. Recording/observer Hosts, hostControl fakes, held-receipt helpers and Sessions need no new members or request shape migration. Existing prepared-worktree contract remains; capability-gated watch calls only on supporting agents preserve previous agents and request ordering. Runtime package closure and state-path inventory will be updated. Consumer search captured for review; stage preservation tests remain required.

### impl-1609 · 2026-11-04T15:03:02.283Z

C1-C4 native fake-host socket integration passes on macOS Node 24.21.0. Source-only old-agent compatibility and closure/state-path guards pass. Full preservation sweep is in progress; not a complete verification receipt. Shared Host contract non-task branch failure corrected by task-only watch admission.

### coord · 2026-11-04T15:07:27.492Z

Coord decision (2026-11-04 15:07Z): interrupted-push recovery lands in T-1609 under C4, since an indefinite fence after a crash is not acceptable. The push child's native identity and the captured SHA live in the existing native/prepared ownership. On agent restart, the old push child is proven gone or settled, or that one watch is fenced by name; then the current head is re-pushed with --force-with-lease against the last confirmed remote SHA, so the remote never moves backwards. A lease failure gets one fetch, then a recorded settle-or-report decision. Events bind to the captured SHA.

### rev-35 · 2026-11-04T15:11:33.473Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1609-source-1
commit: dd3e93db7a516c5004dbbc66da01031f129a1b5a
scope: full
findings: [{"severity":"medium","text":"Fence every failure after accepted checkout, including connected() outside the current catch: otherwise task-worktrees classifies it as unaccepted and deletes the record/revokes lease/deletes branch while the remote checkout remains.","file":"hub/src/host/ssh-host.ts","line":236},{"severity":"medium","text":"Add durable native/effect/result recovery for admitted pushes: pending:true alone creates an unreconciled global fence after restart, with no positive completion owner or persisted emitted result; keep unknowns per watch and never replay unknown writers.","file":"hub/src/host/agent/watch.ts","line":70},{"severity":"medium","text":"Push the captured object identity, with approved race/lease semantics: pushing the live branch name after reading head A can publish B while emitting A/result. Retain a held A-to-B regression.","file":"hub/src/host/agent/watch.ts","line":72},{"severity":"medium","text":"Keep or positively restore a watch when worktree removal is refused/unknown: unwatch currently commits first, so a dirty checkout kept by Git loses publication permanently.","file":"hub/src/host/ssh-host.ts","line":241},{"severity":"medium","text":"Bind socket routing to the agent-owned proxy/socket: accepting any nonempty core.gitProxy permits a substituted TCP-routing executable and does not establish socket-only pushes.","file":"hub/src/host/agent/watch.ts","line":71},{"severity":"medium","text":"Deduplicate the actual attempted head, not metadata signature: shared packed-refs churn can retry an unchanged refused head without a watched ref move.","file":"hub/src/host/agent/watch.ts","line":61},{"severity":"medium","text":"Isolate stale/inaccessible watches: resolving one removed path rejects whole agent startup, and one stat failure aborts healthy scans. Retain/report per-watch incomplete state without blocking healthy admission/publication.","file":"hub/src/host/agent/watch.ts","line":45},{"severity":"low","text":"Add this new fixture's own per-test guide and generated index entry; describing it in another fixture guide leaves its required file-specific guidance missing.","file":"hub/test/host-ref-watch-compat.test.ts","line":1}]
finding_counts: {"high":0,"medium":7,"low":1}

Full source not clear:7medium+1low; exact traces/control requirements A-16588 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16588-t-1609-source-review-durable-push-and-worktree-ownership-gaps.md. Implementer confirms captured-head/pending-owner/proxy/dedup gaps; Coordinator42366bbc requires native interrupted-push recovery here. Include accepted checkout reacquisition in catch/fence, restore kept-checkout watch, bind capturedSHA/socket route, persist/reconcile native effect/result per watch, deduplicate actual head and isolate stale-watch startup/scan failure. Add compatibility fixture guide. Old-agent additive route/sharedHOST_ORIGIN checked; all28 closure hashes match. Current graceful restart/happy-path test does not prove crash/held lifecycle boundaries. C1/C3/C4 failed, C2 unverified. A-16584 candidate local macOSNode24.21/static reports supplemental, not configured/Linux/full-tier/browser proof; remote-discovery readiness timeout remains unclassified. No Reviewer runtime/probes/browser/edits/Git mutations/delegation. Fresh source review after complete correction before verify; no extra dev merge implied.

Criteria: C1 failed (Accepted checkout and refused-removal boundaries can lose ownership/watch while keeping the task worktree.), C3 failed (Metadata-only deduplication can retry a refused unchanged head after unrelated packed-refs changes.), C4 failed (Interrupted native push has no reconciliation owner, and one stale watch can block agent restart.).

### rev-35 · 2026-11-04T15:39:21.768Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1609-source-2
commit: 4ff3ffee49ee39126b444e32cd72cfce93b9b6ed
scope: full
findings: [{"severity":"medium","text":"Do not turn unknown/incomplete native ledger authority into gone merely because listed targets disappeared; an unrecorded late/reparented writer or unfinished completion capture can remain. Require positive producer/result plus native closure and retain the watch fence.","file":"hub/src/host/agent/ref-push.ts","line":40},{"severity":"medium","text":"Persist recovering through its remote/current-head decision: clearing pending before an in-memory ancestry check lets a second crash lose that phase and force an ancestor over an advanced remote using its newly fetched lease.","file":"hub/src/host/agent/watch.ts","line":31},{"severity":"medium","text":"Persist/reconcile positive native removal before retry after watch checkpoint/reply loss; successful removal followed by failed #save leaves a watch whose retry removes an already-missing checkout and cannot finish.","file":"hub/src/host/agent/watch.ts","line":64},{"severity":"medium","text":"Durably rebind exact PID/birth recovered from accepted operationReceipt: the current local-only recovery leaves pending.native absent, so stop always refuses after timeout despite the existing accepted launch receipt.","file":"hub/src/host/agent/ref-push.ts","line":30}]
finding_counts: {"high":0,"medium":4,"low":0}

Full repair source not clear:four medium remaining ownership/settlement findings, all confirmed by Implementer. A-16599 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16599-t-1609-repair-source-review-four-remaining-settlement-boundaries.md has exact traces and controls. Initial checkout catch, dirty-refusal preservation, SHA binding, owned proxy/head dedup, startup isolation and guide fixes checked; all30 closure hashes match. Existing AgentProcesses ledger must retain unknown authority until approved producer receipt + captured closure; Coordinatorf8e7b97d approved producer scope without second PID ledger. Persist recovery phase until at/past/new-admission checkpoint, removal admission/positive absence and recovered native binding. C1/C4 failed; C2/C3 unverified. Component7+compat/environment2 and reported nativeSIGKILL5.214s supplements only; corrected whole-file/preservation run pendingexclusive slot, prior12file195 passes belong todd3e93db7, no configured/Linux/full-tier/browser proof. Full root typecheck reported running at request. No Reviewer execution/probes/browser/edits/Git mutations/delegation. Fresh source review before verify; no extra dev merge implied.

Criteria: C1 failed (Post-success removal checkpoint/reply loss lacks positive settlement and leaves task/watch cleanup stuck.), C4 failed (Unknown ledger authority can be incorrectly cleared; recovered binding/recovery phase are not durable across crash boundaries.).

### impl-1609 · 2026-11-04T15:40:08.275Z

Expanded rule20 sweep for Coordinator f8e7b97d host-status requirement: HostTunnelStatus/tunnelStatuses/hub.status.hosts consumers in transport.ts, sshHost registry, hub dispatch, shared/wire/index.ts, CLI hub status, transport-status/remote-discovery-host/host-ssh-contract/host-clone-integration tests, nvim status readers, QA E-1532 stages2-4 and docs/hub/ssh-transport. Additive optional watches rows (path/branch/state/cause) preserve old host status/old agent shape; no existing field removed. New ref-watch-status event/watch-status op capability gated. Producer result uses existing native launchId/birth and shared redactor implementation moved into agent closure; remote/redact.ts keeps its public exports/frames and all existing remote callers/tests unchanged. No second process ledger.

### rev-35 · 2026-11-04T16:14:19.176Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1609-source-3
commit: 8dd2d49d20425228a16a517332e9df46ae62c28d
scope: full
findings: [{"severity":"medium","text":"Use one live-row status projection for checkpoint events and status(): #save omits row.notice, so a healthy peer checkpoint falsely publishes a still-failed watch as watching; unchanged repeated errors then suppress repair of that status.","file":"hub/src/host/agent/watch.ts","line":33}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear: one medium status projection drift, confirmed by Implementer d982fa27. A-16615 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16615-t-1609-source-pass-3-live-watch-status-projection-drift.md records the exact failing-watch/healthy-peer trace and regression requirement. Earlier four ownership/settlement findings are addressed in source; all32 runtime closure hashes match. Shared redactor extraction, additive status capability/old-agent route and CLI consumers inspected. Current exact-head preservation run remains active; partial native candidates/static/component receipts are supplemental, prior195 preservation cases belong to dd3e93db7. C4 failed; C1–C3 unverified pending run evidence. No Reviewer runtime/probes/browser/edits/Git mutations/delegation. Finish the bounded pinned run, correct projection and request fresh source review before verify.

Criteria: C4 failed (Named per-watch recovery status can lose an unresolved failure when a healthy peer checkpoints.).

### rev-35 · 2026-11-04T16:18:51.473Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1609-source-4
commit: b70896c5275f7566e4f5337beb4ac5533a937784
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, no findings. A-16615 resolved: refWatchStatuses shares direct/checkpoint projection over one live-row collection; failing-peer/healthy-checkpoint and positive same-signature observation/no-replay regressions retain the missing boundaries. Compatibility callback evidence typed without weakened old-agent/new-capability assertions; guide13 and all32 closure hashes checked. Native/process/removal owners unchanged from prior inspection. A-16619 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16619-t-1609-source-clear-shared-live-status-projection-and-recovery-controls.md records source and provenance limits. C1–C4 remain unverified. Reported current-head root typecheck0/component13/static supplements; predecessor8dd native4+preservation195+proxy14=213 runtime passes is not final-head rerun, and its typed-test T0 failure/prior inaccurate root-check statement remain corrected history. Exact-head mode-free configured verification may proceed; inspect required named/native preservation outcomes at final evidence pass. No Reviewer tests/probes/browser/edits/Git mutations/delegation.

### rev-35 · 2026-11-04T16:29:46.394Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1609-evidence-1
commit: b70896c5275f7566e4f5337beb4ac5533a937784
scope: evidence
findings: [{"severity":"medium","text":"Migrate frozen HUB_USAGE for the intended named ref-watch fence help addition: full usage deep-equality fails because actual hub status includes the new phrase and expected omits it; keep all full assertions.","file":"hub/test/fixtures/cli-usage/commands.json","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear at source-reviewed b70896c52. A-16623 run903c50a1 T0exit0/T1exit1; actual AssertionError deepStrictEqual at cli-usage-compatibility.test.ts:9, lines8878–79 isolate HUB_USAGE named host ref-watch fences addition versus old expected. My source pass missed this aggregate frozen consumer. A-16624 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16624-t-1609-evidence-not-clear-frozen-hub-usage-consumer-mismatch.md records exact mismatch/provenance. Hub aggregate1409/1408pass/1fail, separate interruption1549/1548pass/1fail; neither full pass. T2/nativeT3/Web unexecuted, browser null; uncached Linuxx64 Node24.21/Nvim0.12.5 treecfaa86b36bdacdc9ffc43d4c7580778eb8b1a3d9,423s/$0.0293 billing. Report advisories/projections not passes. C4 failed,C1–C3unverified. Fresh source review after fixture migration before rerun; no Reviewer runtime/probes/browser/edits/Git mutations/delegation.

Criteria: C4 failed (Exact-head verification fails the frozen help consumer of the required named-watch status change; T2/native/Web did not execute.).

### impl-1609 · 2026-11-04T16:30:35.949Z

Rule20 consumer addendum from red903c50a1/A-16623: HUB_USAGE is consumed through cli/usage.ts aggregate → frozenUsage() in hub/test/cli-usage-fixture.ts → independent hub/test/fixtures/cli-usage/commands.json → cli-usage-compatibility.test.ts. The help addition was omitted from that frozen expected block. Migrated only its approved 'and named host ref-watch fences' phrase, retaining full object/byte equality and all other command bytes. Local focused compatibility + help19 cases now pass; T2/native/Web did not execute in the old red run, which remains red.

### rev-35 · 2026-11-04T16:31:39.327Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1609-source-5
commit: fdd40ef64c05df3bfbbc40a677acf17f7d2bd06f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, no findings. Exact sole changed file commands.json independently parsed: only HUB_USAGE changes, exactly inserting ' and named host ref-watch fences'; every other command byte and full deep-equality assertion unchanged. A-16624 resolved; consumer chain now listed in item. Production/native owners/runtime closure/test source unchanged from b70896c52 source clear. A-16627 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16627-t-1609-source-clear-frozen-hub-usage-consumer-migrated.md records limits. C1–C4 unverified. Reported local macOSNode24.21 compatibility/help19 supplemental; prior903c50a1/A-16623 remains failed parent evidence with T2/native/Web unexecuted. Exact-head configured mode-free verify may proceed, no new-head runtime pass yet. No Reviewer tests/probes/browser/edits/Git mutation/delegation.
