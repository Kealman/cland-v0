---
id: T-149
kind: task
title: "The brief at launch: session.launch and the CLI take a brief (text or artifact), delivered once after the role clause on all three adapters, never again on reconnect"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-141
topic: topic-68
branch: t/T-149-the-brief-at-launch-session-launch-and
created: 2026-10-10T05:33:00.327Z
updated: 2026-10-10T09:24:51.636Z
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
