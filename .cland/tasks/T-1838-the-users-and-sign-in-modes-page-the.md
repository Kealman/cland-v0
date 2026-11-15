---
id: T-1838
kind: task
title: The users and sign-in modes page, the multi-user section and the CLI reference for `cland user` and `cland auth`
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1834
  - T-1835
  - T-1836
topic: topic-1518
branch: t/T-1838-the-users-and-sign-in-modes-page-the
created: 2026-11-12T10:07:23.227Z
updated: 2026-11-15T08:30:02.020Z
closed: 2026-11-15T08:30:02.020Z
---

## Summary

A new docs page, "Users and sign-in modes", describes the two modes as built. The web-and-phone page gains a multi-user section, and the CLI reference lists `cland user` and `cland auth`. A reader can switch a project to users mode and invite a user from the page alone.

## What to build

Spec §3.8 and §3.9, written from the build of E-1536 and this stage. The page goes under Features in the sidebar and is linked from the features overview. It covers:
- **The modes.** Single and users; `cland auth mode users` and what switching does (the first user from git's `user.name`, browser sessions signed out); `cland auth reset` as the only way back.
- **Users.** `cland user add`, `list` and `invite`; the invite page with a passkey or a password; `--as <user>`; who wrote, answered and approved.
- **Remotes.** Pairings per user, General mirrored to every paired user, the first answer winning.
- **Setup and doctor.** Setup's sign-in mode step and doctor's mode line.
- **Deferred.** What waits for 0.4.x.

The multi-user section of web-and-phone covers signing in with a passkey or a password, the admin's users list and invites in the web, the author names on messages and outcomes, and one inbox for everyone. It links to the users page. The command blocks a reader runs are marked.

## Acceptance criteria

- [x] C1. The page is in the docs sidebar under Features, is linked from the features overview, and has sections on the two modes, switching and reset, users and invites, passkeys and passwords, `--as`, remotes in users mode, setup's sign-in step and doctor's mode line (test).
  - done: impl-1838 · 2026-11-15T06:43:39.302Z
  - verified: rev-36 [reviewer] · run rev-36-1838-final-1 · 2026-11-15T07:24:07.960Z · commit a15551d77475e7332f28e2edc57a92e9c76b1dff
- [x] C2. Every `cland` command and config key on the page and in web-and-phone's multi-user section exists in the CLI help and the config keys (test).
  - done: impl-1838 · 2026-11-15T06:43:39.494Z
  - verified: rev-36 [reviewer] · run rev-36-1838-final-1 · 2026-11-15T07:24:07.960Z · commit a15551d77475e7332f28e2edc57a92e9c76b1dff
- [x] C3. The page's marked command blocks, run in order in a scratch single-mode project, switch it to users mode and print a one-time invite for a second user (test).
  - done: impl-1838 · 2026-11-15T06:55:31.900Z
  - verified: rev-36 [reviewer] · run rev-36-1838-final-1 · 2026-11-15T07:24:07.960Z · commit a15551d77475e7332f28e2edc57a92e9c76b1dff
- [x] C4. web-and-phone has a multi-user section on passkey and password sign-in, the users list and invites in the web, author names and the one inbox, linked from the users page (test).
  - done: impl-1838 · 2026-11-15T06:43:40.010Z
  - verified: rev-36 [reviewer] · run rev-36-1838-final-1 · 2026-11-15T07:24:07.960Z · commit a15551d77475e7332f28e2edc57a92e9c76b1dff
- [x] C5. The CLI reference lists each `cland user` and `cland auth` subcommand that their usage text names, and no other, and the closed-item wording lint passes on the changed pages (test).
  - done: impl-1838 · 2026-11-15T06:43:40.333Z
  - verified: rev-36 [reviewer] · run rev-36-1838-final-1 · 2026-11-15T07:24:07.961Z · commit a15551d77475e7332f28e2edc57a92e9c76b1dff

## Blocked by

- T-1834 (the CLI reference)
- T-1835
- T-1836

## Notes

- Hot files: `site/src/content/docs/docs/users.md` (new), `site/src/content/docs/docs/web-and-phone.mdx`, `site/src/content/docs/docs/cli.md`, `site/astro.config.mjs`, `site/src/content/docs/docs/features.md`, `site/test/`.
- Tests: new `site/test/users-docs.test.ts` (T1); new `hub/test/users-docs-invite.test.ts` (T2, runs the marked blocks on `projectHub` with the web edge).
- Serves epic C7.

## Comments

### impl-1838 · 2026-11-15T06:43:04.797Z

Consumer sweep: site/test/remote-docs.test.ts, hosts-docs.test.ts, onboarding-claims.test.ts; hub/test/remote-docs.test.ts shared wrapper and suite-task-selection.test.ts; site sidebar and link build; wording lint; QA briefs E-1537-stage-4, E-1313, E-1314, T-115. Existing anchors and remote/host inventories retained; new Users section scoped separately. Local macOS Node 24.21.0: users guard 5/5, wrapper 38/38, T2 walkthrough 1/1, selection 10/10, test-docs 4/4; typecheck, tier lint and closed wording lint clear. Native/browser tests not run. Inventory overlaps T-1806 native slot; rerun deferred until release for attribution.

### rev-36 · 2026-11-15T06:51:10.673Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1838-source-1
commit: e0c5440c3ba30102d9289293a13a4a844d583f3e
scope: full
findings: [{"severity":"medium","text":"The new T2 walkthrough starts projectHub without a FakeClock, and its guide explicitly keeps time real. The T2 socket/CLI boundary requires a fake clock; no real-time subject assertion or approved exception applies. Inject a Date.now-relative FakeClock and correct the guide while retaining the public invite/revocation assertions.","file":"hub/test/users-docs-invite.test.ts","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec source audit at the fixed head: Standards has one confirmed medium finding; no additional Spec source findings. A-19559 contains the complete review and evidence qualifications. A-19554 is transcribed candidate evidence, not original producer logs; A-19555/A-19556 are two before-state inventories, not a before/after pair. No runtime criteria verified, no tests or validators run by Reviewer. Correct the clock/guide, then request fresh source review before configured verification.

Criteria: C3 failed (The T2 walkthrough uses the production clock contrary to the required fixture boundary; correct clock ownership before fresh source review.).

### rev-36 · 2026-11-15T06:52:56.359Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1838-source-2
commit: a15551d77475e7332f28e2edc57a92e9c76b1dff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, Standards and Spec: no findings. A-19561 records the exact two-file clock/guide repair and carries forward the complete A-19559 source audit. Public assertions unchanged; clean task tree and requested HEAD confirmed. No runtime criteria verified and no tests/validators run by Reviewer. Corrected T2 execution, attributable inventory recheck and exact-head configured named receipts remain pending. Task view still shows failed C3; restore implementation-done after necessary repair validation before final evidence settlement. Historical transcript/candidate and inventory limitations remain explicit; after-stage QA separate.

### rev-36 · 2026-11-15T07:24:07.961Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1838-final-1
commit: a15551d77475e7332f28e2edc57a92e9c76b1dff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear: A-19576, exact receipt/consumer ledger A-19575, original configured A-19574/run059150dd. Independently reconciled 6345 passing base tests/700 base files and separate 190 passing load tests/files; five users source guards and corrected invite walkthrough each base+5 pass. C1-C5 verified. Wording lint 774 documents/1863 items/0 findings. All 982 manifest paths accounted for: 700 positive T1/T2/Web files, 265 T3 merge-batch and 17 T4 stage/epic deferrals, no missing lower/Web. Source clear A-19561 remains unchanged/clean. Linux/browser/head/tree provenance recorded; budgets/lint report-only. Corrected local T2 raw pass and identical 12955-name saved inventory pair close its interval; earlier transcript/overlap limitations retained. No Reviewer execution, no full-T3/T4 or after-stage QA claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-15T08:30:02.020Z

Merged 17ef83b96bf58fecb6392bcc79d79da27bb659ae onto dev.
