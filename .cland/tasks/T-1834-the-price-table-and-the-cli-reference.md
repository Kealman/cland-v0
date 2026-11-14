---
id: T-1834
kind: task
title: The price table and the CLI reference for `cland host` and `cland login`
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1833
topic: null
branch: null
created: 2026-11-12T10:07:22.374Z
updated: 2026-11-14T22:16:37.516Z
---

## Summary

The hosts page gains a price table with the date its prices were checked. The CLI reference lists the `cland host` and `cland login` subcommands.

## What to build

- **The price table.** On the hosts page: the `agents` and `qa` pool sizes per hour and per month, volumes and snapshots per GiB-month, and what the default `[hosts] daily_spend_usd` buys in host-hours. The implementer checks the prices on DigitalOcean's public pricing page on the day of writing and puts that date in the table. The storage rates must equal the DigitalOcean provider's declared storage prices. If the page differs from the declared rates, the ticket stops and asks rather than changing the declarations.
- **The CLI reference.** A "Hosts and logins" section in the CLI page lists each `cland host` and `cland login` subcommand that their usage text names.

## Acceptance criteria

- [ ] C1. The hosts page has a price table of the `agents` and `qa` pool sizes per hour and per month, volumes and snapshots per GiB-month and the default sub-cap in host-hours, with a "checked on <date>" line (test).
- [ ] C2. The table's volume and snapshot rates equal the DigitalOcean provider's declared storage prices (test).
- [ ] C3. The CLI reference lists each `cland host` and `cland login` subcommand that their usage text names, and no other (test).

## Blocked by

- T-1833

## Notes

- Hot files: `site/src/content/docs/docs/hosts.md`, `site/src/content/docs/docs/cli.md`, `site/test/hosts-docs.test.ts`.
- Tests: `site/test/hosts-docs.test.ts` (T1, against the CLI usage text and the provider's declared storage prices).
- Serves epic C7.
