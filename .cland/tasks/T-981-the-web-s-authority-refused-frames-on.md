---
id: T-981
kind: task
title: "The web's authority: refused frames on the web edge"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
topic: topic-775
branch: t/T-981-the-web-s-authority-refused-frames-on
created: 2026-10-20T16:49:59.999Z
updated: 2026-10-20T20:59:52.260Z
---

## Summary

The cookie carries the human's authority except for the actions that stay in the CLI and Neovim in 0.2.0. The web edge refuses those frames, and any frame with `as`, with a code that names the CLI and Neovim.

## What to build

The dispatcher knows the edge a conversation came from. The edge policy is one table that classifies every human frame in `protocol.ts` as allowed or refused on the web edge; a frame missing from the table is refused (deny by default), and a test fails when a frame lacks a row. Refused in 0.2.0 (Coordinator decision, 2026-10-20): `hub.stop`, `hub.reload`, `release`, `sync`, `push`, `publish`, `config.set`, `crew.set`, `executor.prepare`, `executor.reap`, `executor.retire-legacy`, `task.migrate`, `web.link`, `artifact.create` with a `path`, and any frame that carries `as`. Allowed, for parity with Neovim (§3.5): every other human frame, including `merge`, `suite.*` and `session.resume`. There is no `hub.restart` frame. The refusal code says the action lives in the CLI and Neovim. Check the names against today's `protocol.ts`; a frame there that this list does not name gets a row and is reported in the item topic.

## Acceptance criteria

- [ ] C1. On the web edge every frame the table refuses (`hub.stop`, `hub.reload`, `release`, `sync`, `push`, `publish`, `config.set`, `crew.set`, the three `executor.*` frames, `task.migrate`, `web.link`, `artifact.create` with a `path`) is refused with a code and a message naming the CLI and Neovim, while the same frames still work from a Unix-socket client (test per frame).
- [ ] C2. Any frame that carries `as` is refused on the web edge (test).
- [ ] C3. `topic.send` and `artifact.create` with `content` pass on the web edge and are recorded as the human's (test).
- [ ] C4. The edge policy is one table with a row for every human frame in `protocol.ts`; a frame without a row is refused, and a test fails when a protocol frame has no row.
- [ ] C5. `hub/README.md` lists the refused frames and the deny-by-default rule.

## Comments

### impl-981 · 2026-10-20T20:59:37.863Z

Implementation seams are the acceptance criteria's authenticated web /ws and Unix-socket request boundaries (T2), plus the pure policy boundary and compile-time protocol inventory (T1/T0). The policy will cover ClientRequest, TaskRequest and SessionRequest before replay or actor resolution, denying unknown frames and any own `as` field. Inventory reports executor.status and hook/demo/task-import/artifact/worktree actions as explicit allow rows under the decided remainder policy.

### coord · 2026-10-20T20:59:52.260Z

Refused-frame table amended by the Coordinator, 2026-10-20 21:00Z, after impl-981's protocol inventory found frames newer than the decision: also refused on the web edge in 0.2.0: session.signal, worktree.prune, artifact.delete, suite.forced, task.import and every demo.* frame (they kill processes, delete state, bypass the queue, spend droplet money or import externally). Allowed: executor.status (read-only), artifact.promote, artifact.move, session.bridge, suite.slot and the rest of the human union. Deny by default stays.
