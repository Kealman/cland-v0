---
id: T-1011
kind: task
title: QA tests the web workbench in the real browser through computer use
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by: []
topic: topic-765
branch: t/T-1011-qa-tests-the-web-workbench-in-the-real
created: 2026-10-20T17:02:15.802Z
updated: 2026-10-20T18:52:07.768Z
---

## Summary

QA for the web workbench also tests in the human's real local browser through computer use (Codex gpt-6-astra), not only through playwright-core and headless Chromium. This is the human's directive of 2026-10-20. This ticket gives QA the surface, the brief template and the role wording, and proves the path works on this Mac or names the exact blocker.

## What to build

- A QA surface `real-browser` in `.agents/skills/qa/qa-record.sh`, `BRIEF.md`, `STAGE-BRIEF.md` and the `qa` skill. A case on it is recorded with `note`, with screenshots under `.cland/qa/<item>/<run>/`.
- The `qa` skill's web section says:
  - how a QA session opens the `cland web` link in the human's default browser through computer use;
  - what it may touch: only the cland page and the browser's permission prompts for it;
  - that it closes the tab afterwards.
- The QA role clause and roles.toml launch defaults name the computer-use capable model for web briefs, if the clause needs it.
- A dry run from a launched QA session:
  - it opens a local page in the real browser through computer use, takes a screenshot and records it as a `real-browser` note;
  - or it names the exact blocker (harness refusal, macOS Screen Recording or Accessibility permission, browser profile) in the item topic, so the Coordinator can take it to the human.

## Acceptance criteria

- [x] C1. `qa-record.sh note … real-browser …` records a line, and the surface check accepts `real-browser` (test).
  - done: impl-1011 · 2026-10-20T18:41:27.064Z
  - verified: rev-26 [reviewer] · run rev-20261020-1011-evidence-1 · 2026-10-20T18:52:07.767Z · commit d1acaacc51510bf13df49561434913fb27838712
- [x] C2. `BRIEF.md`, `STAGE-BRIEF.md` and the `qa` skill describe `real-browser` cases for web briefs: open through computer use, scope limited to the cland page and its permission prompts, close the tab, screenshot evidence.
  - done: impl-1011 · 2026-10-20T18:41:27.583Z
  - verified: rev-26 [reviewer] · run rev-20261020-1011-source-1 · 2026-10-20T18:43:13.655Z · commit d1acaacc51510bf13df49561434913fb27838712
  - verified: rev-26 [reviewer] · run rev-20261020-1011-evidence-1 · 2026-10-20T18:52:07.768Z · commit d1acaacc51510bf13df49561434913fb27838712
- [ ] C3. A launched QA session's dry run either records a `real-browser` screenshot of a local page opened in the human's browser through computer use, or posts the exact blocker in the item topic (local evidence).
- [x] C4. `cland qa lint` accepts a brief with a `real-browser` case (test).
  - done: impl-1011 · 2026-10-20T18:41:28.218Z
  - verified: rev-26 [reviewer] · run rev-20261020-1011-evidence-1 · 2026-10-20T18:52:07.768Z · commit d1acaacc51510bf13df49561434913fb27838712

## Comments

### coord · 2026-10-20T17:06:48.283Z

Brief addition (Coordinator, 2026-10-20): the real-browser QA session runs with the human's normal HOME and login keychain (not the sealed fixture environment) and a dedicated cland browser profile. It never presses Reset or changes keychain, profile or system settings; any system dialog it cannot dismiss with Cancel is a blocker to report. Reason: impl-990's sealed Chrome launch raised a 'Keychain Not Found' modal with Reset To Defaults on the human's desktop (17:05Z, A-7738).

### impl-1011 · 2026-10-20T18:39:36.316Z

Implemented real-browser acceptance in the recorder and brief linter; C1 recorder test uses only a disposable fixture and a synthetic PNG, no browser/GUI. C4 exercises the shipped cland qa lint CLI. Templates, QA web procedure, default/project role clauses and matching help/docs are updated. C3 will be handed to the Coordinator for a launched QA dry run after source review.

### rev-26 · 2026-10-20T18:43:13.655Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1011-source-1
commit: d1acaacc51510bf13df49561434913fb27838712
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings in requested C1/C2/C4 source scope. Recorder note and brief-lint surface allowlists accept real-browser; no browser is launched by the recorder. New T2 recorder test uses disposable sealed root, synthetic PNG and durable JSONL/evidence-byte assertions; CLI test retains negative control and accepts the new method row. Matching templates, QA procedure, help/docs and default/project role clauses describe computer use, normal HOME/keychain with dedicated profile, page/permission-only scope, screenshots, tab cleanup and exact blocker reporting. Model remains Codex gpt-6-astra. C2 verified; audit A-7945.

A-7937 contains reported local macOS targeted/check summaries, not raw stdout/exit/timing or suite evidence. Original retained receipts requested without transcription reruns; C1/C4 runtime marks and exact-head final execution remain outstanding. No Linux/load/browser pass claimed.

C3 remains unchecked and outside this source scope: Coordinator c937e720 asks the human for screen timing, holds this head after source review, then supplies committed dry-run brief and launches QA (or defers C3 to first E-415 QA). No GUI launched. Coordinator abc0f34b filed unchanged legacy recorder isolation as T-1021; the new test does not use that helper. No Reviewer edits/tests/delegation.

Criteria: C2 verified.

### rev-26 · 2026-10-20T18:52:07.768Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1011-evidence-1
commit: d1acaacc51510bf13df49561434913fb27838712
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Scoped C1/C2/C4 execution settlement clear; no Standards/Spec findings. A-7954 at exact reviewed unchanged d1acaacc independently contains 2,111 ordinary passes plus five passing load records, no fail/cancel/skip. Synthetic-PNG recorder case passes ordinary 0.033514 s and 5/5 repetitions (max 0.050232 s), within T2. CLI lint acceptance passes 0.291445 s; lint 18/18, clauses 27/27 including both reserve checks, catalogue 5/5, CLI lint 2/2 and recorder file 13/13. C1/C4 verified; unchanged source C2 reverified. Audit A-7956.

C3 remains unchecked/unverified: this suite and synthetic screenshot do not establish a real-browser QA dry run or exact blocker. Coordinator owns human screen timing, committed brief and QA launch under c937e720; the item is not complete. No QA verdict or whole-item final clearance claimed.

Linux x64 c-8 lon1 droplet, two workers, T1 exit 0 (command 51 s/package 46.48 s) and fallback all T2 in both packages exit 0 (command 280 s/package 276.60 s). Actual execution, not cache/projection; lifetime 409 s/$0.0284. Host check reference 93244c17 not repeated remotely. Lint/budgets/ratchet report-only; T3/T4 not executed. A-7946 separately preserves original pre-commit local receipts on 3f74bc05 plus dirty changes/no recorded tree hash, correcting A-7937 attribution; not reused as exact-head execution. No Reviewer tests, edits or GUI launch.

Criteria: C1 verified, C2 verified, C4 verified.
