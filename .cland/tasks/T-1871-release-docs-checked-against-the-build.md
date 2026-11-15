---
id: T-1871
kind: task
title: Release docs checked against the build, with the price table's date
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1539
blocked_by:
  - T-1866
topic: topic-1526
branch: t/T-1871-release-docs-checked-against-the-build
created: 2026-11-15T13:08:09.539Z
updated: 2026-11-15T13:55:32.821Z
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

- [x] C1. Every command, flag, config key, row and line the pages quote matches the build at the item's head, and the T-1860 and T-1866 behaviours are described as built (test).
  - done: impl-1871 · 2026-11-15T13:27:22.241Z
  - verified: rev-36 [reviewer] · run rev-36-1871-final-1 · 2026-11-15T13:55:32.652Z · commit 9036a1395219c85f360bc540ca8fce5e86f0e79d
- [x] C2. The price table's "checked on" date is the day of the work, and its rates equal both DigitalOcean's public prices and the provider's declared storage prices (test).
  - done: impl-1871 · 2026-11-15T13:20:38.389Z
  - verified: rev-36 [reviewer] · run rev-36-1871-final-1 · 2026-11-15T13:55:32.652Z · commit 9036a1395219c85f360bc540ca8fce5e86f0e79d

## Comments

### impl-1871 · 2026-11-15T13:16:58.522Z

A-19677 records independent 2026-11-15 public price checks (unchanged; table already dated today), source audit, and red-before-green T1 source guards. Initial users/CLI cycle 38/40 red then 40/40 green; missing-pool cycle 41/42 red and documentation repaired, final green pending Coordinator TMPDIR slot release. No runtime/provider/browser calls. Web multi-user components match section; zero MDX changes/tracker ids. origin/dev fetched and merged once before first source review.

### rev-36 · 2026-11-15T13:26:07.165Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1871-source-1
commit: 1c0e0979def19eb168965efb02e30c6900c9fb34
scope: full
findings: [{"severity":"medium","text":"host revoke still promises settlement within2 seconds, mirrored by HOST_USAGE, but the public build uses HOST_SETTLEMENT_MS=2*5000+2000=12000ms with no override; CLI adds a separate3s reply margin. Claimant confirmed the stale claim. C1 requires actual-build accuracy, not equality with stale help. Correct docs and shipped help/golden together and guard the declared bound; preserve leftover-report semantics.","file":"site/src/content/docs/docs/cli.md","line":72},{"severity":"low","text":"New test title 'CLI auth and user examples use parser flags and actual output fields' contains 'and' twice, flagged by docs/agents/tests.md's one-behavior naming rule. Rename around its single CLI documentation contract while retaining the assertions.","file":"site/test/users-docs.test.ts","line":87}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source review A-19684: Standards1low title finding; Spec1medium actual-build revoke timing mismatch, confirmed460205ad. Other requested page/setup/doctor/parser/UI audits found no additional issue. Independently read all3 public primary pricing pages today: compute/storage quotes match current table/declaration; date already2026-11-15. No criteria verified pending correction/configured evidence. A-19683 transcribed precommit/outer-completion/publication limits retained; no raw/exact-head suite claim. Repair both findings, migrate frozen help fixture and request fresh source review. Reviewer ran no tests, compiler/lint, native/provider/browser operations or delegation.

Criteria: C1 failed (Quoted host revoke2s settlement guarantee disagrees with the actual12s public settlement budget; correct release docs/help and compatibility consumer.).

### rev-36 · 2026-11-15T13:28:22.443Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1871-source-2
commit: 9036a1395219c85f360bc540ca8fce5e86f0e79d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear: A-19687 preserves full A-19684 page/build/public-price audit. Medium closed by accurate12s budget/leftover wording in public CLI and HOST_USAGE plus matching frozen help fixture, with source-only declaration guard and distinct3s frame margin. Low closed by renamed single-contract title; assertions retained. No actual timeout/policy/runtime/price change. Clean requested HEAD, both criteria done. C1/C2 remain unverified pending configured same-head named/file evidence. A-19686/A-19683 transcribed precommit/publication/coverage limits retained. No Reviewer execution. Remaining native/integrated release/QA occasions separate.

### rev-36 · 2026-11-15T13:55:32.653Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1871-final-1
commit: 9036a1395219c85f360bc540ca8fce5e86f0e79d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear: A-19707; exact named/consumer ledger A-19706; original run75cd0dd0/A-19705. C1/C2 verified. All10 hosts and7 users source guards base+5 pass, including repaired12s revoke budget; frozen help compatibility and actual T2 public walkthroughs pass. Day-of-work public prices independently checked in A-19684 match dated table/provider storage declaration; configured pricing guards pass. 6357 positive base tests/700 files; separate210 load test/file passes. All982 manifest paths accounted:700 lower/Web pass,265 T3/17 T4 deferred, zero missing lower/Web. Exact head/tree/Linux/browser provenance, clean source, report-only budgets/lint. A-19683/A-19686 transcript/candidate/publication limits retained. No Reviewer runtime execution; remaining integrated release/demo/native/T4 occasions separate. Hub/Coordinator own ready/landing.

Criteria: C1 verified, C2 verified.
