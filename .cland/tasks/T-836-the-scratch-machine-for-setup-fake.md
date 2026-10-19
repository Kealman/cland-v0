---
id: T-836
kind: task
title: "The scratch machine for setup: fake harnesses that install, sign in, take trust and say who they are"
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by: []
topic: topic-564
branch: t/T-836-the-scratch-machine-for-setup-fake
created: 2026-10-19T06:34:12.708Z
updated: 2026-10-19T06:59:54.332Z
---

## Summary

The setup scenario (N15) and QA's demo need fake harnesses that answer every surface setup touches, under a scratch HOME. The existing fakes answer `--version` and the status probes only. This ticket teaches them the rest and adds a fake `curl`, so the official installer commands run unchanged against the fakes (question 9).

## What to build

- **A scratch machine fixture** (the E-612 T-639 pattern): a temporary HOME, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, a PATH with a fake bin folder first, a Git identity, and a project made by the real `cland init`. It offers helpers to install a fake harness (on the PATH or in an installer's folder), to sign a profile in or out, and to read the fakes' call log.
- **Logins as marker files per profile.** The key is `CLAUDE_CONFIG_DIR`, `CODEX_HOME` or `OPENCODE_DB`. These commands write the marker, and a `login-fails` switch makes one exit 0 without signing in:
  - `claude auth login`;
  - `codex login`;
  - `opencode auth login --standalone`.
- **Status probes read the marker.**
  - `claude auth status --json` adds `email` and `orgName` when signed in.
  - `opencode auth list` can return an `env`-type connection.
- **Codex's app-server**, in the short-lived stdio mode, answers `account/read` and `config/batchWrite`. The trust edit is appended under `CODEX_HOME`, as the prototype's fake does, and the server exits when its input closes.
- **A fake `curl`** placed first on the PATH answers each official installer URL with a script. The script copies the matching fake into the installer's folder: `~/.local/bin` for Claude Code and Codex, `~/.opencode/bin` for OpenCode. A switch makes it fail.
- A short "how to try" for QA in the hub's test README: how to make the machine with one harness missing and one signed out.

## Acceptance criteria

- [x] C1. On the scratch machine, `curl -fsSL https://claude.ai/install.sh | bash` puts a fake `claude` into `~/.local/bin`, and the official OpenCode command puts one into `~/.opencode/bin` (fixture self-test, T3 header naming the process behaviour).
  - done: impl-836 · 2026-10-19T06:44:04.683Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
- [x] C2. Each fake's login writes its profile's marker, and the status probe afterwards reports signed in, while the `login-fails` switch leaves it signed out with exit 0.
  - done: impl-836 · 2026-10-19T06:44:05.156Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
- [x] C3. The fake Codex app-server answers `account/read` and `config/batchWrite`, and no fake Codex process remains after its input closes.
  - done: impl-836 · 2026-10-19T06:44:05.614Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
- [x] C4. The fixture never reads or writes the real HOME: every inner test runs under a poisoned scratch inherited HOME whose stand-in `.claude.json`, `.codex/` and `.config/cland/` are snapshotted unchanged before and after, and descendants run with a second scratch HOME and an allowlisted environment, so no test needs to open the human's real account files.
  - done: impl-836 · 2026-10-19T06:44:05.975Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b

## Comments

### impl-836 · 2026-10-19T06:38:24.941Z

Implemented scratch HOME/XDG and allowlisted fake tool PATH atop T-639, per-profile fake logins with exit-zero login-fails markers, fake curl for the three official installer URLs, Codex account/read and trust writes with EOF reply drainage. Initial targeted self-test 8.30s and root typecheck green. Adding test-tier metadata and QA recipe, then host lint and review.

### rev-30 · 2026-10-19T06:43:46.860Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-source
commit: 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5839 Standards/Spec audit has no findings. Scratch fixture restricts child HOME/XDG/PATH/env and uses existing bounded owned command drainage; fake curl has official-URL scripts/failure controls without network fallback. Profile login/status/identity and exit-zero failure controls retain legacy fixture defaults. Codex account/trust/EOF reply drainage and PID reaping are asserted. Poisoned inherited scratch HOME snapshots avoid reading human accounts. T3 lifecycle header and dated E-613-owned 15s allowance are valid. C1–C4 final marks await unchanged-head mode-free task gate plus durable host self-test output; no task T3 execution implied. QA none; known T-832 fake overlap retained.

### rev-30 · 2026-10-19T06:59:52.764Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-final
commit: 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5852 combines source A-5839, retained host outer self-test A-5840 (1/1, 7.728s, exit 0, inner exit/title/snapshot assertions audited; raw inner receipts not retained) and exact-head 44d98f8e/A-5851 (1467/1467, zero fail/cancel/skip). All 387 global groups pass 5/5. Installer/profile/EOF proof remains host T3; no own Linux execution/repetitions claimed. Coordinator 11f1dc23/revised C4 accepts poisoned inherited HOME stand-ins plus second scratch/allowlisted env; no real credential-file read or rerun. Five inherited report-only T-803 rows disclosed. C1–C4 verified, no findings; QA none. Linux T3 remains landing-batch evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
