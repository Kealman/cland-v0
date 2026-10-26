---
id: T-1328
kind: task
title: The git-ignored secrets file and cland secret set, list and unset
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by: []
topic: topic-1082
branch: t/T-1328-the-git-ignored-secrets-file-and-cland
created: 2026-10-26T07:54:41.571Z
updated: 2026-10-26T09:11:31.915Z
---

## Summary

A project holds its messenger tokens and speech keys in a git-ignored `.cland/secrets.toml`, managed with `cland secret set|list|unset`. Values arrive only through stdin or a hidden prompt, and nothing ever prints them.

## What to build

`.cland/secrets.toml` holds `[telegram] token`, `[discord] token`, and `[speech] elevenlabs_key` and `xai_key`. It is git-ignored through the managed `.cland/.gitignore`. It is kept at mode 600, checked and tightened at hub start, and refused as a symlink with a reason. TOML goes through the hub's existing parser, with no new dependency. `cland secret set <name>` reads the value from stdin or a hidden prompt, never argv. `list` prints names and SHA-256 fingerprint prefixes only. `unset <name>` removes one. Names are dotted keys (`telegram.token`), as `cland config set` names keys. Spec §3.3 and §3.10. Tests feed made-up values through stdin only.

## Acceptance criteria

- [x] C1. A secrets file at mode 644 is tightened to 600 at hub start, a symlinked file is refused with a reason, and `git status` never lists the file (test).
  - done: impl-1328 · 2026-10-26T09:11:02.770Z
- [x] C2. A value piped to `cland secret set telegram.token` lands in the file, `list` shows only its name and fingerprint prefix, `unset` removes it, and the value appears in no command output, log line or process argv (test).
  - done: impl-1328 · 2026-10-26T09:11:02.845Z

## Comments

### impl-1328 · 2026-10-26T07:57:02.423Z

Contract/consumer audit before changes (rule 20): introduce local-only secrets file schema and resolver; no wire/frame fields change. Production consumers: CLI routing/help (hub/bin/cland.ts, cli/help.ts, cli/usage.ts), project layout/ensureSkeleton called at serveProject startup, init/provision.ts managed GITIGNORE writer. Existing project transport secret (.cland/secret), Discovery and all Unix/Web/MCP clients remain unchanged. Audited hub/src, hub/test (all tiers via rg), shared, nvim, web, shipped .agents/skills, docs/agents, qa/briefs and startup probes: no secrets.toml reader exists. Existing doctor secret check refers to transport authentication and is unaffected. Future consumers T-1329/T-1330/T-1331 will use one resolveSecrets(root) dotted-key map, with exported SecretName/names and fingerprint helper. Tests: T1 public file resolver/mutators for safe parsing/files; T2 projectHub startup and real CLI stdin (CLI itself under test). Legacy wire compatibility unchanged because no frames carry secrets. Local red/green execution held by Coordinator cover-quiet.

### impl-1328 · 2026-10-26T08:53:07.476Z

Local runtime evidence at 16762491e, macOS, serial single-file runs (no suite/browser): hub/test/secret-input.test.ts 3/3 T1; hub/test/secrets.test.ts 5/5 T2; hub/test/secrets-git.test.ts 1/1 T3. Slowest case 619.323 ms. npm run typecheck passed for the committed tree before cover-quiet's later expansion. Deferred pre-change sensitivity control used a sealed disposable archive at 16762491e^ with the new T2 file: 0/5 pass, with actual failures `420 !== 384` (644 retained instead of 600), `Missing expected rejection` (symlink accepted), and `cland: unknown command "secret"` (CLI absent). This is post-hold regression sensitivity evidence, not a claim that red execution preceded implementation. No source change was needed after green execution. Coordinator instructed no merge-dev before first review because dev changes are tracker/brief only.

### rev-26 · 2026-10-26T09:00:08.254Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1328-source-1
commit: 16762491e372b6fd1d2ba1a9549cb54ac47d406d
scope: full
findings: [{"severity":"medium","text":"M1 / Standards: new guide lacks exact test-file heading and index row; supply matching per-file guides/index entries and retain unchanged test-docs guard.","file":"docs/agents/tests/hub-test-secrets.test.ts.md","line":1},{"severity":"medium","text":"M2 / Spec C1: ensureGitignore preserves an unmarked file even when it omits secrets.toml, then set succeeds and writes an unignored credential. Preserve custom ownership but enforce protection or refuse before input/write; add native Git negative/positive control.","file":"hub/src/cli/secret.ts","line":28},{"severity":"medium","text":"M3 / Standards: Git root removal and secrets.test.ts CLI launches lack unconditional captured child termination/close/result drainage on cancellation. Per-child timeout does not establish exit before directory cleanup. Reuse owned command seams and retain behavioral assertions.","file":"hub/test/secrets-git.test.ts","line":14},{"severity":"medium","text":"M4 / Spec C2: isPaused false includes a fresh non-flowing stdin; after resume, cleanup pauses only a previously explicitly paused stream. Confirmation/cancellation can leave terminal input active. Restore non-flowing lifecycle and retain actual input/raw-mode/listener assertions.","file":"hub/src/cli/secret.ts","line":57}]
finding_counts: {"high":0,"medium":4,"low":0}

Complete in-session Standards/Spec audit of all 18 changed files in A-12341. M1 guide heading/index guard; M2 accepted writes with unmarked nonignoring .gitignore; M3 native Git/CLI child cancellation ownership before root removal; M4 hidden input leaves initially non-flowing stdin resumed. M1/M4 working-tree red/green reports are acknowledged as attributed evidence, not corrections in this commit. Existing parser/permissions/fingerprint/wire boundaries otherwise consistent; T-1329 override/deny-list scope excluded. No reviewer execution. A-12340 local results/deferred controls retain their stated limits; configured verification remains pending corrected-head source settlement.

Criteria: C1 failed (M2: secret set accepts an unmarked ignore file without secret protection; M3 native fixture lacks cancellation drainage.), C2 failed (M4: hidden input retains initially non-flowing stdin as active; M3 CLI child cancellation ownership is incomplete.).

### impl-1328 · 2026-10-26T09:08:18.988Z

Source-2 corrections committed/pushed 3c53d1365. A-12343 maps M1–M4 and preserves A-12340/A-12341 receipts. Local macOS candidate/exact-head serial checks: T1 input 4/4 (M4 red true!==false before fix, plus already-flowing preservation); T2 startup/CLI 5/5 at exact committed head; T3 Git/lifecycle 3/3 including custom-ignore refusal/accepted protection with native status and cancellation close/output/root receipts; docs guard 3/3 (M1 prior red index mismatch); typecheck green; wording static guard 305 docs, 1326 items, no findings. M2 red control with unprotected custom bytes and open stdin failed null!==1 before fix; now refuses before input, preserves custom bytes and rejects later negation. M3 helpers moved to owned secrets-fixture.ts; only consumers are the two new test files, no existing helper or wire contract changes. No Linux/suite/load receipt yet. No dev merge per Coordinator.

### rev-26 · 2026-10-26T09:10:27.893Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1328-source-2
commit: 3c53d1365554f80bb661fbc914adacc3346788ec
scope: full
findings: [{"severity":"medium","text":"M5 / Standards: direct numeric setTimeout receipt deadline adds wall-clock-wait with no specific documented suppression; new file has frozen allowance 0. Preserve the bound and exact native receipt assertions with the permitted reason/receipt seam; do not raise baseline or relax guard.","file":"hub/test/secrets-git.test.ts","line":64}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source-2 audit A-12345 resolves M1–M4: indexed exact guides; custom ignore protection enforced before stdin with native negative/positive controls; shared captured child close/output barrier repeated before root removal and cancellation receipt; restored non-flowing hidden input with flowing control. Only M5 remains: new direct numeric receipt timeout has no documented reason, so static test-lint policy predicts wall-clock-wait count 1 versus frozen allowance 0. No reviewer execution or actual refusal claimed. Preserve the legitimate deadline/assertions using the documented reason/receipt seam, retain original guard correction outputs, and request fresh corrected-head source review before verification. A-12343 local reports remain attributed; C1/C2 runtime marks pending.

Criteria: C1 failed (M5: native Git/cancellation file adds an unreasoned direct numeric wall-clock deadline against frozen allowance zero.).

### impl-1328 · 2026-10-26T09:11:02.684Z

M5 narrow correction pushed c00a79a01: only a specific trailing lint-allow-wall-clock reason on the existing 5000 ms persisted-ignore receipt deadline. Focused existing lintTestSource API on local macOS reproduced [{line:64,rule:wall-clock-wait}] before and [] after. No bound, assertion, frozen baseline or guard changed. Runtime evidence remains explicitly at prior source-2 tree/head 3c53d1365 (T1 4/4, T2 5/5, T3 3/3); no runtime rerun claimed for comment-only head. M1–M4 were independently resolved in A-12345.

### rev-26 · 2026-10-26T09:11:31.915Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1328-source-3
commit: c00a79a01dae3768698ca578c63f25ec11e91b38
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source settlement clear, A-12346, carrying A-12341/A-12345's complete audit and resolved M1–M4. Entire parent delta is one specific documented trailing deadline reason at secrets-git.test.ts:64; M5 resolved without changing timeout, native receipt/cleanup assertions, tiers, baseline or guard. Original runtime/typecheck receipts stay attributed to 3c53d1365; narrow local lint red/green is attributed to claimant. No reviewer execution. C1/C2 runtime verification remains pending one exact-head mode-free configured result and named/generated case timing/load facts. No dev merge/full task request; Coordinator cover/landing separate.
