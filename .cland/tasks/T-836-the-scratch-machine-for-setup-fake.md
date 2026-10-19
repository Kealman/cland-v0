---
id: T-836
kind: task
title: "The scratch machine for setup: fake harnesses that install, sign in, take trust and say who they are"
state: closed
status: done
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
updated: 2026-10-19T12:20:11.867Z
closed: 2026-10-19T12:20:11.867Z
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
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
  - verified: rev-30 [reviewer] · run rev-20261019-836-integration-final · 2026-10-19T08:55:17.339Z · commit eb183527f6a22f7d5539b017403a32cbe70bdf7a
  - done: impl-836 · 2026-10-19T08:56:04.619Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-second-integration-final · 2026-10-19T09:13:22.088Z · commit 77a5c64645a55395c45ce99acf72ae8c634248a9
  - verified: rev-30 [reviewer] · run rev-20261019-836-recovery-integration-final · 2026-10-19T11:43:23.668Z · commit 934f883c1e05de5c731cb64d3625d4e0ab526c49
- [x] C2. Each fake's login writes its profile's marker, and the status probe afterwards reports signed in, while the `login-fails` switch leaves it signed out with exit 0.
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
  - verified: rev-30 [reviewer] · run rev-20261019-836-integration-final · 2026-10-19T08:55:17.340Z · commit eb183527f6a22f7d5539b017403a32cbe70bdf7a
  - done: impl-836 · 2026-10-19T08:56:05.205Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-second-integration-final · 2026-10-19T09:13:22.088Z · commit 77a5c64645a55395c45ce99acf72ae8c634248a9
  - verified: rev-30 [reviewer] · run rev-20261019-836-recovery-integration-final · 2026-10-19T11:43:23.668Z · commit 934f883c1e05de5c731cb64d3625d4e0ab526c49
- [x] C3. The fake Codex app-server answers `account/read` and `config/batchWrite`, and no fake Codex process remains after its input closes.
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
  - verified: rev-30 [reviewer] · run rev-20261019-836-integration-final · 2026-10-19T08:55:17.340Z · commit eb183527f6a22f7d5539b017403a32cbe70bdf7a
  - done: impl-836 · 2026-10-19T08:56:05.600Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-second-integration-final · 2026-10-19T09:13:22.088Z · commit 77a5c64645a55395c45ce99acf72ae8c634248a9
  - verified: rev-30 [reviewer] · run rev-20261019-836-recovery-integration-final · 2026-10-19T11:43:23.668Z · commit 934f883c1e05de5c731cb64d3625d4e0ab526c49
- [x] C4. The fixture never reads or writes the real HOME: every inner test runs under a poisoned scratch inherited HOME whose stand-in `.claude.json`, `.codex/` and `.config/cland/` are snapshotted unchanged before and after, and descendants run with a second scratch HOME and an allowlisted environment, so no test needs to open the human's real account files.
  - verified: rev-30 [reviewer] · run rev-20261019-836-final · 2026-10-19T06:59:52.764Z · commit 1940480b30f6af5c0cf0f6728dfe5f5dfdb54d2b
  - verified: rev-30 [reviewer] · run rev-20261019-836-integration-source · 2026-10-19T08:37:15.537Z · commit eb183527f6a22f7d5539b017403a32cbe70bdf7a
  - verified: rev-30 [reviewer] · run rev-20261019-836-integration-final · 2026-10-19T08:55:17.340Z · commit eb183527f6a22f7d5539b017403a32cbe70bdf7a
  - done: impl-836 · 2026-10-19T08:56:06.106Z
  - verified: rev-30 [reviewer] · run rev-20261019-836-second-integration-source · 2026-10-19T08:57:44.372Z · commit 77a5c64645a55395c45ce99acf72ae8c634248a9
  - verified: rev-30 [reviewer] · run rev-20261019-836-second-integration-final · 2026-10-19T09:13:22.088Z · commit 77a5c64645a55395c45ce99acf72ae8c634248a9
  - verified: rev-30 [reviewer] · run rev-20261019-836-recovery-integration-source · 2026-10-19T11:26:38.923Z · commit 934f883c1e05de5c731cb64d3625d4e0ab526c49
  - verified: rev-30 [reviewer] · run rev-20261019-836-recovery-integration-final · 2026-10-19T11:43:23.668Z · commit 934f883c1e05de5c731cb64d3625d4e0ab526c49

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

### rev-30 · 2026-10-19T08:37:15.537Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-integration-source
commit: eb183527f6a22f7d5539b017403a32cbe70bdf7a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration source clear; no findings. A-5904 verifies authorized dev merge (Coordinator 8936bf0f/3c525930), unchanged fakes/setup fixture/test bytes against final-reviewed 1940480b, and original ten-file task shape against landed dev d811832e. OpenCode profile-aware conflict resolution retains T-832 credential/label default with explicit env-only variant. C4 source isolation remains verified under accepted poisoned scratch wording; no real-account reads. A-5902 fresh host outer self-test 1/1, 12.954960458s test /13.071878166s file, raw inner output limitation retained. C1–C3 final refresh awaits fresh exact-head mode-free gate; old A-5851 not reused. Reviewer performed no edits/tests.

Criteria: C4 verified.

### rev-30 · 2026-10-19T08:55:17.340Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-integration-final
commit: eb183527f6a22f7d5539b017403a32cbe70bdf7a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final integrated-head clear; A-5923. Exact-head 1037a387/A-5917 audited: 1476/1476 ordinary pass, zero fail/cancel/skip/TODO, zero tier-mismatch rows, all 399 global load groups 5/5. A-5904 source plus A-5902 current host self-test establish C1–C4. Host T3 outer 1/1 checks inner exit/titles/snapshots; raw inner output limitation retained. setup-machine does not execute in the T0–T2 task gate; Linux T3 stays landing evidence. Coordinator's accepted poisoned scratch HOME control preserved. No findings; report-only budget/lint diagnostics retained.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-19T08:57:44.372Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-second-integration-source
commit: 77a5c64645a55395c45ce99acf72ae8c634248a9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Second integration delta clear; A-5927. Coordinator f73039b5 authority confirmed. Both T3 setup entries retained; incoming T-835 files match landed dev, all T-836 fake/setup fixture/test bytes remain unchanged against original review. A-5926 host self-test 1/1, 14.358670708s test /14.434617625s file plus typecheck/lint/merge-tree proof retained. No findings. C4 refreshed; C1–C3 await fresh exact-head mode-free verify. A-5917 is historical eb183527 evidence only; Linux T3 remains landing evidence.

Criteria: C4 verified.

### rev-30 · 2026-10-19T09:13:22.088Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-second-integration-final
commit: 77a5c64645a55395c45ce99acf72ae8c634248a9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final second integrated-head clear; A-5932. Full A-5931/27e803d5 audited: 1477/1477 ordinary pass, zero fail/cancel/skip/TODO, zero tier-mismatch rows and all 400 global repetition groups 5/5. Source A-5927 plus current host self-test A-5926 establish C1–C4, refreshed. Host outer 1/1 asserts inner exit/titles/snapshots; raw-inner-output limitation retained. Linux task does not execute setup-machine T3; landing batch owns Linux T3 evidence. Accepted poisoned scratch HOME control preserved, no real account reads. No findings; report-only lint/budget diagnostics retained.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-19T11:26:38.924Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-recovery-integration-source
commit: 934f883c1e05de5c731cb64d3625d4e0ab526c49
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Queue-recovery integration source clear; A-5956. Coordinator 9262f75a authority confirmed. All original task-specific fake/profile/curl and setup-machine bytes unchanged against 77a5c646; incoming dev's tier entries retained beside setup-machine T3, original ten-file task shape preserved. A-5955 current host self-test 1/1 (10.920157167s), checks and merge-tree proof retained. No findings; C4 refreshed. C1–C3 await new-head mode-free gate; historical batch A-5951 is not a new-head task/landing receipt. Raw-inner-output limitation and isolated scratch HOME control retained.

Criteria: C4 verified.

### rev-30 · 2026-10-19T11:43:23.668Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-836-recovery-integration-final
commit: 934f883c1e05de5c731cb64d3625d4e0ab526c49
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Queue-recovery final clear; A-5985. Full A-5984/415dd985 audited: 1507/1507 ordinary passed, zero fail/cancel/skip/TODO, zero tier-mismatch rows and all 430 global load groups 5/5. Source A-5956 plus current host A-5955 1/1 self-test refresh C1–C4. Outer assertions/inner-output limitation and accepted scratch HOME isolation retained. No owned Linux T3 execution claimed; historical A-5951 not reused as new-head landing evidence. No findings; report-only lint/budget diagnostics retained.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T12:20:11.867Z

Merged ebd6cafc4ceea161cca518d4b2689460d686511b onto dev.
