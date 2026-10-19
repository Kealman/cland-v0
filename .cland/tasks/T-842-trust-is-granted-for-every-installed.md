---
id: T-842
kind: task
title: Trust is granted for every installed harness without a question and reported in one line
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-837
topic: topic-585
branch: t/T-842-trust-is-granted-for-every-installed
created: 2026-10-19T06:34:13.266Z
updated: 2026-10-19T13:04:30.773Z
---

## Summary

Claude Code refuses a background launch in an untrusted folder (T-24, T-58, D36), and Codex asks at its first attach (T-42). Setup records each installed harness's trust the way the harness's own dialog does, without asking, and reports it in one line, "trusted for …" (Q-593).

## What to build

- **Claude Code.** `projects["<realpath of the root>"].hasTrustDialogAccepted = true` goes into the profile's `.claude.json`.
  - The profile is the one the hub launches with (`$CLAUDE_CONFIG_DIR/.claude.json`, else `~/.claude.json`), plus each Claude Code account a role names (question 5).
  - The write happens under Claude Code's own `<file>.lock` folder, which counts as stale after 10 s.
  - The file is re-read under the lock, written through a temporary file and renamed, keeping every other key, the mode (0600 when new), a symlinked target, and the trailing newline.
  - The prototype's `grantClaudeTrust` encodes this.
- **Codex.** `projects."<folder>".trust_level = "trusted"` is written through a short-lived app-server's `config/batchWrite`, in the `CODEX_HOME` the hub launches with (plus role accounts). The folder is spelt as given, and also as its real path when the two differ. The app-server's process group is ended afterwards, so no Codex daemon is left (Q-594 risk).
- **OpenCode** has no trust gate and is named as such.
- **The line.** One `trust` line:
  - `done` "trusted for claude-code (~/.claude.json), codex (~/.codex/config.toml)";
  - `ok` when every entry is already there;
  - `fail` naming the harness and the manual way (its own dialog) when a write does not re-read as trusted.
- The line says it wrote the human's real harness configuration for this path (risk). Without a terminal and without `--yes`, the step is `open` and writes nothing (question 2).

## Acceptance criteria

- [x] C1. On a scratch `.claude.json` with other projects and keys, the grant adds the root's real path as trusted and leaves every other key, the mode and the trailing newline as they were (T1 on a temp file).
  - verified: rev-30 [reviewer] · run rev-20261019-842-source-corrected · 2026-10-19T11:41:05.696Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - verified: rev-30 [reviewer] · run rev-20261019-842-final · 2026-10-19T12:00:58.346Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - done: impl-842 · 2026-10-19T12:01:13.053Z
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-source · 2026-10-19T12:46:57.225Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-final · 2026-10-19T13:04:27.961Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a
- [x] C2. A fresh lock folder held by another writer makes the grant wait and then succeed once it is released, while a lock older than 10 s is taken over (T1, fake clock).
  - verified: rev-30 [reviewer] · run rev-20261019-842-final · 2026-10-19T12:00:58.346Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - done: impl-842 · 2026-10-19T12:01:13.609Z
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-final · 2026-10-19T13:04:27.961Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a
- [x] C3. With Claude Code and Codex installed, one `trust` line reports both, and the injected Codex client received one `config/batchWrite` whose edits are the root's spellings (T1).
  - verified: rev-30 [reviewer] · run rev-20261019-842-final · 2026-10-19T12:00:58.346Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - done: impl-842 · 2026-10-19T12:01:14.180Z
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-final · 2026-10-19T13:04:27.961Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a
- [x] C4. A second run finds both entries and reports `trust ok` without writing (T1, asserting no write).
  - verified: rev-30 [reviewer] · run rev-20261019-842-final · 2026-10-19T12:00:58.346Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - done: impl-842 · 2026-10-19T12:01:14.648Z
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-final · 2026-10-19T13:04:27.961Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a
- [x] C5. The Codex grant ends the app-server's process group when it returns or fails (T1 with an injected spawner).
  - verified: rev-30 [reviewer] · run rev-20261019-842-final · 2026-10-19T12:00:58.346Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - done: impl-842 · 2026-10-19T12:01:15.212Z
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-final · 2026-10-19T13:04:27.961Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a
- [x] C6. Without a terminal and without `--yes`, nothing is written and the line is `open` (T1).
  - verified: rev-30 [reviewer] · run rev-20261019-842-source-corrected · 2026-10-19T11:41:05.696Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - verified: rev-30 [reviewer] · run rev-20261019-842-final · 2026-10-19T12:00:58.346Z · commit 880bd379f811589f0d687113607ede99fecc7f26
  - done: impl-842 · 2026-10-19T12:01:15.688Z
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-source · 2026-10-19T12:46:57.225Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a
  - verified: rev-30 [reviewer] · run rev-20261019-842-installer-integration-final · 2026-10-19T13:04:27.961Z · commit 2cc318f468c0f668aaacda99c64971b5e982227a

## Comments

### impl-842 · 2026-10-19T11:36:44.761Z

Implemented trust as an ordered setup step: Claude config lock/atomic preservation, Codex batchWrite with bounded process-group cleanup, launch profiles plus role accounts, rerun no-write, and nonterminal --yes policy. All C1–C6 now have targeted T1 coverage in setup-trust.test.ts. Targeted: trust 10/10 (0.152 s), flow 5/5 (0.103 s), CLI 5/5 (0.559 s). Typecheck, tier manifest and test-lint policy passed. Source review next; no per-item QA brief/policy is required (E-613 stage QA scope none).

### rev-30 · 2026-10-19T11:39:24.111Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-842-source
commit: 95079b36e1b9a2f5d977da89775e1ddad25d6efb
scope: full
findings: [{"severity":"medium","text":"M1: A present non-object projects value or selected project entry is replaced with {} before writing. Valid JSON such as {projects:[...]} or {projects:{'/root':[...]}} loses existing configuration while reporting done. Reject unexpected existing shapes and preserve original bytes, with the manual-dialog failure path; missing fields may be created.","file":"hub/src/setup/trust.ts","line":91},{"severity":"low","text":"L1: Setup README still promises no nonterminal/JSON writes and lists trust as future work. This head grants real harness trust with --yes, including --json --yes. Document the built trust step, config-path disclosure and explicit flag exception, composing later with T-838/T-841 wording.","file":"hub/README.md","line":982}]
finding_counts: {"high":0,"medium":1,"low":1}

Source not clear; A-5977. M1: unexpected existing Claude projects/project-entry shapes are silently replaced with empty objects, losing human config. Validate and refuse without writes; add byte-preservation controls. L1: README trust/--yes JSON-write wording stale. Normal atomic/lock/symlink/newline handling, profile selection, Codex batch/group cleanup and no-flag behavior otherwise reviewed against C1–C6; A-5975 host evidence retained. No Reviewer edits/tests or real account access. Fresh source review before verification.

Criteria: C1 failed (Present non-object Claude projects/project-entry values are discarded rather than preserved with a failed manual-repair result.).

### impl-842 · 2026-10-19T11:40:28.082Z

Addressed source review A-5977: M1 now refuses present non-object projects/project entries and preserves original bytes; T1 regression covers arrays/strings/null at both levels. L1 hub README documents built trust and --yes nonterminal/JSON writes. Head 880bd379. Typecheck passed; targeted trust 11/11 0.139s, flow 5/5 0.099s, CLI 5/5 0.522s. Fresh fetch + merge-tree probe clean; no post-review dev merge. Requesting fresh source review before verify.

### rev-30 · 2026-10-19T11:41:05.696Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-842-source-corrected
commit: 880bd379f811589f0d687113607ede99fecc7f26
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-5981. M1/L1 resolved. Present malformed projects/project entries reject before mutation with exact-byte T1 controls; absent fields still created. README now describes built trust and --yes nonterminal/JSON writes. Original lock/atomic/profile/Codex cleanup safeguards unchanged, A-5980 red/green and host evidence retained. C1/C6 source verified; C2–C5 await exact-head mode-free gate. No findings, no dev merge, no Reviewer edits/tests or real harness config access.

Criteria: C1 verified, C6 verified.

### impl-842 · 2026-10-19T12:00:42.960Z

Exact reviewed head 880bd379 passed mode-free verify bb11dfab-e5ea-4ace-bdd6-7d0b937069ef: 1519 tests passed, 0 failed/cancelled/skipped. Receipt A-6010. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; droplet c-8 lon1, lifetime 1010 s, cost $0.0702. T3 deferred to the queue-enabled merge batch as designed. Tree and head unchanged; awaiting the source Reviewer's final evidence settlement.

### rev-30 · 2026-10-19T12:00:58.346Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-842-final
commit: 880bd379f811589f0d687113607ede99fecc7f26
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6011 audits A-6010 / bb11dfab at the unchanged corrected-source head. Ordinary 1519/1519, zero fail/cancel/skip/TODO, all 442 load-gate groups 5/5, zero tier-mismatch rows. All eleven trust controls complete ordinarily and 5/5, including preservation, locking, rerun/no-write, Codex cleanup and malformed-shape correction. C1–C6 verified. Existing report-only findings retained; T3 remains merge-batch landing evidence. No Reviewer tests or real-account reads.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-842 · 2026-10-19T12:46:01.869Z

Resolved merge-queue conflict by merging current origin/dev under rule 11. New head 2cc318f4 composes T-838 installer CLI/machine/JSON handling with T-842 trust/root-spelling policy and docs. Flow fixtures retain T1 via scratch HOME/pretrusted scratch configs; own CLI/trust fixtures implement required new machine methods. Targeted flow 10/10 .134s, trust 11/11 .133s, CLI 7/7 .569s; typecheck + tiers + diff check pass. Fresh fetch/merge-tree clean. Requesting source review before new exact-head verification; old receipt is not reused as current evidence.

### rev-30 · 2026-10-19T12:46:57.225Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-842-installer-integration-source
commit: 2cc318f468c0f668aaacda99c64971b5e982227a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration source clear; A-6041. Queue merge-conflict instruction verified. Installer CLI/effects/JSON env routing compose with trust root spelling/--yes/ordered step; trust writer/lock/RPC/cleanup blobs and assertions unchanged. Scratch fixture updates preserve installer and trust boundaries. C1/C6 refreshed, C2–C5 await new exact-head mode-free receipt. A-6039 targeted checks retained; no Reviewer tests.

Criteria: C1 verified, C6 verified.

### impl-842 · 2026-10-19T13:04:04.580Z

Post-conflict exact-head verification 97b56f96-d7ef-4ec8-8a92-4f8b9e44bb85 passed at reviewed head 2cc318f468c0f668aaacda99c64971b5e982227a: 1547/1547 tests, no failures/cancelled/skipped. A-6043. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; c-8 lon1, lifetime 963 s, cost $0.0669. T3 remains queue-enabled merge-batch evidence. Head and working tree unchanged; awaiting the source Reviewer's final evidence settlement.

### rev-30 · 2026-10-19T13:04:27.961Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-842-installer-integration-final
commit: 2cc318f468c0f668aaacda99c64971b5e982227a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration final clear; A-6044 audits A-6043 / 97b56f96 at unchanged delta-reviewed head. Ordinary 1547/1547, zero fail/cancel/skip/TODO, all 466 load groups 5/5, zero tier-mismatch rows. Eleven trust, ten installer-flow and seven CLI cases complete ordinarily and 5/5, including JSON routing and root spellings. C1–C6 refreshed. Report-only findings retained; T3 is merge-batch landing evidence. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
