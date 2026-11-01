---
id: T-1570
kind: task
title: "The authority seam: a user-role column"
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
topic: topic-1309
branch: t/T-1570-the-authority-seam-a-user-role-column
created: 2026-10-31T23:47:52.978Z
updated: 2026-11-01T21:16:09.886Z
closed: 2026-11-01T21:16:09.886Z
---

## Summary

The web authority table gains a user-role column, and every web request in users mode is checked against the acting user's role, read from the users table at check time through one function. Rows keep their current shape, with plain rows open to `admin` by default, so frames the Host lane adds need no change. A test-only role with one request removed is refused that request, and the refusal names the role. No second role ships.

Hot files: `hub/src/hub/web-authority.ts` [Host: every lane adds rows here], `hub/src/hub/dispatch.ts` [Host] (one call site), `hub/src/hub/users.ts`.

## Acceptance criteria

- [x] C1. Each request type's web rule and its per-role permission are read from one table, and plain rows written as today are open to `admin` with no edit.
  - done: impl-1570 · 2026-11-01T19:58:36.530Z
  - verified: rev-35 [reviewer] · run rev-35-1570-source-1 · 2026-11-01T20:00:08.758Z · commit 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
  - verified: rev-35 [reviewer] · run rev-35-1570-final-1 · 2026-11-01T20:20:01.359Z · commit 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
- [x] C2. In users mode every web request passes the role check, which reads the user's role from the users table at the time of the request.
  - done: impl-1570 · 2026-11-01T19:58:37.432Z
  - verified: rev-35 [reviewer] · run rev-35-1570-final-1 · 2026-11-01T20:20:01.359Z · commit 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
- [x] C3. A test-only role whose column omits one request is refused that request with a result naming the role and the request.
  - done: impl-1570 · 2026-11-01T19:58:38.262Z
  - verified: rev-35 [reviewer] · run rev-35-1570-final-1 · 2026-11-01T20:20:01.359Z · commit 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
- [x] C4. The `roles` table and the authority table ship with `admin` as their only role.
  - done: impl-1570 · 2026-11-01T19:58:39.081Z
  - verified: rev-35 [reviewer] · run rev-35-1570-source-1 · 2026-11-01T20:00:08.758Z · commit 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
  - verified: rev-35 [reviewer] · run rev-35-1570-final-1 · 2026-11-01T20:20:01.359Z · commit 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
- [x] C5. In single mode the web authority checks and their refusals are unchanged.
  - done: impl-1570 · 2026-11-01T19:58:39.286Z
  - verified: rev-35 [reviewer] · run rev-35-1570-final-1 · 2026-11-01T20:20:01.359Z · commit 518b9433ac94b5a03209ea9f51c6aa8f9a31f233

## Comments

### impl-1570 · 2026-11-01T19:54:57.591Z

Rule 20 consumer inventory (rg fields/functions/imports across repository): web-authority.ts WEB_AUTHORITY/webAuthorityRefusal; dispatch.ts request admission and pre-hello as refusal; users.test.ts asserts legacy string rows; web-authority-unit.test.ts policy; web-authority.test.ts authenticated web/Unix; wire-conformance.ts table key exhaustiveness; gateway.test.ts enumerates table keys; QA E-412 stage 2 M19/stage 3 M26; docs/agents/tests.md browser-sign-in-fixtures; hub/README Browser sign-in; implement skill browser sign-in paragraph. No persisted reader or startup probe imports/reads this table; frame/result schema stays unchanged. Existing rows and function signature remain compatible; new reusable userAuthorityRefusal resolves stored role per call. T-1571 and gateway future integration consume this seam (A11); current gateway authority stays narrow. Tests use existing agreed pure-policy and authenticated frame seams.

### rev-35 · 2026-11-01T20:00:08.758Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1570-source-1
commit: 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec no findings. Same table retains plain web rows/admin default and explicit web/roles grants; Users and production authority ship only admin: C1/C4 verified. Shared boundary resolves transport cookie userId and rereads current stored role/active state before replay/actor resolution; frame role/userId cannot grant authority. Single mode keeps original web refusal path/shapes. Pure omitted-role and authenticated same-socket role-change/no-persistence regressions inspected; users/web-authority controls unchanged, consumer inventory and docs/skill/provenance match scope. C2/C3/C5 await exact-head queued verification and actual named policy/auth/users/legacy authority outcomes. No Reviewer execution; after-stage QA separate.

Criteria: C1 verified, C4 verified.

### rev-35 · 2026-11-01T20:20:01.359Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1570-final-1
commit: 518b9433ac94b5a03209ea9f51c6aa8f9a31f233
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings. Same reviewed head is confirmed by branch tip, hub run receipt and A-15388 provenance. Run b1c8d18f-3532-43f9-9989-6f925270a749 exit 0, 4584 passes, zero fail/cancel/skip/todo; T0/T1/fallback all T2/Web completed. T3 deferred to merge batch; T4 unexecuted. Directly inspected ordinary named pass records: policy 6 (current-role/omitted-role at line 7825), auth-mode 7 (same-cookie stored-role/forgery/no-persistence assertions at 9288), users 4, unchanged web-authority 45. These establish C2/C3/C5 with source; C1/C4 source verified, all criteria now verified. Droplet Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, isolated Headless Shell revision1248 / Chrome for Testing156.0.8078.4, cached null; report-only budget/lint/ratchet notices retained. A-15390 records exact provenance and evidence limits: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15390-t-1570-final-evidence-review-at-518b9433.md. After-stage QA and merge-batch coverage separate; Reviewer executed no tests or browsers.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-01T21:16:09.886Z

Merged 9980aea795211836796c543872033c6033e08fdc onto dev.
