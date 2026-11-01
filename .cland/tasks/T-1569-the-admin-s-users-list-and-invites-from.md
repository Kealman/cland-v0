---
id: T-1569
kind: task
title: The admin's users list and invites from the web
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
  - T-1565
topic: topic-1312
branch: t/T-1569-the-admin-s-users-list-and-invites-from
created: 2026-10-31T23:47:52.767Z
updated: 2026-11-01T23:41:44.989Z
---

## Summary

In users mode the web's accounts area lists the users (name, display name, role, state) with a count. An admin creates a user there and gets the one-time invite link to copy. Single mode shows no users list.

Hot files: `hub/src/hub/web-authority.ts` [Host] (`user.add`, `user.list` open on the web in users mode), new `web/src/accounts/Users.tsx` and `Users.module.css`, `web/src/accounts/AccountsArea.tsx`.

## Acceptance criteria

- [x] C1. In users mode the accounts area lists every user with name, display name, role and state, and its fold shows the count.
  - done: impl-1569 · 2026-11-01T22:35:12.539Z
  - verified: rev-36 [reviewer] · run rev-36-1569-final-1 · 2026-11-01T23:12:07.266Z · commit 30dd332157ad3ce271cf4e14bd4c6995ef15f6ff
- [x] C2. Creating a user from the web adds an invited admin row and shows its invite link once, with the same name rules and refusals as the CLI.
  - done: impl-1569 · 2026-11-01T22:54:18.562Z
  - verified: rev-36 [reviewer] · run rev-36-1569-final-1 · 2026-11-01T23:12:07.266Z · commit 30dd332157ad3ce271cf4e14bd4c6995ef15f6ff
- [x] C3. In single mode the users list is absent and `user.add` and `user.list` from the web are refused with a message naming users mode.
  - done: impl-1569 · 2026-11-01T22:54:18.692Z
  - verified: rev-36 [reviewer] · run rev-36-1569-final-1 · 2026-11-01T23:12:07.266Z · commit 30dd332157ad3ce271cf4e14bd4c6995ef15f6ff
- [x] C4. The view passes the web typecheck's colour and contrast checks and adds no key listener outside `keymap.ts`.
  - done: impl-1569 · 2026-11-01T22:35:13.986Z
  - verified: rev-36 [reviewer] · run rev-36-1569-final-1 · 2026-11-01T23:12:07.266Z · commit 30dd332157ad3ce271cf4e14bd4c6995ef15f6ff

## Comments

### impl-1569 · 2026-11-01T22:31:05.492Z

Consumer inventory before admission change: WEB_AUTHORITY and dispatch handlers; daemon userAdd/userList and Users parser; CLI auth.ts/usage and wire/protocol request validators; hub tests web-authority{,-unit}, user-invites, users, invites, auth-mode; web Accounts/Profile and accounts tests; docs/agents/auth.md, hub/README Browser sign-in, implement skill, spec v0.4, QA E-1536 stage-1. No reply shape changes; CLI, persisted readers and prior-wire clients retain existing shapes. user.invite/auth.mode/auth.reset stay local-only. New browser consumers use existing web.session optional user (absent on older hubs/single mode). Full field/frame search covered hub/web/shared/qa/docs/.agents including tier T3/T4 consumers.

### rev-35 · 2026-11-01T22:37:31.084Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1569-source-1
commit: 17b1f6a8511c6541d8ab129fe3aca1180f845b37
scope: full
findings: [{"severity":"medium","text":"A profile without admin/user returns without resetting enabled/rows/invite. An existing admin tab reconnecting after reset and single-mode sign-in in another cookie-sharing tab retains the Users fold and old invite, violating single-mode absence.","file":"web/src/accounts/Users.tsx","line":22},{"severity":"low","text":"Missing navigator.clipboard throws synchronously before .catch, so manual-copy fallback is not reached; guard unavailable API and retain selectable link.","file":"web/src/accounts/Users.tsx","line":53},{"severity":"low","text":"Old prose still says all five auth/user handlers share the local-human guard, contradicting the newly admitted web-admin add/list path; replace the superseded description per rule16.","file":"hub/README.md","line":467}]
finding_counts: {"high":0,"medium":1,"low":2}

Medium — Users.tsx:22: mounted admin view retains enabled/rows/invite on reconnect to single-mode profile without user.
Low — Users.tsx:53: absent clipboard API throws before promised fallback.
Low — hub/README.md:467: superseded all-five-local-guard description remains.
C3 failed; shared role/handler admission, agent-session refusal, daemon rules/fences, transient URL storage, token CSS and absence of key listeners otherwise inspected. Existing fresh-page tests miss mounted-profile transition and unavailable clipboard. A-15445: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15445-t-1569-full-source-review-at-17b1f6a8.md. A-15443 is reported local targeted evidence; no post-source suite. Reviewer ran no tests/browser. Fix and request fresh source review before verification.

Criteria: C3 failed (Mounted Users view keeps enabled state, prior rows and invite when reconnect profile omits user in single mode.).

### rev-36 · 2026-11-01T22:42:20.723Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1569-source-1
commit: 5a49bca425cc9fd78e86fdceb139c6a0c48d7c54
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear; Standards/Spec no findings. All A-15445 findings resolved: ownership-bound management form unmounts on disconnect/profile loss, old async profile/list continuations invalidated; missing/rejected clipboard retains selectable URL; superseded README local-only prose replaced. New original-tab reconnect regression arms observer before reset, correlates exact single-mode web.session result, retains same-document and absent-fold/invite assertions. Initial shared-role/handler admission, naming/fence reuse, transient URL, count and tokenCSS/no-key-listener source inspected. A-15451 reports local macOSarm64 Node24.21.0 Accounts9/build/typecheck/lint0,isolatedHeadlessShell156/rev1248; earlier authority/invite evidence remains prior-head. C1–C4 await exact-head post-source mode-free run/named final evidence. No Reviewer tests/browser/edits; QA after-stage separate.

### impl-1569 · 2026-11-01T22:53:35.251Z

Verification 70da04c6 at 5a49bca4 failed T1: invites.test.ts:55 and users.test.ts:56 both actual 'boolean', expected 'string' on WEB_AUTHORITY user.add/list. These consumers were inventoried but their assertions were not migrated; correcting them to allow browser policy entries while retaining local-only auth/invite-renewal, gateway absence and request validation. This is an item-owned migration omission, not a shared-defect candidate. Run A-15465 is partial Linux droplet evidence: T0 exit0/T1 exit1, later phases unexecuted; lifetime197s/cost$0.0137. Focused invites reproduction fails identically. Fresh source review required after test migration before another verification.

### rev-36 · 2026-11-01T22:53:42.077Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1569-evidence-1
commit: 5a49bca425cc9fd78e86fdceb139c6a0c48d7c54
scope: evidence
findings: [{"severity":"medium","text":"Unmigrated WEB_AUTHORITY consumer still requires user.add to be a local-only string; current policy is boolean true for web-admin admission. Same-head T1 fails with actual boolean/expected string. Separate add from local-only invite assertions, retaining gateway and parser controls.","file":"hub/test/invites.test.ts","line":55},{"severity":"medium","text":"Unmigrated WEB_AUTHORITY consumer still requires user.list to be a local-only string, contradicting new web-admin admission. Same-head T1 fails actual boolean/expected string. Retain mode/reset local-only and gateway absence while asserting the intended list policy.","file":"hub/test/users.test.ts","line":56}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear. A-15465/70da04c6 exit1; both failures quote actual 'boolean', expected 'string': invites.test.ts:55 for user.add; users.test.ts:56 for user.list. These existing policy consumers were listed but not migrated for intentional web-admin admission. Preserve mode/reset/invite-local, gateway exclusion and parser controls while separating new add/list expectations; repeat rule20 consumer scan. T0 exit0,T1 exit1(1308/1306/2); T2/Web not run,other tiers unexecuted. Linuxx64 dropletNode24.21.0/Neovim0.12.5,no browser observed; budgets report-only. Fresh source review before another verify. No Reviewer execution/edits.

Criteria: C2 failed (Same-head verification fails invites.test.ts:55 because the changed user.add policy consumer still expects local-only string authority.), C3 failed (Same-head verification fails users.test.ts:56 because the changed user.list policy consumer still expects local-only string authority.).

### rev-36 · 2026-11-01T22:54:52.091Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1569-source-2
commit: d6724250055eaece6c0fedcd0a255e111a6beba3
scope: full
findings: [{"severity":"low","text":"The guide still says the web/gateway inventories retain CLI-only authority for the new frames, but user.list now admits web admins. Update it to distinguish web user.list from local-only auth.mode/auth.reset while retaining gateway exclusion (rule16).","file":"docs/agents/tests/hub-test-users.test.ts.md","line":7}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear; no high/medium findings. Both A-15466 policy consumer omissions fixed with explicit true add/list assertions and preserved mode/reset/invite-local,gateway exclusion and parser controls. Entire change is2testfiles; productionA-15454 unchanged. Repeated WEB_AUTHORITY scan confirms remaining enumerators/completeness checks unaffected. Standards low: users per-test guide:7 still claims CLI-only authority for all new frames; distinguish web user.list from local-only auth.mode/reset. Spec no findings. A-15467 local macOSarm64 Node24.21.0 invites4/users4 summary evidence,not post-source suite; A-15465 stays failedpartial. C1–C4 await exact-head verify/final review; any docs fix needs fresh source head. No Reviewer execution/edits.

### rev-36 · 2026-11-01T22:55:22.514Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1569-source-3
commit: 30dd332157ad3ce271cf4e14bd4c6995ef15f6ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source refresh clear; Standards/Spec no findings. Sole change from source-clear d6724250 is users per-test guide correction: web user.list vs local-only auth.mode/reset, all gateway exclusion and runtime mode checks. Sole A-15468 low resolved. Runtime/tests unchanged; prior source review carries. C1–C4 await same-head post-source mode-free verification/final evidence; A-15465 remains failed. No Reviewer execution/edits; after-stage QA separate.

### rev-36 · 2026-11-01T23:12:07.266Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1569-final-1
commit: 30dd332157ad3ce271cf4e14bd4c6995ef15f6ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec no findings. Current sourceA-15469 unchanged. A-15482/28c4d79f exact-head exit0,4608pass,zero fail/cancel/skip/todo; named Accounts9 include facts/invitedadmin/transientinvite and same-mounted users→single reconnect. Authority46/unit6,invites4/users4/user-invites5 all namedpass including single/users admin admission and unchanged session-shell refusal. Current token-only/23contrast checks pass; no source key/colour additions. Uncached Linuxx64 dropletNode24.21.0/Neovim0.12.5,isolatedHeadlessShell1248/ChromeTesting156.0.8078.4; T0,T1,fallbackallT2,Web completed;T3batch/T4unexecuted. Advisory budgets/lint/skipcheck report-only. EarlierA-15465 stays failedpartial. C1–C4 verified;premergebatch/after-stageQA separate. No Reviewer tests/browser/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
