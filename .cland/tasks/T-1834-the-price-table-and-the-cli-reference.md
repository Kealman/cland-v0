---
id: T-1834
kind: task
title: The price table and the CLI reference for `cland host` and `cland login`
state: closed
status: done
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
updated: 2026-11-15T02:16:30.146Z
closed: 2026-11-15T02:16:30.146Z
---

## Summary

The hosts page gains a price table with the date its prices were checked. The CLI reference lists the `cland host` and `cland login` subcommands.

## What to build

- **The price table.** On the hosts page: the `agents` and `qa` pool sizes per hour and per month, volumes and snapshots per GiB-month, and what the default `[hosts] daily_spend_usd` buys in host-hours. The implementer checks the prices on DigitalOcean's public pricing page on the day of writing and puts that date in the table. The storage rates must equal the DigitalOcean provider's declared storage prices. If the page differs from the declared rates, the ticket stops and asks rather than changing the declarations.
- **The CLI reference.** A "Hosts and logins" section in the CLI page lists each `cland host` and `cland login` subcommand that their usage text names.

## Acceptance criteria

- [x] C1. The hosts page has a price table of the `agents` and `qa` pool sizes per hour and per month, volumes and snapshots per GiB-month and the default sub-cap in host-hours, with a "checked on <date>" line (test).
  - done: impl-1834 · 2026-11-15T00:33:49.798Z
  - verified: rev-35 [reviewer] · run rev-35-1834-final-1 · 2026-11-15T01:31:45.715Z · commit a14379994c44c02f6af55eec7ac98db0beefee41
- [x] C2. The table's volume and snapshot rates equal the DigitalOcean provider's declared storage prices (test).
  - done: impl-1834 · 2026-11-15T00:33:50.124Z
  - verified: rev-35 [reviewer] · run rev-35-1834-final-1 · 2026-11-15T01:31:45.715Z · commit a14379994c44c02f6af55eec7ac98db0beefee41
- [x] C3. The CLI reference lists each `cland host` and `cland login` subcommand that their usage text names, and no other (test).
  - done: impl-1834 · 2026-11-15T00:33:50.331Z
  - verified: rev-35 [reviewer] · run rev-35-1834-final-1 · 2026-11-15T01:31:45.715Z · commit a14379994c44c02f6af55eec7ac98db0beefee41

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

### rev-35 · 2026-11-15T01:05:27.012Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1834-source-2
commit: b25b12119afdbb4759b445b2f300ef5d61aec775
scope: delta
findings: [{"severity":"medium","text":"Untouched nonterminal runs include configuration/placement/reload commands only without --yes; the yes branch returns first without fix commands. Add that qualifier to the public guidance.","file":"site/src/content/docs/docs/hosts.md","line":258}]
finding_counts: {"high":0,"medium":1,"low":0}

Completed Coordinator-requested setup delta pass; A-19468 records Standards1medium/Spec0new. Configured-pool provider/main-row/separate-offer and CLI interactive distinctions match source; one adjacent untouched nonterminal claim omits without--yes, confirmed by lead. No new test/experiment required. C1-C3 unchanged source assessment remains, all unverified pending corrected-head configured positives; A-19467 remains old-head only. Hold released for the single wording fix and fresh review before verify. No Reviewer runtime/provenance rerun; A-19466/A-19464 historical capture/scan limits retained.

### rev-35 · 2026-11-15T01:06:18.929Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1834-source-3
commit: a14379994c44c02f6af55eec7ac98db0beefee41
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19469: source clear at clean a14379994c44c02f6af55eec7ac98db0beefee41/tree87eb47a4115a03bb89c6f22e164ea0829da96cab. Exact one-line qualifier delta resolves A-19468; no other bytes changed. Prior full price/CLI source assessment and configured setup distinctions remain applicable; Standards0/Spec0remaining. C1-C3 await positive same-head configured receipts; A-19467 remains664a01b-only and original A-19464/A-19466 capture/scan limits stay explicit. No Reviewer runtime/provenance rerun. Normal mode-free verify may proceed at this head; broaderT3/T4/stageQA separate.

### rev-35 · 2026-11-15T01:31:45.716Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1834-final-1
commit: a14379994c44c02f6af55eec7ac98db0beefee41
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear, C1-C3 verified. A-19471 independently streams A-19470/run f88316e8: all3 exact required ordinary cases5135/5140/5145 positive, each5 distinct load test/file completions; shared wrapper5263 and selection consumer9031/9034 pass.6318ordinary tests/695files plus160separate load tests/files, no negatives. All220T1+421T2+54Web files positive, zero missing;265T3/17T4 remain separate occasions. Provenance35851 exact a1437999/treebaaa4d38, clean Git root87eb47a4; Linux droplet Node24.21/nvim.12.5 actual HeadlessShell1248/CfT156.0.8078.4, no cache/skips,1321s/$0.0917. Source finding resolved; report-only warnings and historical A-19464/A-19466 scan/capture limits explicit, A-19467 old-head only. No Reviewer runtime/provenance rerun.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-15T02:16:30.146Z

Merged 6cc0fa8161f6b9412cb378d07bf04d41376ba0fe onto dev.
