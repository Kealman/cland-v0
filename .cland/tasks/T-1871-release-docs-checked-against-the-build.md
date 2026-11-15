---
id: T-1871
kind: task
title: Release docs checked against the build, with the price table's date
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1539
blocked_by:
  - T-1866
topic: null
branch: null
created: 2026-11-15T13:08:09.539Z
updated: 2026-11-15T13:08:16.385Z
---

## Summary

The release docs are checked against the built release (E-1539 C5): the hosts, pools and logins page; the users and sign-in modes page; the web-and-phone page's multi-user section; and the price table, whose check date is refreshed if DigitalOcean's prices changed. The changes T-1860 and T-1866 made after those pages were written are folded in.

## What to build

Read each page against the build at the item's head:
- `site/src/content/docs/docs/hosts.md`;
- `site/src/content/docs/docs/users.md`;
- the multi-user section of `site/src/content/docs/docs/web-and-phone.mdx`;
- the CLI reference sections for host, login, user and auth.

Fix every sentence that no longer matches, including:
- T-1860: a role on a missing pool now reads `open` in setup and `warn` in doctor;
- T-1866: setup's sign-in step reads the config mode when the hub is down.

Check DigitalOcean's public prices for the table's sizes, volumes and snapshots on the day of the work. If they're unchanged, refresh the "checked on" date. If they changed, stop and ask the lead, because the provider's declared storage prices must match. Keep every existing docs test green (`site/test/hosts-docs.test.ts`, `site/test/users-docs.test.ts`, the shared site wrapper). The closed-item wording lint passes.

## Acceptance criteria

- [ ] C1. Every command, flag, config key, row and line the pages quote matches the build at the item's head, and the T-1860 and T-1866 behaviours are described as built (test).
- [ ] C2. The price table's "checked on" date is the day of the work, and its rates equal both DigitalOcean's public prices and the provider's declared storage prices (test).
