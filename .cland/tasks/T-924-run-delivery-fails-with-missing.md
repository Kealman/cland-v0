---
id: T-924
kind: task
title: Run delivery fails with missing prerequisite commits when a snapshot prepare finishes during run start (A-6898)
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-670
found_by: droplet
topic: topic-676
branch: t/T-924-run-delivery-fails-with-missing
created: 2026-10-20T01:19:43.164Z
updated: 2026-10-20T01:40:01.694Z
closed: 2026-10-20T01:40:01.694Z
---

## Summary

T-671's mode-free verify a5360642 (A-6898) failed delivery with `Repository lacks these prerequisite commits: 0f8cb85b…`, seconds after `cland executor prepare` finished at 01:10:44Z on 2026-10-20 (new image 250590125, snapshot cland-v0-2df697c7a3e6). The same head retried green (a4abcd86, A-6909). So the run's tree bundle was cut against the new snapshot's base commit while the droplet booted from an image without it (or the reverse): a race between snapshot switch-over and run start.

## What to build

Make a run's bundle base and its droplet image come from one snapshot record, read once per run, so a concurrent prepare can't split them. Alternatively, if the bundle's prerequisite is missing on the machine, fall back to a full bundle once instead of failing.

## Acceptance criteria

- [x] C1. A T2 test with a fake executor swaps the snapshot between bundle creation and machine creation, and the run still delivers (single record, or a full-bundle fallback).
  - verified: rev-31 [reviewer] · run rev-20261020-924-source-corrected · 2026-10-20T01:27:17.831Z · commit ead24b2b261895a8f19b8a7640eaa712572cd99b
  - done: impl-924 · 2026-10-20T01:35:22.163Z
  - verified: rev-31 [reviewer] · run rev-20261020-924-final · 2026-10-20T01:35:51.333Z · commit ead24b2b261895a8f19b8a7640eaa712572cd99b
- [x] C2. The cause is named in the report against A-6898 and the executor events.
  - verified: rev-31 [reviewer] · run rev-20261020-924-source-corrected · 2026-10-20T01:27:17.831Z · commit ead24b2b261895a8f19b8a7640eaa712572cd99b
  - done: impl-924 · 2026-10-20T01:35:22.654Z
  - verified: rev-31 [reviewer] · run rev-20261020-924-final · 2026-10-20T01:35:51.333Z · commit ead24b2b261895a8f19b8a7640eaa712572cd99b
- [x] C3. A mode-free verify at the reviewed head is green.
  - done: impl-924 · 2026-10-20T01:35:23.247Z
  - verified: rev-31 [reviewer] · run rev-20261020-924-final · 2026-10-20T01:35:51.333Z · commit ead24b2b261895a8f19b8a7640eaa712572cd99b

## Comments

### impl-924 · 2026-10-20T01:24:38.981Z

Implementation 2bee82ffe144a8d1908c9cbf47033dfaac2caadf pushed to origin. Cause and red→green evidence: A-6912, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6912-t-924-snapshot-race-cause-and-regression-evidence.md. Acquire/deliver independently read snapshot.json; active machine preceded executor-prepared publication by 2.718 s, and A-6898 lacked exactly the new base. Primary fix pins Snapshot on the lease; safety net retries only missing-prerequisite fetch once with full bytes. T2 fake regression exercises snapshot replacement, acquired prepare key, legacy lease fallback, normal delivery and bounded failure policy. Touched file 10/10 pass (5.18 s); new test 0.191 s. npm run check passed. Dry-run admission passed; source review next. No per-item QA required (qaPolicy scope none).

### rev-31 · 2026-10-20T01:26:26.118Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-924-source
commit: 2bee82ffe144a8d1908c9cbf47033dfaac2caadf
scope: full
findings: [{"severity":"medium","text":"M1: Retained machine.result fake emits preparation output for both newly split fetch and checkout/prepare calls; concatenated delivery.log has two lines while line108 requires one. Make fake step-specific, preserve exact output assertion and retain targeted native pass before fresh source review; T3 is absent from task verification.","file":"hub/test/executor-prepare.test.ts","line":66}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6914: source not clear, sole medium M1 retained native fake mismatch, confirmed by implementer91693b7c. Snapshot pinning/persistence and bounded prerequisite-only full fallback otherwise satisfy design; no additional Standards/Spec findings. C2cause independently corroborated against A-6898 and journalactive01:10:41.998Z/publication01:10:44.716Z. New T2 fake test is adequate and needs5/5 future receipts; local10/10 and exact-head dry-run are not final task evidence. Preserve native line108assertion; step-specific fake, targeted receipt, new source review before verify. No Reviewer tests/edits; QA none.

Criteria: C3 failed (Source change breaks a retained native delivery assertion; repair and fresh source review required before mode-free verification.).

### impl-924 · 2026-10-20T01:26:50.964Z

Source finding A-6914 corrected in ead24b2b: retained native fake emits prepare output only in the actual prepare step, exact one-line delivery.log assertion unchanged. Reproduced duplicate-output red; native fake-executor file 5/5 green (10.52 s, pinless case 0.819 s), receipt A-6915. Typecheck and revised admission dry-run passed. Fresh source review requested before verification; no dev merge after first review.

### rev-31 · 2026-10-20T01:27:17.831Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-924-source-corrected
commit: ead24b2b261895a8f19b8a7640eaa712572cd99b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6917: source clear, M1 resolved. Sole correction from2bee82ff makes native fixture result step-specific; exact delivery.log assertion and all other assertions unchanged. A-6915complete retained local native file5/5zero nonpasses,10.516690625s whole/pinless.818748834s (reported local provenance, no Linux claim). Production snapshot pinning/persistence, bounded prerequisite-only fallback, worktree/head/ref checks and T2fake regression unchanged and sound per A-6914. C1/C2verified; C2 independently corroborated against A-6898 and journaltimestamps. C3remains pending fresh configured mode-free green at this exact head, including new T2identity5/5. No findings; no Reviewer tests/edits; QA none.

Criteria: C1 verified, C2 verified.

### rev-31 · 2026-10-20T01:35:51.334Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-924-final
commit: ead24b2b261895a8f19b8a7640eaa712572cd99b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6925: final clear at unchanged ead24b2b. Whole A-6923 audit confirms1916ordinary+5load passes,zero nonpasses/no duration/resource/missing diagnostics. New snapshot-regression ordinary.073134457s,5distinctrepsmax.213444847s,explicit5/5at44586;file10/10,sum3.179529475s. Hostcheck/allT1/fallbackallT2bothpackages green. C1/C2sourceA-6917 remains applicable, C3nowestablished;allclaimantdoneconfirmed22159f06. M1resolved, no findings. Retained nativeA-6915local5/5 remains separate from deferred LinuxT3. QA none;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T01:40:01.694Z

Merged 1b509ea8d0afece648a45c06e2257487c2d9225d onto dev.
