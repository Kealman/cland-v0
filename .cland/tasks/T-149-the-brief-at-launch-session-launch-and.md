---
id: T-149
kind: task
title: "The brief at launch: session.launch and the CLI take a brief (text or
  artifact), delivered once after the role clause on all three adapters, never
  again on reconnect"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-111
blocked_by:
  - T-141
topic: topic-68
branch: t/T-149-the-brief-at-launch-session-launch-and
created: 2026-10-10T05:33:00.327Z
updated: 2026-10-10T10:28:45.580Z
closed: 2026-10-10T10:28:45.596Z
---

## Parent

T-111 (The human's own session), slice 2 of 5. Map T-81, "Settled while charting" (a brief at launch).

## What to build

`session.launch` and `cland session launch` take a brief: text, or an artifact id `A-<n>` whose content is read at launch. The hub delivers it once, right after the role clause and before the session's first turn, through the ordinary queue and stages, on Claude Code, Codex and OpenCode. It is never delivered again on reconnect or hub restart; the journal records it like a message.

## Acceptance criteria

- [ ] An Implementer launched with a brief starts on it with no other message, on each of the three fake harnesses; the brief arrives after the clause.
- [ ] A reconnect or a hub restart does not redeliver the brief; a test proves both.
- [ ] A brief naming an artifact delivers that artifact's content; an unknown artifact is refused at launch.
- [ ] The brief does not race the hub's welcome (the T-106 concern).
- [ ] `hub/README.md` documents the brief.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.

## Comments

### impl-149 · 2026-10-10T08:41:19.109Z

Beginning implementation: launch brief text/artifact resolution, one-time role-then-brief delivery through the existing queue, native adapter and reconnect/restart coverage.

### impl-149 · 2026-10-10T08:54:10.601Z

Implemented text/artifact briefs and --brief. Coordinator clarified that the first native input must bundle clause then brief on all three harnesses; Claude Code/OpenCode now bind the initial clause to the ordinary brief delivery digest, with independent records/stages. Targeted native cases, artifact/CLI cases and early-hello/reconnect/restart checks pass; typecheck passes. Running code-review skill and full suite next.

### rev-67 · 2026-10-10T09:24:51.636Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-149-1
commit: 5d8a3cf628b344b98f40bf50a6054b40a6e3d14a

Medium — hub/src/adapters/sessions.ts:147: brief stays only in #firstHello RAM until first hello; successful running-row acceptance followed by hub restart before hello loses the brief entirely instead of retaining the ordinary queued delivery.
Medium — hub/src/adapters/sessions.ts:535: with an already-assigned Implementer role omitted from optional launch role, Codex spawn receives neither clause nor brief; first hello queues them in a second input, violating the first-native-input decision.

Standards: clear, 0 findings. Spec: not clear, 2 medium findings. Root and independent Spec reviewer reproduced both using Node24 memory probes against pinned git modules. Ordinary carried/noncarried ordering, stages, post-delivery reconnect/restart, pre-spawn validation and stale-clause retry probes passed. T-141 ownership checks remain unchanged. No edits or full suite repeat.
Evidence: A-526, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-526-t-149-review-at-5d8a3cf-first-launch-persistence-and-input-gaps.md.

### impl-149 · 2026-10-10T09:36:27.934Z

Pushed f5f8e7357094f544b4e60174d3eab075bf87672e fixing both rev-67 medium findings: durable first-input queue before hello/restart, and effective preassigned role for all native adapters. Failed-spawn notes restored; stage transitions journalled. Frame 5/5, native 6/6, admission 15/15, typecheck clear; self-reviews clear. Full suite cancelled for T-164 per Coordinator; rebase/rerun pending.

### rev-67 · 2026-10-10T09:42:23.895Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-149-2
commit: f5f8e7357094f544b4e60174d3eab075bf87672e

Medium — hub/src/adapters/sessions.ts:569: brief cancellation failure escapes before owned-process cleanup; after watch refusal a Store cancellation fault yields zero stops, zero pending receipts, a running row and retained Implementer role, breaching the existing T-141 supervision contract.
Medium — hub/src/adapters/sessions.ts:528: pre-spawn brief recording is outside the cancellation handler; post-commit send logger failure refuses launch but leaves its brief queued, so a successful same-name retry starts on the refused brief before the requested one.
Medium — hub/src/hub/core.ts:597: early carried Codex hello marks the brief injected before native turn acceptance; first-turn refusal leaves false injected and send/acked/injected journal records instead of cancelling unaccepted work.

Both original A-526 findings are fixed. Standards: 1 grouped medium finding; Spec: 2 medium findings, one overlaps Standards; three distinct correction points above. Root independently reproduced all failures against pinned f5f8e73; prior ordinary and original-fix probes pass. Existing native Codex fake supports the early-hello/refused-first-turn timing. The stage issue concerns brief completion, not T-141 launch-grant trust policy. No edits or suite repeat; full-suite rebase/rerun remains separately pending.
Evidence: A-538, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-538-t-149-review-at-f5f8e73-launch-failure-settlement-gaps.md.

### impl-149 · 2026-10-10T09:58:40.307Z

A-538 final-round fixes are implemented and rebased onto dev 10e25ba (T-164 included). Brief ownership is now the launch credential, cleanup settles it through the guarded receipt after stopping the owned process, and Codex injection waits for accepted native first input. The three regression probes fail on the previous production code and pass here; both local standards/spec reviews are clear. Typecheck, 59 launch ownership cases, 21 admission/serialization cases, 7 brief cases, and 7 native launch/refusal cases pass. Completing the full launch file before committing/pushing; full suite will then be queued.

### rev-67 · 2026-10-10T10:03:12.929Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-149-3
commit: cecef34a2b13a572ed0bdc7c4088c07da9489815

Standards: clear, 0 findings. Spec: clear, 0 findings. No high or medium finding remains within the Coordinator’s final-round scope.

A-526 and all three A-538 findings are resolved: launch-credential ownership prevents refused briefs reaching a same-name retry; recording is guarded; owned stop/rollback precede cancellation and a cancellation fault retains the cleanup receipt; early Codex hello leaves the brief queued until accepted native first input. T-141 launch ownership and T-164 lifecycle notices are preserved.

Root independently verified the three regressions, ordinary order/stages/reconnect/restart, both original corrections and credential-matching recovery using pinned Node24 in-memory production modules. Both independent review axes are clear. No new unresolved storage-fault-only T-129 finding. A-550 targeted/typecheck evidence reviewed; full npm test remains separately queued and is not claimed passed. No edits or suite repeat.
Evidence: A-551, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-551-t-149-final-review-at-cecef34-clear.md.

### impl-149 · 2026-10-10T10:28:35.268Z

Handover at pushed cecef34a2b13a572ed0bdc7c4088c07da9489815, clean worktree, rebased dev 10e25ba including T-164. Final formal review clear: rev-67-149-3 / A-551, both axes 0 findings. Typecheck and targeted regressions pass. Required npm test exit 0: hub 967/967, Neovim 214/214, total 1181, zero failures/cancelled/skipped/todo; suite 963.82s, lock wait 729.07s. Both earlier lifecycle and handover cases pass. Evidence A-564 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-564-t-149-handover-review-and-full-suite-clear-at-cecef34.md. No roles.toml changes; ready for Coordinator merge gate.

### coord · 2026-10-10T10:28:45.580Z

Merged f8b9bc92ed31268a3164ecdbe7c7751f1a8c62a9 onto dev.
