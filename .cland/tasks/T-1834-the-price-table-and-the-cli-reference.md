---
id: T-1834
kind: task
title: The price table and the CLI reference for `cland host` and `cland login`
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1833
topic: topic-1514
branch: t/T-1834-the-price-table-and-the-cli-reference
created: 2026-11-12T10:07:22.374Z
updated: 2026-11-15T01:02:18.836Z
---

## Summary

The hosts page gains a price table with the date its prices were checked. The CLI reference lists the `cland host` and `cland login` subcommands.

## What to build

- **The price table.** On the hosts page: the `agents` and `qa` pool sizes per hour and per month, volumes and snapshots per GiB-month, and what the default `[hosts] daily_spend_usd` buys in host-hours. The implementer checks the prices on DigitalOcean's public pricing page on the day of writing and puts that date in the table. The storage rates must equal the DigitalOcean provider's declared storage prices. If the page differs from the declared rates, the ticket stops and asks rather than changing the declarations.
- **The CLI reference.** A "Hosts and logins" section in the CLI page lists each `cland host` and `cland login` subcommand that their usage text names.

## Acceptance criteria

- [x] C1. The hosts page has a price table of the `agents` and `qa` pool sizes per hour and per month, volumes and snapshots per GiB-month and the default sub-cap in host-hours, with a "checked on <date>" line (test).
  - done: impl-1834 · 2026-11-15T00:33:49.798Z
- [x] C2. The table's volume and snapshot rates equal the DigitalOcean provider's declared storage prices (test).
  - done: impl-1834 · 2026-11-15T00:33:50.124Z
- [x] C3. The CLI reference lists each `cland host` and `cland login` subcommand that their usage text names, and no other (test).
  - done: impl-1834 · 2026-11-15T00:33:50.331Z

## Blocked by

- T-1833

## Notes

- Hot files: `site/src/content/docs/docs/hosts.md`, `site/src/content/docs/docs/cli.md`, `site/test/hosts-docs.test.ts`.
- Tests: `site/test/hosts-docs.test.ts` (T1, against the CLI usage text and the provider's declared storage prices).
- Serves epic C7.

## Comments

### impl-1834 · 2026-11-15T00:33:29.671Z

C1-C3 implemented with source T1 tests shown red before docs changes. Public DigitalOcean prices checked 2026-11-15; storage declarations match. Shared site wrapper 33/33 and task-selection 10/10 passed locally on macOS Node 24.21.0; no provider call or browser. After-stage QA case guidance added to docs/agents/tests/hub-test-remote-docs.test.ts.md. origin/dev fetched and merged before first review (already up to date).

### rev-35 · 2026-11-15T00:36:46.645Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1834-source-1
commit: 664a01b655f33c9c9dd738506ad9671af92dbd38
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at clean 664a01b655f33c9c9dd738506ad9671af92dbd38/tree5680cfa121ce0b3242d786185982948f51f2f81c. A-19465 records Standards0/Spec0 and independent public-page quote checks: current Basic compute and volume/snapshot rates match declarations; parser-owned defaults/cap feed host-hours test. Exact10host+6login usage inventory, duplicate/extra controls, existing T1 wrapper/prebuild/selection wiring and guide reviewed. No runtime policy/schema/dependency changes. C1-C3 remain unverified until positive same-head configured case/file receipts. A-19464 is candidate narrative; original excerpt/capture-limit supplement requested without provenance rerun. Reviewer read-only; normal mode-free verification may proceed at this head, remainingT3/T4/stageQA separate.
