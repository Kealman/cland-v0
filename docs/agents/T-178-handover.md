# T-178: scoped Lead permissions

The shipped role defaults grant a Lead `session.launch`, `session.stop` and `merge` within its live claimed subtree. Reviewer and QA launches accept `item`, bind the process to its worktree, and leave the Implementer claim intact. Review/QA request lines identify the item whose subtree admission is checked. Stops check all current open claims and verifier holds, falling back to the launch item for a session with no holds. Launch admission also reaches the native adapter process creation and first-turn boundaries, before any clause or brief starts work after scope loss. Merge uses the existing verdict/criteria gate and rechecks admission during preparation and before landing. The Coordinator retains releases, sync, push, unscheduled merges and Lead launches.

`cland update` preserves existing `.cland/roles.toml`. Apply these exact line replacements in that file after landing; line numbers below identify the instance at the start of T-178, while stanza and original text identify the edit if concurrent work moves them. Leave project-specific launch models unchanged.

- In `[lead.permissions]` (line 186), replace its tools line with:

```toml
tools = ["send:agents", "session.launch", "session.stop", "merge", "artifact.create", "artifact.keep", "artifact.move", "artifact.archive", "subscribe", "unsubscribe", "subscriptions", "who", "history", "status", "task.view", "task.list"]
```

- In `[lead]` clause (line 177), replace `- Node planning, session management, merges and handover permissions arrive with the later hierarchy slices; report requests for those operations to the Coordinator for now.` with these four exact lines:

```text
- Launch Implementers, Reviewers and QA for an item in your subtree with `session.launch` and `item`; stop sessions only when all their current work stays in your subtree, using `cland session stop` from your shell. Reviewers and QA launch without taking the item's Implementer claim.
- Request review and QA in the item's topic with `send` kind `report`, first line `review request T-<n>` or `qa request T-<n>`, naming the branch/head, criteria and scope, and the committed QA brief when applicable. Reuse the existing verifier pool when available.
- Merge your scheduled items on their `ready` event through `merge` and the same verdict gate. The Coordinator keeps releases, sync, push, unscheduled merges and the launch of Leads. A refusal names your node's level and subtree; report a request beyond it to `lead T-<n>` for your node.
- Node planning and handover permissions arrive with later hierarchy slices; report those requests to the Coordinator for now.
```

- In `[implementer]` clause, replace its commit/push line with:

```text
- Commit on your task branch and push to the local territory (`origin`); task work reaches `dev` through the supervising Lead's or Coordinator's `merge` gate.
```

- In `[reviewer]` clause, replace its request line with:

```text
- A request is a hub message from the item’s lead (the live claimant in `task.view`), a supervising Lead within its subtree, or the Coordinator, in the Agents topic or a topic bound to the item. Its first line is `review request T-<n>`; the rest names what to review (a branch, commits or a diff) and what to check.
```

- In `[qa]` clause, replace its request line with:

```text
- A request is a hub message from the item’s lead (the live claimant in `task.view`), a supervising Lead within its subtree, or the Coordinator, in the Agents topic or a topic bound to the item. Its first line is `qa request T-<n>`; the rest names the brief, `qa/briefs/T-<n>.md`, and the branch or build. The brief is the whole job: follow the `qa` skill.
```

Roles reload for later calls; reconnect or reassign running sessions to deliver refreshed clauses. Protocol coverage is in `hub/test/lead-permissions.test.ts`, including the `lead-1` gated merge demo, cross-epic refusals and reparenting during real Git preparation. No Neovim surface changes in this slice.
