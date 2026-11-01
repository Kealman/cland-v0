---
id: T-1565
kind: task
title: "Invites: `cland user add` and the one-time invite link"
state: closed
status: done
size: S
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1558
topic: topic-1310
branch: t/T-1565-invites-cland-user-add-and-the-one-time
created: 2026-10-31T23:47:51.739Z
updated: 2026-11-01T22:29:48.401Z
closed: 2026-11-01T22:29:48.401Z
---

## Summary

`cland user add <name> [--display <name>]` creates an admin user in state `invited` and prints a one-time invite link valid for 24 hours. `cland user invite <name>` mints a fresh link for an existing user (assumed, A16), and the switch to users mode prints one for the first user. Invites are stored as digests only, and a used or expired invite is refused when it is checked.

Hot files: new `hub/src/hub/invites.ts` (or within `users.ts`), `hub/src/hub/dispatch.ts` [Host], `hub/src/protocol.ts` [Host], `hub/src/hub/web-authority.ts` [Host], `hub/src/cli/user.ts`.

## Acceptance criteria

- [x] C1. `cland user add <name>` creates a user with role `admin` and state `invited` and prints an invite URL on the web edge's address.
  - done: impl-1565 · 2026-11-01T20:09:03.490Z
  - verified: rev-35 [reviewer] · run rev-35-1565-final-1 · 2026-11-01T20:29:39.177Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-merged-final-1 · 2026-11-01T21:37:56.059Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
- [x] C2. Names are lowercase slugs, unique, and never `human`, `hub`, `all`, a role name or a current session name, and each refusal names the rule.
  - done: impl-1565 · 2026-11-01T20:01:01.876Z
  - verified: rev-35 [reviewer] · run rev-35-1565-source-2 · 2026-11-01T20:10:28.480Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-final-1 · 2026-11-01T20:29:39.177Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-delta-source-1 · 2026-11-01T21:18:48.549Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
  - verified: rev-35 [reviewer] · run rev-35-1565-merged-final-1 · 2026-11-01T21:37:56.059Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
- [x] C3. The invite token is stored only as a SHA-256 digest with its expiry, and appears in no log line, frame other than the minting result, or journal record.
  - done: impl-1565 · 2026-11-01T20:01:03.994Z
  - verified: rev-35 [reviewer] · run rev-35-1565-source-2 · 2026-11-01T20:10:28.480Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-final-1 · 2026-11-01T20:29:39.177Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-delta-source-1 · 2026-11-01T21:18:48.550Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
  - verified: rev-35 [reviewer] · run rev-35-1565-merged-final-1 · 2026-11-01T21:37:56.059Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
- [x] C4. The invite check accepts an invite once within 24 hours (by the hub clock), and refuses a used, an expired or an unknown token with distinct reasons.
  - done: impl-1565 · 2026-11-01T20:01:06.101Z
  - verified: rev-35 [reviewer] · run rev-35-1565-final-1 · 2026-11-01T20:29:39.177Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-merged-final-1 · 2026-11-01T21:37:56.059Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
- [x] C5. `cland user invite <name>` replaces any open invite of that user, and the switch to users mode prints the first user's invite.
  - done: impl-1565 · 2026-11-01T20:09:03.627Z
  - verified: rev-35 [reviewer] · run rev-35-1565-final-1 · 2026-11-01T20:29:39.177Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-merged-final-1 · 2026-11-01T21:37:56.059Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
- [x] C6. `cland auth reset` revokes every open invite through T-1558's reset step, proven by a test that resets with an open invite and then refuses its token.
  - done: impl-1565 · 2026-11-01T20:01:09.029Z
  - verified: rev-35 [reviewer] · run rev-35-1565-final-1 · 2026-11-01T20:29:39.177Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-merged-final-1 · 2026-11-01T21:37:56.059Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
- [x] C7. `auth.mode`, `auth.reset` and `user.list` refuse a session caller in their handlers, as `user.add` and `user.invite` do, with the same human-only refusal; a test per frame proves a session's call is refused and the human's succeeds.
  - done: impl-1565 · 2026-11-01T20:09:04.179Z
  - verified: rev-35 [reviewer] · run rev-35-1565-final-1 · 2026-11-01T20:29:39.177Z · commit 410c9beac27d877e12b85549d024121d4e2c939c
  - verified: rev-35 [reviewer] · run rev-35-1565-merged-final-1 · 2026-11-01T21:37:56.059Z · commit 3c5d156155280efa78c1fdcfc0108b1de0d26c8e

## Comments

### impl-1565 · 2026-11-01T19:54:57.454Z

Contract consumer inventory before implementation: Users firstAdmin/reset callers (daemon, users/auth-mode tests); auth.mode result CLI auth.ts and auth-mode tests, stage-1 QA brief (existing user result retained, invite URL additive/optional on older hubs); user.list consumers web accounts test and QA brief unchanged. New user.add/user.invite frames require protocol validator, session-CLI classification, web explicit CLI-only authority and gateway exclusion; audit summarizer must omit tokens/results. Searched field/frame/function names across hub/src, hub/test (all tiers), web/test, nvim/test, qa and .agents. New invite check is a Store API for the subsequent sign-in item, not a token-bearing client frame. Approved seams: existing public Users Store T1 and disposable projectHub/CLI T2 from T-1558.

### impl-1565 · 2026-11-01T19:58:04.237Z

Consumer migration addendum: shared/wire/index.ts WorkbenchRequest migrated alongside hub protocol (wire-conformance caught the missing mirrored members). Existing user.list clients and stage-1 QA brief remain unaffected; the historical stage-1 brief describes its pinned pre-invite head and is retained. CLI has optional auth.mode URL handling and a previous-wire-shape regression without URL. New invite frames stay explicitly CLI-only on web and absent from gateway authority until the later web integration item.

### rev-35 · 2026-11-01T20:05:36.592Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1565-source-1
commit: 2a94a99a168327e9be319d926aae60f90d8144ab
scope: full
findings: [{"severity":"high","text":"user.add/user.invite are session-CLI exemptions without a permission tool or handler caller guard; an authenticated agent shell can create admins or replace invites and receive tokens despite local-human-only docs.","file":"hub/src/hub/dispatch.ts","line":194},{"severity":"medium","text":"invite minting bypasses the active sign-in transition fence; external add/invite can mutate records and return URLs during held reset or failed transition/reload recovery.","file":"hub/src/hub/web-edge.ts","line":178},{"severity":"low","text":"auth mode users help promises an invite without naming the available-web-edge condition implemented in daemon.ts.","file":"hub/src/cli/usage/auth.ts","line":2}]
finding_counts: {"high":1,"medium":1,"low":1}

High — hub/src/hub/dispatch.ts:194: session-CLI exemptions admit new admin/invite mutations without caller authority checks.
Medium — hub/src/hub/web-edge.ts:178: direct invite minting bypasses the held/failed auth-transition fence before mutation.
Low — hub/src/cli/usage/auth.ts:2: help omits the web-edge availability condition for printing an invite.
Full source evidence and requested regression boundaries: A-15385, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15385-t-1565-full-source-review-at-2a94a99a.md. C1/C5 failed; other runtime criteria left unverified. Reviewer ran no tests or browser. Fixes require fresh source review before queued verification.

Criteria: C1 failed (user.add admits session-shell callers and bypasses the documented human-only mutation boundary.), C5 failed (user.invite admits session callers and can replace open invites while sign-in transition admission is fenced.).

### impl-1565 · 2026-11-01T20:08:22.268Z

Source-review fix adds Coordinator-approved C7: a shared local-human guard runs in all five handlers (auth.mode/reset, user.list/add/invite) after admitted session identity validation. SESSION_CLI_FRAMES retains routing to those own guards; no role grant is added. Consumers of the refusal contract searched: CLI auth.ts, auth docs, auth-mode/user-invites/cli-session-credential/web-auth/web-authority tests, role/permission inventories and stage-1 pinned QA brief; current docs updated, session refusal newly tested for each frame, human success preserved. WebAuth.assertAdmission now owns transition rejection for link and invite entry; WebEdge checks before user creation and mode switch mints its first invite after successful reload. Held/failed transition tests assert unchanged durable users/invites.

### rev-35 · 2026-11-01T20:10:28.480Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1565-source-2
commit: 410c9beac27d877e12b85549d024121d4e2c939c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source review: no findings. A-15385's handler authority, transition-fence and help findings are fixed; Coordinator-approved C7 uses the same guard across all five handlers. External invite admission occurs before durable mutation; mode-switch first invite follows successful reload. Reviewed changed test bodies, bounded held-reset cleanup, contract consumers and matching docs/help/skill changes. Source verifies C2 naming and C3 digest/output boundary. C1/C4/C5/C6/C7 await exact-head post-source queued verification and named runtime outcomes. A-15387: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15387-t-1565-refreshed-source-clear-at-410c9bea.md. Reviewer ran no tests or browsers; local targeted results in A-15386 are not a final suite receipt.

Criteria: C2 verified, C3 verified.

### rev-35 · 2026-11-01T20:29:39.177Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1565-final-1
commit: 410c9beac27d877e12b85549d024121d4e2c939c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings. Same source-reviewed head confirmed by branch tip, hub verify receipt and A-15394 provenance. Run69b2e299-67b8-4800-9276-aad58dbfa6cf exit0, 4592 passes, zero fail/cancel/skip/todo; T0/T1/all fallback T2/Web completed. T3 deferred to merge batch; T4 unexecuted. Direct inspection finds named ordinary pass records for invites4, user-invites5, unchanged auth-mode7/users4/web-auth29/web-authority45 plus frozen/native help controls. C1/C4/C5/C6/C7 now established by reviewed assertions and exact-head outcomes: mint/admin/URL, once/expiry/refusal classes, replacement/first invite, reset revocation, five human-only paths, held/failed transition fencing. C2/C3 source and runtime evidence confirmed; all criteria verified. Droplet Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, isolated Headless Shell1248 / Chrome for Testing156.0.8078.4, cached null; advisories report-only. Detailed identities, line receipts and runner tree in A-15395: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15395-t-1565-final-evidence-review-at-410c9bea.md. Reviewer ran no tests/browser. After-stage QA and merge-batch evidence separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-35 · 2026-11-01T21:18:48.550Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1565-delta-source-1
commit: 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear, no findings. Reviewed composed dispatcher/table runtime changes from T-1570 plus retained invite paths and README/skill composition; five local-human guards, admission fence and CLI-only invite rows survive. C2/C3 source reverified. Coordinator50462025 permits waiver only for documentation-only changes; relative to final-reviewed410c9bea this merge includes runtime authority changes and changed tests, so waiver is inapplicable. Run fresh queued mode-free verify at3c5d1561; C1/C4/C5/C6/C7 remain unverified at this head. Prior A-15394/69b2e299 is parent evidence, not a merged-head pass/cache hit; A-15414 reports102 targeted macOS Node24.21.0 passes/typecheck only. A-15415 records comparison, composition and evidence limits: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15415-t-1565-merge-delta-source-review-at-3c5d1561.md. Reviewer ran no tests/browser; after-stage QA and merge-batch coverage separate.

Criteria: C2 verified, C3 verified.

### rev-35 · 2026-11-01T21:37:56.059Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1565-merged-final-1
commit: 3c5d156155280efa78c1fdcfc0108b1de0d26c8e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final evidence clear, no findings. Exact delta-reviewed3c5d1561 confirmed by branch tip/hub run/provenance. Run7c764124/A-15420 exit0,4593 passes,zero fail/cancel/skip/todo; T0/T1/all fallback T2/Web complete; T3 deferred,T4 unexecuted. Direct named timing pass facts: invites4,user-invites5,composed auth-mode7/web-authority-unit6,users4/web-auth29/legacy authority45,frozen usage1/native help5. Current-role and forged-write assertions pass alongside five human-only paths, held/failed fences, old-wire mint and reset/digest/expiry assertions. All C1–C7 now verified at merged head; no waiver or parent-run reuse as exact-head evidence. Droplet Linux x64 6.8.0-142-generic Node24.21.0 Neovim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4,cached null; advisories report-only. A-15421 records exact case lines and runner tree: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15421-t-1565-merged-head-final-evidence-at-3c5d1561.md. Reviewer executed no tests/browser; after-stage QA and merge batch separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-01T22:29:48.401Z

Merged 9de0552f8e6b886bc6dedb2e55b02d33808fce0e onto dev.
