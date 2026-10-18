---
id: E-676
kind: epic
title: "Tests at the right level, part 1: tiers, test lint and in-process simulation"
state: closed
rank: 4220
criterion_seq: 8
labels:
  - epic
  - v0.1.4
  - verification
assignee: null
parent: R-577
blocked_by: []
topic: topic-505
branch: null
created: 2026-10-16T19:58:43.022Z
updated: 2026-10-18T21:57:26.344Z
closed: 2026-10-18T21:57:26.344Z
---

## Summary

Week 0 and week 1 of D53. Every test file declares a tier in hub/test/tiers.json. A test lint reports, then refuses, tests at the wrong level, and per-tier budgets report what they would refuse. The hub gets the in-process seams that T1 and T2 tests need: a Clock with a FakeClock, an in-process fake adapter for the three harnesses, and an in-process spoke. Source: A-4143 (memo §5.1–5.5, report-strategy).

## Goal

New tests stop arriving at the wrong level, and the seams exist to move the old ones. Nothing changes what a run executes until the merge-queue epic switches the protocol.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. `hub/test/tiers.json` lists every hub and Neovim test file sorted by path, `shards.json` is gone, and the tier lint passes at the demo SHA.
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.072Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4
- [ ] C2. A task run and an integrated run at the demo SHA each show per-tier lines, the test-lint summary and the budget would-fail lines, and `cland verify --dry-run` prints the same without creating a queue entry or lease.
  - verified: qa-676 [qa] · run qa-2026-10-18-2 · 2026-10-18T15:52:33.051Z · commit e92fa663d08f269604e9e36f704d81be39d4d658
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.072Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4
- [ ] C3. A planted new T3 file without a lifecycle header, a planted new numeric sleep and a planted new `startDaemon` call site are each refused at verify and at merge admission.
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.073Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4
- [ ] C4. `projectHub` serves a project with a `FakeClock`, the in-process fake adapter in all three flavours and an in-process spoke, each proven by a T2 file whose spawn census row shows no hub, spoke, harness or Neovim child process (git and ps infrastructure probes are T-719’s).
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.073Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4
- [ ] C5. heartbeat.test.ts runs on the fake clock in 5 s or less (from 25.7 s) and passed 20/20 serially.
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.073Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4
- [ ] C6. Ten consecutive droplet task runs show no typecheck on the droplet and the host-gate reuse line.
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.073Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4
- [ ] C7. Over the last 40 landings at the demo SHA, the selection replay shows zero own-test misses, and the current selector selects more of those landings than the selector at A-10's merge base (6174032f) does on the same 40 landings.
  - verified: qa-676 [qa] · run qa-2026-10-18-2 · 2026-10-18T15:52:33.051Z · commit e92fa663d08f269604e9e36f704d81be39d4d658
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.073Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4
- [ ] C8. An Implementer's `cland verify all` is refused with `verify-all-reserved`, and the tier share baseline (A-12) is recorded on the epic.
  - verified: qa-676 [qa] · run qa-2026-10-18-5 · 2026-10-18T21:31:19.992Z · commit 0544169ac8d69b0827799e3584f1629940d9512a
  - verified: qa-676 [qa] · run qa-2026-10-18-6 · 2026-10-18T21:57:13.073Z · commit b500b8fe9c9c11143f64f9991225ca5abc38edb4

---

## Plan

```yaml
stages:
  - name: report only
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-679
        - T-681
        - T-683
        - T-720
      - - T-680
        - T-689
        - T-722
      - - T-685
        - T-686
        - T-687
      - - T-659
      - - T-688
  - name: stop the growth
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-682
        - T-730
        - T-735
        - T-743
        - T-744
        - T-747
        - T-741
        - T-684
      - - T-690
      - - T-729
      - - T-748
```

## Comments

### coord · 2026-10-17T08:27:54.039Z

Coordinator, 08:28Z: stage 1 'report only' is closed. Every ticket in it is merged, and integrated cover 41455236 at 010c9955 is green, 2471/0 with the Neovim phase (A-4396). The usual stage-close refresh of hub/test/durations.json is deferred to E-677 stage 1's close. Six open E-677 branches all edit allowances in that file, and a refresh commit now would conflict with every one of them. Ticket seconds are judged from each ticket's own evidence artifact in the meantime (rule posted on E-677).

### coord · 2026-10-17T16:01:55.816Z

Tier-share baseline from T-690 (A-4606, recorded by the Coordinator because Implementers can comment only on their own item): T1+T2 share of manifest seconds rises from 4.803229 % to 9.750444 % with T-690's retags. The manifest total is 4666.629951 s at the refreshed baseline (b16ad496). There are 46 retags. Six lower-qualified files stay at their tags on purpose (T4 by purpose, T3 by header, spoke-readiness pending T-743). The eight T-741 files are excluded. Existing wall-clock debt is listed in A-4606. This is the baseline E-677's exit and E-578 read (T-662 C3).

### coord · 2026-10-17T16:10:20.206Z

Correction to the T-690 baseline above, superseding A-4606's 46-retag figure: A-4608. After source review there are 30 safe retags, 10 to T1 and 20 to T2. 22 lower-qualified files keep their tags because their fixtures or helpers use resources the lower tier forbids (T-744 will make the lint see these), or because of T4 purpose, a T3 header or T-743.
Before: T1 31 files / 19.18 s, T2 46 / 204.97 s, T3 222 / 4358.59 s, T4 6 / 83.89 s.
After: T1 41 / 44.28 s, T2 61 / 350.37 s, T3 197 / 4188.09 s, T4 6 / 83.89 s.
T1+T2 share: 4.803229 % → 8.456862 % of 4666.629951 manifest seconds (305 files). This is the baseline E-677's exit and E-578 read.

### hub · 2026-10-18T11:42:03.096Z

demo 1bba1dd2-938f-4893-8bc3-141ad2d222bc created: droplet cland-v0-1bba1dd2, commit 54657bf8ced5beb64633db5b7315da873717b597, deadline 2026-10-18T12:55:46.457Z.

### hub · 2026-10-18T11:45:19.666Z

demo 1bba1dd2-938f-4893-8bc3-141ad2d222bc destroyed: lifetime 256236 ms; cost $0.0178.

### qa-676 · 2026-10-18T12:12:49.747Z

verdict: qa
result: not clear
by: qa-676 [qa]
run: qa-2026-10-18-1
commit: 54657bf8ced5beb64633db5b7315da873717b597
findings: [{"severity":"medium","text":"L2 delivered suite result is truncated during lint-tier details before mandatory T1–T4 and tier-share summary lines; A-5256 log contains them.","file":"hub/src/hub/suites.ts","line":113},{"severity":"medium","text":"R2/C7 committed >6 baseline threshold is unmet (6=6), despite controlled same-window improvement 5→6 and zero misses.","file":"qa/briefs/E-676.md"}]
finding_counts: {"high":0,"medium":2,"low":0}

| case | execution / inspection | result | evidence |
| --- | --- | --- | --- |
| G0 | local macOS / hub-api | PASS | G0.txt |
| G1 | local macOS / hub-api | PASS | G1-epic.json, G1-children.json, G1-ancestry.txt |
| G2 | local macOS / hub-api | PASS | G2-hold.txt |
| G3 | local macOS / hub-api | PASS | G3-ruling.txt, G3-admission-diff.txt |
| L1 | local macOS / hub-api | PASS | L1-dry.txt, L1-dry.json, L1-queue.txt |
| L2 | Linux run / local log read | FAIL | L2-submit.json, L2-result.txt, L2-log-check.txt, L2-result-check.txt, A-5256-suite-01a2956c-cff7-4229-92f5-224afc3b8852-auto-at-54657bf.log |
| L3 | Linux run / local log read | PASS | L3-log-check.txt, L3-result.txt, A-5244-suite-487fb5f1-ca75-4fd9-ba80-d5c8f2242f6f-all-at-54657bf.log, A-5245-suite-487fb5f1-ca75-4fd9-ba80-d5c8f2242f6f-shard-1-at-54657bf.log, A-5246-suite-487fb5f1-ca75-4fd9-ba80-d5c8f2242f6f-shard-2-at-54657bf.log |
| D0 | Linux droplet | PASS | D0-start.json, D0-status.json |
| D1 | Linux droplet | PASS | D1-build.txt |
| D2 | Linux droplet | PASS | D2-tiers.txt, D2-tiers-full.log, D2-ruling.txt |
| D3 | Linux droplet | PASS | D3-census.txt |
| D4 | Linux droplet | PASS | D4-heartbeat.txt |
| D5 | Linux droplet | PASS | D5-full.log, D5-summary.txt |
| D6a | Linux droplet | PASS | D6a-full.log, D6a-summary.txt |
| D6b | Linux droplet | PASS | D6b-full.log, D6b-summary.txt |
| D6c | Linux droplet | PASS | D6c-full.log, D6c-summary.txt |
| D6d | Linux droplet | PASS | D6d-full.log, D6d-summary.txt |
| D7a | Linux droplet | PASS | D7a-full.log, D7a-summary.txt |
| D7b | Linux droplet | PASS | D7b-full.log, D7b-summary.txt |
| D8 | Linux droplet | PASS | D8-full.log, D8-summary.txt |
| D14 | Linux droplet | PASS | D14-status.json, D14-dev.txt |
| D15 | local macOS / hub-api | PASS | D15-stop.json, D15-after.json, D15-comments.txt |
| L4 | local macOS / hub-api | PASS | L4-execution.txt, L4-control-lint.txt |
| L5 | local macOS / hub-api | PASS | L5-execution.txt, L5-dry.txt, L5-lint.txt |
| L6 | local macOS / hub-api | PASS | L6-execution.txt, L6-dry.txt, L6-lint.txt |
| L7 | local macOS / hub-api | PASS | L7-execution.txt, L7-dry.txt, L7-lint.txt |
| L8 | local macOS / hub-api | PASS | L8-cleanup.txt |
| L9 | local macOS / hub-api | PASS | L9-execution.txt, L9-all.txt |
| R1 | local macOS / hub-api | PASS | R1-host-gate.txt |
| R2 | local macOS / hub-api | FAIL | R2-replay.md, R2-execution.txt |
| R2b | local macOS / hub-api | PASS | R2b-replay-base-selector.md |
| R3 | local macOS / hub-api | PASS | R3-record.txt, R3-epic.json |
| R4 | local macOS / hub-api | PASS | R4-record.txt |
| R5 | local macOS / hub-api | PASS | R5-record.txt |

Verdict: **not clear**, run `qa-2026-10-18-1`, tested commit `54657bf8ced5beb64633db5b7315da873717b597`.

Findings (medium; no high or low findings):

1. **L2 / C2 — delivered suite result loses its tier summaries.** `cland verify --fresh --report topic-505 --to coord --to qa-676 --json` ran green as `01a2956c-cff7-4229-92f5-224afc3b8852`. A-5256 contains all four tier lines, tier share, lint, budget and ratchet lines plus host-gate reuse. But the actual delivered message and `history` copy end mid `test lint tie`: zero T1/T2/T3/T4 lines and zero tier-share lines; lint summary and exactly ten would-fail lines survive. `hub/src/hub/suites.ts:113` includes every lint-tier detail before the final tier summary at line 125. The delivered summary fails the brief even though the underlying run and log pass. No fix or retry performed.
2. **R2 / C7 — committed selection threshold unmet.** `node hub/test/selection-replay.ts 54657bf8ced5beb64633db5b7315da873717b597 --coverage` exits 0, covers 40/40 landings, selects 6, and has zero own and historical misses. A-4300's recorded baseline is also 6; the committed R2 bar requires more than 6. Informational R2b, using selector `6174032f0b3a99c29c9cfaa04eb16a138506f5ee` over the same 40 landings, gives 5 with zero misses: the controlled comparison improves **5→6**, whereas the absolute recorded-baseline comparison is **6=6**. This is an unmet acceptance threshold, not evidence of a selector regression. Coordinator proposed the controlled comparison, explicitly left QA the choice, then accepted preserving FAIL for this pass and a prospective criterion revision.

Criterion marks: fail C2 (L2 delivered summary) and C7 (R2 committed threshold). C1, C3, C4, C5, C6 and C8 passed their checks; this not-clear verdict carries no verified marks, as the brief requires. R2b is informational.

Accounting:

- Demo: Linux x86_64, Node v24.21.0, machine `cland-v0-1bba1dd2`, lease `1bba1dd2-938f-4893-8bc3-141ad2d222bc`, deadline `2026-10-18T12:55:46.457Z`. Confirmed released; lifetime 256236 ms, cost **$0.01779417**. All D5–D8 files passed first attempt. Heartbeat: 20/20 serial runs, 9/9 tests each, maximum 1649.825177 ms. Four seam census rows all `{}`.
- L2 task run: A-5256; `01a2956c-cff7-4229-92f5-224afc3b8852`, `cland-v0-6c04def4`, c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5. 2575 tests, 2567 pass, 0 fail, 8 skip. Suite duration 1659.05 s; lifetime 1766 s; cost **$0.1226**. Full result received at 12:10:39.498Z. macOS-only skips do not invalidate the Linux reporting checks.
- L3 integrated run: A-5244; `487fb5f1-ca75-4fd9-ba80-d5c8f2242f6f`, same S, same Linux/Node/Neovim versions; 2575 tests, 2567 pass, 0 fail, 8 skip. Shard 1 A-5245: `cland-v0-adbcce06`, c-8 lon1, duration 884.42 s, lifetime 854 s, **$0.0593**. Shard 2 A-5246: `cland-v0-708c593f`, c-8 lon1, duration 853.42 s, lifetime 829 s, **$0.0576**. Merged total wall 907.31 s, total cost **$0.1169**.
- Combined attributable demo + task + integrated cost: **approximately $0.25729417**, using the hub's rounded suite costs. Local inspections have no droplet cost.

Execution notes:

- G3 passes under Coordinator ruling `6c1529e6-4d22-439a-8887-a060ab4e8e30`: the specified admission-path diff from live-hub restart tree 80e90ab2 to S is empty; later adapter-only code is outside that surface.
- D2 passes under Coordinator correction `9b857ee5-da7c-4f44-84ee-6b7dd3192459`: test:tiers intentionally prints two hub phase lines, not the brief's three. Full output: `hub free: 53 files, 1 workers`; `hub machine: 279 files, 4 workers`. Manifest is complete and sorted, 371/371 including Neovim; both lints exit 0; shards.json absent.
- Recorder accepts hub-api, not the brief's droplet/local macOS surface names. Every manual case is recorded as hub-api, with location in its method; demo checks carry the recorder's droplet accounting. L2/L3 records describe local inspection of remote run evidence. No recorder code changed.
- The first extraction of R3–R5 shell text selected expected-output prose and failed shell parsing before any check executed; the extraction was corrected, then each real check ran once. Error captures retained for transparency.
- All three plant branches and their worktree were removed; zero qa refs reached origin. The build worktree stayed clean at S throughout L2. The demo is released. Final demo freshness is current; dev remains S. Build worktree and hold are removed/released after the verdict.

QA elapsed from hold at 2026-10-18T11:39:18.609000+00:00 to report at 2026-10-18T12:12:26.463172+00:00: 1987.85 seconds.

Evidence bundle A-5257: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5257-e-676-qa-run-qa-2026-10-18-1-evidence
Report A-5258: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5258-e-676-qa-not-clear-c2-summary-truncation-and-c7-threshold.md

Criteria: C2 failed (L2 delivered result truncates at 8192 bytes before all four per-tier lines and tier share; full log is complete.), C7 failed (R2 selects 6 landings, equal to recorded baseline 6, not greater; same-window comparison is 5→6 with zero misses.).

### coord · 2026-10-18T12:13:21.455Z

C7 revised prospectively (coord, 2026-10-18 12:14Z) after QA run qa-2026-10-18-1 (A-5258). The old bar compared the selecting count at the demo SHA with A-4300's recorded 6, which was measured over a different window of 40 landings. Two populations can't show whether selection improved. The revised C7 compares the merge-base selector and the current selector on the same 40 landings, the controlled comparison in the brief's R2b. qa-2026-10-18-1 measured 5 → 6 there with 0 misses. The FAIL recorded under the old bar stands; a re-run limited to C2 (after T-800) and the revised C7 will be requested. C2's finding is filed as T-800.

### qa-676 · 2026-10-18T15:52:33.051Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-18-2
commit: e92fa663d08f269604e9e36f704d81be39d4d658
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | execution / inspection | result | evidence |
| --- | --- | --- | --- |
| PREP | local macOS / hub-api | PASS | G0.txt, G1-epic.json, G1-T800.txt, G2-hold.txt, G3-hub.txt, request-scope.txt |
| L1 | local macOS / hub-api | PASS | L1-exits.txt, L1-dry.txt, L1-dry.json, L1-queue.txt |
| L2 | Linux droplet / local log inspection | PASS | L2-submit.json, L2-result.txt, L2-line-counts.txt, A-5404-suite-6e0beb15-c5ce-4b97-887d-731c53e7157f-auto-at-e92fa66.log |
| L3 | Linux droplet / local log inspection | PASS | L3-result.txt, L3-logs-check.txt, L3-line-counts.txt, L3-unrelated-failure.txt, A-5401-suite-ac462603-f8ef-4956-9445-f874dde9f621-all-at-e92fa66.log, A-5402-suite-ac462603-f8ef-4956-9445-f874dde9f621-shard-1-at-e92fa66.log, A-5403-suite-ac462603-f8ef-4956-9445-f874dde9f621-shard-2-at-e92fa66.log |
| R2 | local macOS / hub-api | PASS | R2-replay.md, R2-execution.txt |
| R2b | local macOS / hub-api | PASS | R2b-replay-base-selector.md, R2-execution.txt |
| FRESH | local macOS / hub-api | PASS | final-freshness.json, final-build.txt |

**QA clear for C2 and C7 only.** Run `qa-2026-10-18-2`; tested commit `e92fa663d08f269604e9e36f704d81be39d4d658`. Coordinator request `ac42fe8d-15f1-4e33-8645-dfb44130b740` limits this pass to those two criteria. Verify **C2,C7**; do not mark the other criteria in this run.

In-scope findings: none (high, medium or low).

C2: `cland verify --dry-run` text and JSON both exit 0, plan T1–T3, and leave QA queue/run counts at 0→0. Fresh task `6e0beb15-c5ce-4b97-887d-731c53e7157f` (A-5404) is green: 2622 tests, 2614 pass, 0 fail, 8 skip. Its actual delivered message, recovered through history, contains each T1–T3 line, tier share, lint summary, exactly ten would-fail budget lines, ratchet and the final log link. Its full log confirms the same reporting and one host-gate reuse line. The earlier truncation is resolved.

Integrated stage run `ac462603-f8ef-4956-9445-f874dde9f621` at the same S has T1–T4, share, lint summary, exactly ten delivered budget lines and ratchet in its complete delivered message; merged A-5401 and shard logs A-5402/A-5403 agree. Reporting passes even though the stage suite is red on the unrelated failure below, as the brief and requester specify.

Tier policy: T-714, commit `e2a8e937`, excludes T4 from ordinary task/batch runs and includes it for stage/epic/release occasions. `hub/src/suite-shards.ts:174` implements that exclusion. Coordinator confirmation `4ae38739-0c65-4297-8b9c-9b70883f5882` explicitly directs judging per-tier completeness against each run's plan. Thus task/dry-run require T1–T3; this stage run requires T1–T4.

C7: the criterion was prospectively revised before this request (Coordinator comment 2026-10-18T12:13:21.455Z). `node hub/test/selection-replay.ts <S> --coverage` and `node hub/test/selection-replay.ts <S> 6174032f0b3a99c29c9cfaa04eb16a138506f5ee --coverage` each exit 0 over the identical 40 landings, 42 maps and 777 retained run logs. Current selector selects **6**, merge-base selector selects **5**. Both have **zero own-test misses and zero historical misses**. **6>5 passes revised C7.** The old run's FAIL against its then-current absolute 6 baseline remains valid historical evidence.

Outside scope — medium, already filed **T-809 (E-482)**: stage run has 2668 tests, 2659 pass, 1 fail, 8 skip. `nvim/test/thread.test.ts:718`, “generated live appends, ask evictions and delivery changes equal a full render”, timed out waiting for generated append within 10000 ms on shard 1 (A-5402). Reported to the Coordinator as Bugs, estimated S; Coordinator confirmation `fcfc6681-98bd-4bbf-8537-04e0bdbeb707` says T-809 tracks it and C2 is reporting-only. No local tests or rerun were performed under cover-quiet. This verdict does not claim the stage suite is green.

Scope carried from earlier pass: cite `qa-2026-10-18-1`, report **A-5258** and evidence **A-5257**, for C1/C3/C4/C5/C6/C8. Those six were not rerun or marked verified here. D7's source-test coverage also remains in that earlier pass; this request explicitly narrowed C2 execution to dry-run, fresh task reporting and integrated reporting.

Accounting:

- No demo lease was started in this limited pass; demo cost $0. Status returned the old released lease metadata while assessing requested S freshness; that historical lease was not reused for execution.
- L2 task: `cland-v0-ff121fc8`, c-8 lon1; Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; 2 workers. Suite duration **1335.84 s**, lifetime **1419 s**, cost **$0.0985**. Log **A-5404**.
- L3 stage: same platform/tool versions; 2 c-8 lon1 shards. Shard 1 `cland-v0-04104c0c`, duration **953.73 s**, lifetime **918 s**, cost **$0.0637**, log **A-5402**, exit 1. Shard 2 `cland-v0-daa3eb49`, duration **837.72 s**, lifetime **828 s**, cost **$0.0575**, log **A-5403**, exit 0. Merged wall **953.88 s**, total cost **$0.1212**, log **A-5401**.
- Combined task + integrated cost **$0.2197** using rounded hub receipts. Local dry-run/replay/log inspection has no droplet cost. Runs overlap; summed suite durations are not elapsed wall time.

Safety/freshness: detached build remained clean at S throughout the fresh task run. No plant branch or demo lease in this pass. Final `cland demo status E-676 --commit <S> --json` returns `freshness.current: true`, despite dev advancing to `a4e8b92e0e9560f75b7f128ffd64088be88a1d79`. Recorder uses hub-api for manual checks; methods identify remote execution/local inspection. Hold and build worktree are released/removed after verdict.

Elapsed QA wall from hold to report 2026-10-18T15:52:19.233324+00:00: 1618.92 s.

Report A-5406: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5406-e-676-c2-c7-qa-clear-at-e92fa663.md
Evidence A-5405: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5405-e-676-limited-c2-c7-rerun-evidence-qa-2026-10-18-2

Criteria: C2 verified, C7 verified.

### hub · 2026-10-18T15:55:45.803Z

demo e493eef4-609f-468b-a791-689f02fe018e created: droplet cland-v0-e493eef4, commit e92fa663d08f269604e9e36f704d81be39d4d658, deadline 2026-10-18T17:09:33.487Z.

### hub · 2026-10-18T16:04:12.459Z

demo e493eef4-609f-468b-a791-689f02fe018e destroyed: lifetime 260817 ms; cost $0.0181.

### qa-676 · 2026-10-18T16:06:24.776Z

verdict: qa
result: not clear
by: qa-676 [qa]
run: qa-2026-10-18-3
commit: e92fa663d08f269604e9e36f704d81be39d4d658
findings: [{"severity":"medium","text":"L6 and L7: planted sleep/startDaemon verify --dry-run each timed out at 15000 ms; expected verify-test-lint refusal not observed. Local lint and queue checks passed; quiet-machine recheck pending."}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Location | Result | Evidence |
| --- | --- | --- | --- |
| PREP | local macOS / hub-api | PASS | [G0.txt](G0.txt), [G1-epic.json](G1-epic.json), [G1-children.json](G1-children.json), [G2-hold.txt](G2-hold.txt), [G3-hub.txt](G3-hub.txt), [request-scope.txt](request-scope.txt) |
| D0 | droplet | PASS | [D0-start.json](D0-start.json), [D0-status.json](D0-status.json) |
| D1 | droplet | PASS | [D1-build.txt](D1-build.txt) |
| D2 | droplet | PASS | [D2-tiers.txt](D2-tiers.txt) |
| D3 | droplet | PASS | [D3-census.txt](D3-census.txt) |
| D4 | droplet | PASS | [D4-heartbeat.txt](D4-heartbeat.txt) |
| D5 | droplet | PASS | [D5-full.log](D5-full.log), [D5-summary.txt](D5-summary.txt) |
| D6a | droplet | PASS | [D6a-full.log](D6a-full.log), [D6a-summary.txt](D6a-summary.txt) |
| D6b | droplet | PASS | [D6b-full.log](D6b-full.log), [D6b-summary.txt](D6b-summary.txt) |
| D6c | droplet | PASS | [D6c-full.log](D6c-full.log), [D6c-summary.txt](D6c-summary.txt) |
| D6d | droplet | PASS | [D6d-full.log](D6d-full.log), [D6d-summary.txt](D6d-summary.txt) |
| D7a | droplet | PASS | [D7a-full.log](D7a-full.log), [D7a-summary.txt](D7a-summary.txt) |
| D7b | droplet | PASS | [D7b-full.log](D7b-full.log), [D7b-summary.txt](D7b-summary.txt) |
| D8 | droplet | PASS | [D8-full.log](D8-full.log), [D8-summary.txt](D8-summary.txt) |
| D14 | droplet | PASS | [D14-status.json](D14-status.json) |
| L4 | local macOS / hub-api | PASS | [L4-execution.txt](L4-execution.txt), [L4-control-lint.txt](L4-control-lint.txt) |
| L5 | local macOS / hub-api | PASS | [L5-execution.txt](L5-execution.txt), [L5-dry.txt](L5-dry.txt), [L5-lint.txt](L5-lint.txt) |
| L6 | local macOS / hub-api | INCONCLUSIVE | [L6-execution.txt](L6-execution.txt), [L6-dry.txt](L6-dry.txt), [L6-lint.txt](L6-lint.txt) |
| L7 | local macOS / hub-api | INCONCLUSIVE | [L7-execution.txt](L7-execution.txt), [L7-dry.txt](L7-dry.txt), [L7-lint.txt](L7-lint.txt) |
| L8 | local macOS / hub-api | PASS | [L8-cleanup.txt](L8-cleanup.txt) |
| L9 | local macOS / hub-api | PASS | [L9-execution.txt](L9-execution.txt), [L9-all.txt](L9-all.txt) |
| R1 | local macOS / hub-api | PASS | [R1-host-gate.txt](R1-host-gate.txt) |
| R3 | local macOS / hub-api | PASS | [R3-record.txt](R3-record.txt), [R3-epic.json](R3-epic.json) |
| R4 | local macOS / hub-api | PASS | [R4-record.txt](R4-record.txt) |
| R5 | local macOS / hub-api | PASS | [R5-record.txt](R5-record.txt) |
| D15 | local macOS / hub-api | PASS | [D15-stop.json](D15-stop.json), [D15-current.json](D15-current.json) |

Medium — L6 and L7, C3: `cland verify --dry-run` on each planted head returned `cland: the hub did not answer on /Users/evgeniyivanov/Projects/cland/v0/.cland/hub.sock within 15000 ms`, rather than the required `verify-test-lint` refusal. L6 planted a numeric sleep at hub/test/project-clock.test.ts:101; L7 planted startDaemon at hub/test/in-process-spoke.test.ts:64. Both local `npm run test:lint` runs correctly refused the exact planted violation, and queue/run counts stayed mine 0→0, atS 1→1. Admission results are INCONCLUSIVE. No high or low findings.

Verdict: **not clear**, run `qa-2026-10-18-3`, commit `e92fa663d08f269604e9e36f704d81be39d4d658`. Scope is C1, C3, C4, C5, C6 and C8 under Coordinator request 9da4aa38-4c3d-4901-a49e-e299a7cf2231. Failed criterion mark: C3 (L6/L7 inconclusive). C1, C4, C5, C6 and C8 passed; this not-clear verdict adds no verified marks. C2 and C7 remain covered by clear `qa-2026-10-18-2` at this same SHA, evidence A-5405 and report A-5406.

C1: D2 compares all 384 files to the manifest, no missing/extra entries, sorted paths, both lints exit 0 and shards.json absent. Counts T1=60, T2=132, T3=182, T4=10. Per Coordinator ruling 9b857ee5-da7c-4f44-84ee-6b7dd3192459, test:tiers intentionally prints only hub shards; exact output:

```
hub free: 60 files, 1 workers
hub machine: 284 files, 4 workers
```

C3: D6a–D6d pass (6/7/5/30 tests); L4 clean lint exits 0; L5 new T3 file fails both admission and lint as expected. L6/L7 remain inconclusive only at admission. L8 removed all three plant branches and the plant worktree, with no qa refs at origin and a clean build worktree. The brief uses local lint plus D6a as merge-admission proof; no live merge was attempted.

C4: D3 passes all four T2 files with empty process census rows; R5 confirms FakeClock, three fake harness flavours and in-process spoke. C5: D4 heartbeat passes 20/20 serially, 9/9 tests each, maximum 1617.64372 ms; R4 confirms FakeClock and no real waits/process helpers. C6: D8 executor-run passes 14 tests; R1's newest ten droplet task logs each show host gate=1, reuse=1, droplet typecheck=0, droplet npm check=0 (A-5407, A-5404, A-5399, A-5388, A-5387, A-5385, A-5369, A-5338, A-5336, A-5325). C8: D5 verifies all-mode admission (1 test); L9 returns verify-all-reserved without queue mutation; R3 finds tier-share baseline records A-4606/A-4608 and closed T-690.

Coordinator ruling e14c1fef-073e-4b4a-83cf-2d50ba11968c requested recording L6 inconclusive and finishing. Message 7a7b7c8e-ebc1-4afe-89a6-dd0bc951620f includes L7 in the future quiet-Mac pass and asks for each dry-run's wall time. Concurrent macOS stage b50559f3 and a cold lint-cache miss are suspected causes, not established. No regression is asserted from this loaded-machine observation. That recheck requires a new run id after the Coordinator signals the machine is quiet.

Demo executor: droplet, Linux x86_64, Node v24.21.0, machine `cland-v0-e493eef4`, lease `e493eef4-609f-468b-a791-689f02fe018e`, created 2026-10-18T15:54:35.412Z, deadline 2026-10-18T17:09:33.487Z. Hub-confirmed released lifetime **260817 ms**, cost **$0.018112291666666665** (D15-current.json). Stop initially returned releasing; later status confirmed released and freshness.current=true. Earlier releasing-state estimates are superseded by that final result. Total remote cost of this pass is $0.0181123, one lease, no shards or additional full suite. Local checks incur no droplet cost. Pass elapsed wall time from hold at 15:54:26Z through D15 recording at 16:04:56Z is approximately 630 s, including release confirmation and local evidence collection.

Full-suite receipts at S were collected in run 2: task 6e0beb15-c5ce-4b97-887d-731c53e7157f (A-5404) green; integrated ac462603-f8ef-4956-9445-f874dde9f621 (A-5401, A-5402/A-5403 shards) had the unrelated T-809 Neovim timeout. A-5406 records their machines, durations, lifetimes and costs; those costs are not charged again here. No local tests or full suites ran during this pass. Only individual remote test files, authorized local lint/dry-run and read-only records were exercised.


Published evidence: A-5409 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5409-e-676-run-3-evidence-at-e92fa663 (relative table links resolve there). Report: A-5410 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5410-e-676-run-3-qa-not-clear-l6-l7-admission-inconclusive.md.

Criteria: C3 failed (L6/L7 verify dry-runs timed out after 15000 ms; admission refusal INCONCLUSIVE despite correct local lint refusals and unchanged queue.).

### hub · 2026-10-18T20:07:39.139Z

demo 8ea57fe6-89b9-47b5-b35b-859311cee20f created: droplet cland-v0-8ea57fe6, commit 0544169ac8d69b0827799e3584f1629940d9512a, deadline 2026-10-18T21:21:22.177Z.

### hub · 2026-10-18T20:10:59.388Z

demo 8ea57fe6-89b9-47b5-b35b-859311cee20f destroyed: lifetime 261200 ms; cost $0.0181.

### qa-676 · 2026-10-18T21:31:19.992Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-18-5
commit: 0544169ac8d69b0827799e3584f1629940d9512a
findings: [{"severity":"low","text":"L6/L7 correct admission refusals took 5.686s/5.564s; no timeouts. Residual latency slightly above prior ~5s investigation threshold reported to Coordinator as T-811 follow-up context; no criterion failure."}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Location | Result | Evidence |
| --- | --- | --- | --- |
| G0 | local macOS / hub-api | PASS | [G0.txt](G0.txt) |
| G1 | local macOS / hub-api | PASS | [item.json](item.json), [G1-children.json](G1-children.json), [G1-ancestry.txt](G1-ancestry.txt) |
| G2 | local macOS / hub-api | PASS | [item.json](item.json) |
| R3 | local macOS / hub-api | PASS | [R3-record.txt](R3-record.txt), [R3-epic.json](R3-epic.json) |
| R4 | local macOS / hub-api | PASS | [R4-record.txt](R4-record.txt) |
| R5 | local macOS / hub-api | PASS | [R5-record.txt](R5-record.txt) |
| D0 | droplet | PASS | [D0-start.json](D0-start.json) |
| D1 | droplet | PASS | [D1-build.txt](D1-build.txt) |
| D2 | droplet | PASS | [D2-tiers.txt](D2-tiers.txt) |
| D3 | droplet | PASS | [D3-census.txt](D3-census.txt) |
| D4 | droplet | PASS | [D4-heartbeat.txt](D4-heartbeat.txt) |
| R2 | local macOS / hub-api | PASS | [R2-replay.md](R2-replay.md), [R2b-replay-base-selector.md](R2b-replay-base-selector.md) |
| R2b | local macOS / hub-api | PASS | [R2b-replay-base-selector.md](R2b-replay-base-selector.md) |
| D5 | droplet | PASS | [D5-full.log](D5-full.log), [D5-summary.txt](D5-summary.txt) |
| D6a | droplet | PASS | [D6a-full.log](D6a-full.log), [D6a-summary.txt](D6a-summary.txt) |
| L4 | local macOS / hub-api | PASS | [L4-control-lint.txt](L4-control-lint.txt), [L4-execution.txt](L4-execution.txt) |
| R1 | local macOS / hub-api | PASS | [R1-host-gate.txt](R1-host-gate.txt) |
| D6b | droplet | PASS | [D6b-full.log](D6b-full.log), [D6b-summary.txt](D6b-summary.txt) |
| D6c | droplet | PASS | [D6c-full.log](D6c-full.log), [D6c-summary.txt](D6c-summary.txt) |
| D6d | droplet | PASS | [D6d-full.log](D6d-full.log), [D6d-summary.txt](D6d-summary.txt) |
| D7a | droplet | PASS | [D7a-full.log](D7a-full.log), [D7a-summary.txt](D7a-summary.txt) |
| D7b | droplet | PASS | [D7b-full.log](D7b-full.log), [D7b-summary.txt](D7b-summary.txt) |
| D8 | droplet | PASS | [D8-full.log](D8-full.log), [D8-summary.txt](D8-summary.txt) |
| D14 | droplet | PASS | [D14-status.json](D14-status.json), [D14-dev.txt](D14-dev.txt) |
| D15 | local macOS / hub-api | PASS | [D15-stop.json](D15-stop.json), [D15-after.json](D15-after.json) |
| G3 | local macOS / hub-api | PASS | [G3-hub.txt](G3-hub.txt), [G3-restarted.txt](G3-restarted.txt), [resume-freshness.json](resume-freshness.json) |
| L1 | local macOS / hub-api | PASS | [L1-dry.txt](L1-dry.txt), [L1-dry.json](L1-dry.json), [L1-queue.txt](L1-queue.txt) |
| L5 | local macOS / hub-api | PASS | [L5-execution.txt](L5-execution.txt), [L5-dry.txt](L5-dry.txt), [L5-lint.txt](L5-lint.txt) |
| L6 | local macOS / hub-api | PASS | [L6-L7-execution.txt](L6-L7-execution.txt), [L6-dry.txt](L6-dry.txt), [L6-timing.json](L6-timing.json), [L6-lint.txt](L6-lint.txt), [L6-queue.txt](L6-queue.txt) |
| L7 | local macOS / hub-api | PASS | [L6-L7-execution.txt](L6-L7-execution.txt), [L7-dry.txt](L7-dry.txt), [L7-timing.json](L7-timing.json), [L7-lint.txt](L7-lint.txt), [L7-queue.txt](L7-queue.txt) |
| L8 | local macOS / hub-api | PASS | [L8-cleanup.txt](L8-cleanup.txt) |
| L9 | local macOS / hub-api | PASS | [L9-all.txt](L9-all.txt), [L9-execution.txt](L9-execution.txt) |
| L3 | local macOS / hub-api | PASS | [L3-summary.txt](L3-summary.txt), [L3-result.txt](L3-result.txt), [L3-T4-support.txt](L3-T4-support.txt), [request-rulings.txt](request-rulings.txt), [after-plants-freshness.json](after-plants-freshness.json) |
| L2 | droplet | PASS | [L2-submit.json](L2-submit.json), [L2-result.txt](L2-result.txt), [L2-summary.txt](L2-summary.txt) |

No high or medium finding. Low observation — L6/L7 admission now correctly refuses both planted violations, with measured wall times 5.686447375 s and 5.563625209 s. This is slower than the earlier approximate 5 s investigation threshold, but within the CLI deadline and functionally PASS. Timings reported to Coordinator as T-811 follow-up context. Prior 15 s timeouts were not reproduced.

Run qa-2026-10-18-5 tests **0544169ac8d69b0827799e3584f1629940d9512a**. All C1–C8 are in scope: Coordinator initially requested C1/C3/C4/C5/C6/C8 and conditional C2/C7, then accepted full scope when prior e92fa663 freshness returned false. Verdict **clear**: all 34 checks PASS. Verified marks: **C1,C2,C3,C4,C5,C6,C7,C8**, all in run qa-2026-10-18-5. Final freshness.current=true before publication; hub will recheck when recording.

C1: 405/405 test files match the sorted manifest, no missing/extra entries; tiers T1=65,T2=150,T3=180,T4=10. Both tier lints exit0; shards.json absent. Exact test:tiers lines: `hub free: 65 files, 1 workers`; `hub machine: 288 files, 4 workers`. Clean static lint exits0,185 findings in98files, zero refusals.

C2: L1 text/JSON exit0, requested head, no run id, queue/run counts0→0. Actual task plan is T1–T3 with share/lint/10budget/ratchet reporting. D7a/b pass4tests each. L3 green integrated receipt **ccf0b8ea-73d0-4ec1-9c31-b3be057d2c60**, full SHA **dc05341fab56e071f05a5d1319557d3a2358fece**, accepted under explicit Coordinator ruling ef60e417 and S freshness.current=true. Per ruling d156e0ee, C2 judges per-tier lines for the tiers actually planned: ordinary batch T1–T3. T4 support exists separately in A-5551 and A-5555 at c74179448170fa6937810403a6a0bd983eab0e57 (10files/46tests;118.805s Linux,83.577s macOS). These stage receipts are supporting evidence only. L2 PASS: fresh task22d4ba43 at S,2656tests/2648pass/0fail/8skip. Its log and delivered receipt contain all planned T1–T3 lines, share, lint summary, budget would-fail lines (9 in receipt), T3 ratchet and host-gate reuse. Artifact A-5587.

C3: L5 new T3 lifecycle header, L6 numeric wait and L7 startDaemon are each refused by verify-test-lint and local test:lint, exactly at planted lines1/101/64. Own queue count1→1 and atS count1→1 (the authorized L2 run); no plant created a run. Three plant branches and plant worktree removed. D6a/b/c/d pass6/7/6/30tests. No live merge attempted; the brief's local lint plus merge-gate test establishes merge admission.

C4: all four T2 files pass with census rows{}, no child hub/spoke/harness/Neovim. Static files show FakeClock, all three harness flavours and inProcessSpoke. C5: heartbeat20/20 serial,9/9 each, max1582.576576ms; baseline1.676902s,FakeClock4,no waits/helpers. C6: newest ten droplet task logs at R1 check time A-5547,A-5542,A-5536,A-5534,A-5528,A-5521,A-5517,A-5507,A-5505,A-5501 each gate1/reuse1/droplet-typecheck0/npmcheck0; D8 passes14tests. C7: same40landings,48maps,804retained logs; current5selected versus baseline6174032f's4selected,zero own misses. Both replays exit1 solely for one historical miss T-806/hub/test/init-next.test.ts outside changed-function coverage, excluded from the criterion by the committed brief. C8: verify-all test passes1test, live QA all dry-run refuses verify-all-reserved without queue mutation, tier-share baseline A-4606/A-4608 recorded and T-690 closed.

G3 initially waited for hub restart14; no live admission check ran against stale code. Observed restarted hub21:06:36.563Z is newer than latest hub code19:11:04Z. Coordinator holds epic-file merges; final-freshness.json confirms S remains current. The clean build worktree remained unchanged throughout L2.

Demo **8ea57fe6-89b9-47b5-b35b-859311cee20f**, machine cland-v0-8ea57fe6, Linux x86_64,Node24.21.0; created20:06:24.096Z,deadline21:21:22.177Z. Confirmed released lifetime261200ms,cost$0.01813888888888889. D1–D8 all pass with no reruns. Local cases incur no droplet cost. Interim artifact A-5557 contains the pre-restart evidence.

Integrated receipt A-5567:2657tests,2649pass,0fail,8skips; Linux x64 kernel6.8.0-142-generic,Node24.21.0,Neovim0.12.5,2workers. Shard1 A-5568,cland-v0-ba9ba0f2,c-8lon1,duration888.01s,lifetime874s,cost$0.0607. Shard2 A-5569,cland-v0-cf2a6c73,c-8lon1,duration776.01s,lifetime765s,cost$0.0532. Merged wall906.65s,total$0.1139. L3-result.txt preserves the delivered receipt including budget lines and log links. No additional integrated run submitted. L2 A-5587: machine cland-v0-168303b1,c-8lon1,Linux x64 kernel6.8.0-142-generic,Node24.21.0,Neovim0.12.5,2workers; suite1253.53s,lifetime1331s,cost$0.0925. Total incremental run5 remote cost (demo plus fresh task) $0.1106389; including reused integrated receipt $0.2245389, with no double charging of supporting stage receipts. From hold20:05:43.455Z to final task receipt21:30:30.783Z total elapsed5087.328s (84m47.328s), including the wait for restart14. The integrated suite occurred separately and its wall906.65s is reported above, not added to overlapping elapsed time.


Evidence A-5588: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5588-e-676-final-qa-evidence-at-0544169a-all-criteria-pass (relative case links resolve here). Report A-5589: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5589-e-676-qa-clear-at-0544169a-c1-through-c8.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### hub · 2026-10-18T21:34:11.415Z

demo a22310bf-9e03-49c8-b6c1-dc1110f61d38 created: droplet cland-v0-a22310bf, commit b500b8fe9c9c11143f64f9991225ca5abc38edb4, deadline 2026-10-18T22:47:34.439Z.

### hub · 2026-10-18T21:34:47.902Z

demo a22310bf-9e03-49c8-b6c1-dc1110f61d38 destroyed: lifetime 118951 ms; cost $0.0083.

### qa-676 · 2026-10-18T21:57:13.073Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-18-6
commit: b500b8fe9c9c11143f64f9991225ca5abc38edb4
findings: [{"severity":"low","text":"Carried from qa-2026-10-18-5 under limited request: L6/L7 correct admission refusals took5.686s/5.564s, no timeout; residual latency reported as T-811 follow-up context. Not rerun in owner-only pass; no new findings."}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Location | Result | Evidence |
| --- | --- | --- | --- |
| PREP | local macOS / hub-api | PASS | [item.json](item.json), [durations-owner.diff](durations-owner.diff), [semantic-diff.json](semantic-diff.json), [changed-files.txt](changed-files.txt), [G3.txt](G3.txt), [freshness-start.json](freshness-start.json) |
| CARRY | local macOS / hub-api | PASS | [request.txt](request.txt), [semantic-diff.json](semantic-diff.json) |
| D0 | droplet | PASS | [D0-start.json](D0-start.json) |
| D1 | droplet | PASS | [D1-build.txt](D1-build.txt) |
| D2 | droplet | PASS | [D2-tiers.txt](D2-tiers.txt) |
| D14 | local macOS / hub-api | PASS | [D14-status.json](D14-status.json) |
| D15 | local macOS / hub-api | PASS | [D15-stop.json](D15-stop.json), [D15-after.json](D15-after.json) |
| L2 | droplet | PASS | [L2-result.txt](L2-result.txt), [L2-summary.txt](L2-summary.txt), [L2-submit.json](L2-submit.json) |

No new high, medium or low findings. Retained low observation from run5: L6/L7 correct admission refusals took5.686s/5.564s, slightly above the earlier approximate5s investigation threshold, with no timeout; this was reported as T-811 follow-up context and was not rerun in this limited pass.

**Clear**, run `qa-2026-10-18-6`, tested full SHA **b500b8fe9c9c11143f64f9991225ca5abc38edb4**. All8 checks in this limited pass PASS. Verified criteria **C1,C2,C3,C4,C5,C6,C7,C8**: D2 and task reporting refreshed here; other evidence carried from clear qa-2026-10-18-5 at0544169ac8d69b0827799e3584f1629940d9512a under explicit Coordinator request e0fa704a-5639-4041-8d93-a463b297932d. The retained evidence is A-5588, report A-5589; its34 checks passed. This report does not claim all prior cases were rerun at S2.

The one-line durations.json change is at `hub/test/durations.json:4055`, allowance `hub/test/durations-runner.test.ts::an outer repetition deadline reaps a failed worker with a live socket before continuing`: `"owner": "E-676"` becomes `"owner": "E-482"`. An independent recursive JSON comparison confirms this is the only semantic change in durations.json. Seconds5.069633,reason,added2026-10-17,expiry2026-10-24 remain unchanged. The change keeps the allowance owned by an open item when E-676 closes. Other intervening non-epic/tracker changes are listed in changed-files.txt; the Coordinator authorized the carry-forward after the previous freshness failure.

C1 D2: exact clean S2,405/405 sorted manifest,missing0,extra0;T1=65,T2=150,T3=180,T4=10. Both test:tiers and repository-tier-plan lint exit0. shards.json absent and untracked. Exact two phase lines: `hub free: 65 files, 1 workers`; `hub machine: 288 files, 4 workers`.

C2 task reporting: mode-free run **e71af81e-07a6-4ed8-bfdf-0b7dcc23d33e**, artifact **A-5591**, was admitted at S2 without cache reuse. Exit0;2657tests,2649pass,0fail,8skips. Log and delivered receipt have all planned T1–T3 lines, tier share,185 test-lint findings in98files, budget would-fail reporting (10 lines in receipt), legacy allowance summary128/1188.435s, T3 ratchet, and host-gate typecheck reuse. No allowance-validation hard failure. The aggregate legacy summary remains owner E-677; the changed individual allowance's owner is independently established by semantic-diff.json. Per retained T-714 ruling, task runs report actual planned T1–T3; integrated-stage T4 support remains in run5 evidence.

Retained criteria proof: C1 clean lint; C2 dry-run/no queue entry and designated integrated ccf0b8ea atdc05341fab56e071f05a5d1319557d3a2358fece with Coordinator freshness ruling; C3 all3 planted violations refused at verify and lint, gate tests passed; C4 four T2 seam files with empty spawn census; C5 heartbeat20/20,max1.583s; C6 ten droplet logs host-gate reuse/no remote typecheck; C7 same40 landings current5selected versus baseline4,zero own misses; C8 reserved-all refusal and tier-share baseline. See A-5589 for commands, results, all integrated shard logs/machines/durations/costs and retained low latency observation.

Demo executor droplet, Linux x86_64,Node24.21.0; lease **a22310bf-9e03-49c8-b6c1-dc1110f61d38**, machine cland-v0-a22310bf,created21:32:35.995Z,deadline22:47:34.439Z. Confirmed released lifetime118.951s,cost$0.00826048611111111. One lease, D2 only plus build/accounting checks; no plant worktree or code changes.

Task machine **cland-v0-161cad26**,c-8lon1,Linux x64 kernel6.8.0-142-generic,Node24.21.0,Neovim0.12.5,2workers. Suite duration1314.20s,lifetime1397s,cost$0.0970. Phase walls:hub free20.62s,hub machine1127.57s,Neovim165.99s. Total additional remote cost for this pass **$0.1052604861**. Elapsed from hold21:32:21.543Z to receipt21:56:13.730Z **1432.187s (23m52.187s)**. Prior run5 and integrated receipt costs are retained in A-5589, not charged again. Local records incur no droplet cost.

Final freshness.current=true at S2; final-freshness.json preserved. The hub will recheck at verdict recording. Build stayed clean and unchanged during task execution. No new integrated suite submitted.


Evidence A-5592: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5592-e-676-owner-only-recheck-final-evidence-at-b500b8fe. Report A-5593: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5593-e-676-qa-clear-at-b500b8fe-allowance-owner-recheck.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-18T21:57:26.344Z

Closed on QA clear qa-2026-10-18-6 at b500b8fe (C1–C8; owner-only recheck A-5592/A-5593, carrying the full run qa-2026-10-18-5 at 0544169a, A-5588/A-5589). Its one legacy duration allowance now belongs to E-482.
