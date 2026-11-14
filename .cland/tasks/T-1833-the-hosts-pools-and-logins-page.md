---
id: T-1833
kind: task
title: The hosts, pools and logins page
state: open
status: ready
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1821
  - T-1827
  - T-1829
  - T-1831
topic: topic-1513
branch: t/T-1833-the-hosts-pools-and-logins-page
created: 2026-11-12T10:07:22.211Z
updated: 2026-11-14T23:09:24.148Z
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

- [x] C1. The page is in the docs sidebar under Features, is linked from the features overview, and has sections on configuration, role placement, commands, lifecycle and failures, money, and logins with the per-harness rules and the Codex one-place warning (test).
  - done: impl-1833 · 2026-11-14T22:26:25.638Z
  - verified: rev-36 [reviewer] · run rev-36-1833-final-1 · 2026-11-14T23:09:23.934Z · commit 37a9884b416107215582281c3786a061dd1d19ff
- [x] C2. Every `cland` command and config key on the page exists in the CLI help and the config keys, and every waiting-launch reason it quotes is one the hub emits (test).
  - done: impl-1833 · 2026-11-14T22:41:29.280Z
  - verified: rev-36 [reviewer] · run rev-36-1833-final-1 · 2026-11-14T23:09:23.934Z · commit 37a9884b416107215582281c3786a061dd1d19ff
- [x] C3. The page's marked command blocks, run in order in a scratch project on the fake host provider, configure a second pool that `cland host status` then lists (test).
  - done: impl-1833 · 2026-11-14T22:26:26.176Z
  - verified: rev-36 [reviewer] · run rev-36-1833-final-1 · 2026-11-14T23:09:23.934Z · commit 37a9884b416107215582281c3786a061dd1d19ff
- [x] C4. The page names doctor's host lines and setup's agent-hosts step as they are built, and the closed-item wording lint passes on it (test).
  - done: impl-1833 · 2026-11-14T22:26:26.387Z
  - verified: rev-36 [reviewer] · run rev-36-1833-final-1 · 2026-11-14T23:09:23.934Z · commit 37a9884b416107215582281c3786a061dd1d19ff

## Blocked by

- T-1821
- T-1827
- T-1829
- T-1831

## Notes

- Hot files: `site/src/content/docs/docs/hosts.md` (new), `site/astro.config.mjs` (the sidebar), `site/src/content/docs/docs/features.md`, `site/test/`.
- Tests: new `site/test/hosts-docs.test.ts` (T1 through the hub's site wrapper, against the CLI help and config keys); new `hub/test/hosts-docs-pool.test.ts` (T2, runs the marked blocks on the fake host provider), after `site/test/remote-docs.test.ts` and `hub/test/remote-docs-pairing.test.ts`.
- Serves epic C7.

## Comments

### impl-1833 · 2026-11-14T22:25:49.610Z

Implemented Hosts, pools and logins page and Features links. Consumer sweep: site remote-docs/onboarding tests and hub wrapper; prerequisite dependency lint; documentation link existence checks; closed-item wording guard; QA E-1313/E-1314 remote-link references unaffected. T1 checks help/config/emitted labels/defaults; T2 executes marked commands with fake provider and confirms persisted second pool/status. macOS Node 24.21.0 targeted checks pass; source review then Linux verification pending. Native slot inventory delta zero; all pre-existing entries retained.

### rev-36 · 2026-11-14T22:31:41.698Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1833-source-1
commit: a9f3e0d53fd14920d70c261e971de173ddf9900e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0. A-19446 records the complete page/build comparison, additive Features links, shared command extraction, T1 vocabulary/default controls, T2 real config/status walkthrough and approved wording-lint extension. A-19447 retained transcript excerpts were read after publication of that review note: candidate-only receipts, precise OS/arch and per-run hashes uncaptured; actual A-19444/A-19445 zero-delta sets bracket only the final T2 execution, not earlier failed/first-green attempts. Original errors and report-only T-1484/lint limitations remain explicit. C1–C4 unverified until same-head mode-free configured results with named docs and consumer completions. No runtime host change or price/CLI-reference scope expansion. Affected QA remains after-stage on dev; full T3/T4 occasions separate. No Reviewer execution.

### rev-36 · 2026-11-14T22:40:10.607Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1833-evidence-1
commit: a9f3e0d53fd14920d70c261e971de173ddf9900e
scope: evidence
findings: [{"severity":"medium","text":"New site/test/hosts-docs.test.ts is only registered in a separate wrapper, violating the shared mode-free docs/site prebuild guard contract. A-19450 explicitly fails suite-task-selection.test.ts:234 ('hosts-docs.test.ts runs through the T1 wrapper'). Register it through the shared documentation wrapper/selection owner; preserve the guard and existing assertions, remove redundant wrapper registration if appropriate, then obtain fresh source review and same-head verification.","file":"hub/test/remote-docs.test.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-19451 records actual failure, source cause and claimant confirmation 8346c7a7. The source pass missed this selection consumer. A-19450 T0 passed, T1 failed one named assertion; base 1683/1682 pass/1 fail, later T2/T3/Web unexecuted. No criteria verified. Preserve prior candidate/capture limits and the failed run; release pin for shared-wrapper correction, fresh committed source review and same-head verification. Affected after-stage QA and full T3/T4 remain separate. No Reviewer execution.

Criteria: C2 failed (Configured T1 integration failed because the new site vocabulary guard is missing from the shared documentation-selection wrapper.).

### rev-36 · 2026-11-14T22:42:18.399Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1833-source-2
commit: 37a9884b416107215582281c3786a061dd1d19ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear after shared site-guard registration repair. Standards 0 / Spec 0. A-19453 records direct import through shared remote-docs wrapper, removal of redundant wrapper/manifest entry, relocated notes/index and preservation of page/site controls/T2 walkthrough/selection guard/remote assertions. A-19452 red/green command/cwd/tool completions remain qualified precommit candidate evidence; prior A-19450 remains red with later tiers unexecuted. All criteria implementation done, none verified pending fresh same-head mode-free results. Affected after-stage QA and full T3/T4 remain separate. No Reviewer execution.

### rev-36 · 2026-11-14T23:09:23.934Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1833-final-1
commit: 37a9884b416107215582281c3786a061dd1d19ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C4 verified. A-19456 / c3509fac passes 6315/6315, zero fail/cancel/skip/todo, T0/all T1/fallback all T2/Web. Independently checked four site host guards (each base+5 load), repaired selection guard, actual marked-command walkthrough (base 3.266500842 s +5 load pass), document membership and T0 wording scan (768 docs/0 findings). A-19458 records criterion/provenance/capture limits; A-19457 reconciles all 977 manifest paths: 695 positive file receipts, 265 T3/17 T4 deferred, no missing lower/Web. Linux x64 Node24.21/Nvim0.12.5, pinned Headless Shell1248/CfT156.0.8078.4, no cache/skips; report-only budgets/lint retained. Prior A-19450 red and qualified candidate/inventory history preserved. Full T3/T4, site rendering/native provisioning and affected after-stage QA are not claimed. No Reviewer execution; hub/Coordinator owns ready/landing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
