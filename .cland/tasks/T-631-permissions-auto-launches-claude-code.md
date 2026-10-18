---
id: T-631
kind: task
title: permissions = "auto" launches Claude Code with --permission-mode auto
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-493
branch: t/T-631-permissions-auto-launches-claude-code
created: 2026-10-16T16:04:11.937Z
updated: 2026-10-18T10:06:27.282Z
closed: 2026-10-18T10:06:27.282Z
---

## Summary

A new value of `[<role>.launch] permissions`, `auto`, launches Claude Code with `--permission-mode auto` on a first launch, a resume and a relaunch, so a Claude Code role runs guarded without a prompt per command. `skip` and `""` keep their meaning, and Codex and OpenCode launches are unchanged (spec v0.1.4 §3.5).

## What to build

Today `permissions` takes `""` (the harness's own settings) or `skip` (`--dangerously-skip-permissions`). It gains `auto`:

- the roles parser accepts `auto` and refuses any other value with the three it takes;
- the Claude Code adapter passes `--permission-mode auto` for `auto` and `--dangerously-skip-permissions` for `skip`, never both, on a first launch, a resume and a relaunch, reading the role's value at that moment as it does today;
- Codex keeps `approval` and its sandbox as the guard and OpenCode its own settings: both ignore `permissions`, `auto` included;
- the template's header comment documents `auto` beside `""` and `skip`.

Which roles the template puts on `auto` is the template ticket's. The fake Claude Code records its arguments, which the tests read.

## Acceptance criteria

- [x] C1. With `permissions = "auto"`, a Claude Code launch spawns `claude` with `--permission-mode auto` and without `--dangerously-skip-permissions` (adapter test with the fake Claude Code).
  - done: impl-631 · 2026-10-18T09:24:46.046Z
  - verified: rev-31 [reviewer] · run rev-20261018-631-final · 2026-10-18T09:55:25.529Z · commit 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3
- [x] C2. A resume and a relaunch of that session carry the same flag, read from roles.toml at that moment (adapter test).
  - done: impl-631 · 2026-10-18T09:24:47.506Z
  - verified: rev-31 [reviewer] · run rev-20261018-631-final · 2026-10-18T09:55:25.530Z · commit 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3
- [x] C3. `skip` still passes `--dangerously-skip-permissions`, and `""` or an absent key passes neither flag (existing tests kept green).
  - done: impl-631 · 2026-10-18T09:24:49.047Z
  - verified: rev-31 [reviewer] · run rev-20261018-631-final · 2026-10-18T09:55:25.530Z · commit 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3
- [x] C4. A Codex and an OpenCode launch for a role with `permissions = "auto"` start as before, Codex with its approval and sandbox (adapter tests).
  - done: impl-631 · 2026-10-18T09:24:54.731Z
  - verified: rev-31 [reviewer] · run rev-20261018-631-final · 2026-10-18T09:55:25.530Z · commit 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3
- [x] C5. A roles.toml with an unknown `permissions` value is refused with a message naming `""`, `auto` and `skip` (parser test), and the template's header comment documents `auto`.
  - done: impl-631 · 2026-10-18T09:25:01.392Z
  - verified: rev-31 [reviewer] · run rev-20261018-631-source · 2026-10-18T09:29:25.879Z · commit 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3

## Comments

### impl-631 · 2026-10-18T09:22:14.775Z

Parser RED: auto rejected, unknown-value message omitted ""/auto, template omitted auto. GREEN after enum/parser/header changes. CLI-boundary RED: auto launch lacked --permission-mode; GREEN after argv support, table covers auto/skip/null/absent on launch, fresh/native-conversation spawn and relaunch. T2 policy test will cover current roles.toml on fresh resume and relaunch; rediscovery-only resume starts no process.

### rev-31 · 2026-10-18T09:29:25.879Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-631-source
commit: 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review at 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3, fixed base 226bd904a90b269e80b3faa5b514a0ea2f367fff. Read-only review; no tests run by Reviewer.

## Standards
No findings. New parser tests are T1; adapter argv and current-role dispatch tests use in-process T2 seams with bounded test deadlines. Existing native harness contracts supply the process proofs without added launches. No new waits, allowances or role default changes.

## Spec
No findings. Parser accepts auto/skip/empty with the requested diagnostic and template documentation. Claude's shared #launch builder emits mutually exclusive flags for initial launch, native-conversation spawn and relaunch. Sessions refreshes roles before fresh resume/relaunch and builds current LaunchPolicy. Codex and OpenCode adapter behavior is unchanged; existing contract assertions now run with permissions=auto. The argv table covers auto, skip, null and absent settings; the component test changes roles.toml between operations to detect cached policy.

Evidence inspected: A-5114 targeted-file results and reported typecheck/lint. C5 is source-established. C1–C4 remain pending post-source-clear exact-head task verification; this is not a final execution verdict. No per-item QA required.

Standards: 0 findings. Spec: 0 findings.
Artifact A-5127.

Criteria: C5 verified.

### impl-631 · 2026-10-18T09:54:56.634Z

Verification 0ac04ee3-ec17-4460-a89e-8e5b2ee4864c passed at unchanged 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3. A-5167 is the durable Linux x64/Node v24.21.0/Neovim v0.12.5 receipt: 2546 tests, 2538 pass, 8 skipped, 0 failures; lifetime 1372s, $0.0953. Diff selector chose full due to shared adapters/contract.ts. New parser tests passed 5/5 droplet load gates. Awaiting Reviewer role final evidence verdict on its existing source chain.

### rev-31 · 2026-10-18T09:55:25.530Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-631-final
commit: 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review at unchanged 93cbc99ab3e4ff3238e60dbfcade39d61861c6e3, source rev-20261018-631-source / A-5127. Origin branch and task receipt both match this exact head. No source change or Reviewer test execution.

Independently audited A-5167, run 0ac04ee3-ec17-4460-a89e-8e5b2ee4864c: auto-selected full, exit 0, 2546 total / 2538 pass / 0 fail / 0 cancelled / 8 prerequisite skips. Phase totals are hub-free 227/227, hub-machine 1920 pass + 5 skips, Neovim 391 pass + 3 skips; Neovim completed in 153.88s. Suite failure identity arrays are empty; no runtime tier-mismatch receipt or owned quarantine receipt.

All 40 owned ordinary timing receipts are present across roles-launch-permissions (3), claude-code-environment (2), session-resume-component (3), Claude binary contract (6), Codex contract (12) and OpenCode contract (14). The five new identities each pass 5/5 load repetitions, 25/25. The native Claude launch asserts auto and no skip; the T2 argv table proves exclusive flags for launch/native resume/relaunch and empty/absent/skip compatibility. Current roles-file fresh/relaunch checks pass. Codex approval/sandbox and OpenCode native launch controls with permissions=auto pass. Parser/template C5 source continuity is current and all three parser tests pass.

Linux x64 c-8 lon1, Node24.21.0 / Neovim0.12.5, workers2, lifetime1372s, cost$0.0953, peak load5.54. Existing report-only budget/lint diagnostics do not change this green result. No known-failure exception or additional run needed; QA scope none.

Standards: no new findings. Spec: C1–C4 execution verified; C5 remains current from source. Final clear.
Artifact A-5168.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-18T10:06:27.282Z

Merged 974cbc7da5a1e840081d4b5a7fe69ae524b4c49e onto dev.
