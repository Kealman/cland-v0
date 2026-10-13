---
id: T-181
kind: task
title: "The crew file: .cland/crew.toml, validated and reloaded, cland crew show
  and set, the sessions header summary"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-113
blocked_by: []
topic: topic-89
branch: t/T-181-the-crew-file-cland-crew-toml-validated
created: 2026-10-10T15:38:36.819Z
updated: 2026-10-10T17:20:51.506Z
---

## Parent

T-113, slice 6 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

`.cland/crew.toml` with its shape and validation; reload on change, a broken file refused with a notice and the last good version kept; `cland crew show` and `cland crew set`; `cland init` defaults; the sessions panel header's summary.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-181 · 2026-10-10T15:54:27.063Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-2 · 2026-10-10T15:56:06.353Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-3 · 2026-10-10T16:46:21.277Z
- [x] C2. Demo: `cland crew set reviewer.size 2` and the header reads "rev pool 2".
  - done: impl-181 · 2026-10-10T15:48:01.901Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-1 · 2026-10-10T15:51:52.004Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-2 · 2026-10-10T15:56:06.353Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-3 · 2026-10-10T16:46:21.277Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-181 · 2026-10-10T15:48:02.149Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-1 · 2026-10-10T15:51:52.128Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-2 · 2026-10-10T15:56:06.353Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-3 · 2026-10-10T16:46:21.277Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-181 · 2026-10-10T17:18:31.600Z
  - verified: rev-14 [reviewer] · run rev-20261010-181-4 · 2026-10-10T17:20:28.634Z

## Comments

### impl-181 · 2026-10-10T15:39:43.579Z

Implementing slice 6: validated crew file and last-good reload, CLI show/set, init defaults and sessions header summary. Coverage through real hub protocol/CLI and headless Neovim.

### rev-10 · 2026-10-10T15:51:52.240Z

verdict: review
result: not clear
by: rev-10 [reviewer]
run: rev-20261010-181-1
commit: f0c2de5532f3fc1aafbc71f839c00c367d176a9a

Medium — hub/src/crew.ts:23: `record()` accepts TOML date/timestamp objects as tables; `crew = 1979-05-27` and `[crew]\nreviewer = 1979-05-27` both load defaults, so a broken edit can reset last-good reviewer size 3 to 1 without a refusal notice. Reject non-table date objects and cover refusal/retention through the protocol. Standards: no findings. Spec: one medium finding against §3.8. C2/C3 verified separately in this run; C1 failed; C4 remains unverified while the full suite is pending.

Criteria: C1 failed (TOML dates/timestamps pass the table guard and load defaults instead of refusing the broken file and retaining the last good crew.).

### impl-181 · 2026-10-10T15:54:27.606Z

Fixed review finding as a class: isPlainTable allows only Object.prototype or null (smol-toml ordinary tables), applied at root/crew/role levels. Protocol regression reproduced size 3→1 reset before the fix and now confirms refusal plus retention for date/time/timestamp/array inputs. All three targeted crew tests pass. Fresh final-head full suite queued next.

### rev-10 · 2026-10-10T15:56:06.353Z

verdict: review
result: clear
by: rev-10 [reviewer]
run: rev-20261010-181-2
commit: 5f03e2011740f4634d788172e9f37f079e60b08e

No high, medium or low findings remain. A-648's medium issue at hub/src/crew.ts:23 is resolved by isPlainTable at root/crew/role boundaries. Independently verified rejection of 12 date/time/array cases and acceptance of valid ordinary/inline/per-group tables plus defaults round trip. Reviewed A-649 red/green protocol regression evidence for refusal notices and last-good size retention. Standards: no findings. Spec: no findings; unchanged full-item checks from run 1 carry forward. C1/C2/C3 verified; C4 remains unverified pending the fresh full suite for this head.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-181 · 2026-10-10T16:44:46.512Z

Full package run A-667 found 3 crew integration failures and one Codex digest count mismatch. Fixed committed-file/update inventories and reused tracker DEFAULT_LEVELS in parseCrew. All affected targeted checks pass; unchanged Codex digest case also passes in isolation. Head 1240a4d pushed; full package rerun started as one persistent command. C4 remains pending.

### rev-10 · 2026-10-10T16:46:21.277Z

verdict: review
result: clear
by: rev-10 [reviewer]
run: rev-20261010-181-3
commit: 1240a4d93a0fc1acfc8a012cc975f9331f28f548

No findings in the three-line follow-up. hub/src/crew.ts now shares tracker DEFAULT_LEVELS while actual custom levels remain supplied by CrewFile; daemon committed-file inventory includes crew.toml; update rewrite inventory excludes the preserved staffing file. Independent read-only parser checks and A-668 targeted evidence support the fixes. Prior full-item clearance A-654 carries forward. Standards: 0 findings; Spec: 0 findings. C1/C2/C3 verified; C4 remains unverified pending the fresh full suite on 1240a4d (A-667's earlier run failed).

Criteria: C1 verified, C2 verified, C3 verified.

### impl-181 · 2026-10-10T17:18:31.740Z

Full npm run typecheck && npm test passed on 1240a4d93a0fc1acfc8a012cc975f9331f28f548 (exit 0): hub 1025/1025, Neovim 233/233, zero failures/skips. Complete retained log A-687 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-687-t-181-full-package-checks.log. C4 marked done; requesting final C4 verification from rev-14 with prior clear reviews A-654/A-669.

### rev-14 · 2026-10-10T17:20:28.634Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-181-4
commit: 1240a4d93a0fc1acfc8a012cc975f9331f28f548

No findings in the focused C4 evidence review. A-687:2–11 records both typecheck phases and the complete package test command; A-687:1160–1166 and :1407–1413 report hub 1025/1025 and Neovim 233/233, zero failures, cancellations, skips or todos. package.json:16–17 and hub/test/run-suite.ts:221–239 establish complete inventories and failure propagation. Independently confirmed clean T-181 worktree and matching HEAD/local origin at the pinned commit; live lead reports exit 0. No tests rerun or repository edits. Standards: 0 findings; Spec: 0 findings. C4 verified; existing C1/C2/C3 marks from rev-20261010-181-3 carry forward. Detailed review A-688 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-688-t-181-c4-review-at-1240a4d-full-package-checks-verified.md.

Criteria: C4 verified.

### coord · 2026-10-10T17:20:51.506Z

Merged e1cab3a5663412d7942f6247407b2e8b2d7fd5fb onto dev.
