---
id: T-1774
kind: task
title: Fake harness logins that rotate every turn
state: open
status: review
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1454
branch: t/T-1774-fake-harness-logins-that-rotate-every
created: 2026-11-09T12:44:08.653Z
updated: 2026-11-09T13:07:58.143Z
---

## Summary

The fake Claude Code, Codex and OpenCode binaries keep a login file in their harness home and rotate it on every turn, as a subscription harness rotates its refresh token. Their sign-in commands write a fresh login, and a turn containing `DEAD-LOGIN` kills it, after which turns report that harness's own dead-login signal. Every later logins test uses this fixture.

## What to build

Test-only code under `hub/test/fakes`. The login file is `login.json` in `FAKE_LOGIN_HOME` when it is set, else in the harness home: `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, or the directory of `OPENCODE_DB`. It holds the login name, a random token, a generation, the sign-in and the last rotation (time and host), a dead flag, and the last 20 turns (host, session, generation).

The sign-in commands:
- `claude auth login` prints a fake link, reads a pasted code from stdin, and writes generation 0.
- `codex login --device-auth` prints a fake link and device code and writes generation 0. It refuses a home that already holds a live login, so a test can prove that a Codex login starts in an empty home.
- `opencode auth login` writes generation 0.

The dead-login signals are the real ones: Claude Code's `StopFailure` with `authentication_failed` and "OAuth token revoked"; Codex's `refresh_token_reused` with `codexErrorInfo: "unauthorized"`; OpenCode's `provider.auth`. A turn with no login file reports the same signal. Every logout form (`claude auth logout`, `codex logout`, a `/logout` input) is appended to the fake's calls file, so tests can assert that none ran. With `FAKE_LOGIN_HOLDER=1`, a sign-in leaves a detached process with its working directory and an open file in the home, as OpenCode 2's `opencode serve --service` did.

## Acceptance criteria

- [x] C1. Each fake's sign-in writes generation 0 in its harness home, and each turn raises the generation by one and records its host and session (test).
  - done: impl-1774 · 2026-11-09T13:05:30.499Z
- [x] C2. A turn containing `DEAD-LOGIN`, every later turn until the next sign-in, and a turn with no login file each report that harness's dead-login signal (test).
  - done: impl-1774 · 2026-11-09T12:55:52.797Z
- [x] C3. The fake Codex sign-in refuses a home holding a live login and writes nothing there, and signs in over a dead one (test).
  - done: impl-1774 · 2026-11-09T12:55:55.267Z
- [x] C4. Every logout form is recorded in the fake's calls file (test).
  - done: impl-1774 · 2026-11-09T12:55:56.917Z
- [x] C5. With `FAKE_LOGIN_HOLDER=1`, a sign-in leaves one detached process holding a file open in the home, with its pid recorded (test).
  - done: impl-1774 · 2026-11-09T13:05:30.920Z

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/test/fakes/claude-code/fake-claude.ts`, `hub/test/fakes/codex/fake-codex.ts`, `hub/test/fakes/opencode/fake-opencode.ts`, `hub/test/fakes/setup-profile.ts`, `hub/test/fakes/fake-login.ts` (new, the shared login file).
- Tests: new `hub/test/fake-harness-login.test.ts` (T2, the fakes as child processes, no hub). The existing fake-harness tests pass unchanged.
- Serves epic C2, C7 and C8 as the fixture. Written for question 1's recommended answer; under the other answer, this ticket becomes a fenced `fake` harness adapter instead.

## Comments

### impl-1774 · 2026-11-09T12:47:51.432Z

Rule 20 pre-change sweep: shared suite-import-graph over every tiers.json test (T1–T4/Web), changed fake binaries + setup-profile: reached scenarios/setup.test.ts and setup-machine.test.ts; 16 unknown graphs conservatively reached, listed with diagnostics in the topic consumer artifact. Explicit consumers: setup-machine.ts (loginMarker/setFakeLogin), curl fake (recordCall), three harness binaries, native adapter fixtures and account/model/auth tests referenced by FAKE_*_HOME/binary-path strings; docs/QA/skills searched too. All legacy consumers remain unaffected because rotation activates ONLY with FAKE_LOGIN_ENABLED=1 or FAKE_LOGIN_HOME (Coordinator decision); legacy fake-login.json shape unchanged. New file shape has no previous consumers. No production protocol or registration changes.

### impl-1774 · 2026-11-09T12:55:15.781Z

Coordinator tier decision cd887413: fake-harness-login.test.ts is T3, not T2, by tier policy. New tests previously ran locally as targeted implementation red/green probes before lint identified this mismatch; further native run waits for clear source review and preservation lock. New file cases sampled below 3s macOS; no duration allowance required from these samples. Shared contract: docs/agents/fake-harness-logins.md; per-case QA guide: docs/agents/tests/hub-test-fake-harness-login.test.ts.md. Local existing fake-harness, capabilities and setup-machine consumers pass (24/24 including new 14 login cases on pre-final working tree), hub typecheck clear. Linux evidence remains pending mode-free verification at reviewed head; remaining T3 and stage QA deferred.

### rev-36 · 2026-11-09T13:02:06.340Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1774-source-1
commit: 7863a057e02c5b51eff6e69e36b45799827a4c1d
scope: full
findings: [{"severity":"medium","text":"Standards/lifecycle: detached-holder cleanup is registered only after successful sign-in/assertion and receipt parsing. Failure in that interval can leave a detached holder unowned. Cleanup signals a recorded PID without native birth/command ownership validation. Prearm owned all-steps cleanup before creation, join positively owned native exit and give scratch storage an explicit disposition; cover early failure. Author e0bc664a confirms no omitted owner.","file":"hub/test/fake-harness-login.test.ts","line":90},{"severity":"medium","text":"Spec/C5: any login-holder.json suppresses launching a holder without liveness/native identity/open-file proof. After SIGKILL its stale receipt makes later successful sign-ins leave no holder. Reuse only a positively observed matching holder and recover stale receipts; test dead/stale and live reuse. Author e0bc664a confirms the gap.","file":"hub/test/fakes/fake-login.ts","line":79},{"severity":"medium","text":"Spec/C1: Claude input loop falls through on EOF even if no nonempty pasted code was read, then saves a generation0 live login. Refuse EOF/empty input without writing login and retain nonempty success. Author e0bc664a confirms no intended exception.","file":"hub/test/fakes/fake-login.ts","line":72},{"severity":"medium","text":"Spec/compatibility: with rotation disabled, OpenCode now accepts auth login without --standalone, and all three new logout branches succeed instead of their former unsupported invocation. Gate added forms behind loginEnabled and preserve legacy standalone/refusal parity under Coordinator c98afa58. Author327683f0 confirms these are unapproved regressions.","file":"hub/test/fakes/opencode/fake-opencode.ts","line":94}]
finding_counts: {"high":0,"medium":4,"low":0}

A-18066: Standards1medium/Spec3medium, all author-confirmed e0bc664a/327683f0. Prearm/join owned holder cleanup with native identity; reuse only live owned holder; refuse empty Claude code; gate new CLI logout/non-standalone forms so disabled behavior stays unchanged per c98afa58. All11 files/native signal/call-recording paths reviewed, no other findings. T3 classification approved cd887413; docs/index/schema present. A-18053 narrative candidate24/24 lacks exact producer/immutablehead receipts; no runtime criteria verified. Correct/commit/fresh source request before directed locked native/configured verification. Affected after-stageQA separate; no provenance-only rerun requested. Reviewer read-only/no execution/delegation.

Criteria: C1 failed (Claude EOF/empty code signs in and writes a live generation0 login without pasted input.), C5 failed (Stale holder receipt suppresses replacement; test cleanup is late and lacks native ownership proof.).

### rev-36 · 2026-11-09T13:07:58.143Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1774-source-2
commit: afc246a6818b5fea10ed175334e9b6abaa90e07a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear Standards0/Spec0; all A-18066 findings resolved. Prearmed fixture cleanup uses live socket-owned self-shutdown and OS exit observation, not serialized PID signals; stale/corrupt/crashed holder and uncommitted readiness failure controls inspected. Claude empty input refuses; disabled CLI parity restored while legacy standalone remains. All correction files/new holder client and retained login semantics/native handlers inspected, no other findings. T3 cd887413/explicit opt-in c98afa58 retained. A-18072 development21/21 is transcription/working-tree evidence with original capture limits; intermediate20/21 remains history. No runtime criteria verified. Next directed locked final native/legacy receipts then mode-free Linux exacthead; fullT3batch/affectedafter-stageQA separate. >=4s Linux newcase allowance bar retained; no provenance-only repeats. Reviewer read-only/no execution/delegation.
