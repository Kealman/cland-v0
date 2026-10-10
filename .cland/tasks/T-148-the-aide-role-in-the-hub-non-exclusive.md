---
id: T-148
kind: task
title: "The Aide role in the hub: non-exclusive role, its exact tools and refusals, routing that keeps Aides out of broadcasts, all, Agents notices, asks and @lead"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-141
topic: topic-69
branch: t/T-148-the-aide-role-in-the-hub-non-exclusive
created: 2026-10-10T05:33:00.073Z
updated: 2026-10-10T09:17:29.347Z
---

## Parent

T-111 (The human's own session), slice 1 of 5. Spec §3.3.

## What to build

The `aide` role: non-exclusive, in `.cland/roles.toml` (`[aide]`, `[aide.launch]` defaulting to Claude Code and the human's model, `[aide.permissions]`) and in `cland init`'s defaults. Its tools are exactly §3.3's list: the tracker in full, `artifact.create` and `artifact.promote`, `send` to any session by name and to topics, `topic.create`, `history`, `who`, `status`. It is refused `ask`, `resolve`, `session.*`, `merge`, `role.handover`, `release`, `sync` and `push`, each naming the rule. Routing keeps an Aide out of role broadcasts, `all`, Agents notices, asks and `@lead` resolution; it receives deliveries addressed to it by name and its role clause only.

## Acceptance criteria

- [ ] `cland session launch aide-1 --role aide` connects; several Aides may run at once.
- [ ] A message to every role, to `all`, an Agents notice and a pending ask never reach an Aide; a message to `aide-1` by name does.
- [ ] An Aide creates and edits an item, and is refused `session.launch`, `merge`, `role.handover`, `resolve` and `ask`, each naming the rule.
- [ ] `@lead T-n` never resolves to an Aide unless it holds the claim (slice 5).
- [ ] List the exact `.cland/roles.toml` lines for this project.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.

## Comments

### impl-148 · 2026-10-10T08:41:16.330Z

Starting slice 1: verify §3.3 against default roles, hub permission gates, named/role/all/Agents/ask delivery, and lead resolution. Instance roles.toml changes will be provided for Coordinator merge.

### impl-148 · 2026-10-10T08:52:09.683Z

Implemented non-exclusive Aide defaults (Claude Code; model omitted so the human's configured default is used), exact §3.3 tools and rule-naming refusals, named addressing, live/offline broadcast exclusion, artifact promotion MCP/CLI access and tracker status edits. Queued crew notices from a previous role are dropped before Aide deliveries. Five new Aide protocol/fake-harness tests and the existing permissions suite pass; typecheck passes. Full npm test is queued on the machine-wide suite lock.

### impl-148 · 2026-10-10T09:14:13.929Z

Committed Aide implementation and init/surface assertion fixes as c3847a0; pushed task branch to origin. First full run finished 950/952 hub cases (fixed init expectation and known T-164 launch-notice race). Fresh init single-case check passes; queued one fresh full npm test per Coordinator instruction. Exact instance roles.toml append block is A-513.

### impl-148 · 2026-10-10T09:17:17.908Z

Fresh full-suite waiter withdrawn (exit 130) per Coordinator's suite ordering instruction at 09:16:50. Will requeue only on Coordinator signal after older waiters have run. Review continues on pushed head c3847a092f10e2a5ebb07ccf25bee16517205eb3; targeted Aide suite passes all 5 cases.

### rev-9 · 2026-10-10T09:17:29.347Z

verdict: review
result: not clear
by: rev-9 [reviewer]
run: rev-2026-10-10-148-1
commit: c3847a092f10e2a5ebb07ccf25bee16517205eb3

Medium — hub/src/hub/store.ts:415: queued broadcasts survive a session's transition to Aide because dropCrewNotices only drops hub-authored messages; a Reviewer disconnected before an `all` send receives that broadcast after assignment/reconnect as Aide, violating §3.3's named-delivery-only boundary. Confirmed with target HubCore and in-memory SQLite; preserve named deliveries while suppressing pending broadcast deliveries and their digest members.

Standards: no actionable findings. Spec: one medium finding. Exact 15-tool allowlist, rule-naming crew refusals, non-exclusive/model-free Claude Code defaults, MCP promotion and A-513's instance block otherwise match this slice. Full npm test remains pending. Review evidence: A-518, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-518-t-148-review-of-c3847a0-queued-broadcasts-cross-the-aide-boundary.md.
