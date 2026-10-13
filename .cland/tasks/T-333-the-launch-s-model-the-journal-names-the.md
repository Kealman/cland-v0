---
id: T-333
kind: task
title: "The launch's model: the journal names the model of every launch where the harness reports it, the first turn's model when the launch named none, and each sub-agent's model or unknown"
state: open
status: backlog
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by: []
topic: null
branch: null
created: 2026-10-13T14:04:09.762Z
updated: 2026-10-13T14:04:17.153Z
---

## Summary

The launch record names the model of every launch, never empty when the harness knows it. When a launch names no model, the hub records the model the harness reports on its first turn. A sub-agent's start is recorded with its model where the harness reports one, and as unknown otherwise.

## Parent

E-270: Status, fields and instrumentation. Spec: `docs/spec/v0.1.2.md` §3.12 (the model of every launch, sub-agents included, in the launch record). Decided in T-255. Research: `docs/research/model-performance.md` on `research/model-performance`, section 7 (the gaps).

## What to build

**The launch record.** `session-launched` in `hub/src/adapters/sessions.ts` already carries `model`.

- Codex and OpenCode choose the model at launch: `thread/start` answers it (`hub/src/adapters/codex.ts`), and the OpenCode adapter picks one (`hub/src/adapters/opencode.ts`). A test pins that their launch record names it when the launch named none.
- Claude Code launched without `--model` leaves it null. The adapter learns the model later, from the `session-start` hook payload or the mod's `turn.complete` usage (`interpret` in `hub/src/adapters/claude-code.ts`). `signal` in `sessions.ts` already updates the process row when it does.

**The model record.** When the process row learns a model that its launch record did not name, the hub writes one `session-model` journal line.

- Its fields: the session, its id, the harness, the role, the item, the model and `source: "harness"`.
- One line per launch, at the first report. A later change of model writes another line. A report equal to the recorded model writes nothing.
- A resume or relaunch is a new launch record with its own model, and the rule applies to it again.
- Add `session-model` to `JOURNALLED` in `hub/src/hub/journal.ts`.

**Sub-agents.** Claude Code reports a sub-agent's start and stop through its `SubagentStart` and `SubagentStop` hooks.

- Add both to `HOOK_EVENTS` in `claude-code.ts`, so `cland init` and `cland update` merge them into `.claude/settings.json` (`hub/src/init/claude-settings.ts`) and the launch settings carry them. The hooks stay `async`.
- `interpret` turns a start into a sub-agent meaning. The hub writes a `subagent-launched` journal line: the parent session, its id, role and item, the harness, the agent's type and id where the payload has them, and the model where the payload carries one, else `"unknown"`.
- Codex and OpenCode: check each harness's protocol for a sub-agent signal (the Codex app-server notifications, OpenCode child sessions). Where one exists, write the same record. Where none exists, write nothing, and `hub/README.md` says which harnesses report sub-agents.
- Add `subagent-launched` to `JOURNALLED`.

**The fakes.** `hub/test/fakes/claude-code/fake-claude.ts` reports a model on its first turn when launched without one, and fires `SubagentStart` with and without a model on a prompt that asks for it. The Codex and OpenCode fakes gain a sub-agent signal only where the real harness has one.

**Docs.** `hub/README.md`'s journal section names `session-model` and `subagent-launched` with their fields, and which harnesses report what.

**Demo** (the epic's words). A fake Claude launch with no model journals the model of its first turn.

**Out of scope.** The verdict scope (T-332). Usage records (T-334). The account on each session (E-272). Choosing or rotating models (§3.12 leaves rotation out of this build). The process row's `model`, which keeps working as today.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second, launched through `session.launch`.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291). The records are read back with `cland hub journal --kind session-launched,session-model,subagent-launched --json`.
- Any recompute driven by hub events is coalesced once per tick (T-293), with no synchronous full tracker hydration per event (the T-321 lesson). The model record reads the process row and the session's role and launch item, never the tracker.
- Any panel test waits on state, never on a sleep. Every key goes through the action registry. This ticket adds neither.
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25). Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A fake Claude session launched without a model journals `session-launched` with a null model, then one `session-model` with the model of its first turn. A second turn with the same model writes nothing.
- [ ] C2. A fake Claude session launched with `--model` writes no `session-model` line while the harness reports the same model.
- [ ] C3. Fake Codex and OpenCode sessions launched without a model journal `session-launched` naming the chosen model.
- [ ] C4. A fake Claude sub-agent start with a model journals `subagent-launched` naming it. One without a model journals `"unknown"`. Both name the parent session, role and item.
- [ ] C5. A relaunch writes its own launch record and, when needed, its own `session-model` line.
- [ ] C6. `cland init` and `cland update` merge the two new hooks into `.claude/settings.json` and keep the user's own hooks (`hub/test/init.test.ts`).
- [ ] C7. `hub/README.md`'s journal section describes `session-model` and `subagent-launched` and names which harnesses report sub-agents.
