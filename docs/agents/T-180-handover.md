# T-180: hand over a Lead node

A Lead calls `role.handover {to, note, then?}` to move its live container claim and four-section note to a known session with no item claim. Other Leads keep their nodes and notes. The claim retains its original time; default subscriptions and `@lead T-n` routing follow the successor, and pending question endpoints move with the role. Explicit subscriptions remain with their creators. The previous holder receives its revocation, or the Implementer clause with `then: "implementer"`.

The hub stores each Lead's note and handover under its node, using stable session identities for reconnects and renames. A committed transfer is replayed after a crash before tracker settlement. `role.state` on a Lead returns only that holder's node, claim, note and waiting topics; the UI frame names `session` when several Leads exist. The human may move a specific node with `cland role set next lead --item T-n --note-file note.md` or `--move`. An unseen human-selected successor takes the provisional `name:next` claim immediately and adopts its real session id at hello.

`cland update` preserves project roles. Apply these two exact edits to `.cland/roles.toml`; line numbers identify T-180's starting file and stanza/text identifies them after concurrent edits. Keep project launch settings unchanged.

At line 183 in `[lead]`'s clause, replace:

```text
- Set and show the plan on your claimed epic with task.plan. Handover requests still go to the Coordinator until their hierarchy slice grants that operation.
```

with:

```text
- Set and show the plan on your claimed epic with task.plan. To pass your node on, use `role.handover` with a known, unclaimed receiver and a four-section note drafted by the `handover` skill. The node claim and default subscriptions follow the note. After revocation, stop acting as Lead.
```

At line 192 in `[lead.permissions]`, replace:

```toml
tools = ["task.plan:show", "task.plan:set", "ask.forward", "ask.answer", "send:agents", "session.launch", "session.stop", "merge", "artifact.create", "artifact.keep", "artifact.move", "artifact.archive", "subscribe", "unsubscribe", "subscriptions", "who", "history", "status", "task.view", "task.list"]
```

with:

```toml
tools = ["role.handover", "task.plan:show", "task.plan:set", "ask.forward", "ask.answer", "send:agents", "session.launch", "session.stop", "merge", "artifact.create", "artifact.keep", "artifact.move", "artifact.archive", "subscribe", "unsubscribe", "subscriptions", "who", "history", "status", "task.view", "task.list"]
```

The same grant and clause ship in `hub/src/roles/default-roles.ts`; the built-in permission table grants Lead handover. Reconnect or reassign an existing Lead to deliver its new clause. The updated `.agents/skills/handover/SKILL.md` drafts a node-scoped note and asks the Coordinator for a fresh receiver when needed.

Protocol coverage is in `hub/test/lead-handover.test.ts`: the fake-harness demo sends the next verdict to `lead-2`, independent node notes survive reconnect, and a committed move recovers after a hub crash. This slice changes no Neovim UI.
