---
id: T-981
kind: task
title: "The web's authority: refused frames on the web edge"
state: open
status: ready
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
topic: topic-775
branch: t/T-981-the-web-s-authority-refused-frames-on
created: 2026-10-20T16:49:59.999Z
updated: 2026-10-20T21:19:38.363Z
---

## Summary

The cookie carries the human's authority except for the actions that stay in the CLI and Neovim in 0.2.0. The web edge refuses those frames, and any frame with `as`, with a code that names the CLI and Neovim.

## What to build

The dispatcher knows the edge a conversation came from. The edge policy is one table that classifies every human frame in `protocol.ts` as allowed or refused on the web edge; a frame missing from the table is refused (deny by default), and a test fails when a frame lacks a row. Refused in 0.2.0 (Coordinator decision, 2026-10-20): `hub.stop`, `hub.reload`, `release`, `sync`, `push`, `publish`, `config.set`, `crew.set`, `executor.prepare`, `executor.reap`, `executor.retire-legacy`, `task.migrate`, `web.link`, `artifact.create` with a `path`, and any frame that carries `as`. Allowed, for parity with Neovim (§3.5): every other human frame, including `merge`, `suite.*` and `session.resume`. There is no `hub.restart` frame. The refusal code says the action lives in the CLI and Neovim. Check the names against today's `protocol.ts`; a frame there that this list does not name gets a row and is reported in the item topic.

## Acceptance criteria

- [x] C1. On the web edge every frame the table refuses (`hub.stop`, `hub.reload`, `release`, `sync`, `push`, `publish`, `config.set`, `crew.set`, the three `executor.*` frames, `task.migrate`, `web.link`, `artifact.create` with a `path`) is refused with a code and a message naming the CLI and Neovim, while the same frames still work from a Unix-socket client (test per frame).
  - done: impl-981 · 2026-10-20T21:07:17.438Z
  - verified: rev-23 [reviewer] · run rev-20261020-981-final · 2026-10-20T21:19:38.277Z · commit 2ff5293f9af5b8710a98b34879e21549047bf38b
- [x] C2. Any frame that carries `as` is refused on the web edge (test).
  - done: impl-981 · 2026-10-20T21:07:17.457Z
  - verified: rev-23 [reviewer] · run rev-20261020-981-final · 2026-10-20T21:19:38.277Z · commit 2ff5293f9af5b8710a98b34879e21549047bf38b
- [x] C3. `topic.send` and `artifact.create` with `content` pass on the web edge and are recorded as the human's (test).
  - done: impl-981 · 2026-10-20T21:07:17.478Z
  - verified: rev-23 [reviewer] · run rev-20261020-981-final · 2026-10-20T21:19:38.277Z · commit 2ff5293f9af5b8710a98b34879e21549047bf38b
- [x] C4. The edge policy is one table with a row for every human frame in `protocol.ts`; a frame without a row is refused, and a test fails when a protocol frame has no row.
  - done: impl-981 · 2026-10-20T21:07:17.499Z
  - verified: rev-23 [reviewer] · run rev-20261020-981-final · 2026-10-20T21:19:38.277Z · commit 2ff5293f9af5b8710a98b34879e21549047bf38b
- [x] C5. `hub/README.md` lists the refused frames and the deny-by-default rule.
  - done: impl-981 · 2026-10-20T21:07:17.526Z
  - verified: rev-23 [reviewer] · run rev-20261020-981-source · 2026-10-20T21:08:57.299Z · commit 2ff5293f9af5b8710a98b34879e21549047bf38b
  - verified: rev-23 [reviewer] · run rev-20261020-981-final · 2026-10-20T21:19:38.277Z · commit 2ff5293f9af5b8710a98b34879e21549047bf38b

## Comments

### impl-981 · 2026-10-20T20:59:37.863Z

Implementation seams are the acceptance criteria's authenticated web /ws and Unix-socket request boundaries (T2), plus the pure policy boundary and compile-time protocol inventory (T1/T0). The policy will cover ClientRequest, TaskRequest and SessionRequest before replay or actor resolution, denying unknown frames and any own `as` field. Inventory reports executor.status and hook/demo/task-import/artifact/worktree actions as explicit allow rows under the decided remainder policy.

### coord · 2026-10-20T20:59:52.260Z

Refused-frame table amended by the Coordinator, 2026-10-20 21:00Z, after impl-981's protocol inventory found frames newer than the decision: also refused on the web edge in 0.2.0: session.signal, worktree.prune, artifact.delete, suite.forced, task.import and every demo.* frame (they kill processes, delete state, bypass the queue, spend droplet money or import externally). Allowed: executor.status (read-only), artifact.promote, artifact.move, session.bridge, suite.slot and the rest of the human union. Deny by default stays.

### impl-981 · 2026-10-20T21:07:52.638Z

Completed and pushed head 2ff5293f9af5b8710a98b34879e21549047bf38b after merging origin/dev. Full 93-frame inventory and evidence: A-8066 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8066-t-981-web-authority-inventory-and-review-evidence.md). All C1–C5 marked done; source review requested from Reviewer. At this head local macOS check/T0 passed (lint report mode, zero refusals); targeted T1 policy 4/4, T2 authority 32/32, T2 web auth 13/13, T1 clauses 27/27. No queued task verification receipt yet; it follows clear source review.

### rev-23 · 2026-10-20T21:08:57.299Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-981-source
commit: 2ff5293f9af5b8710a98b34879e21549047bf38b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-981 source review

Head 2ff5293f9af5b8710a98b34879e21549047bf38b; tree 4cde9bd0c2c89e05704a06fcdb8badf609cc1435. Fixed base 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9 (pre-review merged dev). Reviewed all 14 task files against C1–C5 and the Coordinator's item amendment of 2026-10-20 20:59:52.

## Standards
No findings. One isolated explicit table classifies all 93 names in ClientRequest | TaskRequest | SessionRequest. satisfies Record and independent protocol-union conformance catch missing/extra rows; Object.hasOwn rejects prototype names. Runtime unknown classifications deny by default.
The Web gate runs before replay, actor resolution and normal dispatch, with initial-hello own-as handling before hello admission. Existing Web hello validation permits only human clients and rejects session identity, so the earlier spoke branch cannot bypass this gate. Any own as value is refused; artifact.create carrying any own path is refused even alongside content. The error type/code agrees with shared/wire. Unix/stdio policy is unchanged.
Tests use scratch in-process hubs and filtered environments. They observe the human welcome, cookie-authenticated boundary and original local handler results/preconditions; publishing/cloud operations are not executed. README/help/test docs, implementer skill provenance and role pointers match the intended boundary. Diff check is clear.

## Spec
No findings. The base refusal list plus amended session.signal, worktree.prune, artifact.delete, suite.forced, task.import and all four demo frames are present. Explicit allow rows preserve the decided remaining human union, including merge, suite operations other than forced, session.resume/bridge, executor.status and artifact.promote/move.
T2 comparisons cover every refused action, paths, initial/ordinary as fields, unknown/prototype types and human-owned topic messages/inline artifacts. For costly local actions, tests assert contextual admission/preconditions rather than successful release/provider effects; A-8066 states this limit. Pure policy tests exercise malformed as/path values and the explicit allow decisions. C5 README lists the complete refused set, code/message guidance and deny-by-default behavior.

## Evidence and verdict
A-8066 reports at-head local macOS arm64 T1 policy 4/4, T2 authority 32/32, T2 existing auth 13/13, role-clause T1 27/27, plus npm run check with report-mode test lint 131 findings and zero refusals. These are targeted/static claims, not queued full-suite evidence. Its omitted-row typecheck negative control and initial hub.reload/hello-as reds are described separately, not new passing runtime proof. Reviewer launched no tests, browsers or product processes.
Source clear; verify C5 by source only. C1–C4 final runtime settlement awaits normal same-head configured mode-free verification. Affected after-stage QA remains separate.
Standards 0 findings; Spec 0 findings.

Criteria: C5 verified.

### rev-23 · 2026-10-20T21:19:38.277Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-981-final
commit: 2ff5293f9af5b8710a98b34879e21549047bf38b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; evidence audit A-8076 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8076-t-981-final-evidence-review-at-2ff5293f.md). Same-head configured run 6e56c0c4/A-8075 exited 0 on Linux x64 droplet: T1/all-T2 fallback, 2,187 ordinary passing test finishes/337 passing files. All 36 new authority identities pass 5/5 load repetitions separately: policy T1 4/4 and authority T2 32/32 confirm typed frame refusals, every own-as form, human attribution and deny-by-default behavior. Full-union compile-time conformance and docs remain source-established. Costly Unix parity checks validate handler admission/preconditions, not actual publication/cloud execution. Host check 091b0f5d not repeated remotely; lint/duration/ratchet diagnostics report-only, two missing baselines. No T3/T4/Web phase or after-stage QA claim. No findings; verify C1–C5.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
