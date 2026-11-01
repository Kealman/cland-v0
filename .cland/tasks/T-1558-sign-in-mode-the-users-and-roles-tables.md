---
id: T-1558
kind: task
title: Sign-in mode, the users and roles tables, the switch and the reset
state: closed
status: done
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by: []
topic: topic-1287
branch: t/T-1558-sign-in-mode-the-users-and-roles-tables
created: 2026-10-31T23:47:49.735Z
updated: 2026-11-01T01:30:00.209Z
closed: 2026-11-01T01:30:00.209Z
---

## Summary

A project gains `[auth] mode = "single" | "users"` (default `single`, written by `cland init` and added by `cland update`) and the `users` and `roles` tables in `hub.db`. `cland auth mode users` switches the project and creates the first user, an admin named from git's `user.name`, and `cland auth reset` is the only way back to single. Single mode behaves exactly as today.

Hot files: `hub/src/init/config.ts` [Host], `hub/src/init/config-set.ts` [Host], `hub/src/hub/store.ts` [Host] (or a new `hub/src/hub/users.ts` on Store's handle), `hub/src/protocol.ts` [Host], `hub/src/hub/dispatch.ts` [Host], `hub/src/hub/web-authority.ts` [Host], `hub/bin/cland.ts` [Host]; new `hub/src/cli/auth.ts`, `hub/src/cli/user.ts`, `hub/src/cli/usage/*`.

## Acceptance criteria

- [x] C1. `cland init` writes `[auth] mode = "single"`, `cland update` adds the table to an older managed config with its other values kept, and a mode other than `single` or `users` is refused at parse.
  - done: impl-1558 · 2026-10-31T23:55:53.061Z
  - verified: rev-35 [reviewer] · run rev-35-1558-source-3 · 2026-11-01T00:02:13.725Z · commit 79e17e9e7a89b88e68b3a9b01632321044ce4373
  - verified: rev-35 [reviewer] · run rev-35-1558-source-4 · 2026-11-01T00:08:18.223Z · commit f0a14b389e2211ef60156c6b128bf03341615705
  - verified: rev-35 [reviewer] · run rev-35-1558-source-5 · 2026-11-01T00:21:26.909Z · commit b5b779070eefa7aee486fe510001f2defaf54cbf
  - verified: rev-35 [reviewer] · run rev-35-1558-source-6 · 2026-11-01T00:21:52.894Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.750Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.308Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.585Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
- [x] C2. `hub.db` holds a `users` table (id, name, display name, role, state, created) and a `roles` table whose only row is `admin`.
  - done: impl-1558 · 2026-10-31T23:55:58.419Z
  - verified: rev-35 [reviewer] · run rev-35-1558-source-3 · 2026-11-01T00:02:13.725Z · commit 79e17e9e7a89b88e68b3a9b01632321044ce4373
  - verified: rev-35 [reviewer] · run rev-35-1558-source-4 · 2026-11-01T00:08:18.223Z · commit f0a14b389e2211ef60156c6b128bf03341615705
  - verified: rev-35 [reviewer] · run rev-35-1558-source-5 · 2026-11-01T00:21:26.909Z · commit b5b779070eefa7aee486fe510001f2defaf54cbf
  - verified: rev-35 [reviewer] · run rev-35-1558-source-6 · 2026-11-01T00:21:52.895Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.751Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.308Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.585Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
- [x] C3. `cland auth mode users` sets users mode and creates one admin user whose display name is git's `user.name` and whose name is its lowercase slug.
  - done: impl-1558 · 2026-10-31T23:55:59.099Z
  - verified: rev-35 [reviewer] · run rev-35-1558-source-3 · 2026-11-01T00:02:13.725Z · commit 79e17e9e7a89b88e68b3a9b01632321044ce4373
  - verified: rev-35 [reviewer] · run rev-35-1558-source-4 · 2026-11-01T00:08:18.223Z · commit f0a14b389e2211ef60156c6b128bf03341615705
  - verified: rev-35 [reviewer] · run rev-35-1558-source-5 · 2026-11-01T00:21:26.909Z · commit b5b779070eefa7aee486fe510001f2defaf54cbf
  - verified: rev-35 [reviewer] · run rev-35-1558-source-6 · 2026-11-01T00:21:52.895Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.751Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.308Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.585Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
- [x] C4. Repeating the switch, or restarting or reloading the hub in users mode, never creates a second first user.
  - done: impl-1558 · 2026-10-31T23:56:00.515Z
  - verified: rev-35 [reviewer] · run rev-35-1558-source-3 · 2026-11-01T00:02:13.725Z · commit 79e17e9e7a89b88e68b3a9b01632321044ce4373
  - verified: rev-35 [reviewer] · run rev-35-1558-source-4 · 2026-11-01T00:08:18.223Z · commit f0a14b389e2211ef60156c6b128bf03341615705
  - verified: rev-35 [reviewer] · run rev-35-1558-source-5 · 2026-11-01T00:21:26.909Z · commit b5b779070eefa7aee486fe510001f2defaf54cbf
  - verified: rev-35 [reviewer] · run rev-35-1558-source-6 · 2026-11-01T00:21:52.895Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.751Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.309Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.585Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
- [x] C5. `cland config set auth.mode` with any value is refused with a message naming `cland auth`.
  - done: impl-1558 · 2026-10-31T23:56:01.577Z
  - verified: rev-35 [reviewer] · run rev-35-1558-source-3 · 2026-11-01T00:02:13.725Z · commit 79e17e9e7a89b88e68b3a9b01632321044ce4373
  - verified: rev-35 [reviewer] · run rev-35-1558-source-4 · 2026-11-01T00:08:18.223Z · commit f0a14b389e2211ef60156c6b128bf03341615705
  - verified: rev-35 [reviewer] · run rev-35-1558-source-5 · 2026-11-01T00:21:26.909Z · commit b5b779070eefa7aee486fe510001f2defaf54cbf
  - verified: rev-35 [reviewer] · run rev-35-1558-source-6 · 2026-11-01T00:21:52.895Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.751Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.309Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.585Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
- [x] C6. `cland auth reset` returns the project to single mode, keeps the users rows for attribution, and revokes every web session; it exposes the reset step that later invite (T-1565) and pairing (T-1572) tables attach their revocation to.
  - done: impl-1558 · 2026-11-01T00:01:38.512Z
  - verified: rev-35 [reviewer] · run rev-35-1558-source-3 · 2026-11-01T00:02:13.725Z · commit 79e17e9e7a89b88e68b3a9b01632321044ce4373
  - verified: rev-35 [reviewer] · run rev-35-1558-source-4 · 2026-11-01T00:08:18.223Z · commit f0a14b389e2211ef60156c6b128bf03341615705
  - verified: rev-35 [reviewer] · run rev-35-1558-source-5 · 2026-11-01T00:21:26.909Z · commit b5b779070eefa7aee486fe510001f2defaf54cbf
  - verified: rev-35 [reviewer] · run rev-35-1558-source-6 · 2026-11-01T00:21:52.895Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.751Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.309Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.585Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
- [x] C7. `cland user list` prints each user's name, display name, role and state, and in single mode `cland user` commands are refused with a message naming `cland auth mode users`.
  - done: impl-1558 · 2026-10-31T23:56:03.667Z
  - verified: rev-35 [reviewer] · run rev-35-1558-source-3 · 2026-11-01T00:02:13.725Z · commit 79e17e9e7a89b88e68b3a9b01632321044ce4373
  - verified: rev-35 [reviewer] · run rev-35-1558-source-4 · 2026-11-01T00:08:18.223Z · commit f0a14b389e2211ef60156c6b128bf03341615705
  - verified: rev-35 [reviewer] · run rev-35-1558-source-5 · 2026-11-01T00:21:26.909Z · commit b5b779070eefa7aee486fe510001f2defaf54cbf
  - verified: rev-35 [reviewer] · run rev-35-1558-source-6 · 2026-11-01T00:21:52.895Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.751Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.309Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.585Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
- [x] C8. The new frames are CLI-only in the web authority table and absent from the gateway's, and the existing web, CLI and remote tests pass unchanged in single mode.
  - done: impl-1558 · 2026-11-01T00:37:46.485Z
  - verified: rev-35 [reviewer] · run rev-35-1558-final-1 · 2026-11-01T00:37:49.751Z · commit 85e2b271d469159c5db604fef8be917044f65d7f
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-1 · 2026-11-01T00:40:54.309Z · commit d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
  - verified: rev-36 [reviewer] · run rev-36-1558-delta-2 · 2026-11-01T01:23:15.586Z · commit 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74

## Comments

### impl-1558 · 2026-10-31T23:49:38.561Z

Contract inventory underway: additive auth.mode ProjectConfig field, auth.mode/auth.reset/user.list CLI-only frames and User rows. Search covers field/frame names and importers across hub/web/nvim, shipped skills and docs/QA, all test tiers (140 matching paths). Config consumers use defaultConfig/parseConfig; retain legacy missing-auth default single. Existing ClientFrame validators, web authority exhaustive inventory, gateway allowlist, dispatcher session CLI deny set and CLI usage/router require migration. Store web_sessions retained readers and WebAuth/edge revocation need reset integration. Full inventory will be attached as artifact with dispositions before implementation.

### impl-1558 · 2026-10-31T23:56:04.922Z

Implementation pushed at b2bed6771b97c3b636093a7980c58a28072fd742. Consumer inventory A-15101 and implementation/local evidence A-15106. C1–C7 implemented and targeted green locally; C8 additive authority inventory green, named unchanged single-mode files await queued verification after source clear. Coordinator-confirmed reset hook and live-owner startup recovery included. Source review requested next; no per-item QA because policy is after-stage.

### rev-35 · 2026-10-31T23:57:26.796Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1558-source-1
commit: c539740739d28309bffd5a911257dbbfd48bb9c3
scope: full
findings: [{"severity":"medium","text":"validateMode accepts users config with no authorized users checkpoint or first admin. Hand-edit a fresh single config to users and reload/start: user.list is empty and auth_state stays absent. Editing back to single then succeeds without cland auth reset. Reject unauthorized entry (with CLI guidance) or route it through the complete authorized switch; cover startup and reload.","file":"hub/src/hub/users.ts","line":49},{"severity":"medium","text":"revokeAll enumerates auth.sessions(), which prunes expired durable rows before returning. A live socket or in-flight upload belonging to an expired/pruned session is therefore omitted and can outlive reset's successful reply. Drain the actual socket/upload owners independently of the active-session listing, with an expired-session regression.","file":"hub/src/hub/web-edge.ts","line":307},{"severity":"medium","text":"revokeAll clears links once and snapshots sessions, then yields while draining; link() and redemption remain admitted. A concurrent web.link/redeem during a held upload drain creates a new link/session outside the snapshot which survives the mode transition. Fence admission until transition publication and test the held-drain interleaving.","file":"hub/src/hub/web-edge.ts","line":306}]
finding_counts: {"high":0,"medium":3,"low":0}

Source review not clear: three medium findings, no high/low findings. hub/src/hub/users.ts:49 permits hand-edited users entry without a first user/checkpoint and later return to single without reset. hub/src/hub/web-edge.ts:307 skips expired/pruned-session native owners. hub/src/hub/web-edge.ts:306 leaves link/session admission open during reset's asynchronous drain. See detailed finding records and review artifact. C8 preservation receipts remain pending. No Reviewer runtime/browser execution; no full verification at this head is clear.

Criteria: C6 failed (Unauthorized users-mode entry bypasses the reset fence; reset misses expired-session native owners and admits new links/sessions during drainage.).

### rev-35 · 2026-11-01T00:00:27.069Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1558-source-2
commit: 12ed6d305ba2c5f5834ffbc89fb0edf018b6934d
scope: full
findings: [{"severity":"medium","text":"The outer finally unconditionally releases the transition fence when changeAuth's reload fails after durable mode/config publication. For example, an invalid roles.toml or pending restart-only config change makes #reload throw after setMode/reset and publishMode have run; the loaded mode remains old but mint/redemption/cookie admission reopen. Retain a fail-closed fence or roll back/reconcile all transition state until loaded mode is positively published, and cover injected reload failure/recovery for both directions.","file":"hub/src/hub/daemon.ts","line":389}]
finding_counts: {"high":0,"medium":1,"low":0}

Original three source findings resolved on normal paths, with appropriate held-native-owner regressions. One medium remains in the new outer fence lifecycle: hub/src/hub/daemon.ts:389 unconditionally releases it on failed loaded-mode publication after changing durable/config mode. Example: invalid roles.toml or pending restart-only settings. Reconcile/rollback or keep admission fenced through recovery; add reload-failure coverage. C8 runtime preservation pending. No Reviewer runtime/browser execution.

Criteria: C6 failed (Reload failure after durable transition releases admission fence while the serving mode remains old; transition needs fail-closed settlement and recovery.).

### rev-35 · 2026-11-01T00:02:13.725Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1558-source-3
commit: 79e17e9e7a89b88e68b3a9b01632321044ce4373
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear. Standards: no findings. Spec: no findings. All prior medium findings resolved. The daemon now retains the admission fence on failed saved transitions and releases it only on successful configuration apply; both transition directions have failure/recovery regressions. Earlier unauthorized users-entry and active/expired native-owner drainage fixes remain intact. C1–C7 source verified. C8 authority portion is source-established, but its unchanged single-mode web/CLI/remote runtime preservation remains unverified until same-head cland verify evidence (web-auth.test.ts, config-set.test.ts, remote-cli.test.ts). No Reviewer runtime/browser execution and no final suite pass claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-35 · 2026-11-01T00:07:05.062Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1558-evidence-1
commit: 79e17e9e7a89b88e68b3a9b01632321044ce4373
scope: evidence
findings: [{"severity":"medium","text":"Same-head verification fails the frozen usage deepEqual: new AUTH_USAGE and USER_USAGE exports are absent from the pre-refactor export fixture. Migrate this consumer while retaining the frozen bytes assertion for every existing export; then obtain fresh source review and a new verification receipt.","file":"hub/test/cli-usage-compatibility.test.ts","line":9}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence verdict not clear. Actual output: '✖ all command usage exports retain their pre-refactor bytes'; deepStrictEqual diff adds AUTH_USAGE and USER_USAGE. This is an unmigrated exhaustive export consumer (hub/test/cli-usage-compatibility.test.ts:9). Receipt A-15113 run e6c8c0e4-e62c-4c6c-ad1c-6dd6132d7cfa matches reviewed head 79e17e9e7 and tree dc26917e75526ca545f4fc7bf58c97249338ddf7. T0 exit 0 (host gate); T1 exit 1 on Linux x64 6.8.0-142-generic droplet Node 24.21.0. T2 and Web unexecuted, browser binary/version null; T3 deferred to periodic/integrated occasions, T4 unexecuted. Duration/test-lint notices are report-only, not this failure. No Reviewer runtime execution. C8 fails pending consumer fix, fresh source review and same-head successful verification.

Criteria: C8 failed (Same-head verify e6c8c0e4 failed CLI usage compatibility in T1; T2/Web preservation phases did not execute.).

### impl-1558 · 2026-11-01T00:07:59.957Z

Run e6c8c0e4 (A-15113) completed T0 green and T1 red on cli-usage-compatibility.test.ts::all command usage exports retain their pre-refactor bytes; T2/Web unexecuted. Failure is item-owned, confirmed by Coordinator 488df626. f0a14b389 adds only the new independent snapshot blocks/export mappings, retaining all old values and the unchanged compatibility assertion. Removes tracker ID from public auth help per corrected decision. Local compatibility test reproduced red then green; refreshed typecheck/lint underway. Revised consumer inventory A-15114 explicitly includes the exhaustive usage consumer and its two fixture maps. Fresh source review requested before re-verification.

### rev-35 · 2026-11-01T00:08:18.223Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1558-source-4
commit: f0a14b389e2211ef60156c6b128bf03341615705
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear. Standards: no findings. Spec: no findings. Failed usage consumer fixed additively through independent AUTH_USAGE/USER_USAGE fixture blocks and export mappings, preserving every existing block/mapping and the compatibility assertion. Public tracker/staging help removed. Production auth logic unchanged from source-clear A-15112. C1–C7 source verified at this head; C8 and final pass await new same-head verification with unchanged web-auth/config-set/remote-cli receipts. Previous-head e6c8c0e4 remains failed, T2/Web unexecuted. No Reviewer runtime/browser execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-35 · 2026-11-01T00:20:00.496Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1558-evidence-2
commit: f0a14b389e2211ef60156c6b128bf03341615705
scope: evidence
findings: [{"severity":"medium","text":"Same-head T2 run fails full CLI help byte comparison because fixtures/cli-usage/help.txt omits the newly prepended AUTH_USAGE/USER_USAGE placeholders. Migrate that aggregate template retaining every old marker/order and the complete native child-output assertion.","file":"hub/test/cli-help.test.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Actual output: 'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal', with added auth mode users/auth reset/user list help bytes. The remaining unmigrated consumer is fixtures/cli-usage/help.txt, expanded by cli-help.test.ts:30. Durable failed run b0fcad09-c5ea-4605-aa2d-d4996d15b4fc / A-15125 matches f0a14b389e2211ef60156c6b128bf03341615705, tree 00ccc8a4c171bf4b11dd11ade71cbd5bf329b8ab (not cached). T0/T1 exit 0; T2 exit 1; Web unexecuted, browser binary/version null. Linux x64 6.8.0-142-generic droplet, Node 24.21.0, Neovim 0.12.5. T3 deferred to periodic/integrated occasions; T4 unexecuted. Duration/test-lint findings report-only. No Reviewer runtime execution. C8 failed; template fix needs fresh source review before another verify.

Criteria: C8 failed (Verify b0fcad09 failed the unchanged T2 cli-help full-output comparison; aggregate help template missing new usage blocks. Web unexecuted.).

### impl-1558 · 2026-11-01T00:21:13.568Z

b5b779070 source review requested. A-15126 supersedes the prior consumer inventory: includes frozenUsage export consumer, aggregate cli-help.test.ts + help.txt template, and T3 cli-imports.test.ts pure-module count. Aggregate CLI test unchanged, 5/5 local; T3 import guard count 36→37 with non-help budgets unchanged, 3/3 local (actual no-hub native CLI). Typecheck green, lint final exit pending; report-only findings unchanged. b0fcad09/A-15125: T0/T1 green, T2 red only on missing auth/user aggregate markers, Web unexecuted. No overall pass claimed.

### rev-35 · 2026-11-01T00:21:26.909Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1558-source-5
commit: b5b779070eefa7aee486fe510001f2defaf54cbf
scope: full
findings: [{"severity":"low","text":"The paragraph now names 37 pure help modules but retains the old 'current total observed counts' 39/51/56 from the 36-module closure. Refresh from the new cli-imports diagnostics or label these counts historical; don't present prior measurements as current.","file":"hub/README.md","line":2375}]
finding_counts: {"high":0,"medium":0,"low":1}

Source review clear, with one low finding: hub/README.md:2375 retains prior current observed total module counts beside the updated help-module count; refresh from diagnostics or label historical. Spec: no findings. The aggregate help template migration preserves every old marker/order and full native child assertion. Changed T3 cli-imports keeps implementation budgets, SQLite/closure and failure assertions, adds auth/user coverage and updates pure-help count only. Production auth logic unchanged. C1–C7 source verified; C8/final evidence await same-head mode-free verify including changed T3 cli-imports plus named unchanged preservation cases. Prior run remains failed; no Reviewer tests/browser execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-35 · 2026-11-01T00:21:52.895Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1558-source-6
commit: 85e2b271d469159c5db604fef8be917044f65d7f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear. Standards: no findings. Spec: no findings. Complete intervening diff is one README sentence correcting total module counts to 40/52/57 and naming reported macOS Node 24 real-CLI fixture provenance. Resolves source-5 low. Carry full source review A-15127; no code/test changes. C1–C7 source verified. C8 and final evidence await same-head mode-free verify including changed T3 cli-imports and unchanged web-auth/config-set/remote-cli cases. No Reviewer runtime/browser execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-35 · 2026-11-01T00:37:49.751Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1558-final-1
commit: 85e2b271d469159c5db604fef8be917044f65d7f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear. Standards: no findings. Spec: no findings. Durable passed run aaa15399 / A-15135 matches source head and tree 1f8845d3e6fbf4ef909255aabdc6b0220db9b58a (not cached). Checked actual pass records: init-config 17, users 4, auth-mode 6, cli-usage-compatibility 1, cli-help 5, changed T3 cli-imports 3; unchanged web-auth 29, config-set 20, remote-cli 23. Exact identities/outcomes retained in final evidence artifact. All C1–C8 verified. T0/T1/T2/changed T3/Web exit 0, reported 4535 passing runtime tests, zero fail/cancelled/skipped/todo. Linux x64 6.8.0-142-generic droplet, Node 24.21.0, Neovim 0.12.5, isolated chromium_headless_shell-1248 Chrome for Testing 156.0.8078.4. Changed T3 ran once without repetitions; remaining T3 deferred to periodic/integrated occasions, T4 unexecuted. Duration/test-lint/ratchet/Web repetition and skip-reason advisories report-only. No Reviewer runtime/browser execution. QA after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### impl-1558 · 2026-11-01T00:40:24.309Z

Coordinator authorized dev merge under rule11 (d48d7aa4). Merged head d47c7bdbb, dev second parent d29dbd0b; all Host/WebAuthn/sign-in documentation sections retained verbatim. Merged-head typecheck and lint passed; resolution text/API search matched five tests + frozen fixture, all five tests and three fixture consumers passed sequentially (49 cases), no nvim matches. Full receipts A-15139. Delta review requested. No new Implementer suite submitted; Coordinator will run verify all after ready because storage/authority needs full pre-merge coverage. Claim retained.

### rev-36 · 2026-11-01T00:40:54.309Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1558-delta-1
commit: d47c7bdbb6524a5bca0b26bf8e1b3b22616cc610
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta review clear; standards/spec no findings. Read Coordinator decision d48d7aa4 authorizing dev merge and docs checks. Combined conflict diff preserves six independent Host/WebAuthn/sign-in sections; T-1558 production/config/authority/CLI and auth tests unchanged from prior final-clear 85e2b271. Independent merged-head search matches five tests plus frozen CLI fixture, no Neovim hits. A-15139 records all five tests plus three fixture consumers passing (49 named cases), typecheck/lint exit 0, zero lint refusals/122 advisory findings; local Darwin arm64 Node 24, no browser. C1–C8 carried forward under prior clear and authorized delta checks. No full merged-head suite claimed: parent aaa15399/A-15135 is prior-head Linux task-selected evidence. Coordinator's explicitly required full pre-merge verify remains pending and must precede landing. Reviewer ran no tests/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### rev-36 · 2026-11-01T01:23:15.586Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1558-delta-2
commit: 5ff45f7528b46ddfa68d7cc7ba9f941db3e4cc74
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Second delta review clear; standards/spec no findings. README resolution moves unchanged users prose into existing Browser sign-in section and preserves incoming Host prose; T-1558 implementation/auth tests unchanged. Independently confirmed search matches and A-15155's 54 named passing cases across ten files, typecheck/lint exit 0, zero refusals/122 advisory findings, local macOS Node 24, no browser. Read Coordinator decision d0432015 explicitly authorizing re-merge and carry-forward of pre-merge 720ca7b0/A-15154 code evidence. Independently checked parent run: uncached Linux x64 droplet Node v24.21.0, T0–T3/Web green, 6181 pass/8 explicitly reasoned skips, T4 unexecuted; Chrome Headless Shell 156.0.8078.4. No full suite at new head is claimed. C1–C8 carried forward under that decision plus prior clear reviews and new targeted checks. Reviewer ran no tests/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-11-01T01:30:00.209Z

Merged 487bf3371cb925af36c74243e9868985402ff544 onto dev.
