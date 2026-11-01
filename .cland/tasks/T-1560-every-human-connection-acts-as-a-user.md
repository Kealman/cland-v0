---
id: T-1560
kind: task
title: Every human connection acts as a user
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1558
topic: topic-1291
branch: t/T-1560-every-human-connection-acts-as-a-user
created: 2026-10-31T23:47:50.232Z
updated: 2026-11-01T03:12:04.037Z
closed: 2026-11-01T03:12:04.037Z
---

## Summary

In users mode each human conversation carries a user. A web socket takes the user its cookie maps to. The CLI and Neovim, local trust through the hub socket, act as the first user. `cland web` mints a one-time link bound to the acting user (assumed, A4). The audit record of every human request names that user's id. Single mode keeps `human` and today's link flow.

Hot files: `hub/src/hub/dispatch.ts` [Host], `hub/src/hub/web-auth.ts` [E-1538], `hub/src/hub/web-edge.ts` [E-1538], `hub/src/hub/store.ts` [Host] (`web_sessions.user_id` in `ADDED_COLUMNS`), `hub/src/hub/audit.ts`, `hub/src/protocol.ts` [Host], `hub/src/cli/web.ts`, `web/src/accounts/Profile.tsx`. **Not** `hub/src/hub/socket.ts`.

## Acceptance criteria

- [x] C1. A web session row records the user its sign-in was for, and a web conversation opened with that cookie acts as that user.
  - done: impl-1560 · 2026-11-01T01:34:48.402Z
  - verified: rev-35 [reviewer] · run rev-35-1560-final-1 · 2026-11-01T01:53:30.596Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
- [x] C2. In users mode `cland web` mints a one-time link bound to the CLI's acting user, and redeeming it yields a cookie for that user; in single mode the link flow and cookie are unchanged.
  - done: impl-1560 · 2026-11-01T01:36:17.706Z
  - verified: rev-35 [reviewer] · run rev-35-1560-final-1 · 2026-11-01T01:53:30.596Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
- [x] C3. CLI and Neovim conversations in users mode act as the first user.
  - done: impl-1560 · 2026-11-01T01:34:48.802Z
  - verified: rev-35 [reviewer] · run rev-35-1560-final-1 · 2026-11-01T01:53:30.596Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
- [x] C4. `web.session` returns the signed-in user's name, display name and role in users mode and no user in single mode, and the web Profile shows the user's display name.
  - done: impl-1560 · 2026-11-01T01:34:48.907Z
  - verified: rev-35 [reviewer] · run rev-35-1560-final-1 · 2026-11-01T01:53:30.596Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
- [x] C5. Every audit record of a human request carries the acting user's id in users mode and none in single mode.
  - done: impl-1560 · 2026-11-01T01:34:49.010Z
  - verified: rev-35 [reviewer] · run rev-35-1560-final-1 · 2026-11-01T01:53:30.596Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
- [x] C6. A web request carrying `as` is still refused, and the user of a web conversation never comes from the frame.
  - done: impl-1560 · 2026-11-01T01:34:49.307Z
  - verified: rev-35 [reviewer] · run rev-35-1560-source-2 · 2026-11-01T01:36:31.682Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
  - verified: rev-35 [reviewer] · run rev-35-1560-final-1 · 2026-11-01T01:53:30.597Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
- [x] C7. The change touches nothing under `hub/src/adapters/`, `hub/src/spoke/` or `hub/src/hub/socket.ts`.
  - done: impl-1560 · 2026-11-01T01:34:49.411Z
  - verified: rev-35 [reviewer] · run rev-35-1560-source-2 · 2026-11-01T01:36:31.683Z · commit 2b83012f140b10a174da8560865bf975b8a188a3
  - verified: rev-35 [reviewer] · run rev-35-1560-final-1 · 2026-11-01T01:53:30.597Z · commit 2b83012f140b10a174da8560865bf975b8a188a3

## Comments

### impl-1560 · 2026-11-01T01:31:03.485Z

Contract search before changes: web_sessions readers/writers in Store, WebAuth, WebArtifacts; web edge websocket and upload conversations; Dispatcher audit and web.link control through daemon; protocol and shared/wire WebSessionResult conformance; Profile and web/test/accounts; hub web-auth/unit, auth-mode, web-artifacts/unit, web-upload, web-authority/unit tests; historical QA E-412/E-414/E-418 briefs. Plan additive optional user on web.session and userId on audit, preserving old reply shape regression. Session/socket plumbing, adapters and spoke stay untouched. Existing frame/HTTP/WebAuth and headless Profile seams cover criteria.

### impl-1560 · 2026-11-01T01:35:51.692Z

Source review requested at cd6cc5c2de207c641fb6ce9642766ebede52ac66, assigned Reviewer via role routing. Evidence A-15163 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15163-t-1560-source-and-targeted-evidence.md. Targeted local evidence only; hub verification and Coordinator full suite are still pending. Claim retained; no further dev merge after first source review unless Coordinator requests or merge reports a conflict.

### rev-35 · 2026-11-01T01:35:57.053Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1560-source-1
commit: cd6cc5c2de207c641fb6ce9642766ebede52ac66
scope: full
findings: [{"severity":"medium","text":"WEB_USAGE adds users-mode text but its independent expected WEB_USAGE block in hub/test/fixtures/cli-usage/commands.json remains unchanged. Both cli-usage-compatibility.test.ts's exhaustive export equality and cli-help.test.ts's aggregate native output equality will fail. Migrate that literal fixture block, preserve unrelated blocks/assertions, and add the missed consumer to the inventory before verification.","file":"hub/src/cli/usage/web.ts","line":2}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: medium hub/src/cli/usage/web.ts:2 changes WEB_USAGE but frozen expected commands.json WEB_USAGE remains old. Both exhaustive usage export and aggregate native help comparisons will fail; migrate literal expected block without weakening assertions and extend consumer inventory. User session/profile/audit routes otherwise match source expectations, trusted transport identity remains server-owned, C7 prohibited paths untouched. No Reviewer tests/browser execution, no runtime failure claimed for this source-detected mismatch. Fresh source review required before verify.

Criteria: C2 failed (CLI web help changed without migrating its frozen expected block, breaking existing usage/export and full-help compatibility assertions.).

### impl-1560 · 2026-11-01T01:36:10.306Z

Source review found WEB_USAGE's independent fixture missing the added users-mode line. Confirmed red cli-usage-compatibility (actual includes users-mode line; expected absent). Consumer inventory extended: hub/test/fixtures/cli-usage/commands.json, cli-usage-fixture.ts, cli-usage-compatibility.test.ts and cli-help.test.ts. Updating only that fixture literal, keeping both tests and all unrelated expected bytes unchanged. Fresh source review before verify.

### rev-35 · 2026-11-01T01:36:31.683Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1560-source-2
commit: 2b83012f140b10a174da8560865bf975b8a188a3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear. Standards: no findings. Spec: no findings. Complete delta adds only the matching literal users-mode sentence to commands.json WEB_USAGE; all unrelated frozen blocks and both compatibility/native output assertions untouched. Resolves original missed-consumer finding. Full production review A-15164 carries forward. C6 trusted transport/frame identity refusal and C7 prohibited-path exclusion established by source; C1–C5 final runtime evidence pending same-head mode-free verify, including user-bound cookie/audit/Profile cases, unchanged single-mode web-auth and both usage regressions. No Reviewer runtime/browser execution.

Criteria: C6 verified, C7 verified.

### rev-35 · 2026-11-01T01:53:30.597Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1560-final-1
commit: 2b83012f140b10a174da8560865bf975b8a188a3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear. Standards/Spec: no findings; all C1–C7 verified. Passed durable run e532777e / A-15169 matches reviewed head, runner tree 72f82cbfc91cc476d4c8ea50f0d693baafc9d103 (not cached). Checked actual pass receipts: WebAuth unit 5 including user-bound reopen and old single-mode shape; auth-mode 7 including trusted user audit/forged web as refusal; unchanged web-auth 29; CLI help 5 and usage compatibility 1; browser Accounts 7 including user displayName. Exact identities retained in final evidence artifact. T0/T1/T2/Web exit 0, reported 4549 passes, zero failure/cancelled/skipped/todo. Linux x64 droplet Node 24.21.0, Neovim 0.12.5, isolated Chrome Headless Shell 1248 / Chrome for Testing 156.0.8078.4. T3 deferred, T4 unexecuted; not an integrated full occasion. Advisory budget/lint/ratchet/Web repetition/skip checks report-only. No Reviewer runtime/browser execution. QA after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-01T03:12:04.037Z

Merged a6190e1486245d486a8b193f1678471b3d72c39e onto dev.
