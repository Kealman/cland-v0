---
id: T-1830
kind: task
title: "Setup's agent-hosts step: the offer, the roles and the `agents` pool"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1828
topic: null
branch: null
created: 2026-11-12T10:07:21.555Z
updated: 2026-11-14T14:20:41.846Z
---

## Summary

`cland setup` gains an optional agent-hosts step after the remote steps and before the Aide. It is offered with No as the default, and `--yes` alone does not enable it. On the human's yes, it checks the provider token's presence in the hub's environment, places the chosen roles on the `agents` pool, and writes the pool with its defaults to config. Without a terminal it reports what is open.

## What to build

Setup's rules: check first, ask only about what is missing, one result line per check. The step:
- **Detects** a configured `agents` pool, the roles placed on it, and the token's presence and fingerprint from T-1828. A configured pool whose placed roles have ready logins prints `ok` and asks nothing.
- **Offers** "Set up agent hosts?", default No. A decline prints `skip`. `--yes` takes that default, with or without a terminal: the step prints `skip` and writes nothing.
- **Token.** With the token absent, the step prints `open` naming `DIGITALOCEAN_TOKEN` in the hub's environment and a hub restart, and goes no further. It never asks for, prints or stores the token.
- **Roles.** It asks which roles to place on the pool (question 1).
- **The pool.** A second yes names the pool's size, `min_hosts` and the price per hour that the hub's provider declares, since `min_hosts = 1` starts an always-on host (questions 2 and 20). On that yes it writes `[hosts.agents]` with the defaults through the config-set path, writes `[<role>.launch] pool = "agents"` for the chosen roles, and reloads the hub.
- **Without a terminal** it writes nothing and prints `open` with the exact `cland config set` commands.

T-1831 adds the image and the first logins.

## Acceptance criteria

- [ ] C1. With a scripted prompter, the agent-hosts step runs after the remote steps and before the Aide, and its offer defaults to No (test).
- [ ] C2. `--yes`, with or without a terminal, leaves the step `skip` with no pool written, and without a terminal and without `--yes` the step writes nothing and prints `open` with the exact `cland config set` commands (test).
- [ ] C3. On yes with the token present in the hub's environment, the step shows the fingerprint, writes `[hosts.agents]` with its defaults and `[<role>.launch] pool = "agents"` for the chosen roles, and reloads the hub (test).
- [ ] C4. The pool is written only after a yes that names its size, `min_hosts` and declared price per hour, and a no there writes nothing (test).
- [ ] C5. With the token absent, the step prints `open` naming `DIGITALOCEAN_TOKEN` and the hub restart, writes nothing, and no line, narration or `--json` report contains a token (test).
- [ ] C6. A project whose `agents` pool is configured and whose placed roles have ready logins prints `ok` and asks nothing (test).

## Blocked by

- T-1828

## Notes

- Hot files: `hub/src/setup/steps/hosts.ts` (new), `hub/src/setup/runner.ts` (the step order), `hub/src/setup/types.ts`, `hub/src/setup/hub.ts` (the hub reads), `hub/src/cli/setup.ts`, `hub/test/setup-prompter.ts`.
- Tests: new `hub/test/setup-hosts.test.ts` (T2, scripted prompter, `projectHub`, the fake DigitalOcean API or the fake host provider per question 12); `hub/test/setup-flow.test.ts` order updated.
- Serves epic C5.
