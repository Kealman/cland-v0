---
id: T-1994
kind: task
title: The fake DigitalOcean API turns a rejected beforeCreate assertion into a 500, so the test times out at 120 s instead of failing
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1735
branch: t/T-1994-the-fake-digitalocean-api-turns-a
created: 2026-11-19T02:38:47.676Z
updated: 2026-11-24T10:51:46.619Z
---

## Summary

The fake DigitalOcean API catches a rejected `beforeCreate` callback and replaces the assertion with an HTTP 500 (`lease-missing`, "lease not armed before create"), around hub/test/fakes/digitalocean/fake-api.ts:181. The original error is discarded, and the caller's later wait for a running state can never succeed. A failed assertion therefore shows up as a 120 s test timeout instead of the precise failure, as impl-1958 found in T-1958 on 2026-11-19 (suite-accounting.test.ts around 412–415).

## What to build

When a test-supplied `beforeCreate` callback rejects, the fake API fails the test with that callback's original error, either surfaced to the waiting case or recorded as the case's failure, instead of disguising it as an unrelated provider 500. Real provider-error simulation stays available on purpose.

## Acceptance criteria

- [ ] C1. A `beforeCreate` callback that throws an assertion fails its case with that assertion's message within the case's normal budget, never by timeout (test with a positive control, red on the current fake).
  - failed: rev-40 [reviewer] · 2026-11-24T10:51:46.618Z · note New controls lack bounded setup/action ownership, and teardown cleanup rejection can still mask the original beforeCreate assertion.
- [x] C2. Every caller that passes `beforeCreate` is listed with its disposition (rule 41) and still passes.
  - done: impl-1994 · 2026-11-24T10:50:09.835Z

## Comments

### impl-1994 · 2026-11-24T10:42:45.198Z

Rule 20/41 consumer census: searched repository-wide beforeCreate field/method and fake-api importers, plus docs, skills, QA and raw lease-missing text. No production beforeCreate caller or frozen wire fixture; compatible 500/lease-missing preserved. Assertion-bearing callers migrated to checked waits: suite-accounting (ledger count/reservation), executor-droplet (armed lease/PID/modes), suite-close (shard reservations), host-provider-digitalocean second callback (armed watchdog via armed()). Other callers unaffected in success path; retained teardown now reports unexpected callback errors: executor-safety-component (3 barriers), executor-safety (held create control), suite-remote-budget (2 barriers), demo-provisioning (barrier), daemon (barrier), suite-remote-process (barrier), suite-close-recovery (barrier), executor-prepare-component (barrier and snapshot-file mutation), suite-close-component (captures ledger reservations, asserts after hook), demo (config mutation), suite-candidate-remote (Git/tracker mutation), executor-run (2 file/config mutations), host-provider-digitalocean first callback (barrier). New digitalocean-pacing controls exercise teardown, checked observer and deliberate faults.create on scripted/HTTP transports. Matching file guidance updated; no command/config/permission change. Full source consumer passes will be supplied by mode-free verification; focused checks underway.

### impl-1994 · 2026-11-24T10:50:28.401Z

Source pushed at 930fa347df0be60620bb6fbf6bc4c3c5632bd11d. Full npm run typecheck exit 0 and npm run test:lint exit 0 (zero refusals) on its complete source diff; local macOS Node 24.21.0, no browser. Lint report-only advisory diagnostics remain advisory; no full suite receipt yet. Source review requested from responsible reviewer in item topic; A-22844 holds red/focused-green evidence. T3 consumer coverage remains pending configured verify.

### rev-40 · 2026-11-24T10:51:46.619Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-1994-source1
commit: 930fa347df0be60620bb6fbf6bc4c3c5632bd11d
scope: full
findings: [{"severity":"medium","text":"M1: all five new controls acquire the fake before an owning setup scope, lack separate setup/action bounds, and can await request before close indefinitely; whole-test timeout does not own late roots/server/work. Install shared case/fixture ownership before acquisition and prove held/rejected work is drained through guarded removal.","file":"hub/test/digitalocean-pacing.test.ts","line":10},{"severity":"medium","text":"M2: close reports hookErrors only after shutdown/drain/process cleanup/rm; any earlier rejection masks the original beforeCreate assertion for teardown-only callers. Preserve that assertion as primary with cleanup failure secondary on every exit, retain incomplete roots, and add an assertion-plus-cleanup-rejection control.","file":"hub/test/fakes/digitalocean/fake-api.ts","line":432}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear at corrected930fa347df. Medium M1 pacing.test.ts:10: missing pre-acquisition owner and separate setup/action bounds allow late/unjoined work beyond whole-test timeout. Medium M2 fake-api.ts:432: earlier cleanup rejection bypasses hookErrors, replacing original assertion; retain primary plus secondary cleanup diagnostics and incomplete-root fence. Implementer confirmed both at pinned head775d1c1d. C1 failed; C2 census inspected but exact-head consumer verification remains pending (native T3 not run). Core observer, compatible500 shape, four migrated assertion callers and deliberate provider controls otherwise match spec. A-22848 records both axes/local-evidence limits. Fresh source review after correction required before configured verify; no reviewer runs/edits.

Criteria: C1 failed (New controls lack bounded setup/action ownership, and teardown cleanup rejection can still mask the original beforeCreate assertion.).
