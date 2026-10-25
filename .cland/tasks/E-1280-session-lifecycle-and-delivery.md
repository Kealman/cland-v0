---
id: E-1280
kind: epic
title: Session lifecycle and delivery
state: open
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1058
branch: null
created: 2026-10-25T09:52:42.374Z
updated: 2026-10-25T17:15:37.061Z
---

## Summary

Sessions survive restarts, re-execs and provider hiccups without a Coordinator message: a deaf session after a Claude Code re-exec is detected, long Codex threads reattach, provider-capacity failures retry, and OpenCode sees the user's Console login. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: deaf sessions, long threads and logins
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1256
        - T-1224
      - - T-1265
      - - T-1230
        - T-1302
      - - T-1258
  - name: retry, reservations and launch values
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1249
        - T-1235
        - T-290
```

## Comments

### qa-677 · 2026-10-25T17:15:37.061Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-stage-2026-10-25-677-2
commit: 2b9d3c2b422f72f82a3011984f8cd48544d96341
stage: deaf sessions, long threads and logins
stage_hash: 07629d36231b4061506215b066b7867e5cefe04a74c0eb36110de475a0bb3d20
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

CLEAR — stage deaf sessions, long threads and logins. Build 2b9d3c2b422f72f82a3011984f8cd48544d96341, clean detached HEAD matched dev before and after. Six stage items are landed; affected/after-stage cover pair is green at verification tree 2bc8ecaf43f7326a238bdd164dfcbd7e4422bba9 (Linux 7cf7c622, macOS 7867cc49).

| Case | Result | Execution |
|---|---|---|
| M1 | PASS | claude-code-schedule: 20 |
| M2 | PASS | inject-stalled: 8 |
| M3 | PASS | mod-bridge: 1 |
| M4 | PASS | codex-delivery: 5 |
| M5 | PASS | codex-native: 33 |
| M6 | PASS | codex-adapter: 13 |
| M7 | PASS | roles-component + config-reload-component + roles-timing: 18 |
| M8 | PASS | doctor-harness-probe + opencode-launch-policy + opencode-native: 47 |
| M9 | EXCLUDED | Live doctor probes against human HOME violate rule 15; withdrawn by Coordinator in topic-1058, msg 61eb6b19. Not executed or counted as pass. |

145/145 tests passed across 12 serial single-file node --test commands, zero skipped/cancelled/todo. Execution: local darwin arm64, Node v24.21.0, isolated disposable HOME/XDG/Git via shared fixture builder. T1–T3 selected files only; fake harness binaries and scripted transports, no real provider, browser, full suite or performance budget gate. Generated case names and actual native summaries independently checked in case-summary.json. No findings. No epic criterion marks.

Evidence: A-12040, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12040-e-1280-stage-qa-clear-145-tests-at-2b9d3c2b/report.md (commands, outputs, receipts, recorder rows and build checks). Earlier stale admission run qa-stage-2026-10-25-677 executed no tests; this verdict covers fresh run qa-stage-2026-10-25-677-2 only.
