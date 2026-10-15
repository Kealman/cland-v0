---
id: T-459
kind: task
title: "Demos on a droplet: cland demo start, exec and stop lease a droplet for an epic's QA demo at a named dev commit, and the hub accepts the demo's verdict while dev moves on files outside the epic's surfaces"
state: open
status: in progress
size: L
labels:
  - v0.1.3
  - hub
  - docs
assignee: null
parent: E-423
blocked_by:
  - T-335
topic: topic-296
branch: t/T-459-demos-on-a-droplet-cland-demo-start-exec
created: 2026-10-15T07:15:15.838Z
updated: 2026-10-15T13:20:56.747Z
---

## Summary

Epic demos freeze `dev` today, because QA runs them in the root at the `dev` tip and reports BLOCKED when `dev` moves. This ticket gives QA a hub-held demo lease: a droplet acquired within `remote_budget` and the daily cap, with the demo commit delivered and prepared as for a suite run, Neovim included. Commands run on the droplet through `cland demo exec`. The hub then accepts an epic verdict whose commit is behind the tip when the later commits touch none of the epic's surfaces, using the surfaces T-335 reads from the `Item:` trailers.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 7 of 7; spec `docs/spec/v0.1.3.md` §3.4 ("Demos off dev"), `docs/spec/v0.1.2.md` §3.14 (the remote executor); the epic's choices "The demo lease" and "Fresh demo verdicts". Builds on E-271 (Remote executors) and T-347 (the remote budget).

## What to build

**The lease (`hub/src/executor/droplet/lease.ts`, `droplet.ts`, `prepare.ts`, `spend.ts`).** A demo lease is a third holder of droplet capacity, beside verification and E-387's sharded close runs.

- `cland demo start <epic> [--commit <sha>]` asks the hub for a droplet for the epic. The commit defaults to the `dev` tip.
- The hub acquires the droplet within `remote_budget` and the daily cap, delivers the commit and prepares it as for a suite run, Neovim included.
- It answers with the lease id, the commit and the droplet's lifetime.
- When no remote slot or budget is left, the command says so with the reason and exits non-zero. QA then runs the demo locally at the same commit.
- `cland demo exec <epic> -- <command…>` runs one command on the droplet as the ordinary user, in the delivered tree, and returns its stdout, stderr and exit code. `cland --headless --qa <case.lua>` runs there the same way.
- `cland demo stop <epic>` releases the droplet.
- The lease also ends at the epic's verdict or at its lifetime (`lifetime` of the remote executor), whichever comes first, through the existing watchdog.
- The droplet's create, its destroy and its cost each post on the epic as a comment.
- Callers: QA holding the epic's hold, the Coordinator and the human. Any other session is refused with `forbidden`.
- The DigitalOcean token is never stored. Sessions never call the provider.
- Frames: `demo.start`, `demo.exec`, `demo.stop` and `demo.status`, plus `hub/src/cli/demo.ts` and its entry in `usage.ts`.

**Fresh demo verdicts (`hub/src/tracker/gate-verdicts.ts`, `freshness.ts`).**

- An epic's QA verdict names its commit.
- The hub accepts it when that commit is on `dev` and every commit after it on `dev` touches none of the epic's surfaces. The surfaces are the files changed by the merges of the epic's tickets, read from `Item:` trailers through the helper T-335 adds for the merge hold.
- A later commit that touches a surface makes the verdict stale. The refusal names the commit and the files.

**The `qa` skill (`.agents/skills/qa/`).**

- The recorder runs each case of an epic demo through `cland demo exec`. Cases that need macOS run locally at the same commit, and the verdict says which ran where.
- The re-check of `dev` after the cases applies the freshness rule above instead of reporting BLOCKED on any move.
- The verdict's evidence names the executor, the commit, the lifetime and the cost.
- When `demo start` reports no slot or budget, the skill runs the demo locally, and the T-335 hold stays in force.

**Tests** run against E-271's fake DigitalOcean API and fake machine (`hub/test/fakes/digitalocean/`). A real droplet is QA's check and never part of `npm test`.

## Acceptance criteria

- [ ] C1. `cland demo start <epic>` against the fake DigitalOcean API acquires a droplet within `remote_budget` and the daily cap, delivers the `dev` tip (or `--commit`), prepares it with Neovim, and reports the lease, commit and lifetime.
- [ ] C2. `cland demo exec <epic> -- <cmd>` returns the command's output and exit code from the delivered tree as the ordinary user, and a `cland --headless --qa` case runs there the same way.
- [ ] C3. `cland demo stop`, the epic's verdict and the lease lifetime each release the droplet, and the create, destroy and cost are posted on the epic.
- [ ] C4. With no slot or budget left, `demo start` refuses with the reason and starts nothing, and a session other than QA, the Coordinator or the human is refused with `forbidden`.
- [ ] C5. The hub accepts an epic verdict at a commit behind the `dev` tip when the later commits touch no file the epic's merges changed, and refuses it naming the commit and files when one does.
- [ ] C6. The `qa` skill runs epic cases through `cland demo exec`, runs macOS cases locally at the same commit, applies the freshness rule after the cases, and names executor, commit, lifetime and cost in the evidence.
- [ ] C7. `hub/README.md` describes the demo lease, its commands, budget sharing and the freshness rule.

## Comments

### impl-459 · 2026-10-15T13:20:56.747Z

Read task, E-423 choices, release spec §3.4 and safety constraints. Implementing demo leases on existing DropletExecutor lifecycle/watchdog/budget, plus epic QA freshness and recorder/docs. Tests will use fake DO/SSH only; proposed public frame and verdict seams sent to lead.
