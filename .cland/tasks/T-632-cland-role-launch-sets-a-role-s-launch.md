---
id: T-632
kind: task
title: cland role launch sets a role's launch fields, and cland role list shows them all
state: open
status: ready
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-628
topic: topic-492
branch: t/T-632-cland-role-launch-sets-a-role-s-launch
created: 2026-10-16T16:04:12.070Z
updated: 2026-10-18T10:25:02.614Z
---

## Summary

`cland role launch <role> [--harness …] [--model …] [--effort …] [--account …] [--permissions …]` sets that role's `[<role>.launch]` fields in `.cland/roles.toml` through the hub and refuses a value the hub cannot read, so the onboarding's crew round and the human never edit launch fields by hand. `cland role list` shows every launch field, and `cland role set` keeps its meaning (spec v0.1.4 §3.5).

## What to build

- **The command.** Each flag sets one key with the roles.toml editor; flags given together land in one write. `--model ""` and `--account ""` clear the key to the harness's default. `--json` prints the role's launch fields as the hub reads them after the write.
- **Through the hub.** The CLI sends a request the hub serves, like `cland crew set`: the human, the Coordinator and an Aide may run it from their shells; a Lead, an Implementer, a Reviewer and QA are refused with a reason and the refusal shows in Agents. The hub checks the caller again just before it writes.
- **Refusals.** A value the hub cannot read is refused with its reason and the file stays as it was: an unknown role or harness, a `permissions` value the roles parser does not take, an account name the user-level accounts registry does not hold for that harness.
- **A harness change.** Changing `--harness` without `--model` and `--effort` resets the model to the harness's default and the effort to one the new harness takes (Claude Code `max`, Codex `high`, OpenCode none, as setup's prototype does), and the output names both changes.
- **When it applies.** The output says the fields apply from the role's next launch; when the caller holds that role, it adds that its own session keeps its settings until its next launch (the auto-mode classifier risk of §3.5: the Aide applies its own change last).
- **`cland role list`** shows, per role, the harness, model, effort, account, permissions, approval and sandbox as the hub reads them.
- The usage text lists `role launch` with its flags; `role set` still assigns a role to a session.

## Acceptance criteria

- [x] C1. `cland role launch implementer --harness codex --model gpt-6.1-sol --effort high` writes those keys into `[implementer.launch]`, keeps every other line of roles.toml, and `cland role list` shows them (new CLI test against a temporary project's hub).
  - done: impl-632 · 2026-10-18T09:26:03.657Z
  - verified: rev-30 [reviewer] · run rev-20261018-632-final · 2026-10-18T10:25:00.148Z · commit 5d21514bf6df3b379dd3f02d37fb839b06f94332
- [x] C2. `--permissions` writes any value the roles parser takes and `--account <name>` a registered account, and `cland role list` shows each role's account and permissions.
  - done: impl-632 · 2026-10-18T09:59:22.535Z
  - verified: rev-30 [reviewer] · run rev-20261018-632-final · 2026-10-18T10:25:00.148Z · commit 5d21514bf6df3b379dd3f02d37fb839b06f94332
- [x] C3. A harness change without `--model` and `--effort` resets the model to the harness's default and the effort to one the new harness takes, and the output names both changes.
  - done: impl-632 · 2026-10-18T09:26:08.563Z
  - verified: rev-30 [reviewer] · run rev-20261018-632-final · 2026-10-18T10:25:00.148Z · commit 5d21514bf6df3b379dd3f02d37fb839b06f94332
- [x] C4. An unknown role, an unknown harness, a permissions value the parser refuses and an account not registered for that harness are each refused with their reason, roles.toml unchanged (one test per case).
  - done: impl-632 · 2026-10-18T09:26:11.903Z
  - verified: rev-30 [reviewer] · run rev-20261018-632-final · 2026-10-18T10:25:00.148Z · commit 5d21514bf6df3b379dd3f02d37fb839b06f94332
- [x] C5. The human, the Coordinator and an Aide may run it from their shells, while a Lead, an Implementer, a Reviewer and QA are refused and the refusal shows in Agents (frame-protocol test).
  - done: impl-632 · 2026-10-18T09:26:13.229Z
  - verified: rev-30 [reviewer] · run rev-20261018-632-final · 2026-10-18T10:25:00.148Z · commit 5d21514bf6df3b379dd3f02d37fb839b06f94332
- [x] C6. The next `cland session launch --role <role>` uses the new fields without a hub restart, and the output says they apply from the role's next launch (test with the fake harnesses).
  - done: impl-632 · 2026-10-18T09:26:14.214Z
  - verified: rev-30 [reviewer] · run rev-20261018-632-final · 2026-10-18T10:25:00.148Z · commit 5d21514bf6df3b379dd3f02d37fb839b06f94332
- [x] C7. `cland role set` still assigns roles to sessions, and the usage text lists `role launch` with its five flags.
  - done: impl-632 · 2026-10-18T09:26:15.027Z
  - verified: rev-30 [reviewer] · run rev-20261018-632-final · 2026-10-18T10:25:00.148Z · commit 5d21514bf6df3b379dd3f02d37fb839b06f94332

## Comments

### impl-632 · 2026-10-18T09:24:39.973Z

Implemented role.launch CLI/frame and serialized source-preserving roles editor updates. T2 red proof initially failed with unknown role command launch; current 13 role-launch tests cover combined flags, accounts/permissions, reset/default output, unchanged-file refusals, shell roles/Agents notices, next-launch settings, legacy role set, and authorization revoked while queued. Host lint/typecheck in progress; pre-review origin/dev merged at 226bd904.

### rev-30 · 2026-10-18T09:28:24.695Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-632-source
commit: b238a11f2ae93db6592cc5ca63bbfa11dc9f14aa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5122. Five-flag hub edit uses roles parser/account validation, serialized config work and existing span/atomic writer with before-write identity/authority checks. Immediate parsed snapshot supplies next launches; caller session retains prior launch settings. Harness reset/default output and complete role list inspected; role set path retained. Thirteen T2 cases cover exact edits/refusals/registry/defaults/authority/next-launch and usage. C1–C7 await exact-head droplet evidence. No reviewer execution.

### rev-30 · 2026-10-18T09:57:23.867Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-632-runtime
commit: b238a11f2ae93db6592cc5ca63bbfa11dc9f14aa
scope: evidence
findings: [{"severity":"medium","text":"M1: registering the Codex account before projectHub starts triggers AccountPoller native spawn (#read → #run at accounts/poller.ts:204). All 13 owned T2 cases report this unexpected child; it is outside the CLI helper exemption. Inject/prevent the incidental account probe while retaining registry validation, and prove whole-file unexpected-child census clean.","file":"hub/test/role-launch.test.ts","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

A-5170: behavioral gate A-5169 is green (13 ordinary owned cases, 65/65 load repetitions), but every owned T2 case records a native account poller spawn through accounts/poller.ts:204. fixture registers Codex accounts before projectHub startup; this is outside the allowed CLI subject exemption. Correct the fixture/account-read seam, retain registry and role assertions, provide an unexpected-child census, and obtain fresh source review before replacement verify.

Criteria: C2 failed (Registered-account fixture starts native account polling in every new T2 case; isolate that probe before final verification (M1).).

### impl-632 · 2026-10-18T09:59:23.358Z

M1 corrected at 5d21514b: optional account-reading boundary keeps startup poll scheduling and real registry/account checks but prevents native probes in this T2 fixture. Enforced tripwire reproduces 13 spawn rows at prior head; replacement whole-file run has 0 unexpected children and 13/13 passed in 2.156 s. Existing account-poller-clock cases 10/10 green (0.356 s). Host lint/typecheck green. Fresh source review requested before replacement verify; no dev merge.

### rev-30 · 2026-10-18T09:59:56.126Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-632-account-reader-correction
commit: 5d21514bf6df3b379dd3f02d37fb839b06f94332
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5172: M1/A-5170 source correction clear. Optional AccountReader replaces only external usage reads; production default native/live reader unchanged. Role-launch fixture retains actual registry/account-harness checks and every original assertion. A-5171 enforced-T2 whole-file red/green documents 13 poller trips before, zero unexpected trips after with 13 cases passing. No dev merge/further findings. All C1–C7 runtime verification awaits replacement exact-head droplet gate.

### rev-30 · 2026-10-18T10:25:00.148Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-632-final
commit: 5d21514bf6df3b379dd3f02d37fb839b06f94332
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5206: exact-head A-5205 passes full hub/Neovim, 2546 pass/0 fail/8 outside-scope skips. All13 owned ordinary cases and65/65 repetitions pass; zero owned tier trips, so M1 does not recur. Retained account-poller-clock10/10 and native poller6/6 also pass. All C1–C7 verified from source mapping plus clean runtime receipts; no hard budgets or findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
