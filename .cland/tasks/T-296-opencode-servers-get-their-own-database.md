---
id: T-296
kind: task
title: "OpenCode servers get their own database: the shared database lets OpenCode's background service resume cland's sessions (#51213)"
state: open
status: ready
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
updated: 2026-10-16T05:54:03.286Z
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
  - verified: rev-30 [reviewer] · run rev-20261016-296-final · 2026-10-16T05:54:00.086Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
- [x] C2. With no account the server runs on the per-user database under the data directory, an account keeps its registry database, and inherited OPENCODE_DB and XDG_DATA_HOME never reach the server.
  - done: impl-296 · 2026-10-15T23:47:34.138Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280
  - verified: rev-30 [reviewer] · run rev-20261016-296-manifest-delta · 2026-10-16T01:25:56.291Z · commit 3f28265df73c5d2e95269fa5bd4c855af7c2f5c9
  - verified: rev-30 [reviewer] · run rev-20261016-296-merge-delta · 2026-10-16T04:00:19.575Z · commit 16d819bc6809689de73340786c7b2bd05bd1ddfd
  - verified: rev-30 [reviewer] · run rev-20261016-296-guard-budget-correction · 2026-10-16T04:39:26.763Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
  - verified: rev-30 [reviewer] · run rev-20261016-296-final · 2026-10-16T05:54:00.086Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
- [x] C3. The launch record names the database, and resume and relaunch reuse it.
  - done: impl-296 · 2026-10-15T23:48:07.788Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280
  - verified: rev-30 [reviewer] · run rev-20261016-296-manifest-delta · 2026-10-16T01:25:56.292Z · commit 3f28265df73c5d2e95269fa5bd4c855af7c2f5c9
  - verified: rev-30 [reviewer] · run rev-20261016-296-merge-delta · 2026-10-16T04:00:19.575Z · commit 16d819bc6809689de73340786c7b2bd05bd1ddfd
  - verified: rev-30 [reviewer] · run rev-20261016-296-guard-budget-correction · 2026-10-16T04:39:26.763Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
  - verified: rev-30 [reviewer] · run rev-20261016-296-final · 2026-10-16T05:54:00.087Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
- [x] C4. `cland doctor` names the database and its standalone login line, warns when an account points at the default database, and says whether the free default model needs a login.
  - done: impl-296 · 2026-10-15T23:49:01.818Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280
  - verified: rev-30 [reviewer] · run rev-20261016-296-manifest-delta · 2026-10-16T01:25:56.292Z · commit 3f28265df73c5d2e95269fa5bd4c855af7c2f5c9
  - verified: rev-30 [reviewer] · run rev-20261016-296-merge-delta · 2026-10-16T04:00:19.576Z · commit 16d819bc6809689de73340786c7b2bd05bd1ddfd
  - verified: rev-30 [reviewer] · run rev-20261016-296-guard-budget-correction · 2026-10-16T04:39:26.763Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
  - verified: rev-30 [reviewer] · run rev-20261016-296-final · 2026-10-16T05:54:00.087Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
- [x] C5. hub/README.md (OpenCode) describes the database and the login.
  - done: impl-296 · 2026-10-15T23:49:36.050Z
  - verified: rev-30 [reviewer] · run rev-20261016-296-source · 2026-10-16T00:00:37.200Z · commit 7f964e694492ed6312e05bc6772075f0b883564c
  - verified: rev-30 [reviewer] · run rev-20261016-296-docs-delta · 2026-10-16T00:02:07.895Z · commit ddeb710c2119ac1e5b4cd822318e53d800a08280
  - verified: rev-30 [reviewer] · run rev-20261016-296-manifest-delta · 2026-10-16T01:25:56.292Z · commit 3f28265df73c5d2e95269fa5bd4c855af7c2f5c9
  - verified: rev-30 [reviewer] · run rev-20261016-296-merge-delta · 2026-10-16T04:00:19.576Z · commit 16d819bc6809689de73340786c7b2bd05bd1ddfd
  - verified: rev-30 [reviewer] · run rev-20261016-296-guard-budget-correction · 2026-10-16T04:39:26.763Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447
  - verified: rev-30 [reviewer] · run rev-20261016-296-final · 2026-10-16T05:54:00.087Z · commit 991d1c86a7e599c0104d50d23bb8a56122bc9447

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

### rev-30 · 2026-10-16T01:25:56.292Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-296-manifest-delta
commit: 3f28265df73c5d2e95269fa5bd4c855af7c2f5c9
scope: delta

Delta source review T-296 clear at 3f28265df73c5d2e95269fa5bd4c855af7c2f5c9, direct parent/source-reviewed ddeb710c2119ac1e5b4cd822318e53d800a08280. Standards: no findings. Spec: no findings in this data-only delta.

Independent immutable audit: only hub/test/durations.json changes. Conflict resolution matches Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e byte for byte. Strict JSON parsing rejects duplicate keys; root keys remain version/source/budget/files/tests/allow. All non-allow fields equal the posted payload, including2177 baseline test identities; all229 shared allowance keys and values/reasons remain, with zero drops or changed common values. No extra task allowances. No production code, test cases, bounds or dependencies changed; no dev merge. Immutable diff whitespace checks clear.

Shared evidence A-3493/c0c04df1 is the full integrated cover at a06020a3478184c604165d70d0d0e81b30a956a7, exit0, hub and Neovim completed. It supports this Coordinator-directed baseline refresh; it is not a task-head verification. No additional local rerun requested for this shared data-only pick under launch rules.

Database/P3 implementation, docs correction and A-3474 targeted55/55 remain unchanged. Prior A-3492 source marks carry. C1 final gate remains pending; T-546 merge and its exact posted shared fix plus delta review remain prerequisites. Rule13 stays active until Coordinator rollout check/merge retirement.

Only source-established criteria C2,C3,C4,C5 reverified here. No final evidence/merge readiness claimed. Any subsequent source/head change needs delta review; verification follows the lead's stated prerequisites/admission sequence. No per-item QA change. Read task files/earlier review chain; no task.view full-journal scan. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Review artifact A-3562 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3562-t-296-shared-manifest-delta-clear-at-3f28265d.md.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-16T04:00:19.576Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-296-merge-delta
commit: 16d819bc6809689de73340786c7b2bd05bd1ddfd
scope: delta

Delta source review T-296 clear at16d819bc6809689de73340786c7b2bd05bd1ddfd, authorized merge of prior source-cleared3f28265df73c5d2e95269fa5bd4c855af7c2f5c9 and freshly fetched devdecbab2693407424ae39a7d5eeb38fcef1ef450a. Standards/Spec: no high, medium or low findings. Origin task ref independently matches this exact head.

Primary Coordinator a244d3f5-1ac5-4240-aed8-c82568c72eaa read in Agents explicitly authorizes fresh dev merge under rule11 after T-546, conflict resolution/delta review, then one droplet/fresh verify; named known reds T-555/T-565/T-566/T-567 and rule13 remains active until merge. Independent ancestor checks confirm d2e83f0e,576404e8,64390ae8,2149fe33 present. No new T-296 feature is introduced.

Three resolutions checked against both parents: README keeps all isolated DB/login/default-session rollout paragraphs and incoming T-533 OpenCode2.x release-check policy. doctor/toolchain.ts combined diff is imports only: add incoming compareVersions/Version while retaining account/database/path helpers. Relative to prior task head, its new version policy body exactly follows the incoming dev feature; auth/version probes still run with accountEnvironment selecting clandOpenCodeDatabase, auth fixes still use openCodeLogin, separate account/default-path checks remain. Incompatible majors skip incompatible auth probing while independent database checks still run. No default-database probe was reintroduced. shards.json equals exact parent tests-map union (194 keys), retaining both opencode-check and opencode-database machine entries.

Automatic integration checked: own launch/account/retained-environment/session/database feature source is unchanged; own-overlap files changed only README, toolchain, doctor tests, fake OpenCode version output and shards. Incoming doctor tests add1.x/3.x refusal, newer2.x warning and missing-v2-installer checks; fake version is configurable without changing its database-selection behavior. Final durations.json is byte-identical to dev parent, with no task allowances to restore. Immutable whitespace check passes.

Resolution identifier search against committed hub/test+nvim/test independently finds doctor.test.ts and shards.json, with no Neovim test match; all matches are covered. A-3674 raw whole-file receipts audited: doctor22/22 (26.016s), typecheck1/1 (3.645s), opencode-check7/7 (2.413s) and non-skipped real P3/database isolation1/1 (2.462s),31/31, no failures/cancellations/skips. The extra typecheck/release-check/P3 cover supports combined import and incoming policy compatibility. README records serial local:none/refined guard/load3.04–3.74 admissions. Root typecheck and shard lint reported green; no Reviewer execution. Original55 feature receipts A-3474 remain supporting unchanged-source evidence.

C2/C3/C4/C5 source criteria refreshed: dedicated persistent DB selection/auth/login doctor guidance, retained process environment, default/account warning and isolation/rollout behavior remain intact with version policy. C1 final overall task gate remains pending fresh actual reviewed-head droplet verification, now unblocked by T-546. This is source clear, not final ready or a new suite waiver. Submit once per Coordinator a244d3f5; any further head change needs delta review. Rule13 retirement/old-default-session rollout check remains the Coordinator's merge step. No per-item QA change. No Reviewer edits/tests/compiler/binary execution, installs, signals, commits, merges, provider actions, task.view scan or subagents.

Review artifact A-3676 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3676-t-296-authorized-dev-merge-delta-clear-at-16d819bc.md

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-16T04:31:56.614Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-296-linux-first
commit: 16d819bc6809689de73340786c7b2bd05bd1ddfd
scope: evidence

# T-296 Linux evidence not clear at 16d819bc

A-3703 /c1acaff2-6c2f-4bfb-af56-42e7a7b8e48b names reviewed16d819bc6809689de73340786c7b2bd05bd1ddfd and actual Linux c-8 lon1, four workers. Exit1:1887pass/1ordinaryfail/5platform skips; hub phases completed, Neovim smoke not reached. No Reviewer execution.

## Standards
Medium M1 — hub/test/account-poller.test.ts:251–266 / hub/src/accounts/registry.ts:21,23: the existing architecture guard now fails on the task's two new passive opencode.db path-selection literals (raw4350–4362). These functions select paths; this receipt does not demonstrate a credential-store read or a provider request. Integrate the new passive literals with the guard's existing narrowly scoped exact-literal exceptions, retaining the scanner and forbidden content/access protection. Do not disable the test, exclude the whole registry or remove opencode.db globally from the protected vocabulary. Rerun the whole guard file and relevant owned account tests; a source correction needs delta review before another verify.
Medium M2 — hub/test/accounts.test.ts: new unassigned OpenCode restart/relaunch cases exceed the hard new-identity duration budget: XDG6.507782s and HOME7.259932s>5. Both cases pass functionally and5/5 load repetitions, but this hard budget blocks the suite. Diagnose unnecessary work if present or add narrowly reasoned measured allowances under the existing manifest policy; do not baseline-refresh away the new-test proof. No allowance is claimed approved or implemented here.

## Spec
No runtime evidence of a new database-isolation functional failure. Own account launch/restart cases pass and5/5, doctor database/login warning passes3.962s and5/5. Real P3 skips on this Linux image for absent opencode, including five reasoned prerequisite skips; prior accepted non-skipped Mac P3 proof remains A-3474/A-3674. That permitted skip is not a failing C1 result.
The full gate nevertheless is not clear. C1 final verification remains pending; existing source C2–C5 marks are not failed merely because other suite checks are red. Prior corrected README low is already resolved.

Additional outside-task results require lead classification/disposition before an unchanged retry: tracker-load retained200000 case4/5 (ordinary passes, raw3994; full ordinary max timings remain below5s), remote-fixture-lifecycle hard budgets normal5.272s, watchdogTERM7.445s, watchdogINT9.244s and file70.135s>60. Those are not dismissed as non-failing duration-regression notices. They concern incoming/shared tests, unlike the two new owned account budgets. Do not assume a known E-482 identity solely from the file.
Source clear A-3676 remains historical; this evidence verdict blocks final readiness. Correct own guard/budget integration, obtain classification of shared reds, request delta review at a committed new head, then follow Coordinator run direction. No automatic third/unchanged run requested. Rule13 retirement/old-default-session rollout remains Coordinator's merge action, not performed or waived.
Findings: high0,medium2,low0; Standards2medium,Spec0 functional findings. No criterion-failure marks added because concrete isolation criteria have not been observed false.

Artifact A-3705 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3705-t-296-linux-not-clear-path-literal-guard-and-owned-duration-budgets.md

### rev-30 · 2026-10-16T04:39:26.763Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-296-guard-budget-correction
commit: 991d1c86a7e599c0104d50d23bb8a56122bc9447
scope: delta

# T-296 correction delta source clear at 991d1c86

Head991d1c86a7e599c0104d50d23bb8a56122bc9447; branch t/T-296-opencode-servers-get-their-own-database. Compare reviewed16d819bc6809689de73340786c7b2bd05bd1ddfd. Origin ref matches; three commits, no dev merge. Only account-poller.test.ts (+2) and durations.json (+37) changed. Source and all task launch/doctor assertions unchanged.

## Standards
No high, medium or low findings (0). A-3705 M1/M2 are addressed.
The guard adds two exact complete passive function-definition literals, scoped to /accounts/registry.ts, with path-selection/no-content-read explanations. It removes only one occurrence of each matching definition before the unchanged source scan; the protected opencode.db term, other forbidden terms, recursive file scope and final assertions remain. Neither entire registry exclusion nor global removal of the protected word occurs. Existing negative protection outside those precise passive definitions remains.
Owned duration entries are narrowly measured allowances for the two new restart identities: XDG6.508s, HOME7.260s, grounded in A-3703's6.507782/7.259932 Linux four-worker observations and real two-hub/server persistence work. Tests, assertion bounds and tests baseline are unchanged, so both identities still require new-test load proof. This is not a disguised baseline refresh.

## Spec
No findings (0). Original production source clear A-3486, docs correction A-3492 and authorized merge A-3676 remain valid. C2–C5 refreshed at this head; final C1 task gate remains pending, not falsely failed by the earlier permitted real-binary absence skip.
Primary Coordinator eefc3ad2-90b3-4c46-9af9-f42a0ed3233e, read in topic-336, authorizes the two owned corrections and exact posted08e88000/b4fc313b picks, classifies tracker-load4/5 as T-570, and directs one new droplet receipt reaching Neovim green. Other named known reds T-555/T-565/T-566/T-567/T-569 remain subject to that exact disposition, not a blanket unknown-red waiver.
Independent duplicate-rejecting manifest audit: final allow is exactly prior allow plus the two owned entries and seven additions from posted shared08e88000/b4fc313b (nine additions total). All other root fields unchanged. No task code, doctor policy, P3 behavior or runtime helper changed; shared pick history733c11e5 and991d1c86 only manifests. Whitespace clean.

## Evidence
A-3715 durable folder raw poller.log10/10 and accounts.log16/16, no fail/cancel/skip, file34.149s and30.939s. Guard passes21.496ms; owned restart cases2.741s XDG/2.683s HOME. README labels serial quiet Mac admissions local:none and starting loads2.51/3.09 with guard free. Typecheck/test:shards reported green after owned correction; subsequent picks are manifest-only.
A-3703 remains overall red, not accepted final gate. Earlier non-skipped real Mac P3 proof A-3474/A-3674 and own Linux ordinary/5-of5 launch/login checks remain supporting evidence for unchanged product code. New Linux receipt must supply the requested complete selected phases including Neovim. No per-item QA.

Source delta clear; refresh C2,C3,C4,C5 only. Honor active restart submission hold: do not submit until explicit hub-restarted/lift notice, then Coordinator's T-557 first/T-296 second one-minute spacing. Further changed head requires delta review. Rule13 retirement and old-default-session rollout checks remain Coordinator merge actions.
Totals: Standards0,Spec0 findings. No Reviewer test/compiler/binary execution, edits, signals, installs, provider actions, commits, merges or subagents.

Artifact A-3716 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3716-t-296-correction-clear-narrow-passive-guard-and-measured-restart-allowances.md

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-16T05:23:43.953Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-296-linux-corrected
commit: 991d1c86a7e599c0104d50d23bb8a56122bc9447
scope: evidence

# T-296 corrected-head Linux evidence not clear at 991d1c86

A-3733 /033386f2-d7f1-426f-9a12-3fb82a8b80d1 names exact source-cleared991d1c86a7e599c0104d50d23bb8a56122bc9447. Actual Linux c-8 lon1, four workers, peak1m13.67, suite1458.50s. Exit1:1887pass/1ordinaryfail/5platform skips. No hard duration-budget or load-gate failures remain. Hub phases complete; Neovim smoke not reached.

## Standards
Medium runtime blocker — hub/test/task-prefixes.test.ts:200: after planned legacy epic removal and invalid-plan replacement, the expected null plan is still the old build/T-2 stage object (raw4350–4377). This is an outside-task file/path, not a demonstrated regression caused by database isolation. The test waits for the replacement task.view request to become ok at199, then asserts the plan at200; whether the defect is stale projection invalidation or an insufficient observation boundary remains unproved. No task with this exact signature was found in a targeted task-file phrase search. Treat as Bugs/S for lead classification, not an automatic new duplicate ticket.
No new owned source findings: narrow account-poller guard passes (438). Both new restart cases pass5.759/5.796s (451–452) and5/5 (280/330); doctor isolated DB/login warning passes3.701s and5/5 (994/1106). Earlier M1/M2 guard/budget corrections are effective.

## Spec
Real P3 cleanly skips absent opencode on this image, with five reasoned prerequisite skips; prior accepted non-skipped Mac P3 evidence remains. Source C2–C5 stand at991d1c86. C1 final gate remains pending, with no false criterion failure inferred from the unrelated planned-epic assertion.
Primary Coordinatoreefc3ad2 requires the new droplet receipt to reach Neovim green and lists specific known reds. This unknown signature is not in that disposition, and Neovim was not reached. Do not treat the receipt as final clear or automatically invoke a two-known-failure gate. Earlier A-3703 contains owned blockers and is historical, not a substitute green phase.
Impl fb922068/A-3734 already escalates exact signature and missing phase to lead T-296, with no retry/head mutation. Await classification and explicit next gate direction; no new run requested by Reviewer. If source changes, obtain delta review before verification. Rule13 remains Coordinator's merge/rollout action.

Evidence verdict not clear; no new or failed criterion marks. Counts: high0,medium1 outside runtime blocker,low0; owned Standards0/Spec0 new source findings. Provider lifetime/cost are reported unknown in the receipt rather than invented. No Reviewer execution, edits, provider operations or subagents.

Artifact A-3735 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3735-t-296-corrected-linux-not-clear-outside-legacy-plan-assertion-and-missing-neovim.md

### rev-30 · 2026-10-16T05:54:00.087Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-296-final
commit: 991d1c86a7e599c0104d50d23bb8a56122bc9447
scope: evidence

# T-296 final evidence clear at 991d1c86

Head991d1c86a7e599c0104d50d23bb8a56122bc9447; branch t/T-296-opencode-servers-get-their-own-database. Origin ref and fresh A-3760 receipt match exactly. Source chain A-3486/A-3492/A-3676/A-3716 applies; no further head movement or T-574 pick. Current task.view confirms all five claimant criteria done.

## Standards
No unresolved high, medium or low findings (0). Corrected passive-literal architecture guard passes (A-3760:437); owned restart budget entries preserve assertions and5/5 proof. Prior outside legacy-plan red T-574 is not recurring here. Known-entry duration-regression notices are not hard failures; final exit0. No declined/queued/cancelled receipt is counted as execution evidence.

## Spec
C1 final verification is now established with the originally accepted real-binary P3 Mac proof and qualifying task gate; C2–C5 refreshed at this head.
C1 real P3 evidence remains A-3474 (non-skipped real2.0.24 case1/1) and A-3674 (non-skipped isolation proof1/1 after authorized merge). Source A-3486 audited its positive default-service sweep control, isolated cland provider/conversation exclusion, no duplicate cland request, retained active cland server, explicit scratch environment and writer teardown. Linux lacks real opencode and permits the criterion's explicit platform skip, including5/5 reasoned prerequisite skips at A-3760:2110. That skip is disclosed, not described as a Linux real-binary P3 pass.
C2/C3 supporting current Linux observations: unassigned XDG/HOME restart/relaunch5.486/6.288s (450–451), both5/5 (280/330); named accounts/inherited selector/drop and saved launch environment assertions remain in the reviewed whole file. Source still selects dedicated persistent per-user database, honors explicit registry accounts and reuses recorded environment rather than current ambient settings.
C4 doctor isolated DB/standalone login/default-db warning passes3.583s and5/5 (1108/1255); merged version policy remains the separately reviewed incoming T-533 integration. Earlier scratch free-model experiment is scoped to its recorded version/environment, not a new general promise. C5 corrected README exact-login guidance is unchanged.
Old sessions are not silently migrated and explicit registry default-db choices retain the documented warning; those accepted rollout/spec choices remain from the source chain.

A-3760 /886b41a2-3cc1-4986-823e-03db3ea5214f actual Linux x64 6.8.0-142-generic,c-8lon1 cland-v0-827cba5c,Nodev24.21.0,Neovimv0.12.5,fourworkers. Diff-selected hub-only package gate1905tests/1900pass/0fail/cancel/5platform skips. Hub free38/38, hub machine1850pass/5skip, Neovim smoke12/12. Both typechecks and all selected phases complete; requested Neovim green phase is now supplied, without falsely claiming a full Neovim package run. Suite1505.86s,peak1m15.01,extra11.86s;final exit0 at6205. Lifetime/cost remain unknown as reported.
Primary Coordinator6d9e926d-0219-455f-9390-22d74433e1ca, independently read in topic-336, accepts previous own hub proof and authorizes this single unchanged-head retry to reach Neovim; no shared fix is required now that the receipt is green. No known-red exception or further run is needed.

Final evidence clear, C1–C5 verified. No per-item QA. Rule13 retirement and checking old default-database sessions/fresh launches remain Coordinator merge/rollout actions; this verdict neither performs nor prematurely retires that rule. Further source movement requires delta review.
No Reviewer tests/compiler/binary execution, edits, model/API/provider calls, signals, installs, commits, merges or subagents. Totals Standards0,Spec0 findings.

Artifact A-3761 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3761-t-296-final-clear-linux-gate-and-neovim-smoke-green-real-mac-p3-retained.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
