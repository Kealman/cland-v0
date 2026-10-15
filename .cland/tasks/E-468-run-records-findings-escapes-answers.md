---
id: E-468
kind: epic
title: "Run records: findings, escapes, answers, covers and sub-agent models as data"
state: open
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:13:06.243Z
updated: 2026-10-15T09:13:06.243Z
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
- [ ] C2. `found_by` and `answered_as` are stored and shown.
- [ ] C3. Cover status and cause are recorded for green, red, budget and cancelled integrated runs, and the Coordinator can classify a load flake.
- [ ] C4. Sub-agent starts record their model, or `unreported`.
