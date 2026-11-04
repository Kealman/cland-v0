---
id: T-1609
kind: task
title: Push on every ref move
state: open
status: in progress
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
updated: 2026-11-04T15:11:33.473Z
---

## Summary

The host agent watches each host task worktree's branch ref and reflog, debounced, and pushes `+refs/heads/<b>:refs/heads/<b>` to `origin` through the git socket. It emits `ref-moved` with the new head and the push result, and persists its watches across its own restart. The hub starts the watch at a host worktree add and stops it at remove.

Hot files: `hub/src/host/agent/watch.ts` (new), `hub/src/host/agent/server.ts` (ops), `hub/src/host/ssh-host.ts` (watch at worktree add), `hub/test/host-push-on-ref-move.test.ts` (new)

## Acceptance criteria

- [ ] C1. A commit in a fake host's task worktree reaches the territory's branch within 5 s, with no push by the session (test).
  - failed: rev-35 [reviewer] · 2026-11-04T15:11:33.473Z · note Accepted checkout and refused-removal boundaries can lose ownership/watch while keeping the task worktree.
- [x] C2. An amend, a reset and a rebase in the worktree each reach the territory, and no `post-commit` hook is installed (test).
  - done: impl-1609 · 2026-11-04T15:03:35.930Z
- [ ] C3. A push the allow list refuses is reported in `ref-moved` with the refusal, retried at the next move, and never loops (test).
  - failed: rev-35 [reviewer] · 2026-11-04T15:11:33.473Z · note Metadata-only deduplication can retry a refused unchanged head after unrelated packed-refs changes.
- [ ] C4. Watches survive an agent restart, and a commit made while the agent was down is pushed after it is back (test).
  - failed: rev-35 [reviewer] · 2026-11-04T15:11:33.473Z · note Interrupted native push has no reconciliation owner, and one stale watch can block agent restart.

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
