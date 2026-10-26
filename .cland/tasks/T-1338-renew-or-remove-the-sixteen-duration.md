---
id: T-1338
kind: task
title: Renew or remove the sixteen duration allowances that expire on 2026-10-31 and 2026-11-01 before they refuse every verify run
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1086
branch: t/T-1338-renew-or-remove-the-sixteen-duration
created: 2026-10-26T12:12:39.576Z
updated: 2026-10-26T12:46:48.233Z
closed: 2026-10-26T12:46:48.233Z
---

## Summary

Sixteen duration allowances in hub/test/durations.json expire at 00:00 UTC on 2026-10-31 (nine) and 2026-11-01 (seven), all owned by E-880. `hub/src/suite-durations.ts` throws "expired duration allowance" once one expires, which refuses every verify run, the merge queue and the covers included. Renew or remove each one before 2026-10-30.

## What to build

For each of the sixteen keys, check the test's current timing in the last green covers and runs: Linux A-12333 and A-12360, macOS A-12338 and A-12224.
- **Still needed:** if the test still exceeds its tier budget, renew it within the owner's span limit. Set "seconds" to 1.5x the worst recent passing sample, rounded up to milliseconds, set "added" to today and "expires" to 2026-11-25. Append a dated renewal note with the samples to "reason". Keep the owner E-880.
- **No longer needed:** if the test now fits its budget in every recent sample, remove the stanza.
- **Never** change a test or its assertions here.
The keys are the `allow` entries with "expires" "2026-10-31" or "2026-11-01". As of dev 89107fe1 they are in suite-cover, homebrew-publication, qa-lint-build, startup-replies-scale, dev-t3-search-component, suite-cancel (2), codex-adapter, suite-recovery, launcher-input-load, explorer-outline-load, claude-code-sessions-lifecycle, suite-timeouts (3) and executor-safety-load.

## Acceptance criteria

- [x] C1. No duration allowance in hub/test/durations.json expires before 2026-11-02, each renewed stanza names its recent samples and the 1.5x rule, each removed one is listed in the item with the samples showing it fits its budget, and the durations lint passes (test).
  - done: impl-1338 · 2026-10-26T12:17:14.685Z
  - verified: rev-26 [reviewer] · run rev-20261026-1338-evidence-1 · 2026-10-26T12:40:37.281Z · commit 379947ceadab63eed6280d39067d6b683d6351d5

## Comments

### impl-1338 · 2026-10-26T12:14:52.579Z

Scope/seam: data-only changes to the 16 expiring duration allowances; no tests/assertions, command semantics, schema, wire shape or duration policy changes. Existing lintDurationManifest is the red/green criterion seam, plus source/owner manifest lint. The 2026-11-02 fixed-clock pre-change lint failed with `expired duration allowance:` naming all 16 entries. Consumers searched: suite-durations validation/checks, suite-shards working/tree lint, duration refresh tooling, suite duration reporting and duration regression tests/docs; these remain unchanged because the existing allowance shape and budgets are retained. No rule-20 contract migration is needed.

### impl-1338 · 2026-10-26T12:16:28.329Z

T-1338 duration allowance decisions, 2026-10-26.

Samples below are exact top-level `suite timing` receipts in seconds, in order A-12333 (Linux droplet stage, fb73592), A-12360 (Linux droplet ordinary integrated, dcc15d0), A-12338 (macOS local stage, fb73592), A-12224 (macOS local stage, e090007). These are existing measured passing receipts, not fresh runs. All four used duration-budget report mode. Cross-check against all top-level `suite progress` finish receipts found no additional matching load repetitions. T4 did not run in A-12360; Linux-only Claude case skipped on macOS. Skips and missing samples are not zero or passing evidence.

Key | Tier / budget | A-12333 | A-12360 | A-12338 | A-12224 | Decision
--- | --- | --- | --- | --- | --- | ---
`hub/test/suite-recovery.test.ts::admission quarantines a dead run’s recreated root and releases both compatibility locks` | T3 / 10 s | 5.221786358999999 | 4.156120765 | 4.169034042 | 4.157551583 | Remove; all passing samples fit tier budget
`hub/test/suite-cancel.test.ts::verify cancel reaps a detached fake child before removing the phase root, then admits the next run` | T3 / 10 s | 7.344204113 | 5.162054887999999 | 5.152338667 | 5.113872333000001 | Remove; all passing samples fit tier budget
`hub/test/suite-cancel.test.ts::verify cancel reaps a detached fake child that recreates the root after runner death, then admits the next run` | T3 / 10 s | 7.289963166 | 6.216135207000001 | 5.182457708 | 5.18738925 | Remove; all passing samples fit tier budget
`hub/test/startup-replies-scale.test.ts::eight startup replies and byte guards work on a copied live durable fixture` | T3 / 10 s | 21.133181821999997 | 14.183127087999999 | 7.054619333 | 6.8981826250000005 | Renew to 31.700 s; 1.5x worst passing sample rounded upward to milliseconds; expires 2026-11-25
`hub/test/suite-cover.test.ts::all capacity-refused shards preserve a not-run cover receipt and never start culprit search` | T1 / 0.5 s | 0.398563058 | 0.295410967 | 0.145703917 | 0.131776834 | Remove; all passing samples fit tier budget
`hub/test/codex-adapter.test.ts::Codex launches Implementer with narrow workspace roots, QA full access, Reviewer read-only, and the configured T-48 profile (T-1222)` | T3 / 10 s | 7.656888105 | 6.186771955999999 | 4.127343541999999 | 3.5498699580000004 | Remove; all passing samples fit tier budget
`hub/test/dev-t3-search-component.test.ts::red periodic run runs Web probes and names the first red merge` | T2 / 2 s | 0.994156459 | 0.881564397 | 1.6637809159999999 | 1.63996275 | Remove; all passing samples fit tier budget
`hub/test/suite-timeouts.test.ts::hung fixture reaps its runner and worker after assertion failure` | T3 / 10 s | 5.681646648 | 5.069653953 | 3.95515575 | 4.141283499999999 | Remove; all passing samples fit tier budget
`hub/test/suite-timeouts.test.ts::hung fixture reaps its runner and worker after setup failure` | T3 / 10 s | 5.505907302 | 4.677052689 | 3.986416583 | 3.854003292 | Remove; all passing samples fit tier budget
`hub/test/suite-timeouts.test.ts::hung fixture reaps its runner and worker after split failure` | T3 / 10 s | 5.748394315 | 4.9436801070000005 | 4.04001975 | 3.833089083 | Remove; all passing samples fit tier budget
`hub/test/homebrew-publication.test.ts::release preview, download failure and lost tap reply recover the pinned formula once` | T3 / 10 s | 1.120356127 | 1.0936826510000002 | 3.428213834 | 2.9692381660000002 | Remove; all passing samples fit tier budget
`nvim/test/launcher-input-load.test.ts::launcher Insert receipt holds 20/20 under parallel load` | T4 / none | 7.657861557 | not run | 4.378669875 | 4.423756416 | Remove; T4 has no tier budget
`hub/test/executor-safety-load.test.ts::foreign live leases settle 10/10 at two workers under CPU load` | T4 / none | 4.483417801 | not run | 4.8384751249999995 | 5.029477541 | Remove; T4 has no tier budget
`hub/test/qa-lint-build.test.ts::committed brief corpus has no false absent file or title reports against the compiler source oracle` | T3 / 10 s | 10.929478443 | 4.148720988 | 5.0689815 | 3.719521292 | Renew to 16.395 s; 1.5x worst passing sample rounded upward to milliseconds; expires 2026-11-25
`nvim/test/explorer-outline-load.test.ts::explorer settled card preserves unselected-task isolation 20/20` | T4 / none | 13.147099567 | not run | 7.869842417 | 7.916231 | Remove; T4 has no tier budget
`hub/test/claude-code-sessions-lifecycle.test.ts::Linux background Claude publishes a verifiable native birth and stops through the recorded PID` | T3 / 10 s | 4.201581494 | 3.324562996 | skip | skip | Remove; all passing samples fit tier budget

2 renewed; 14 removed. All baselines, budgets and test sources remain unchanged. No new test requires a duration allowance. Public policy/help/skills are unaffected by these data renewals.

Red control: unchanged lintDurationManifest at 2026-11-02T00:00:00Z raised `expired duration allowance:` and named all sixteen original entries (exit 1). Green lint and typecheck receipts follow separately.

Durable evidence: A-12387, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12387-t-1338-exact-timing-comparison-and-allowance-decisions.md

### rev-26 · 2026-10-26T12:25:50.957Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1338-source-1
commit: 379947ceadab63eed6280d39067d6b683d6351d5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards and Spec have no findings. A-12391 contains the independent original-log comparison, all 16 decisions, exact renewal arithmetic, baseline/generic-limit analysis and owner/expiry audit. Only durations.json changes: 14 removals and 2 renewals; all other manifest data and assertions unchanged. A-12387 sample table matches all four original logs, with absent T4 and macOS Linux-only skips excluded correctly. C1 final verification remains pending one mode-free configured run at this unchanged head; no runtime execution by Reviewer.

### impl-1338 · 2026-10-26T12:40:27.306Z

Same-head mode-free verification 25079fb0-b3ee-4f4e-90d6-2cd55168e33b passed at 379947ceadab63eed6280d39067d6b683d6351d5: T0 and 3404/3404 runtime tests (T1 1067, fallback all T2 2000, Web 227). Linux droplet c-8 lon1, x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; Chrome Headless Shell 156.0.8078.4 / Playwright shell v1248. Duration budget mode report, T3/T4 did not run; this is task evidence, not an integrated cover. Original receipt A-12393: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12393-suite-25079fb0-b3ee-4f4e-90d6-2cd55168e33b-auto-at-379947c.log. Host typecheck was reported at 4e08af5c, not repeated remotely. Droplet lifetime 755 s, cost $0.0524. Final evidence/C1 review requested from Reviewer; no source changes after source clearance A-12391.

### rev-26 · 2026-10-26T12:40:37.281Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1338-evidence-1
commit: 379947ceadab63eed6280d39067d6b683d6351d5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1 verified. A-12394 records independent inspection of original A-12393 / run 25079fb0-b3ee-4f4e-90d6-2cd55168e33b: exit 0, 3404 ordinary test passes across 457 files, no failure/cancellation/skip/TODO and no scoped load repetitions. T0/all T1/fallback all T2/Web completed; T3/T4 not executed. A-12391 supplies the independently checked sixteen timing decisions and manifest arithmetic; A-12388 remains the explicitly local fixed-clock lint summary. Successful same-head admission and named duration manifest/owner/source guards pass. Report-only lint/budget warnings, reused host typecheck tree and separate historical T3/T4 evidence are retained with their limits. No Reviewer execution or integrated-cover claim. Coordinator owns remaining cover and landing.

Criteria: C1 verified.

### coord · 2026-10-26T12:46:48.233Z

Merged c63469bf9e709b290599bec49d4cf66035dd2638 onto dev.
