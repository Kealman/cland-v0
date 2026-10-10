---
id: T-181
kind: task
title: "The crew file: .cland/crew.toml, validated and reloaded, cland crew show and set, the sessions header summary"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-113
blocked_by: []
topic: topic-89
branch: t/T-181-the-crew-file-cland-crew-toml-validated
created: 2026-10-10T15:38:36.819Z
updated: 2026-10-10T15:56:06.353Z
---

## Parent

T-113, slice 6 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

`.cland/crew.toml` with its shape and validation; reload on change, a broken file refused with a notice and the last good version kept; `cland crew show` and `cland crew set`; `cland init` defaults; the sessions panel header's summary.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-181 · 2026-10-10T15:54:27.063Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-2 · 2026-10-10T15:56:06.353Z
- [x] C2. Demo: `cland crew set reviewer.size 2` and the header reads "rev pool 2".
  - done: impl-181 · 2026-10-10T15:48:01.901Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-1 · 2026-10-10T15:51:52.004Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-2 · 2026-10-10T15:56:06.353Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-181 · 2026-10-10T15:48:02.149Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-1 · 2026-10-10T15:51:52.128Z
  - verified: rev-10 [reviewer] · run rev-20261010-181-2 · 2026-10-10T15:56:06.353Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

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
