---
id: T-832
kind: task
title: Doctor shows each harness's version for information, and OpenCode's environment keys no longer count as credentials
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
topic: topic-562
branch: t/T-832-doctor-shows-each-harness-s-version-for
created: 2026-10-19T06:34:12.337Z
updated: 2026-10-19T08:35:07.113Z
closed: 2026-10-19T08:35:07.113Z
---

## Summary

Doctor stops judging harness versions: each harness row prints the version it found and where, with no tested-range warning, refusal or upgrade fix (the amendment to Q-599 §4, E-424 C3 amended). Its OpenCode login row counts only stored credentials, not environment keys (Q-593).

## What to build

- **Version rows.** Every harness version gets an `ok` row: `<version> at <bin>`. The tested release is an informational note, `(tested with 2.1.294)`, never a verdict.
  - Codex 0.163.0 no longer warns.
  - OpenCode 2.x newer than tested no longer warns.
  - OpenCode 1.x and 3.x get no refusal (question 7). The note says cland speaks OpenCode's v2 API.
  - A missing or unreadable `--version` still fails, because the binary does not run.
- **OpenCode login.** `opencode auth list` returns connections of type `credential` and of type `env`. Only `credential` connections count. A list that holds only `env` connections reads "no stored credentials", with the same optional-login wording as an empty list.
- **One probe for doctor and setup.** Doctor's per-harness probe (binary, version, login) becomes one exported function. `cland setup` (N6) reads its harnesses through the same function, so the two never disagree.
- The hub README's doctor section follows.

## Acceptance criteria

- [x] C1. With fake probe results, Claude Code 2.3.0, Codex 0.163.0 and OpenCode 2.0.40 each give one `ok` row naming the version and binary, and no `warn` or `fail` row mentions a range (T1).
  - done: impl-832 · 2026-10-19T06:40:30.517Z
  - verified: rev-30 [reviewer] · run rev-20261019-832-final · 2026-10-19T06:55:10.234Z · commit a073af27640c626a825f840cd878f1a8ec82ffcb
- [x] C2. OpenCode 1.4.0 and 3.0.0 give `ok` version rows with the v2-API note and no refusal, and a failing `--version` still gives a `fail` row (T1).
  - done: impl-832 · 2026-10-19T06:40:30.977Z
  - verified: rev-30 [reviewer] · run rev-20261019-832-final · 2026-10-19T06:55:10.234Z · commit a073af27640c626a825f840cd878f1a8ec82ffcb
- [x] C3. An `opencode auth list` result whose only connection has `type: "env"` gives the "no stored credentials" row, and one with a `credential` connection gives `ok` naming the provider (T1).
  - done: impl-832 · 2026-10-19T06:40:31.575Z
  - verified: rev-30 [reviewer] · run rev-20261019-832-final · 2026-10-19T06:55:10.234Z · commit a073af27640c626a825f840cd878f1a8ec82ffcb
- [x] C4. Setup's probe and doctor's rows come from one exported function, and a test calls it directly for each of the three harnesses (T1).
  - done: impl-832 · 2026-10-19T06:40:32.050Z
  - verified: rev-30 [reviewer] · run rev-20261019-832-final · 2026-10-19T06:55:10.234Z · commit a073af27640c626a825f840cd878f1a8ec82ffcb

## Comments

### impl-832 · 2026-10-19T06:37:27.897Z

Implemented shared probeHarness(id, env, probe?, installation?) returning id, binary, parsed version and doctor checks. T1 red/green covers all three harness versions, OpenCode other majors, failed/unreadable version and stored credential connections versus env connections. Host typecheck and test lint pass; targeted probe file 0.078s, doctor component file 1.328s. CLI fake-binary compatibility check running; source review next.

### rev-30 · 2026-10-19T06:40:10.511Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-832-source
commit: a073af27640c626a825f840cd878f1a8ec82ffcb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5833 Standards/Spec audit has no findings. Shared exported probeHarness backs doctor and direct T1 calls for all harnesses; setup-facing API is available for later E-613 flow. Parsed versions are informational ok rows, all OpenCode majors carry v2 note, failed/unreadable versions still fail. Only nested credential connections count, with env-only/empty warning and mixed-provider filtering; standalone/database behavior retained. Obsolete range-policy tests replaced at T1; other doctor/CLI controls retained with truthful stored-credential fakes. C1–C4 final marks await exact-head mode-free task gate; none verified here. QA none; T3 fake CLI coverage remains host/batch evidence.

### impl-832 · 2026-10-19T06:54:38.247Z

Same-head mode-free droplet verification af90d071-2d02-4032-8b88-6a19170aaaed passed at a073af27640c626a825f840cd878f1a8ec82ffcb: 1468 tests, 1468 pass, no failures/skips/cancellations. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; droplet lifetime 817s, cost $0.0567. Durable log A-5847 at .cland/artifacts/A-5847-suite-af90d071-2d02-4032-8b88-6a19170aaaed-auto-at-a073af2.log. T3 deferred to merge batch under queue policy. Reviewer receives same-head result directly for final criterion marks/verdict; task head remains unchanged.

### rev-30 · 2026-10-19T06:55:10.234Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-832-final
commit: a073af27640c626a825f840cd878f1a8ec82ffcb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5848 combines source A-5833 and accepted same-head af90d071/A-5847. T0–T2 1468/1468, zero fail/cancel/skip. Shared-probe 4/4 with all 20 repetition bodies passing establishes informational rows, other OpenCode majors/v2 note, failed/unreadable versions, credential-only auth and direct export use for all harnesses; doctor integration file passes. All 391 global groups pass 5/5. Five inherited report-only T-803 Git rows disclosed, none in new probe. C1–C4 verified; no findings, QA none. No setup orchestration or T3 CLI execution falsely claimed; Linux T3 remains landing-batch evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T08:35:07.113Z

Merged d811832edd7744cb41fccc4a1c46b5c1ddc21ebf onto dev.
