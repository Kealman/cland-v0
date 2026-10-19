---
id: T-846
kind: task
title: "The setup scenario: a scratch machine runs `cland setup` end to end, and a second run reports `ok` throughout"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-836
  - T-840
  - T-842
  - T-845
topic: topic-650
branch: t/T-846-the-setup-scenario-a-scratch-machine
created: 2026-10-19T06:34:13.631Z
updated: 2026-10-19T21:18:17.763Z
closed: 2026-10-19T21:18:17.763Z
---

## Summary

One named T3 scenario proves the flow across real processes once its rules are proven in T1/T2:
- the real CLI in a pseudo-terminal (question 10);
- fake harnesses on the PATH, one missing and one signed out, with the fake `curl`;
- a real hub with the Aide launched on a fake harness;
- the stand-in launcher.

It also finishes the hub README's setup section for QA's demo.

## What to build

- **The scenario.** On N5's scratch machine with Codex missing and Claude Code signed out, the scenario runs `cland setup` in a pseudo-terminal. It answers:
  - yes to the Codex install;
  - yes to the Claude Code login;
  - Enter to the accounts question (a signed-in `~/.claude-work` exists);
  - `1` to the favourite.

  It then reads:
  - the step lines;
  - `[aide.launch]`;
  - the trust entries in the scratch `.claude.json` and `~/.codex/config.toml`;
  - the running hub;
  - `aide-1` with its brief;
  - the stand-in launcher's recorded `CLAND_OPEN_SESSION`.
- **A second run** answers nothing and must report `ok` for every step.
- **A third run** without a terminal must exit 0 and ask nothing.
- **A declined-install run** on a second machine must not offer the install again until `--install`.
- The scenario's header names the lower-tier rule files and its expected hub starts (one), as `docs/agents/tests.md` asks. It carries a manifest entry and measured duration.
- The hub README's setup section is complete: the steps, the flags, what is written outside the project (the accounts registry on yes, the harness trust entries), and how to stop the Aide and the hub.

## Acceptance criteria

- [x] C1. The scenario's first run ends with `codex done`, `claude-code login done`, `accounts skip` (accounts.toml absent), `favourite done`, `trust done`, `hub done` and `aide done`, in the spec's order, one line each.
  - verified: rev-30 [reviewer] · run rev-20261019-846-source-corrected · 2026-10-19T20:57:46.060Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - verified: rev-30 [reviewer] · run rev-20261019-846-final · 2026-10-19T21:12:04.375Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - done: impl-846 · 2026-10-19T21:13:28.022Z
- [x] C2. After it, the scratch trust files hold the root as trusted for Claude Code and Codex, `aide-1` runs with the brief `Run the onboarding skill; project: empty; harnesses: claude-code, codex; human's harness: claude-code`, and the stand-in launcher recorded `CLAND_OPEN_SESSION=aide-1`.
  - verified: rev-30 [reviewer] · run rev-20261019-846-source-corrected · 2026-10-19T20:57:46.060Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - verified: rev-30 [reviewer] · run rev-20261019-846-final · 2026-10-19T21:12:04.375Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - done: impl-846 · 2026-10-19T21:13:28.610Z
- [x] C3. The second run reports `ok` for every installed or applicable step and `skip` for the declined OpenCode install, and asks nothing.
  - verified: rev-30 [reviewer] · run rev-20261019-846-source-corrected · 2026-10-19T20:57:46.060Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - verified: rev-30 [reviewer] · run rev-20261019-846-final · 2026-10-19T21:12:04.375Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - done: impl-846 · 2026-10-19T21:13:29.203Z
- [x] C4. No fake Codex process and no hub other than the project's remain when the scenario ends.
  - verified: rev-30 [reviewer] · run rev-20261019-846-source-corrected · 2026-10-19T20:57:46.060Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - verified: rev-30 [reviewer] · run rev-20261019-846-final · 2026-10-19T21:12:04.375Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - done: impl-846 · 2026-10-19T21:13:29.785Z
- [x] C5. The scenario passes five serial runs on the Mac at a one-minute load below 15, with the receipts in the task's report.
  - verified: rev-30 [reviewer] · run rev-20261019-846-source-corrected · 2026-10-19T20:57:46.060Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - verified: rev-30 [reviewer] · run rev-20261019-846-final · 2026-10-19T21:12:04.375Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - done: impl-846 · 2026-10-19T21:13:30.278Z
- [x] C6. Without a terminal, the hub and Aide steps detect first: a third run with the project's hub serving and `aide-1` live reports `ok` for both, asks nothing and exits 0; with either missing the step reports `open` with its command and the run exits 1, proved by a T1/T2 rule test (spec §3.3 shape and 'Without a terminal'; Coordinator decision 00046b1d).
  - verified: rev-30 [reviewer] · run rev-20261019-846-final · 2026-10-19T21:12:04.375Z · commit 9ad558aa34d26f8ca50418784be60cd323eb06e8
  - done: impl-846 · 2026-10-19T21:13:30.866Z

## Comments

### impl-846 · 2026-10-19T20:51:34.486Z

Implemented at f442bf2cd5717a422e350228a6b7383d50c8b350 and pushed to origin. C1–C6 declaration/assertion audit and scoped spawn census: A-6685 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6685-t-846-implementation-and-criterion-audit.md). Five serial Mac scenario passes: A-6683 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6683-t-846-five-serial-mac-scenario-receipts.log), observed load 4.11–5.16. npm run check passed; targeted setup-hub (7) and setup-cli (7) pass. Limited production fix follows Coordinator decision 00046b1d; nonterminal hub/Aide detect existing services first, missing services still open with commands. Per-item QA policy none/after-stage. Awaiting source review before exact-head mode-free verify.

### rev-30 · 2026-10-19T20:53:30.657Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-846-source
commit: f442bf2cd5717a422e350228a6b7383d50c8b350
scope: full
findings: [{"severity":"high","text":"M1: Fallback cleanup reacquires ownership from historical vendor PIDs and raw hub-start PIDs (:124/:131–132). ownProcess captures the current holder when no original identity is retained, so an exited child's reused PID can cause an unrelated process to be signalled. Retain immutable spawn/first-observation identities or verified scratch-root ownership; cover the original-gone/reused-PID path and preserve stop-before-directory cleanup.","file":"hub/test/scenarios/setup.test.ts","line":90}]
finding_counts: {"high":1,"medium":0,"low":0}

Full source not clear, A-6689. Standards M1/C4: historical PID fallback cleanup must preserve immutable ownership; helper capture contract explicitly excludes reacquiring after remembered child exit. Remaining scenario assertion mapping and limited Coordinator-authorized nonterminal detect-first fix are focused. A-6683 five Mac passes/load<15 audited, but they do not exercise replacement/failure cleanup. Correct source and obtain fresh review before mode-free verification; corrected scenario retains C5 five-Mac-pass requirement. No Reviewer tests or process actions; QA none.

Criteria: C4 failed (Historical PID numbers are promoted to ownership during teardown and can target a replacement process instead of the owned child.).

### impl-846 · 2026-10-19T20:56:36.128Z

Corrected review M1 at pushed head 9ad558aa34d26f8ca50418784be60cd323eb06e8: historical PIDs are observations only; fallback proves current ownership via captured scratch-root dev/inode and cleanupProcesses(root). New synthetic boundary regression preserves a replacement outside fixture and stops live fixture writers; four targeted safety cases pass. Corrected scenario re-established five serial Mac passes in A-6692 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6692-t-846-corrected-cleanup-five-serial-mac-receipts.log), peak sampled one-minute load 5.21875. npm run check and final manifest lint green. Fresh source review requested; no verification before source clear.

### rev-30 · 2026-10-19T20:57:46.060Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-846-source-corrected
commit: 9ad558aa34d26f8ca50418784be60cd323eb06e8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-6696. M1 resolved: no historical PID acquires ownership; inode-verified scratch-root cleanup proves current cwd/ancestry and revalidates identity before signals. Synthetic replacement control preserves outside process/stops fixture writer; normal first-observation owners and stop-before-removal retained. A-6692 independently audited five corrected Mac passes, max body 7.840925167 s, sampled load peak5.21875; targeted host-native C1–C5 verified, no Linux T3 claim. Production detect-first C6 unchanged/source clear; final C6/runtime settlement awaits exact-head mode-free gate and new T1 control ordinary+five repetitions/no owned resource or budget trip. Dated measured/conservative-estimate allowances remain E-613-owned. QA none; no Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-846 · 2026-10-19T21:11:51.717Z

Exact reviewed head 9ad558aa34d26f8ca50418784be60cd323eb06e8 passed mode-free verify db11777d-d7f2-4d5d-9084-b3fc28ac00b7: 1887/1887 pass, no failures/cancellations/skips/TODO. Log A-6709 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6709-suite-db11777d-d7f2-4d5d-9084-b3fc28ac00b7-auto-at-9ad558a.log). Linux x64 Node v24.21.0, c-8 lon1 droplet; lifetime 788s, cost $0.0547. Queue-enabled T0–T2 receipt; no Linux T3 claim. Corrected five Mac T3 passes remain A-6692; Reviewer final settlement pending.

### rev-30 · 2026-10-19T21:12:04.375Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-846-final
commit: 9ad558aa34d26f8ca50418784be60cd323eb06e8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6710. Independent A-6709 audit:1887/1887, zero fail/cancel/skip/TODO; all296 load groups5/5, zero resource mismatch/owned overrun. New C6 nonterminal rule ordinary .005675811 s plus actual five repetitions; expanded live/missing setup flow ordinary+five max .078374418 s. Corrected source A-6696 and A-6692 five serial Mac scenario receipts retain C1–C5 (ownership M1 resolved). All C1–C6 verified. Native scenario/cleanup T3 remains qualified Mac proof, not Linux task execution. Covered report-only rows follow Coordinator directive; QA none; no Reviewer tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T21:18:17.763Z

Merged d265e716dc309aaef33e86d4ccc6f64b0f543f67 onto dev.
