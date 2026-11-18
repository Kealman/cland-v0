---
id: T-1895
kind: task
title: Periodic dev T3 only for new integrated evidence
state: open
status: in progress
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1628
branch: t/T-1895-periodic-dev-t3-only-for-new-integrated
created: 2026-11-16T07:29:45.935Z
updated: 2026-11-18T17:47:00.463Z
---

## Summary

It already skips an unchanged tree, or a green full cover on dev's ancestry within 1 h (`suites.ts:1203–1226`). Batches likely don't suppress it, because their candidate head is not on dev's ancestry (unverified). Skip when dev's tree equals a green T1+T3 batch candidate tree, and lengthen `dev_t3_every`. Merges impl #5 and §7 #5.

Kind: product + config. Triage ticket H-7 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes rule 6 ("periodic dev T3 covers T2 on integrated dev") and `verification.dev_t3_every`. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. A dev tree equal to a green T1+T3 batch candidate tree skips the periodic run, with a notice naming the batch (test).
- [ ] C2. `dev_t3_every` is raised (for example 2h to 8h), and a week's ledger shows at most 3 periodic runs a day (evidence).
- [ ] C3. Integrated T2 keeps a stated cadence of at least once a day, or rule 6's text changes with the human's yes (test or doc).

## Dependencies

none; suites.ts

## Comments

### impl-1895 · 2026-11-18T17:44:12.616Z

Proposed verification.dev_t3_every: 8h (repository config only; generated default remains disabled). C2's seven-day post-landing <=3/day observation stays evidence-pending. Requested structured prior-week ledger from Coordinator; never accessing live hub.db. Investigating C3: batch T1+T3 does not prove integrated T2; daily T2 may remain supplied by nightly soak under enabled/authenticated executor and spend/network availability, or need a daily backstop/updated rule 6 approved by human.

### impl-1895 · 2026-11-18T17:44:44.850Z

Consumer census before source edits (rg fields/functions plus dev-t3/devT3/dev_t3_every and notice wording across production, web, docs, skills, QA, hub/test and nvim/test): scheduler hub/src/hub/suites.ts; persistence store.ts and suite-job summaries (new eligibility must survive compact load); config init/config.ts, hub/configuration.ts, repository .cland/config.toml and init-config.test.ts pin. Verification policy/occasion/plan and cli/suite.ts retain occasion/selection shape. server.ts/daemon.ts dispatch notices through onSoakNotice; heartbeat.ts/suite-author.ts and web Agents topic/TopicsArea.tsx, merge queue/Suites views consume existing text/jobs, no new wire shape planned. dev-t3-result/report/search/probe retain results, not skip eligibility. CLI usage/suite.ts and frozen fixtures/cli-usage/commands.json require wording migration if help changes. Docs running.md, tests.md, per-file suite-soak guide and merge/implement skills describe cadence. QA E-420 assumes two-hourly (update); E-617/E-678 and E-412/E-415/E-579/E-1281/E-1532/E-1534/E-1535 refer to occasions, fixture disabling or historical results (unchanged). Tests: suite-soak, suite-soak-component, suite-scheduling, init-config directly schedule; suite-tiers/verification-commands/verification-tree/durations/merge-batches/merge-batch-dependencies/web-phase/suite-accounting/suite-persistence/suite-cover/dev-t3-search(-component), release-cover-fixture/harness/remote-fixture consume unchanged occasion/results. No nvim scheduler reader found. Tier history unchanged; existing scheduler fixture imports native modules, so new pure tests will use a leaf module only.

### impl-1895 · 2026-11-18T17:47:00.463Z

Ledger command staged as t1895-ledger.py: python3 t1895-ledger.py > t1895-ledger.json. Streams read-only root .cland/artifacts/A-*-suite-*-all-at-*.log, filters Queued in [2026-11-11T00:00Z,2026-11-18T00:00Z), deduplicates run ids, uses suite provenance occasion/tree/executor and Finished exit, never artifact mtime or hub.db. Same-tree earlier-queued green batch matches are observational only: logs do not establish durable completion ordering or producer-tier eligibility, so 'already covered before admission' remains unknown where those receipts are absent. Source skip implementation will require structured receipts. Proposed rule clarification (Coordinator only if needed): periodic integrated T2/T3/Web runs use an 8h attempt cadence; batch-only suppression cannot exceed 24h on changed dev, while unchanged trees retain existing skip. No RULES.md or clause edits.
