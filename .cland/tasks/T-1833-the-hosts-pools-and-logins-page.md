---
id: T-1833
kind: task
title: The hosts, pools and logins page
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1821
  - T-1827
  - T-1829
  - T-1831
topic: null
branch: null
created: 2026-11-12T10:07:22.211Z
updated: 2026-11-14T22:16:37.259Z
---

## Summary

A new docs page, "Hosts, pools and logins", describes agent hosts as built: configuration, role placement, the `cland host` and `cland login` commands, the host lifecycle and its failures, the money, and the login rules per harness with the Codex one-place warning. A reader can configure a second pool from it alone.

## What to build

Spec §3.4 to §3.7 and §3.9, written from the build. The page goes under Features in the sidebar and is linked from the features overview. It covers:
- **Configuration.** The `[hosts]` and `[hosts.<pool>]` keys with their defaults, hot reload and `cland config set`, and `[<role>.launch] pool`.
- **Running hosts.** Slots as weights and the memory floor; waiting launches and their reasons; scale-up, `min_hosts` and idle stop; `cland host list`, `status`, `stop`, `destroy` and `prepare`.
- **Failures and money.** The lifecycle and failures: boot timeout, the unreachable host at 3 and 15 minutes, a host destroyed by anyone. The money: the lease, the watchdog, the ledger categories, the sub-cap and its 80 % line, and storage in the month figure.
- **Logins.** Disk and key logins; `cland login add`, `list`, `signin`, `remove`, `snapshot` and `set`; capacity and the "create one?" card; signed-out logins and the sign-in cards. The rules per harness, with the Codex warning that one ChatGPT account keeps one login in use at one place, the human's Mac included.
- **The workbench and the CLI.** The Hosts row and the web's hosts view; doctor's host lines and setup's agent-hosts step.

The command blocks a reader runs are marked, as the remote-control page marks them. The price table and the CLI reference are T-1834's.

## Acceptance criteria

- [ ] C1. The page is in the docs sidebar under Features, is linked from the features overview, and has sections on configuration, role placement, commands, lifecycle and failures, money, and logins with the per-harness rules and the Codex one-place warning (test).
- [ ] C2. Every `cland` command and config key on the page exists in the CLI help and the config keys, and every waiting-launch reason it quotes is one the hub emits (test).
- [ ] C3. The page's marked command blocks, run in order in a scratch project on the fake host provider, configure a second pool that `cland host status` then lists (test).
- [ ] C4. The page names doctor's host lines and setup's agent-hosts step as they are built, and the closed-item wording lint passes on it (test).

## Blocked by

- T-1821
- T-1827
- T-1829
- T-1831

## Notes

- Hot files: `site/src/content/docs/docs/hosts.md` (new), `site/astro.config.mjs` (the sidebar), `site/src/content/docs/docs/features.md`, `site/test/`.
- Tests: new `site/test/hosts-docs.test.ts` (T1 through the hub's site wrapper, against the CLI help and config keys); new `hub/test/hosts-docs-pool.test.ts` (T2, runs the marked blocks on the fake host provider), after `site/test/remote-docs.test.ts` and `hub/test/remote-docs-pairing.test.ts`.
- Serves epic C7.
