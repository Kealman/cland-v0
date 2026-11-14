---
id: T-1829
kind: task
title: Doctor's hosts block
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
created: 2026-11-12T10:07:21.390Z
updated: 2026-11-14T14:20:41.705Z
---

## Summary

`cland doctor` gains a hosts block. It checks the provider token's presence and fingerprint, each pool's image against its key, the free logins per pool and harness, the signed-out logins, the hosts' reachability and the hosts' spend against the sub-cap. Each `warn` names its fix. Doctor makes no provider or paid call.

## What to build

A hosts check module beside the remote checks, in doctor's `ok`, `warn` and `fail` shape, with `--json`:
- **Token.** For each provider that a pool uses, its presence and fingerprint from T-1828, read from the running hub. An absent token is `warn`, with the fix naming `DIGITALOCEAN_TOKEN` in the hub's environment and a hub restart.
- **Pool images.** For each pool, its image record against the key computed locally, as `cland host prepare` computes it. A stale image is `warn`, naming the changed parts, with `cland host prepare <pool>`; an absent image is `warn` too.
- **Free logins.** The free logins per pool and harness, for the harnesses of the roles placed on the pool. Zero free is `warn`, with `cland login add <harness> --pool <pool>`.
- **Signed-out logins.** One `warn` per signed-out login, with `cland login signin <name>`.
- **Reachability.** Each live host, `ok` when ready, or `warn` with its outage start and the fix, `cland host stop <id>`, or `cland host destroy <id>` for a host the hub cannot reach.
- **Spend.** Today's hosts spend against `[hosts] daily_spend_usd`. From 80 % it is `warn`, with `cland config set hosts.daily_spend_usd <n>`.

Without a running hub, the hub-backed lines read "hub not running" with `cland hub start` (question 17). A project with no pool prints one `ok` line, "no host pool".

## Acceptance criteria

- [ ] C1. With the token unset, doctor's token line for a `digitalocean` pool is `warn` with a fix naming `DIGITALOCEAN_TOKEN` in the hub's environment; with a made-up token it is `ok` with its fingerprint, and the value is in neither the text nor the `--json` output (test).
- [ ] C2. A pool image whose key no longer matches, after a changed lock file, reads `warn` with the changed parts and `cland host prepare <pool>` (test).
- [ ] C3. The free logins per pool and harness are listed, and a placed role's harness with no free login reads `warn` with `cland login add <harness> --pool <pool>` (test).
- [ ] C4. A signed-out login reads `warn` with `cland login signin <name>`, and an unreachable fake host reads `warn` with its outage start and its fix (test).
- [ ] C5. Today's hosts spend reads against `[hosts] daily_spend_usd`, and is `warn` with its fix from 80 % of it (test).
- [ ] C6. During a doctor run the fake DigitalOcean API records no request and no host is created (test).
- [ ] C7. Without a running hub the hub-backed lines read "hub not running" with `cland hub start`, and a project with no pool prints one `ok` line (test).

## Blocked by

- T-1828

## Notes

- Hot files: `hub/src/doctor/hosts.ts` (new), `hub/src/cli/doctor.ts` (the check list).
- Tests: new `hub/test/doctor-hosts.test.ts` (T2, `projectHub`, the fake DigitalOcean API with a request log for the token and image lines, the fake host provider and the fake harness binaries for the login and host lines, seeded spend ledger), after `hub/test/doctor-remotes.test.ts`.
- Serves epic C4.
