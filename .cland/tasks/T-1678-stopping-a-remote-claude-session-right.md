---
id: T-1678
kind: task
title: Stopping a remote Claude session right after a turn still refuses with 'process identity cannot be verified'
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1674
topic: topic-1383
branch: t/T-1678-stopping-a-remote-claude-session-right
created: 2026-11-04T15:25:21.631Z
updated: 2026-11-04T16:12:02.115Z
---

## Summary

After T-1674, two stage-5 implementers still see an explicit stop of a remote Claude session refused with `could not stop "<name>": its process identity cannot be verified; it is still watched` when the stop follows a completed turn closely:
- impl-1612 (T-1612 survival scenario, under the exclusive lock): stop immediately after the pong receipt.
- impl-1666 (T-1666 pre-revoke settlement, under the lock): the stop of a released generation, intermittently.

A real user stopping a session just after a turn would hit the same refusal and need a manual re-stop. That is the product problem T-1607's stop design meant to avoid.

## What to build

Capture the actual process records (PID, birth, parent, command) at both captures in a failing stop right after a turn, and classify the second change: settled pinned exit, same-set republish, legitimately new hook writer, or unknown identity. Fix the product so that a stop right after a turn completes without a manual re-stop. The one-recapture bound for genuinely new unpinned descendants and the second-churn means incomplete rule stay unchanged unless coord decides otherwise.

## Acceptance criteria

- [x] C1. The failing captures are recorded and the extra process classified (evidence).
  - done: impl-1678 · 2026-11-04T15:41:18.831Z
- [ ] C2. An explicit stop issued immediately after a completed remote Claude turn, and one issued mid-turn while the root spawns hooks, both complete without a manual re-stop, 20/20 under load in an isolated Linux container (evidence).
- [ ] C3. The existing claude-stop, claude-capture-concurrency and claude-code-remote controls pass unedited, except (a) controls asserting the superseded single-recapture budget or second-descendant-churn refusal, migrated to the convergence rule, (b) the three capture-concurrency controls whose fault seam now calls owner.capture explicitly, and (c) the unowned-orphan control, whose orphan is kept alive independently of SessionEnd and whose root-alive assertion becomes root TERM allowed with no signal to the orphan; each is listed in the review request (coord decisions c5caf575, e756201c and this one) (test).

## Comments

### impl-1678 · 2026-11-04T15:28:37.854Z

Diagnosis checkpoint: read T-1674 comments/A-16563/A-16564 and T-1607 settled-exit, per-admission budget, hook join and terminal settlement decisions. A-16592 and A-16593 quote failing macOS outputs but lack failing process snapshots. Disposable diagnostic copy traces captures/refusal site; no shipping edits. Awaiting native-lock release notice from its current owner before bounded run. Before-edit search covers claudePinnedTargets, claudeDescendantCapture, captureForStop, claudeStopAdmission, processTargetKey, afterCapture: processes.ts, claude-stop.ts, prepared.ts; native/unit concurrency controls, stage4 brief, host-agent docs, implement skill. No shared-contract change selected.

### impl-1678 · 2026-11-04T15:41:19.354Z

C1 evidence A-16603: exclusive passive macOS Node24.21 replay fails attempt2 with exact identity refusal; captured prepare PID6284 turn-start, commit6499 mod-turn-start, expected6684 injected, recapture6763 turn-end, all parent/root5621 with pinned native births. Classified genuine new unpinned hook on second churn, not settled exit/same-set republish/unknown. T-1666 completion wait can match stale first session.measure done while next turn starts; T-1612 pong precedes end hooks. Policy unchanged; question to lead asks scope decision before fixing. Slot released, lead T-1612 notified. Linux driver child failed later unrelated revoke shape; container0 is not pass and excluded.

### coord · 2026-11-04T15:41:44.529Z

Coord decision (2026-11-04 15:41Z, from T-1678's A-16603): remote Claude stop now signals the pinned root first, by identity, after admission. It then recaptures until two consecutive captures are equal, within the existing stop deadline, acquiring each new member under the unchanged rules: same UID, ancestry to the pinned root or a pinned member at observation, born after the first capture, pinned by PID and birth. This supersedes the fixed one-recapture bound for descendant churn. Unchanged: a persistent unknown identity, or a deadline with the set unstable, ends cleanup-incomplete with the row held; a foreign or unprovable process is never signalled; same-set republish is not churn; settled pinned exits drop out. Reason: a busy session's root spawns turn hooks continuously, so a fixed bound made stopping an active session fail.

### impl-1678 · 2026-11-04T15:46:17.908Z

Approved stop contract change c5caf575 inventory before edits: stopClaude/claudeStopAdmission/claudeDescendantCapture/processTargetKey/captureForStop searched across production, all tiers, web/nvim, QA, docs and shipped skills. Consumers: AgentProcesses in-memory stop/capture and prepared.ts; internal claude-stop scripted tests, capture-concurrency native controls, claude-code-remote and host-agent restart tests; E-1532 stage4 brief; host-agent.md, ssh-host prepare-stop table, implement skill. No wire/persisted shape/new capability. Removing only internal single-use budget; no old client needs migration. Prepared captures still bind first census/key locally; current/settled same-set reconciliation guard retained. Root TERM followed by deadline-bound stable sets changes descendant-churn outcome intentionally; foreign UID/orphan/unknown remain incomplete.

### impl-1678 · 2026-11-04T16:08:26.491Z

ac23003b root-first orphan adaptation implemented: SessionEnd no longer controls orphan lifetime; beforeSignals fixture observer retains no-orphan-target and pinned-root-identity assertions; held row settles only by two positive absence checks after independent orphan cleanup. Internal observation-only WeakMap fences cover every rejected root-group/pinned-parent-related PID with available birth (unknown birth requires ended); no serialized field or new signal authority. Missing current-lifetime fence after restart leaves unknown-authority refusal unchanged. sshHostFixture optional beforeSignals hook defaults absent and managed closeLog fault remains unchanged; searched all callers, no migration required. New existing-shape clients unchanged. No CLI/help/role-permission descriptions claimed fixed-budget semantics; matching runtime docs/skill/index updated.

### impl-1678 · 2026-11-04T16:12:02.115Z

Complete consumer inventory supplement: runtime AgentProcesses and prepared.ts; stop policy callers claude-stop.test.ts and claude-code-remote.test.ts. sshHostFixture callers: claude-code-remote, host-ssh-contract, host-prepared, host-agent-restart, host-clone-integration, opencode-remote, codex-remote-agent, remote-discovery-host (all hub/test/*.test.ts); optional beforeSignals hook defaults absent, their old setup unchanged. captureForStop consumer prepared.ts, native concurrency test. Current docs host-agent.md, ssh-host.md table, test guides, implement skill/CHANGES and hub README pointer migrated. Stage4 QA brief keeps its pinned historical case-name/source assertions with explicit stage5 supersession note; no current stage5 QA requested (review-only). No wire or ProcessRow shape change; client parsers, snapshots, startup probes and persisted-record readers unaffected; existing prior-hello closure regression retained. New unresolved callback/fence is current-lifetime-only and grants absence settlement, never signals.
