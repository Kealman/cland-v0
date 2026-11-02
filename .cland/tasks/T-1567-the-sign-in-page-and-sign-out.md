---
id: T-1567
kind: task
title: The sign-in page and sign-out
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1566
topic: topic-1337
branch: t/T-1567-the-sign-in-page-and-sign-out
created: 2026-10-31T23:47:52.250Z
updated: 2026-11-02T14:00:36.569Z
closed: 2026-11-02T14:00:36.569Z
---

## Summary

In users mode a browser without a valid cookie gets the sign-in page instead of the disconnected strip, and signs in with name and password. Signing out from Profile revokes that browser's session and closes its sockets. Single mode keeps today's page and link flow.

Hot files: `hub/src/hub/web-signin.ts`, `hub/src/hub/web-edge.ts` [E-1538], `web/src/SignIn.tsx`, `web/src/accounts/Profile.tsx`, `web/src/connection.ts`.

## Acceptance criteria

- [x] C1. In users mode a page load without a valid cookie shows the sign-in page, and a correct name and password sign the browser in as that user.
  - done: impl-1567 · 2026-11-02T12:46:27.602Z
  - verified: rev-35 [reviewer] · run rev-35-1567-final-1 · 2026-11-02T13:10:25.787Z · commit 1b950a52ba72e0b27f13109ebbc39976d8ad3643
- [x] C2. A wrong password or an unknown or invited-only name is refused with one message that does not say which was wrong.
  - done: impl-1567 · 2026-11-02T12:46:27.995Z
  - verified: rev-35 [reviewer] · run rev-35-1567-final-1 · 2026-11-02T13:10:25.787Z · commit 1b950a52ba72e0b27f13109ebbc39976d8ad3643
- [x] C3. Sign out in Profile revokes that browser's web session, closes its sockets and returns to the sign-in page, and other browsers stay signed in.
  - done: impl-1567 · 2026-11-02T12:46:28.214Z
  - verified: rev-35 [reviewer] · run rev-35-1567-final-1 · 2026-11-02T13:10:25.787Z · commit 1b950a52ba72e0b27f13109ebbc39976d8ad3643
- [x] C4. In single mode a page without a cookie behaves as today, with the existing connection and phone-disconnected tests unchanged.
  - done: impl-1567 · 2026-11-02T12:46:28.625Z
  - verified: rev-35 [reviewer] · run rev-35-1567-final-1 · 2026-11-02T13:10:25.787Z · commit 1b950a52ba72e0b27f13109ebbc39976d8ad3643
- [x] C5. The pages pass the web typecheck's colour and contrast checks and add no key listener outside `keymap.ts`.
  - done: impl-1567 · 2026-11-02T12:46:28.755Z
  - verified: rev-35 [reviewer] · run rev-35-1567-final-1 · 2026-11-02T13:10:25.787Z · commit 1b950a52ba72e0b27f13109ebbc39976d8ad3643

## Comments

### impl-1567 · 2026-11-02T12:42:04.138Z

Contract inventory (rule 20): extending HTTP only (/signin, /signin/status, /signin/password, /signout); no wire/schema changes. Searched webSessionCookie, createWebSignIn, WebAuth, session/revoke, /auth, SignIn, connection close consumers across production hub/web/nvim/shared, all test tiers, skills/docs/QA. Existing link/invite/session/capability consumers retain signatures and shapes. Edge owns browser revocation via existing revoke (uploads and sockets drained), main entry and Profile consume new HTTP; connection close checks optional status with old-hub 404 fallback. Unedited web/test/connection.test.ts and phone-disconnected.test.ts plus hub web-auth.test.ts preserve single-mode/previous wire.

### rev-35 · 2026-11-02T12:49:02.937Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1567-source-1
commit: 1b950a52ba72e0b27f13109ebbc39976d8ad3643
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear,no findings. Users-mode root/signin/password form uses boundedHTTP/exactOrigin/admittedHost/sharedscrypt; unknown/invited/wrong credentials same401/no cookie, dummyhash for unknown. Read A-15078A9; per-name/address exponential failure delay/cap and volatile cleanup source match. Admission/stop/hash rechecked after scrypt, auth.issue revalidates active user. Profile signout reuses edge revoke owner: delete session,drain uploads/observe matching socket closes before200,other sessions retained. Optional close-status redirects revoked sibling with oldhub404 fallback; single-mode link/disconnected paths and named preservation tests unchanged. Tokenstyles/nativebutton no new keylistener; docs/skill/testguides and HTTP consumer inventory updated,no wire/CLI/role change. A-15822 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15822-t-1567-source-review-at-1b950a52b.md) records both axes. C1–C5 remain unverified pending named samehead queued/browser/preservation/typecheck evidence. A-15819 localMac HTTP3/Websignin2/connection4/phone3/webauth29/static reports are preliminarytargeted,not queued evidence. QAafterstage unchanged. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T13:10:25.787Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1567-final-1
commit: 1b950a52ba72e0b27f13109ebbc39976d8ad3643
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear,C1–C5 verified,no findings. Independently matched A-15829 HTTPwebsignin3/Websignin2 pass facts including credential-uniformity/failure5 delay/correct sign-in, rendered Profile identity, signout original+sibling navigation and independent browser reload identity. Existing invite flow green. C4 unchanged webauth29/phone-disconnected3 pass; connection1outer+3nested finish/pass records explicitly checked, including oldpage reload/protocol refusal/backoff. C5 web typecheck log27–31 includes colourfixtures/token-only/23texttokens≥4.5:1; source has no new keylistener. Host typecheck at tree0f8c0fbb38679db2046510d20f47826f33a3229b,not repeated remotely. Exact-head68afd4ba exit0/4732pass/zero fail,cancel,skip,todo;T0/T1/allfallbackT2/Web complete,T3 batchdeferred,T4unexecuted. Linuxx64 6.8.0-142-generic c8nyc1 Node24.21/Nvim.12.5 workers2;isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4;cache/occasionnull,skips[],skipreasonreport/missing0. Budget/lint/ratchet advisoryonly;executor1151s not suitewalltime,no fullpremerge claim. QAaffected/afterstage unchanged. A-15833 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15833-t-1567-final-evidence-review-at-1b950a52b.md). Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-02T14:00:36.569Z

Merged bb2302625dc6f2bb562c1302b573f3f87a9c0ff0 onto dev.
