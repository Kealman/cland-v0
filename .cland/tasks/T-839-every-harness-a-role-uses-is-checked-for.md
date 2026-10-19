---
id: T-839
kind: task
title: Every harness a role uses is checked for a login and signed in on yes, and the second check decides
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-838
  - T-834
topic: topic-627
branch: t/T-839-every-harness-a-role-uses-is-checked-for
created: 2026-10-19T06:34:12.988Z
updated: 2026-10-19T20:07:23.997Z
closed: 2026-10-19T20:07:23.997Z
---

## Summary

Tracer bullet 2, the login half. For each harness a role uses (N3's function), setup checks the login. A signed-out one gets the harness's own blocking login in this terminal on the human's yes, in the environment the hub launches with, then a second check (spec §3.3 step 3).

## What to build

- **The commands.**
  - `claude auth login`, in the `CLAUDE_CONFIG_DIR` setup and the hub run with, set or unset.
  - `codex login`, in that `CODEX_HOME`.
  - `opencode auth login --standalone` against cland's OpenCode database, whose folder is created first.
- **The question.** `Sign in to <Harness> now?` defaults to Yes for Claude Code and Codex and to No for OpenCode, which is optional because its free model needs none.
- **The outcome.**
  - A login that leaves the harness signed out offers one more try. A second no is `fail` with the command.
  - A decline on the first question is `skip` with the command.
  - Harnesses no role uses get no login line beyond `skip` "no role uses it".
- Without a terminal, a login never runs: the line is `open` (OpenCode's is `skip`) with the exact command.

## Acceptance criteria

- [x] C1. A signed-out Claude Code used by a role runs `claude auth login` on yes, and the second check reading signed in gives `claude-code login done` (T1).
  - done: impl-839 · 2026-10-19T19:36:25.397Z
  - verified: rev-31 [reviewer] · run rev-20261019-839-final · 2026-10-19T19:38:29.285Z · commit 1e72273030453ff8949181b11e791cac74f2a673
  - verified: rev-31 [reviewer] · run rev-20261019-839-integration-final · 2026-10-19T19:56:35.037Z · commit 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2
- [x] C2. A login that exits 0 but leaves the harness signed out offers one retry, and a no then gives `fail` with `run: claude auth login` (T1).
  - done: impl-839 · 2026-10-19T19:36:30.159Z
  - verified: rev-31 [reviewer] · run rev-20261019-839-final · 2026-10-19T19:38:29.285Z · commit 1e72273030453ff8949181b11e791cac74f2a673
  - verified: rev-31 [reviewer] · run rev-20261019-839-integration-final · 2026-10-19T19:56:35.037Z · commit 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2
- [x] C3. A signed-out Codex that no role uses is not offered a login, and its line says no role uses it (T1).
  - done: impl-839 · 2026-10-19T19:36:39.204Z
  - verified: rev-31 [reviewer] · run rev-20261019-839-final · 2026-10-19T19:38:29.285Z · commit 1e72273030453ff8949181b11e791cac74f2a673
  - verified: rev-31 [reviewer] · run rev-20261019-839-integration-final · 2026-10-19T19:56:35.037Z · commit 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2
- [x] C4. OpenCode's login question defaults to No, and on yes the command runs with `OPENCODE_DB` set to cland's database after its folder exists (T1, asserting the command's env).
  - done: impl-839 · 2026-10-19T19:36:43.855Z
  - verified: rev-31 [reviewer] · run rev-20261019-839-final · 2026-10-19T19:38:29.285Z · commit 1e72273030453ff8949181b11e791cac74f2a673
  - verified: rev-31 [reviewer] · run rev-20261019-839-integration-final · 2026-10-19T19:56:35.037Z · commit 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2
- [x] C5. Without a terminal, no login runs, and each signed-out harness in use is `open` with its exact command (T1).
  - done: impl-839 · 2026-10-19T19:36:47.822Z
  - verified: rev-31 [reviewer] · run rev-20261019-839-final · 2026-10-19T19:38:29.285Z · commit 1e72273030453ff8949181b11e791cac74f2a673
  - verified: rev-31 [reviewer] · run rev-20261019-839-integration-final · 2026-10-19T19:56:35.037Z · commit 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2

## Comments

### impl-839 · 2026-10-19T19:13:25.761Z

Implemented login confirmations, one retry, fresh-probe verdicts, exact remedies, launch-profile preservation and OpenCode database setup. Targeted tests: setup-flow 19/19, related setup tests 32/32; npm run check passed. Coordinator decision on --yes is pinned by a T1 test. Pushed fb33d1e846205d4478027f28184bc454d83dae77 after merging origin/dev; requesting source review before verification.

### impl-839 · 2026-10-19T19:15:09.806Z

Source review identified explicit CLAND_*_BIN overrides were not preserved by bare login names. Fixed in ec11e19bf628e716012a711bc8c8292575accd13 with a red/green T1 table for all three selected executable paths, including spaces/apostrophe. Requested fresh source review; no dev merge after initial review. Evidence A-6363.

### rev-31 · 2026-10-19T19:16:35.319Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-839-source
commit: ec11e19bf628e716012a711bc8c8292575accd13
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no remaining Standards/Spec findings. All C1–C5 controls reviewed: vendor blocking logins require terminal confirmation, fresh probes decide outcome independent of command exit, one retry maximum, unused harnesses skip, optional OpenCode defaults No and receives cland DB after directory creation, nonterminal runs no login. launch-profile env forwards through actual SetupMachine.run/terminalCommand; JSON routes child stdout to stderr. Initial explicit executable override gap confirmed during review is fixed at this head, with shell-quoted probed paths and exact remedies for all three harnesses under a T1 table. Independently read Coordinator 97065b73 confirming terminal --yes still asks; test pins it. A-6357/A-6363 report host tests/checks green; exact runtime/budget verification remains pending. No C1–C5 final marks until same-head configured task receipt. See full source review artifact in topic-627.

### impl-839 · 2026-10-19T19:22:50.948Z

Verification 7132fb56-0581-45fc-9890-20b51b7fb107 failed in the two verify-tool.test.ts controls tracked by shared defect T-891, including load repetitions (A-6394). Reported to lead T-839; diagnosis held and reviewed head ec11e19b unchanged pending Coordinator’s posted shared fix. No final readiness claimed.

### impl-839 · 2026-10-19T19:24:06.891Z

Applied exactly the Coordinator-posted T-891 shared-fix commits a7159290 and 67a01b6f as aace8313 and 681c1d89. Only verify-tool fixtures changed after source-reviewed ec11e19b. Targeted verify-tool now 3/3; typecheck passes. Pushed 681c1d890953d491d2cf0a2e48f3004e38ce8baf and requested fresh delta source review before mode-free verification.

### impl-839 · 2026-10-19T19:26:53.566Z

Reviewer caught owned T1 resource mismatch in the custom CODEX_HOME profile test: only default profile trust had been seeded. Reproduced exact spawn violation under tier enforcement, then seeded selected profile trust and asserted trust remains ok. All 20 setup-flow tests now pass under T1 enforcement with zero mismatch rows (A-6410); typecheck passes. Pushed 1e72273030453ff8949181b11e791cac74f2a673 and requested fresh delta source review before verification.

### rev-31 · 2026-10-19T19:27:46.773Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-839-runtime-1
commit: ec11e19bf628e716012a711bc8c8292575accd13
scope: evidence
findings: [{"severity":"medium","text":"Owned T1 profile table spawns Codex through trust.ts → grantCodexTrust because selected CODEX_HOME lacks a pretrusted config. A-6394:38960 records child_process.spawn despite the body passing; caught trust errors do not establish the required T1 boundary.","file":"hub/test/setup-flow.test.ts","line":422},{"severity":"medium","text":"Configured receipt A-6394 exits 1: two shared T-891 fixture identities fail ordinarily and all five repetitions; 0/5 gates. Source behavior alone cannot establish final acceptance.","file":"hub/test/verify-tool.test.ts","line":43}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards: owned T1 resource finding at A-6394:38960; implementer confirms selected profile lacks trust. Spec controls are positive: all 20 ordinary setup-flow cases and 55 repetitions pass, but runtime acceptance remains not clear. Ordinary complete-log counts 1390 pass/2 fail; 12 total failed verify-tool finishes. Eight external report-only budgets retained in the companion audit. No claim of a passing receipt at ec11e19b.

Criteria: C1 failed (Owned T1 setup-flow profile proof triggers child_process.spawn; configured receipt A-6394 is also red on shared T-891 failures.).

### rev-31 · 2026-10-19T19:27:47.669Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-839-source-2
commit: 1e72273030453ff8949181b11e791cac74f2a673
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining findings. Profile table seeds the actual selected Codex/Claude trust config and asserts trust remains ok, preserving login command/env/count/auth assertions; resolves the owned T1 spawn. Shared T-891 changes exactly match independently read Coordinator cf621244: root command configuration plus cland-shaped fixtures, with injected candidate selection and all admission assertions retained. Spec: no findings; login product source and C1–C5 semantics unchanged. A-6410 retains 20/20 passing exact-source setup-flow cases, no tier rows, reported under T1 enforcement; typecheck reported green. Source clear at this exact head permits one mode-free configured task verification. C1–C5 final execution verification remains pending that receipt; A-6394 stays failed.

### impl-839 · 2026-10-19T19:36:49.871Z

Same-head configured verification be15502b-5834-4150-8e5e-b364faac21d2 passed at 1e72273030453ff8949181b11e791cac74f2a673: 1627/1627, no fail/cancel/skip/TODO, A-6434. Owned setup-flow and shared verify-tool new identities each pass 5/5 load repetitions; no tier-mismatch rows. Linux x64 droplet c-8 lon1, lifetime 372s, cost $0.0258. C1–C5 claimant done marks added. Awaiting same-head final reviewer verdict; no head changes.

### rev-31 · 2026-10-19T19:38:29.285Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-839-final
commit: 1e72273030453ff8949181b11e791cac74f2a673
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear on be15502b-5834-4150-8e5e-b364faac21d2 / A-6434 at the unchanged current source-clear head. Independently parsed 1627 ordinary passes and all 40 load groups 5/5, with no failures or tier mismatches. All 20 setup-flow ordinary cases pass, total 0.108418921 s, maximum 0.018124822 s. Eleven admitted new/changed setup-flow identities each have five passes (55 repetitions); the three shared verify-tool identities also pass ordinarily and five times each (15). Combined repeated maximum 0.244683726 s. No tier-mismatch row anywhere; the previous selected-profile native Codex spawn is absent. C1 fresh-auth success (:37139), C2 one retry (:37144), C3 unused Codex (:37155), C4 OpenCode No/database (:37149), C5 nonterminal exact commands (:37161), plus --yes, profile and override controls pass. Source/spec requirements and all criteria checked across the source chain and this receipt. Complete external report-only budget inventory retained in A-6447; none owned, no unrelated diagnosis. T3 remains periodic/integrated evidence, not part of this task claim. Earlier red receipt remains retained.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-839 · 2026-10-19T19:43:18.832Z

Queue dropped the prior ready head on setup-flow.test.ts conflict with landed T-844. As authorized by gate and Coordinator, merged origin/dev once (3147e92f). Resolved by keeping login assertions and new hub/Aide skip rows; every login-focused setup call has noAide, preserving the T1 boundary. Enforced setup-flow 20/20 and typecheck pass. Pushed 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2; fresh delta source review requested before verification. Earlier clear receipt is retained as historical.

### rev-31 · 2026-10-19T19:45:20.428Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-839-integration-source
commit: 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear, no Standards/Spec findings. Independently read Coordinator 79b3a85f allowing this one dev merge after conflict. Only manual conflict is setup-flow.test.ts: retain login labels/required-harness and exact-command/auth assertions, selected-profile pretrust/trust-ok protection, add the landed hub/Aide skip rows and noAide:true to focused fixture calls. noAide's landed hub step returns skip before obtaining a native client; T-844's dedicated hub/Aide tests remain on dev. The summary now accounts for two skip rows while still requiring all preceding steps ok. Product logins.ts is byte-unchanged from the final-clear head. Types merge preserves dev's noAide/hub/project-kind options plus T-839's run environment option. Against pinned dev only logins.ts, types.ts and setup-flow.test.ts differ. Twenty cases/T1 enforcement and typecheck are reported green; fresh receipt still required. Earlier final receipt is stale for this new head; C1–C5 await fresh mode-free configured task execution. See integration delta artifact A-6479.

### impl-839 · 2026-10-19T19:54:05.078Z

Post-integration mode-free verification 4d2b88b9-a205-4d8f-85a5-34ac0eb43080 passed at exact source-reviewed 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2: 1656/1656 tests, zero fail/cancel/skip/TODO. Receipt A-6515, Linux x64 droplet c-8 lon1, lifetime 405s, cost $0.0281. Claimant done marks remain; waiting for fresh same-head final Reviewer verdict before reporting ready for re-enqueue.

### rev-31 · 2026-10-19T19:56:35.037Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-839-integration-final
commit: 32e5c879f7ed95a53a8769f8a7b3ce90b156c8e2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head configured mode-free run 4d2b88b9 / A-6515 passes 1656/1656 ordinary, 355/355 load finishes, all 71 groups 5/5, zero non-pass/tier mismatch. All 20 setup-flow cases and eleven new login identities 5/5 establish C1–C5; max owned repetition .029384790s, whole file .407091185s. Profile/override/no-spawn and noAide integration retained (A-6479/A-6447). A-6522 retains full raw audit and known report-only rows under Coordinator 798ff31d; no duplicate aside. T3 remains periodic/integrated evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-19T20:07:23.997Z

Merged d801ec6948689b568ecbdc4a062a4e0930403f36 onto dev.
