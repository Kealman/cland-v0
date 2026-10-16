---
id: T-296
kind: task
title: "OpenCode servers get their own database: the shared database lets OpenCode's background service resume cland's sessions (#51213)"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - hub
  - bug
  - ready-for-agent
assignee: null
parent: E-424
blocked_by:
  - T-546
topic: topic-336
branch: t/T-296-opencode-servers-get-their-own-database
created: 2026-10-12T16:20:56.477Z
updated: 2026-10-16T01:20:13.482Z
---

## Summary

E-424 slice 1 (tracer step 1). cland's per-session OpenCode servers share the user's default OpenCode database with OpenCode's background service, which resumes any session it finds mid-turn (upstream #51213). They move to a database of their own: one per user, or per account through the accounts registry.

## What happened

Found by the T-295 research (docs/research/opencode-v2.md on research/opencode-v2): cland's per-session OpenCode servers share the user's default OpenCode database with OpenCode's own background service (v2's one-service-per-user model). When that service starts, for example because an agent runs an `opencode` CLI command inside a cland session, it resumes every session that is mid-turn, cland's included, and two processes then drive one session; the resumed copy runs with the user's global config and without cland's spoke. Reproduced twice in isolation; upstream issue #51213 is open and the code is unchanged through 2.0.27.

## What to build

E-424's "Choices where the spec is silent" settle the details: where the database lives, the login, the proof and the interim rule. Read them first.

- **Per-user database.** With no account, every cland OpenCode server runs with `OPENCODE_DB` at `cland/opencode/opencode.db` under `$XDG_DATA_HOME`, else `~/.local/share`.
- **Per-account database.** An account from `~/.config/cland/accounts.toml` keeps the data home or the database the registry (T-361) gives it.
- **Environment.** The adapter drops any inherited `OPENCODE_DB` and `XDG_DATA_HOME` before setting its own.
- **Launch record.** The session's launch record names its database, and resume and relaunch reuse it.
- **Doctor.** It names the database and prints the standalone login line for it, which never starts the background service. It warns when an account points at the user's default database. It also says whether the free default model needs a login in a fresh database; settle that question first.
- **P3 proof.** The research's `probe-restart-sweep.mjs` becomes a hub test with a fake OpenAI-compatible provider. It is a platform skip where the real `opencode` binary is absent.
- **Interim rule.** It is retired on merge. The Coordinator records the rule's retirement; the Implementer names it in the merge report.

Code: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`, `hub/src/accounts/registry.ts`, `hub/src/doctor/toolchain.ts`.

## Acceptance criteria

- [x] C1. A cland-launched OpenCode session is never resumed by OpenCode's background service, shown by the P3 reproduction turned into a hub test (platform skip without the real binary).
  - done: impl-296 · 2026-10-15T23:47:07.823Z
- [x] C2. With no account the server runs on the per-user database under the data directory, an account keeps its registry database, and inherited OPENCODE_DB and XDG_DATA_HOME never reach the server.
  - done: impl-296 · 2026-10-15T23:47:34.138Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280
- [x] C3. The launch record names the database, and resume and relaunch reuse it.
  - done: impl-296 · 2026-10-15T23:48:07.788Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280
- [x] C4. `cland doctor` names the database and its standalone login line, warns when an account points at the default database, and says whether the free default model needs a login.
  - done: impl-296 · 2026-10-15T23:49:01.818Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280
- [x] C5. hub/README.md (OpenCode) describes the database and the login.
  - done: impl-296 · 2026-10-15T23:49:36.050Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280

## Comments

### impl-296 · 2026-10-15T22:46:32.653Z

Implementation seams follow E-424's prescribed hub frames/fake harness and real-binary fake-provider proof. Added first regression for unassigned database selection, journal launch record and retention after hub restart/relaunch. Local test window currently reserved for T-544; no tests started. Authentication probe will use a fresh scratch database and standalone server with no project code.

### impl-296 · 2026-10-15T22:57:44.823Z

C4 free-model question settled with the Coordinator: OpenCode 2.0.24; standalone server cwd and API session directory /var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/t296-free-cHduKP/project, initially empty and outside the repository. HOME, config/data/state/cache/tmp and explicit fresh OPENCODE_DB were scratch siblings, with no inherited provider variables. GET /api/credential returned 0; opencode/big-pickle replied HELLO to the trivial prompt with no login. Every permission was ask; no pending tool approval appeared or remained at completion. Child stopped before scratch deletion. Probe script is durable artifact A-3430; initial deny-policy confound is A-3423. Doctor will say no login needed for the free default; paid providers need the standalone login into cland's database. Verify waits for T-546 shared platform-skip fix.

### coord · 2026-10-15T23:00:29.063Z

Coordinator note for merge (from impl-296, 23:00Z): a live OpenCode session launched before T-296 stays on the default database when it is only reattached. A legacy relaunch moves to cland's database, which refuses a missing old conversation. Before retiring rule 13 at merge: list live OpenCode sessions (`cland who`, session list), then stop or fresh-launch any launched before the merge. There are none in the crew as of 2026-10-15 23:00Z.

### rev-30 · 2026-10-16T00:00:37.200Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-296-source
commit: 7f964e694492ed6312e05bc6772075f0b883564c
scope: full

Source review T-296 clear at 7f964e694492ed6312e05bc6772075f0b883564c, fixed point a06020a3478184c604165d70d0d0e81b30a956a7. Standards and Spec reviewed directly, no delegation. No high or medium findings; one low documentation finding below.

Standards: database selection lives in accounts/registry.ts and is shared by launch, doctor and login hints. The adapter removes inherited OPENCODE_DB and XDG_DATA_HOME before applying a saved selection. No-account launches derive an absolute XDG data root or HOME fallback, choose cland/opencode/opencode.db, return it as accountEnv, and create its parent before server spawn. Named data_home/db selections retain registry behavior; accountEnvironment and attach prefix remove the competing selector. Shared database lifetime is explicitly outside the per-session LaunchFiles rollback. No credential contents are read by account selection or warning checks.

Persistence trace: sessions.ts:915 retains owned.accountEnv for the unassigned launch, ProcessTable.put serializes account_env and row loading restores it (processes.ts:113/166). Session launch/resume journal entries name database. Warm resume retains the original process; relaunch passes saved accountEnv to #launch. Fresh resume and pool restart likewise reuse the saved selection. Existing default-database sessions are not silently migrated; Coordinator 3d48a95e accepts this rollout and owns the stop/fresh-launch check before retiring rule 13.

Spec: E-424's choices explicitly permit named accounts to retain their registry database, including warning for an account selecting the user's default database. Thus the isolation guarantee applies to the new default and separate accounts; explicit default-db accounts retain the documented sweep hazard. Doctor probes authentication in the cland DB with --standalone, names each account's effective DB and standalone login, and canonicalizes existing path ancestors for default-db warnings. Version policy is unchanged and remains T-533's slice. The free-default statement follows Coordinator d62d62d1 and the authorized scratch-only experiment: 2.0.24, zero credentials, opencode/big-pickle replied HELLO, ask-only tools, no tool requests. A-3430 reproduces the experiment; A-3474 records version/cwd/layout/result. This is an implementer receipt, not a Reviewer model call or a promise for future versions.

P3 source read in full: excludes harness-prepended fake PATH entries, checks real version, uses scratch HOME and all XDG/config/state/cache/tmp paths, a local hanging fake provider and explicit generated config. The positive control must produce a second provider request on service boot; only then does it assert the service excludes the cland conversation, no second cland request, and the original cland server remains active. Writer stops are awaited before provider closure and owned-directory removal. Installed-binary absence is an explicit platform skip. Machine shard entry present; no new duration allowance was needed in measured receipts.

A-3474 raw whole-file logs independently read: accounts16/16, doctor19/19, adapter17/17, catalog2/2, P3 real2.0.24 1/1 (3.721s), total55, zero fail/skip/cancel. Accounts exercise both XDG and HOME default paths, planted inherited DB and changed data root after hub restart/relaunch; existing named-account behavior remains. Doctor test checks exact isolated standalone auth probe, default-account warning and HOME fallback. Typecheck and shard logs pass; immutable diff whitespace check clear.

Low finding L1 — hub/README.md:1211: the sample OPENCODE_DB assignment uses any nonempty XDG_DATA_HOME, while the launcher ignores a relative XDG_DATA_HOME. For XDG_DATA_HOME=relative, copying the sample logs into a different database. Prefer the exact line printed by doctor or an example that applies the launcher's absolute-path fallback. This does not block source clearance; the preceding documented selection and actual doctor output are correct.
Findings: [{"severity":"low","text":"Sample login command should use the same absolute-XDG fallback as the launcher, or direct the reader to doctor's exact command.","file":"hub/README.md","line":1211}].

C2,C3,C4,C5 verified at this source head. C1 final task verification remains pending; this targeted P3 receipt does not replace the required post-source suite gate. Both explicit Coordinator hold-lift and dependency T-546 merge must occur before verification. No Reviewer tests, binaries, model/network calls, edits, installs, merges or provider actions; rule 13 remains active until Coordinator retires it on merge. No per-item QA.

Review artifact A-3486 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3486-t-296-source-clear-at-7f964e69-persistent-isolated-database-and-p3-sweep-proof.md.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-16T00:02:07.895Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-296-docs-delta
commit: ddeb710c2119ac1e5b4cd822318e53d800a08280
scope: delta

Delta source review T-296 clear at ddeb710c2119ac1e5b4cd822318e53d800a08280 versus full source-reviewed 7f964e694492ed6312e05bc6772075f0b883564c.

Standards: no findings. Spec: no findings. Entire immutable diff is hub/README.md's login paragraph: removes the shell sample that accepted relative XDG_DATA_HOME and directs readers to doctor's exact OPENCODE_DB=… opencode auth login --standalone command, explicitly applying the launcher's absolute-XDG/HOME fallback. Low finding L1 in A-3486 is resolved. No runtime, fixture, manifest or dependency changes; no dev merge. C2–C5 reverified from unchanged production source plus corrected docs. A-3474's 55 complete targeted passes, real2.0.24 P3 positive-control/isolation proof, typecheck/shard logs and A-3430 free-default experiment remain applicable; no extra test run for this prose correction.

C1 final evidence remains pending the required post-source task verification. Both Coordinator explicit hold lifted and T-546 merge are prerequisites to submission. Rule 13 stays active until Coordinator's live default-database session check and merge retirement. No per-item QA. No Reviewer tests, binaries, models/network, edits, installs, merges or provider actions. Verdict posted once without read-back under overload guidance.

Review artifact A-3492 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3492-t-296-docs-delta-clear-at-ddeb710c-exact-database-login-command.md.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.
