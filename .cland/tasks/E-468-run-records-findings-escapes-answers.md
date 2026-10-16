---
id: E-468
kind: epic
title: "Run records: findings, escapes, answers, covers and sub-agent models as data"
state: closed
criterion_seq: 4
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: topic-366
branch: null
created: 2026-10-15T09:13:06.243Z
updated: 2026-10-16T08:14:42.429Z
closed: 2026-10-16T08:14:42.429Z
---

## Goal

The run records what a retrospective needs as data, not as prose: findings with their severity (lows included), where an escape was caught, who answered an ask, why a cover was red or cancelled, and which model a sub-agent ran. These close five of the six gaps that the v0.1.2 retrospective (A-2783, §6) listed. Model comparison itself is out of scope by the human's decision of 2026-10-15: no model rotation yet, the current one-model-per-role crew builds the baseline first.

## Contents

- Verdict findings with severity, lows recorded (START 2, STOP 5).
- `found_by` on regressions and `answered_as` on ask answers (START 2).
- Integrated cover status and cause on the suite result (START 2).
- The sub-agent model in its start record (START 2).

## Definition of done

QA runs, in a scratch project through the CLI: a review verdict with high, medium and low findings, whose counts show in `task view`; a regression filed with `found_by cover`; an ask answered from the human's shell and one from a named stand-in, with `answered_as` read back; a red, a budget-failed and a cancelled integrated run, read back with their cover status and cause in `hub status`; and a fake sub-agent start with its model in the journal. The verdict closes the epic.

- [ ] C1. Findings with severity, lows included, are stored and shown, and the Reviewer clause requires them.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-19 · 2026-10-16T08:14:20.020Z · commit 544527784826e12803b6b0111b53025faa7c211a
- [ ] C2. `found_by` and `answered_as` are stored and shown.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-19 · 2026-10-16T08:14:20.020Z · commit 544527784826e12803b6b0111b53025faa7c211a
- [ ] C3. Cover status and cause are recorded for green, red, budget and cancelled integrated runs, and the Coordinator can classify a load flake.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-19 · 2026-10-16T08:14:20.020Z · commit 544527784826e12803b6b0111b53025faa7c211a
- [ ] C4. Sub-agent starts record their model, or `unreported`.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-19 · 2026-10-16T08:14:20.020Z · commit 544527784826e12803b6b0111b53025faa7c211a

## Plan

```yaml
stages:
  - name: verdict, regression and ask records
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-478
        - T-477
      - - T-480
  - name: cover records
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-479
```

## Comments

### qa-27 · 2026-10-16T08:14:20.020Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-16-27-19
commit: 544527784826e12803b6b0111b53025faa7c211a

| Check | Surface | Result | Evidence in A-3854 |
|---|---|---|---|
| G0 | local macOS / hub-api | PASS | G0.txt |
| G1 | local macOS / hub-api | PASS | G1-T479.json |
| G2 | local macOS / hub-api | PASS | G2.txt |
| L1 | local macOS / hub-api | PASS | L1-assertions.txt |
| L2 | local macOS / hub-api | PASS | L2.txt |
| L3 | local macOS / hub-api | PASS | L3.txt; amendment: usage exit 2, not 1; refusal/no write PASS (179c6691) |
| L4 | local macOS / hub-api | PASS | L4.txt |
| L10 | local macOS / hub-api | PASS | L10.txt |
| L11 | local macOS / hub-api | PASS | L11.txt |
| L12 | local macOS / hub-api | PASS | L12.txt |
| L20 | local macOS / hub-api | PASS | L20-ask1.json |
| L21 | local macOS / hub-api | PASS | L21.txt |
| L22 | local macOS / hub-api | PASS | L22.txt |
| L40 | local macOS / hub-api | PASS | L40-hub-status.json; cover from published journal/hub status, not worker result.json (33c55037) |
| L41 | local macOS / hub-api | PASS | L41-cover.json |
| L42 | local macOS / hub-api | PASS | L42-cover.json |
| L43 | local macOS / hub-api | PASS | L43.txt |
| L44 | local macOS / hub-api | PASS | L44.txt |
| L45 | local macOS / hub-api | PASS | L45-assertions.txt |
| L30 | local macOS / hub-api | PASS | L30.txt |
| L31 | local macOS / hub-api | PASS | L31.txt |
| L49 | local macOS / hub-api | PASS | L49-leftovers.txt |
| T1 | local macOS / hub-api | PASS | T1.log |
| T2 | local macOS / hub-api | PASS | T2.log |
| T3 | local macOS / hub-api | PASS | T3.log |
| T4 | local macOS / hub-api | PASS | T4.log |
| T5 | local macOS / hub-api | PASS | T5.log |
| R1 | local macOS / hub-api | PASS | R1.txt |
| R2 | local macOS / hub-api | PASS | R2.txt |
| R3 | local macOS / hub-api | PASS | R3.txt |
| R4 | local macOS / hub-api | PASS | R4.txt |
| F1 | local macOS / hub-api | PASS | F1-dev.txt |

Findings: high none; medium none; low none. Clear.

Run qa-2026-10-16-27-19 at full SHA 544527784826e12803b6b0111b53025faa7c211a, brief committed at that build. All 32 checks passed. Targeted tests T1–T5: 3+2+3+11+9=28 pass, zero fail/skipped, no retries. Each file alone after queue read none/waiters 0. No full product suite, real harness/model, lease or droplet. Final dev unchanged; F1 freshness current=true.

Verify all: C1=L1–L4,T1,R1; C2=L10–L12,L20–L22,T2,T3,R2; C3=L40–L45,T5,R3; C4=L30,L31,T4,R4. Findings and lows persisted/displayed; regression and answer attribution persisted/displayed; all four cover statuses/causes and Coordinator-only load-flake classification matched; both sub-agent models recorded in hook order.

Execution notes: all four children and merge ancestors checked (G1 prose said three ok lines). Correct T-479 landing is 6b51006dd6d45d4e69c499f911605d61659d65f8; brief full SHA missed one d, short id resolves correctly, changed-test list is suite-cover.test.ts. Cover readback adaptation approved in 33c55037 and applies L40–L45. L3 amendment approved in 179c6691. Auxiliary cancellation checker corrected from assumed exit 1 to the stated cover fields; worker exit 143 retained. No product case rerun. Driver pipes ran in persistent sessions. Scratch markers renamed and exact scratch paths moved to Trash after shutdown.

Cleanup: qa-sub stopped, both driver spokes quit, hub pid 62547 stopped, owned tails ended; L49 no scratch process and empty queue. Scratch paths removed. No live mutation beyond hold/verdict.

Full evidence A-3854: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3854-e-468-run-19-at-54452778-full-qa-evidence-all-checks-clear.

Verdict note A-3855: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3855-e-468-qa-run-19-clear-case-table-findings-and-criterion-mapping.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-16T08:14:42.429Z

Closed on QA clear qa-2026-10-16-27-19 at 54452778 (32/32 checks, A-3854/A-3855), with all four children merged: T-477, T-478, T-479 and T-480.
