---
id: T-1220
kind: task
title: A session's shell identity is not bound to a per-session credential
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - bug
  - security
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-952
branch: t/T-1220-a-session-s-shell-identity-is-not-bound
created: 2026-10-24T09:32:51.634Z
updated: 2026-10-24T14:28:02.592Z
---

## Summary

Found by impl-1219 while answering T-1219's C3 (2026-10-24 09:32Z; evidence artifact in topic-951). CLI calls from a session's shell authenticate to the hub with the project-wide discovery secret. The session identity they then present (name, id, role) is taken from environment variables and is not checked against a per-session credential such as the launch token. So a process running in one session's shell can act as another session, and a shell that presents no identity acts as the human. The second part is already documented behaviour.

Trust model today: every session runs as the same OS user on one machine. This gap matters because cland's guardrails (role permissions, the rule that a peer message is never the human's approval, verdict authorship, merge rights) assume each session acts only as itself.

## Acceptance criteria

- [x] C1. A shell CLI call is attributed to a session only when it presents that session's own per-session credential; a call presenting another session's identity is refused, shown in a sealed real-hub test.
  - done: impl-1220 · 2026-10-24T10:13:17.395Z
- [x] C2. A shell that presents no session identity keeps acting as the human, as today (human decision, General 2026-10-24 09:35Z, answer to ask a4e7c1e1); docs state this, and a test pins it.
  - done: impl-1220 · 2026-10-24T10:13:17.528Z
- [ ] C3. Harness adapters (Claude Code, Codex, OpenCode) deliver the credential to their own shells only, and docs describe the trust model.
  - failed: rev-31 [reviewer] · 2026-10-24T14:28:02.592Z · note Configured f5a08d89 exits1 on native launch-publication/account-limit assertion; later mappedT4/Web absent. C1/C2 partial passes do not settle required harness cover.

## Comments

### impl-1220 · 2026-10-24T10:13:17.993Z

Implemented and pushed fbedaf44f94eb0e79340ef1b7496603aec3d8ac9. Session claims require their own credential before client dispatch. Legacy tokenless shells migrate on own MCP reconnect after the shipping restart without relaunch; relaunch rotates, archive removes private files. C1–C3 done. Evidence and exact local-test limitations: A-10724. Includes T-998/T-1219 from dev 63e0e0b0. Requesting full source review before mode-free verification; no per-item QA policy/brief.

### impl-1220 · 2026-10-24T10:15:42.264Z

Source-review head updated to 9585983c200b14bbb15514e1a9d0ad9b30e12532 before a source verdict: legacy reconnect now retains the existing own-spoke launch token when the old database has no credential table, avoiding invalidation of already-tokened shells. The new raw upgrade regression went red then green; all 8 credential tests pass locally. Tokenless Coordinator migration remains green. No dev merge after review request.

### impl-1220 · 2026-10-24T10:18:06.471Z

Reviewer M1/C3 fixed at 54ce12850efe27c2aacd40d3e57978d9fc954ddd: all three new guides now use exact repository test-path headings. Existing test-docs guard reproduced the failure, then passed 3/3 locally. Docs-only delta from 9585983c; waiting for consolidated source verdict before verification.

### rev-23 · 2026-10-24T10:24:29.755Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1220-source
commit: 54ce12850efe27c2aacd40d3e57978d9fc954ddd
scope: full
findings: [{"severity":"medium","text":"M2: synchronous credential write/removal runs on shared serving-time hello/resume/archive paths. Use asynchronous owned lifecycle I/O and public held-I/O/no-sync regressions while preserving welcome readiness and drain-before-removal.","file":"shared/session-credential.ts","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1220 full source review — not clear

Current requested head54ce12850efe27c2aacd40d3e57978d9fc954ddd/tree2fa6e91879d18fb55ee6dbe12516fe77fdc9c87b, origin task ref matches. Full fixed-base comparison git diff63e0e0b0...54ce1285, including original fbedaf44, migration9585983c and guide54ce1285 deltas.111 affected paths principally explicit existing authorization-fixture migrations. Run rev-20261024-1220-source, scope full. Standards/Spec axes in-session under crew.reviewer.subagents=false. Remaining finding M2 only; M1 resolved before this consolidated verdict.

## Standards

M2 (medium), shared/session-credential.ts:27 and hub/src/adapters/sessions.ts:350: writeSessionCredential uses mkdirSync/chmodSync/writeFileSync/renameSync/rmSync; removal uses rmSync. They run from accepted serving-time hello/reconnect through HubCore.#provisionShellCredential, shared resume and session archive/sweep. These are hub request/lifecycle paths, not CLI-local reads or the explicitly separate native adapter spawn filesystem boundary. hub/README.md Request-path guard and tracker-native-boundary.test.ts require asynchronous filesystem work on shared tracker/launch/request paths, rejecting even caught synchronous boundary calls. A reconnect now performs several blocking filesystem operations before welcome, and archive can block the event loop on recursive removal. Move hub writing/removal into asynchronous per-session owned lifecycle work, preserving credential-ready-before-welcome, stop/drain-before-remove and current identity/eligibility before publication; add a held-I/O/no-sync public regression. The CLI-local fallback reader can remain separate. Implementer b54f1519 confirms M2 and is preparing that correction.

M1 resolved: all three new indexed guides now use exact repository test-path headings (Claude environment, cli-session-credential, task-migrate). Existing guard failure reproduced locally and3/3 corrected pass reported at this docs-only head; bodies/index retained. Earlier generic headings would fail existing T1 test-docs guard; they are not remaining findings.

Other reviewed test changes: most paths alias only the explicit authenticated authorization fixtures; helper provisions synthetic session authority in owned disposable stores, and revised non-import hunks supply owned root/store/credential setup before existing permission/lifecycle assertions. Unknown unauthenticated callers now fail at credential admission rather than later permission checks; identity-free controls remain. Raw credential admission and native OpenCode contracts bypass wrappers. New raw CLI test is declared T2 and uses projectHub/fake harness/real CLI; native OpenCode remains its existing lifecycle tier. Existing final assertions are retained, including no refused writes, no leaked token text, isolated session jobs and re-exec PID/role/claim continuity. No new direct process/sleep or workload/cap relaxation. Updated shared fixture credential allowlist is explicit; regular credential/account/environment sealing remains. Whitespace check clean.

## Spec

No additional functional finding beyond M2's hub delivery/lifecycle implementation. Admission validates session claims before replay, audit, permissions and mutation. Stable session id controls attribution before name; the stored credential is compared without exposing it, role comes from hub state, identity-free/unknown human labels retain existing human behavior. Credentials are private in store and excluded from views/audit argument summary. Actor-free authenticated handshake replaces offline migration's actor-bearing status probe. Shell reader uses explicit environment credential first, never falling back after an invalid or empty explicit token; otherwise reads only private regular owner-matching session-id-bound fallback. Hash-derived session directory prevents identity path traversal.

Coordinator b1aaffa6/92c8a2f5 explicitly requires own-spoke reconnect migration without relaunch, and limits the threat model to casual/accidental cross-session use under one OS user. Same-user deliberate impersonation and identity-free human shells remain documented, not represented as OS isolation.9585983c repairs the implementer's discovered migration edge: accepted own reconnect adopts its existing launch token only when the durable credential is absent; retained/rotated credential wins. The added old-store/no-table plus existing-env regression covers that path. Tokenless Coordinator restart/reconnect case remains. Relaunch carries rotated authority through adapters, ordinary resume/PID replacement preserves it, archive removes private run directory. Claude places shell/MCP config in private files rather than argv; Codex/OpenCode receive owned environment values, with native contract coverage. Actual asynchronous persistence/cleanup correctness is still required by M2.

Rule16 docs/help/shared protocol and wire actor shapes, issue-tracker trust boundary, implement skill plus CHANGES were updated; no role-grant expansion. C2 identity-free behavior is implemented and tested in source, but exact-head runtime settlement remains pending. C1/C3 sealed runtime proofs also remain pending.

## Evidence and disposition

A-10724 is a local macOS arm64 summary: initial raw7, Codex12, OpenCode15, archive13, component resume4, check exit0; initial75-file sweep was partial with failures/interrupted waits, not full-suite evidence. Replacement reports raw8/check pass and guard3/3; no complete original stdout/native exit/timing/source bundle audited yet. Requested durable original and necessary correction receipts without transcription reruns. Do not upgrade summaries or partial sweep to a pass. No configured run submitted.

C3 failed for M2; no other criterion is verified by this source verdict. Complete remaining set M2 only. Correct/commit/push and request fresh full source review before configured mode-free verification. No dev merge after first review absent Coordinator direction. Local stage cover now holds capacity; respect cover-quiet refusal and wait or use an explicitly authorized remote targeted route. Reviewer performed static source/Git/artifact inspection only; no tests/probes/install/edits/Git mutation/browser/delegation. Standards one medium remaining; Spec zero additional findings.
Durable review A-10740.

Criteria: C3 failed (Hub hello/resume/archive credential writes/removal use synchronous filesystem work; require asynchronous owned persistence and credential-ready/cleanup ordering.).

### impl-1220 · 2026-10-24T11:00:21.487Z

M2 correction pushed at 241701ab8f5e50fe523bf903684e694e94ca06a2. Async per-session persistence/removal is owned and drained; welcome waits for readiness, rotation precedes native relaunch, archive follows stop and drains writers before removal/publication, production closure awaits owned I/O before table close. Four exact-source regressions red 0/4 at sealed 54ce1285, green 4/4 on corrected tree; affected targeted files and daemon 18/18 pass locally on macOS arm64. npm run check exit 0, lint report mode 133 findings/60 files, zero refusals. A-10779 preserves original raw receipts, intermediate failures and native source envelopes; A-10742/A-10754 retain prior partial sweep evidence. No dev merge after first source review. Requesting fresh full source review; no verification submitted.

### rev-31 · 2026-10-24T11:11:17.138Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1220-source2
commit: 241701ab8f5e50fe523bf903684e694e94ca06a2
scope: full
findings: [{"severity":"medium","text":"M3: credential persistence introduces an await before native relaunch without rechecking the caller's dynamic permission. Private #resume drops authorize; resumed only times work. Recheck after held persistence and in native authorization, with a revoked-grant public-frame regression.","file":"hub/src/adapters/sessions.ts","line":1316},{"severity":"medium","text":"M4: reserveLaunchRole occurs before credential provisioning, but await provision lies outside resume failure settlement. A credential I/O rejection leaves the durable launch/role reservation; include preparation in rollback and prove faulted-write cleanup and subsequent admission.","file":"hub/src/adapters/sessions.ts","line":1283}]
finding_counts: {"high":0,"medium":2,"low":0}

T-1220 full corrected source review — not clear

Reviewed 241701ab8f5e50fe523bf903684e694e94ca06a2, tree 8a205ef9369fa7125d0539536b1bb659332fb15d. Origin task ref matches; task worktree is clean. Fixed base 63e0e0b0f7fecb5964ac9a2333e3e8bec1635f1a; 126 changed paths. Carried rev-23's full original-security audit A-10740 and independently inspected credential admission, migration, adapters, actor/wire fields, raw CLI tests, and the complete async correction. Standards and Spec reviewed in-session, without delegation or execution.

Remaining findings

M3 — medium — hub/src/adapters/sessions.ts:1316 (also 1309–1313).
Recheck the calling session after credential persistence and before native relaunch. Public resume passes the dispatcher's dynamic authorize callback, but calls private #resume without it. Private #resume awaits provision(), then checks only #closed/account limits before adapter.resume; its adapter authorize callback checks only account limits. Resumed is RequestGuard timing, not authorization. Thus a valid Coordinator CLI relaunch of a stopped target can be held in credential rename, have its session.resume grant/role revoked while held, and still enter the native adapter after release. The new asynchronous wait introduces this window even when the target was already stopped. Pass the dynamic authorization through this boundary and subsequent native authorization callbacks; re-read current target/role where needed. Add a public-frame held-rename regression: admit under the grant, await the exact held write, revoke, release, assert forbidden and zero native resumes, retaining the existing positive persistence-before-resume proof. This is a static control-flow finding, not an executed reproduction.

M4 — medium — hub/src/adapters/sessions.ts:1283 and 1316–1323.
Credential preparation failures bypass relaunch rollback. A stopped session with a role calls reserveLaunchRole, which durably writes the role and reservation. await provision() is outside the try/catch that settles unsuccessful resume, and outer resume finally releases only the lifecycle slot. An asynchronous mkdir/write/rename failure therefore rejects the request without releaseLaunchRole/role restoration, leaving a durable pending launch reservation even though no adapter was entered. Synchronous throws before the adapter promise and shutdown-aborted provisioning take the same exit. Put the whole reserved preparation/native-entry phase under owned rollback, preserving the original error and credential-safe diagnostics. Add a faulted credential-write regression asserting no native launch, no residual reservation/role ownership introduced by the attempt, released lifecycle, and successful subsequent admission. This is a static error-path finding, not an executed reproduction.

Resolved/carried

M1 remains resolved: new guide headings use exact repository test paths and index rows exist. M2's synchronous serving-path filesystem work is removed: fs/promises persistence/removal, per-stable-id serialization, welcome and queued delivery behind readiness, archive drain/remove/publication ordering, lifecycle exclusion of resume, and awaited shutdown before table closure. All production closure callers inspected await the drain. Archive refreshes identity/eligibility before publication; CLI-local fallback reads remain separate. No remaining synchronous credential-write/removal finding.

The original accepted security design remains: session claims are checked before replay/audit/permissions/mutation, stable id and stored role control attribution, explicit invalid/empty environment tokens never fall back, own-ID private fallback files migrate existing shells on accepted own-spoke reconnect, existing tokens are retained when old storage is absent, relaunch rotates, archive removes private settings. Identity-free/unknown human labels and deliberate same-OS-user bypass remain the explicit human-approved trust model, not OS isolation. Claude uses private settings paths instead of token argv; Codex/OpenCode receive owned environment credentials. Authorization fixtures are explicit synthetic owned-store authority; raw admission/native contracts bypass them. Matching docs/help/skill provenance and additive wire actor fields are present.

Evidence

A-10779 original records SHA256 4047193a0da756fbf7f2f7fa5c7bea7466a696736def78226f3b9724c2f4fc5e matches provenance. Exact committed four-case regression SHA256 35274f301ca44320b57faa3b7eb80d9cad740001fd6ad9ce0667a60d1b8dfcfc matches both receipts. Sealed 54ce1285 + regression: exit 1, 0/4, early-welcome/early-result and missing writer receipt. Correction working tree later committed unchanged: exit 0, 4/4, native cases 42.436/24.509/20.958/21.031 ms, runner 418.002 ms, process wall 444 ms. These prove successful-I/O ordering, not the revoked/faulted cases above.

Retained local Darwin arm64 Node 24.21 receipts include raw credential 8/8, native-boundary 29/29, daemon 18/18, lifecycle 6/6, archive 13/13, name reservation 67/67 and other affected targeted files. Check exit 0 (27935 ms process wall), lint report mode 133 findings/60 files, zero refusals; docs guard 3/3. These are accurately labeled correction working-tree receipts, not exact-commit reruns or configured-suite evidence. A-10742/A-10754 keep earlier partial failures/truncations; no broad sweep green inferred. Existing role-skill scan was separately filed T-1230 by Coordinator; fixedRoles I/O guard exempts no Sync export. No runtime executed by Reviewer.

Disposition

Complete remaining source finding set M3/M4. C3 fails for relaunch authorization/rollback lifecycle gaps; C1/C2 remain pending exact-head runtime settlement. Correct and push, restore claimant marks, then request fresh full source review before configured mode-free verification. No post-review dev merge absent Coordinator authorization. No merge enqueue or QA/T3/T4 claim.

Durable review A-10804.

Criteria: C3 failed (Async relaunch must recheck caller authority after persistence and roll back role reservations when credential preparation fails.).

### impl-1220 · 2026-10-24T11:20:23.548Z

Pushed 923b23887eb3910eda86aa5691c5547db87a5bb7 for remaining M3/M4. Dynamic caller authorization reaches private resume, credential preparation completion/native entry and adapter callbacks; current target row is reread. Reserved stop/preparation/native-entry failures share settlement; pre-native failure is rethrown after rollback without a false exited publication. Closure drains lifecycle settlement before closing tables. Seven credential lifecycle cases pass with original test-first failures retained in A-10824; affected local macOS arm64 files pass (lifecycle6, reservation67, component resume4, account10, archive13, raw CLI8, native boundary29, daemon18, docs3). Check exit0, report-only lint133/60, zero refusals. No configured-suite claim or dev merge. Request fresh full source review before mode-free verify.

### rev-31 · 2026-10-24T11:21:48.776Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1220-source3
commit: 923b23887eb3910eda86aa5691c5547db87a5bb7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1220 full source review — clear

Head 923b23887eb3910eda86aa5691c5547db87a5bb7, tree 2b2dd47cd6233d8efde152c217211150116b42c3. Parent 241701ab8f5e50fe523bf903684e694e94ca06a2; no dev merge. Origin ref matches; clean task tree; fixed-base whitespace check clean. Scope full after correction, carrying original security review A-10740 and independent full corrected review A-10804. Both Standards and Spec axes reviewed in-session; no subagents or execution.

Standards: zero remaining findings. M1 canonical guide/index contract and M2 asynchronous per-session I/O ownership remain resolved. This correction changes only sessions.ts, the existing T2 I/O regression file, its indexed guide and hub README. No changed tier, baseline, allowance, workload, assertion relaxation or role grants.

M3 resolved: outer resume passes dynamic authorize into private #resume. authorizeResume checks shutdown, the caller's current grant and the current target row/account; it runs before queued credential storage and again after awaited persistence immediately before native entry. Native resume callbacks receive the same dynamic authorization; explicit stop receives it too. Resumed remains timing, not a substitute for authorization. The public fixed-role socket regression holds the exact rename, revokes the Coordinator's role, then asserts forbidden, zero native resumes, stopped target and no durable reservation.

M4 resolved: stop/preparation/native-entry now share failure settlement. Errors before native entry, AccountLimited and ToolForbidden release the attempt's role reservation and rethrow the original error; they do not falsely publish an OS exit. Existing native recovery handling remains. Sessions.close drains lifecycle tails as well as credential I/O/archive work, and production table/storage disposal awaits it. Faulted-rename test inspects durable reservation plus public role ownership, preserves stopped state, confirms no pending cleanup, then proves subsequent resume admission. Shutdown test holds preparation, closes project sessions, releases it, requires refusal and zero native resumes, waits for disposal, then inspects the durable database for no residual role/reservation. Existing four success/readiness/drain proofs remain unchanged.

Spec: zero additional findings. Original session credential attribution, explicit environment precedence, private fallback/migration, adapter-owned credential delivery, rotation/cleanup and human-approved identity-free single-user trust model are unchanged. Current source meets C1–C3's implementation requirements; final criterion verification remains dependent on the configured exact-head runtime result. Prior source failures are not represented as runtime passes.

Evidence audited: A-10824 original records SHA256 79f85371a215074cb81b1e6f6066b09a766cb415ecec7dbb08b781b086eed8a7 matches provenance. Committed seven-case source SHA256 f95885d0d4ed56c28c00c305e8b0857ba4a0dafcfedb2bdf679aef37c68bb9af matches provenance. Original M3 red was undefined versus forbidden; M4 red retained worker/implementer reservation versus []; intermediate shutdown red returned true versus false. Final seven-case correction working-tree receipt exit 0, 7/7, zero failures/skips/cancellations: original positive cases 687.497/26.062/21.786/25.522 ms; revocation 22.273 ms; fault/retry 19.949 ms; shutdown 17.997 ms. Native runner 1201.403 ms, process wall 1230 ms. Test source and production were then committed unchanged; these are not exact-commit reruns.

Other retained Darwin arm64 Node24.21 targeted receipts: lifecycle6, name-reservation67, component-resume4, account-limited10, archive13, raw CLI8, native-boundary29, daemon18, docs guard3, all exit0. Final check exit0, process wall34560ms, lint report-only133/60 and zero refusals; intermediate TypeScript result annotation failure retained before corrected cast. A-10779 preserves previous M2 proof; A-10742/A-10754 retain partial original sweep/failures/truncations. No full suite, Linux, QA or latency-gate inference.

Clear source at 923b2388, findings []. C1–C3 remain unverified until ordinary configured mode-free verification at this exact clean head. Implementer may submit that run, route its result here, and preserve head. Local cover quiet remains in effect; no local targeted reruns. No dev merge absent Coordinator instruction; enqueues currently held by Coordinator. Reviewer performed only read-only source/Git/artifact inspection.

Durable source review A-10826.

### rev-31 · 2026-10-24T11:33:03.063Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1220-evidence1
commit: 923b23887eb3910eda86aa5691c5547db87a5bb7
scope: evidence
findings: [{"severity":"medium","text":"M5: twelve existing fixture cases hit missing/invalid session credentials before their intended permission/behavior assertions. Complete explicit owned-authority fixture migration without weakening admission or negative tests.","file":"hub/test/artifact-delete.test.ts","line":18},{"severity":"medium","text":"M6: configured archive workload fails indexed shared-item timestamp lookup contract, actual 2 versus expected 1. Preserve async freshness and bounded query work; diagnose and fix without raising caps.","file":"hub/test/inbox-workload.test.ts","line":113},{"severity":"medium","text":"M7: two cross-flavour progress integration cases fail: held progress injects 1 versus 0, and uncertain digest is undefined versus ['old progress']. Establish exact async setup readiness while retaining final delivery/membership assertions.","file":"hub/test/progress.test.ts","line":68}]
finding_counts: {"high":0,"medium":3,"low":0}

T-1220 configured evidence — not clear

Exact source-cleared head 923b23887eb3910eda86aa5691c5547db87a5bb7/tree 2b2dd47cd6233d8efde152c217211150116b42c3, source A-10826. task.view confirms failed finished run 66921553-ae31-456c-8fd1-b99fd65ecb00, original log A-10836. This evidence verdict does not reopen resolved M1–M4; it records three remaining integration groups exposed by the configured run.

Actual failures before classification

M5 — medium — hub/test/artifact-delete.test.ts:18 and other authenticated fixtures.
Artifact-delete expected /only the human/, but actual was: session "coord" credential is missing or invalid; reconnect this session's own MCP spoke to provision its shell credential, or resume with --relaunch (A-10836 lines13394–13408). Demo-cap actual qa-demo credential refusal/false versus true; epic-close's two cases actual qa-demo credential refusal and CLI exit1 versus0. Six skills-onboarding cases actual onboarding-aide credential refusal/exit1 versus0; two verdict-criteria cases actual rev/qa-1 credential refusals/exit1 versus0. Total12. Static spot checks confirm raw fixture actors/CLI identity claims without their own credential, e.g artifact-delete line18, demo-cap lines28–33, skills-onboarding lines123–126 and verdict-criteria lines42–43. Complete the explicit owned-authority fixture migration while preserving each downstream permission/behavior assertion and the raw negative credential tests. Do not relax production credential admission or replace assertions with generic refusals.

M6 — medium — hub/test/inbox-workload.test.ts:113 / shared archive sweep.
"one indexed item timestamp lookup for a shared item", actual2 expected1 (log13465–13478). The asynchronous archive implementation re-reads shared item timestamps at publication; that necessary freshness must retain the existing bounded-query contract. Diagnose/fix at the indexed cache/revalidation seam, retaining current eligibility and bounded-work assertions. Do not raise the workload cap merely to accept this run.

M7 — medium — hub/test/progress.test.ts:68 and153.
"held progress starts no native input", actual1 expected0; uncertain digest actual undefined expected ['old progress'] (log13482–13518). The cross-flavour fixtures use presence as setup before recording injection membership. Diagnose the new async welcome/initial-input readiness boundary and establish its exact bounded setup receipt; preserve final no-input, digest membership, uncertain retry and delivery assertions. This evidence identifies failing integration, not a proven independent product defect. Implementer0fce47ba independently identifies the setup race and plans a correction.

Run accounting

Configured mode-free auto exit1. Host T0 exit0,52.041s. T1 exit0,envelope58s,actual suite54.23s; all-T2 fallback was selected, T2 exit1,envelope258s,actual suite254.55s. The structured finish records contain2313 ordinary tests:2298pass/15fail;80 distinct load-gate test passes are separate. Thus completed-before-interruption2393/2378pass/15fail includes those80 repetitions; do not confuse the two accounting scopes. No ordinary skips reported.

The eight raw CLI credential cases and seven I/O/authorization/rollback cases each passed ordinary execution and five distinct load-gate repetitions with explicit5/5 receipts. This supports those focused behaviors, not final readiness. Raw CLI ordinary times1.124373/.392754/.631002/.718399/.382460/.454347/.268416/.338588s; seven I/O ordinary times.101388/.045550/.046666/.047338/.086913/.067800/.050066s.

Changed T3/T4 selection and mapped inbox-verifier-load guard were planned, but no T3/T4 or Web phase completed. Their table projections/zero observations are not execution receipts. No native harness/QA/all-tier cover claim. Host typecheck marker7843ebd9acb96e7acf32ca0f7d1932c7115dadb0 was not repeated remotely. Lint133/60 and listed generic budgets/ratchet remain report-only; these15 assertions, not report warnings or capacity, caused failure.

Executor Linux x64 6.8.0-142-generic, c-8 lon1, cland-v0-bfce446e, Node24.21.0/Neovim0.12.5, workers2, lifetime406s,cost$0.0282. Machine fsync8.81ms/SQLite9.59ms,iowait.01%,steal.01%; no capacity/infrastructure classification inferred.

Disposition

C3 failed for incomplete authorization fixture migration and asynchronous archive/progress integration. C1/C2 remain unverified in tracker pending final configured settlement. No unchanged-head retry: correct, preserve original diagnostics/source receipts, commit/push, restore claimant done mark and request fresh full source review before mode-free verification. Local cover quiet holds: no local test execution until release. No dev merge or enqueue absent Coordinator instruction. Reviewer inspected only source, Git and original logs; no tests executed.
Durable evidence disposition A-10839.

Criteria: C3 failed (Configured run fails 15 T2 cases: missing fixture credentials, archive query-count regression and progress async setup failures; later phases incomplete.).

### impl-1220 · 2026-10-24T11:42:17.075Z

Pushed 26b52798324645e764efc8e46f871330b94a4616 after failed run66921553 (A-10836/A-10839). M5 authentication-fixture omissions, M6 redundant archive lookup and M7 progress setup corrected with all original final assertions retained. Coordinator's complete12-case (a)/(b) classification is in A-10847. Six onboarding cases use raw tokenless ID/name CLI after own-spoke readiness, not synthetic tokens; added fresh Aide first-CLI/tokenless-after-welcome proof. Archive uses event-updated cache during I/O and a new held-removal reopen case. Check passed locally Darwin arm64, report lint133/60, zero refusals; native test execution at this new head is pending while cover quiet holds. Requesting fresh source review before configured verification; no dev merge.

### rev-31 · 2026-10-24T11:44:14.469Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1220-source4
commit: 26b52798324645e764efc8e46f871330b94a4616
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1220 full corrected source review — clear

Reviewed 26b52798324645e764efc8e46f871330b94a4616, tree 732c3f1079f61d4ca15b069cb044e10abced475f, parent923b23887eb3910eda86aa5691c5547db87a5bb7. Origin task ref matches; clean tracked tree; fixed-base whitespace check clean. No dev merge. Scope full after M5–M7 correction; carry independent security/lifecycle review A-10826 and failed configured evidence A-10839. Standards and Spec reviewed in-session without subagents or execution.

Standards: no remaining source findings.
M5 correction enumerates all12 credential refusals. Artifact-delete opts into authenticated sessionUi; epic-close and verdict-criteria use authenticated sessionCland for known --as claims. Existing sessionClient now attaches owned synthetic authority to send as well as request, repairing demo-start's raw-send bypass. Explicit credentials remain untouched, identity-free actors unchanged, provisional IDs are not adopted, and production admission is unchanged. Existing downstream permission/lease/verdict/readback assertions remain.

The six onboarding cases deliberately avoid synthetic credentials: an owned Aide spoke has stable ID/name and an awaited own who round trip; raw CLI calls pass ID/name without a token and read the real fallback file. The fake-GitHub child environment remains intact. This corrects incomplete name-only fixture setup, not a production fallback bypass. Raw credential-admission tests retain unwrapped harness clients. New fresh-Aide case obtains its actual own fake-adapter launch token, asserts no fallback exists before its first raw CLI, then connects its own spoke, awaits readiness, checks0600, repeats a tokenless CLI, and verifies both comment authors plus no token in logs. Existing Coordinator upgrade/no-token and old-env-token migration proofs remain.

M6 source correction replaces unconditional post-removal closedAt reads with event-refreshed tracked timestamps. The existing tracker listener updates a cached close timestamp synchronously on relevant item changes and schedules/coalesces another sweep. After awaited removal, sweep still re-reads current process, pending-stop/running/archive eligibility, item association and deadline using the current cache. New item identities still get an indexed lookup through archiveDue. The one-lookup workload assertion is unchanged. New fake-clock component test prearms a removal hold, reaches the due boundary, reopens the item while I/O is held, releases, awaits sweep completion, then checks unarchived/visible state. The due item and stop interval are explicit. No query cap or workload relaxation.

M7 source correction awaits receiving-spoke who readiness, then arms a bounded initial hub-input injected-stage observer before fake idle. The measured injection mark follows that setup. Original zero-extra-input, digest membership, uncertain retry and final delivery assertions remain across all flavours. Presence alone is no longer the readiness boundary. New indexed guides have exact test-path headings and existing target files; source inspection confirms index membership.

Spec: no additional findings. Credential protocol/adapters/private file validation, own environment precedence, migration, rotation, async persistence and owned shutdown from prior clear source remain unchanged. The only production delta is archive timestamp cache maintenance. M1–M4 remain resolved. Same-user identity-free human behavior stays the human-approved trust boundary, not OS isolation.

Evidence and limits
A-10847 retains original check outputs and the twelve-case classification. First check exit1 was TS2345 at session-credential-fixture frame typing; corrected generic frame shape check exit0, Darwin arm64 Node24.21.0, process wall51138ms, report-only lint133/60, zero refusals. Two explanatory documentation sentences followed check; no exact-commit check rerun claimed. New runtime tests were intentionally NOT executed under active local stage-cover quiet. No red/green pass is invented for this correction.

Prior configured66921553/A-10836 at923b2388 remains failed:2313 ordinary tests2298pass/15fail plus80 actual repetition passes; T0/T1 completed, T2 failed, changedT3/T4/Web incomplete. Its focused8CLI+7I/O ordinary and5/5 groups remain historical support only. This source clearance does not turn that receipt green or verify current-head runtime criteria.

Disposition
Clear source at26b52798, findings[]. All C1–C3 remain pending configured exact-head runtime settlement. Restore/retain claimant done marks, submit ordinary configured mode-free verification at this unchanged clean head, route result here. Droplet runs are unaffected by current local cover quiet; do not start local targeted tests until cover release. No unchanged-head retry of the historical failure, unauthorized dev merge or enqueue. Reviewer performed read-only source/Git/artifact inspection only.
Durable source review A-10855.

### rev-31 · 2026-10-24T11:54:20.930Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1220-evidence2
commit: 26b52798324645e764efc8e46f871330b94a4616
scope: evidence
findings: [{"severity":"medium","text":"M7 remains: both new setup observers time out at15000ms. roleInputInjected searches agents topic history, but #recordClause's hub notice has no topic. Observe its exact recipient/delivery at the actual public seam, preserving original digest/no-extra-input/retry assertions.","file":"hub/test/progress.test.ts","line":13}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1220 replacement configured evidence — not clear

Head26b52798324645e764efc8e46f871330b94a4616/tree732c3f1079f61d4ca15b069cb044e10abced475f, source clearance A-10855. task.view confirms failed finished configured mode-free run2eebda38-6164-4d0d-8968-959112e8094c/A-10866.

Remaining M7 (medium), hub/test/progress.test.ts:13–19,75,161:
Both progress cases now fail the new setup observer: "Error: initial role input injected before digest measurement: not within 15000 ms". Case durations15.134129429s and15.104221117s. The observer queries topic.history for agents, then requires a hub initial role notice there. HubCore.#recordClause constructs that notice with from:'hub'/to:[recipient] but no topic, so the observer cannot find its required message in agents history. My source4 review accepted the setup ordering but missed this topic/notice mismatch; the configured result establishes that it is not a usable receipt. Implementer291ec336 independently confirms the same source diagnosis. Observe the exact recipient's notice/delivery identity at its actual public seam; arm before the idle/input trigger and retain all original zero-extra-input/digest/uncertain-retry assertions. Do not increase timeout or add a duration allowance to mask this setup failure.

Resolved integration evidence:
M5's files now pass ordinary execution: artifact-delete4/4, demo-cap2/2, epic-close15/15, onboarding13/13, verdict-criteria4/4. This includes all12 prior credential refusals. Raw credential admission9/9 plus45 load passes; I/O7/7 plus35 load passes. Archive14/14 plus5 load passes, including reopened-item eligibility ordinary.345959134s. One-lookup archive workload ordinary.364281442s passed. M5/M6 corrected; no remaining failure classification against those changes. Other than M7, no new source finding inferred.

Run accounting:
Structured ordinary finish records2315tests:2313pass/2fail, no skips.90 actual load-gate passes separate. Completed-before-interruption2405/2403pass/2fail includes those90 repetitions. HostT0 exit0,envelope37.964s; T1 exit0,envelope59s/actual55.09s; all-T2 fallback selected, T2 exit1,envelope279s/actual274.95s. ChangedT3/T4 and mapped T4guard were selected but unexecuted; Web unexecuted. Planned file counts/projections/zero observed tests do not establish passes. Host typecheck tree marker8b0917bb17ccdff2c4b034e004117fe93c32cda8 was not repeated remotely.

Linux x64 6.8.0-142-generic, c-8 lon1 cland-v0-960286bb, Node24.21.0/Neovim0.12.5, workers2, lifetime431s,cost$0.0299. fsync8.6ms/SQLite10.04ms/iowait.01%/steal.02%. Budget/lint reporting remains report-only133/60; the two actual setup timeout errors caused this failure. No capacity, shared-defect, native-harness, QA or all-T3/T4 classification.

Disposition:
C3 failed for remaining progress setup failure; C1/C2 remain pending final configured settlement. No unchanged-head retry. Correct, preserve exact failing/passing command receipts/source state, restore claimant mark and request fresh source review before configured verify. Coordinator7933c000 lifted local cover quiet: targeted local runs are now free one file at a time; load loops still require its rule3 window. Reviewer performed only read-only source/log/Git inspection and no execution.
Durable disposition A-10874.

Criteria: C3 failed (Configured replacement run fails both progress setup observers; T3/T4/Web remain unexecuted.).

### impl-1220 · 2026-10-24T11:58:47.435Z

Pushed518114d1f97b71d84a80782000d52d7cc8ab27e5, only progress test/guide delta from source-cleared26b52798. Topicless role notices are now observed at the fake adapter's accepted exact-session native input receipt, armed before idle, with own-ready round trip retained. All original digest assertions retained. After cover release: baseline focused red15000ms reproduced; corrected full progress9/9, docs guard3/3, check exit0 on Darwin arm64 (lint report133/60, zero refusals). Original native provenance and check logs A-10890. Previous configured2eebda38 remains red with only progress2; M5/M6 cases passed there, later phases incomplete. Fresh source review requested before next configured verify; no dev merge.

### rev-26 · 2026-10-24T12:03:46.920Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1220-source-5
commit: 518114d1f97b71d84a80782000d52d7cc8ab27e5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1220 consolidated corrected-source review — clear
Head518114d1f97b71d84a80782000d52d7cc8ab27e5; tree25367f2770ddf0c2f165344d4a1316e8d752e7a4; task/origin refs agree. Scope full as requested; run rev-20261024-1220-source-5; findings[]. Named claimant requestcbc84f79 delivered to rev-26; empty hold acquired, prior reviewer rev-31 informed. No dev merge.

## Standards
M7 resolved in the inspected two-file correction from accepted26b52798. The setup helper observes a FakeHarness record with exact stable sessionId, message.kind=role and outcome=accept, armed before idle. In these cases no delayed role script is installed: FakeHarness.inject records and resolves the default accept synchronously. This is the native-input receipt the tests count, not topic presence, elapsed time or the topicless notice. Own receiver credential-ready who round trip remains before this observer. Digest injection mark/script setup follows the accepted role input.
All original no-extra-input, ordered digest membership, uncertain membership/retry and final injected-stage assertions remain unchanged across three fake flavours. Final guide describes the exact receipt and topicless limitation. No production/authentication/permission/lifecycle/tier/budget change in replacement delta. Whitespace check clean.

Prior full security/lifecycle review A-10826 and corrected source A-10855 by rev-31 explicitly carried forward: M1 indexed-heading contract; M2 async per-session credential I/O and drained disposal; M3 dynamic authorization after held persistence and before native entry; M4 rollback/reservation/role ownership settlement. M5 owned-credential fixture migration/raw fallback tests and M6 event-refreshed archive eligibility/one-indexed-lookup work remain unchanged from accepted26b52798. This review independently inspects the replacement delta and its fake/public seams; it does not claim to have rerun the prior independent review or its tests.

## Spec
C1–C3 implementation basis remains the prior accepted per-session attribution/own shell delivery/rotation/private fallback/migration and human-approved identity-free behavior; only M7 test setup changes. Role-free shell continues human behavior under the explicit human decision, not an OS isolation guarantee. No authentication expansion or blanket fixture bypass introduced.
M7's actual failed configured baseline A-10866 remains failed: both setup observers 'not within15000ms', T0/T1 pass, T2 fails and later phases absent. The new observer no longer asks Agents topic history to contain topicless role input. Original semantic assertions remain the acceptance proof after setup.
All criteria done but remain runtime-dependent and unverified until a fresh exact-head configured result.

A-10890 retained green command output inspected: progress9/9 exit0, no skip/cancel, runner2355.139708ms; affected cases688.531208/344.574458ms. Test SHA256a7d68679161f3670b16b129ec4faad64236481f6e83036cf33a72bc327c1e609 independently matches committed518114d1. These are local Darwinarm64 Node24.21 working-tree receipts subsequently committed unchanged, not exact-commit reruns. Original check receipt exit0/wall103384ms, report lint133/60/zero refusals; docs guard3/3 retained. Exporter's earlier focused red is described in README; configured A-10866 remains durable direct red evidence. Original truncations/history are not reconstructed. No full-suite/Linux pass at this head yet.

Proceed with ordinary configured mode-free verify at518114d1, Reviewer/item-lead routing. Preserve previous failed66921553/A-10836 and2eebda38/A-10866 as historical; neither becomes current green. A changed head needs fresh source review before verification. QA none/after-stage; no native-harness/device/OS isolation or stage closure qualification.
Both axes reviewed in-session under role restrictions: read-only Git/source/artifact inspection and stdlib parsing only, no tests, probes, browser, edits, installs, merge or delegation. Standards0 findings; Spec0 findings.
Durable source review A-10903.

### rev-26 · 2026-10-24T12:29:59.536Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1220-evidence-3
commit: 518114d1f97b71d84a80782000d52d7cc8ab27e5
scope: evidence
findings: [{"severity":"medium","text":"M8: configured run fails on override validation/refusal wording. Coordinator bb672747 classifies known T-998 defect fixed by T-1226/65c47f8c, not T-1220 regression. Authorized shared-fix cherry-pick, fresh delta source review and fresh configured receipt required; Web and mapped T4 did not run.","file":"hub/test/merge-policy.test.ts","line":140}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1220 same-head evidence review — not clear

Head 518114d1f97b71d84a80782000d52d7cc8ab27e5; tree 25367f2770ddf0c2f165344d4a1316e8d752e7a4. Source5 clearance A-10903 remains the reviewed source basis. Audited original configured run 4d9ac23a-e888-4ad8-bcc7-ac708c31caa2 / A-10976. task.view confirms exact-head failed result.

## Standards
No new T-1220 standards finding established. Source tests are not relaxed. This review used read-only Git/source/log parsing without runtime execution. Original local A-10890 green and earlier failed receipts retain their actual source/platform attribution.

## Spec / blocking evidence
M8 medium — configured receipt is red. hub/test/merge-policy.test.ts:140 expects /only the human may override/, but receives "unknown field override; accepted fields: item, cancel". Native case failed in 0.265442312 s. The frame validator uses the MCP merge schema, which advertises item/cancel; the permission handler has a later explicit session-override refusal. Test body is unchanged by T-1220; only its dispatcherUi import adopts the credential fixture, whose wrapper adds actor credentials and preserves arguments.

Coordinator decision bb672747-7a3c-41d8-a4b5-008652bed914 classifies this as the known T-998 dev defect fixed by T-1226 at 65c47f8c, not a T-1220 regression, and authorizes claimant cherry-picking that shared fix under rule11. The branch's actual merge-base with dev is 63e0e0b0, predating 65c47f8c. My earlier 512c4960 comparison was a current-dev comparison reference, not proof that this branch had integrated that head; this corrects that baseline description. Shared strict-validation files have no T-1220 delta in that comparison. No independent base reproduction was executed by Reviewer.

## What passed and what did not run
Native progress records deduplicated by id: 2844 ordinary test passes, one ordinary failure, 403 file passes and one file failure; 90 additional load-gate tests and 90 load file records pass, counted separately. The interruption summary's 2935 = 2845 ordinary outcomes +90 load repetitions, not 2935 independent ordinary tests.

T0 and T1/all fallback hub+Neovim T2 pass. Progress M7 correction now passes 9/9 including both original failed cases. Raw cli-session-credential tests pass 9/9 +45 actual repetitions; credential IO 7/7 +35; session archive 14/14 +5; Claude environment contributes one 5/5 identity. All 18 repeated identities pass 5/5. These positive receipts establish substantial corrected behavior but do not turn the overall red result green.

Changed T3 phase exits1: 24 selected T3/T4 files, 183 passing identities/one failure, one base execution/no repetitions, selected added wall 204.660 s excluding machine wait. Web and mapped T4 inbox-verifier-load have zero executed tests; neither is passing evidence. Remaining general T3 is deferred.

Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-cee83cb8, Node v24.21.0, Neovim v0.12.5, configured workers2; lifetime690 s, cost $0.0479. Host check exit0,29.721 s; remote log says host gate8843fe2d649ef5f8e40d8cd32b39b5f5e2ce4233 not repeated. No remote repeated-typecheck claim.

Budgets/lint/ratchet remain report-only, including T3 over-budget native identities. A-10976 preserves the complete generated allowance stanza with owner E-1197, added2026-10-24, expires2026-10-31, 1.5x measured headroom:
- cli-identity stopped-unresponsive-hub identity: peak10.878 s, proposed16.317 s.
- Lead launches/stops live subtree: peak8.728 s, proposed13.093 s.
- session-events process rows: peak9.271 s, proposed13.907 s.
- finished remote runs free slots after settlement failure: peak10.825 s, proposed16.239 s.
- restart reconciles stop before queued hold cleanup: peak8.478 s, proposed12.717 s.
These are retained measured recommendations, not installed allowances or enforced-budget passes. Do not edit duration policy merely to replace this failed receipt.

Disposition: evidence not clear; C3 end-to-end configured integration remains failed/incomplete, C1/C2 remain unverified in this verdict despite their passing focused receipts. Source5 is historical after any cherry-pick. Apply only Coordinator-authorized shared fix65c47f8c, commit/push and request delta source review before a fresh mode-free run, then exact-head evidence review. No unchanged-head retry, permission relaxation, ready/landing or item-QA claim. Standards0 new findings; Spec/evidence1 medium blocker classified shared dev defect.
Durable review: A-10980.

Criteria: C3 failed (Configured integration receipt is red on the known merge-override dev defect; Web and mapped T4 did not execute.).

### impl-1220 · 2026-10-24T12:31:50.443Z

Per Coordinator decisionbb5deb75, cherry-picked sharedT-1226 dev65c47f8c cleanly onto518114d1 as80d870e517ea3d2608fc4c322bb2ef3f01f34f20; pushed. No manual conflict resolution, no dev merge, no permission-test change. A-10989 preserves exact-head local Darwin arm64 native merge-policy targeted1/1, tool-arguments10/10, spoke2/2 and check0 (lint report133/60, zero refusals). Sole prior T3 failure was the known T-998 regression, not a credential regression; A-10976 stays failed. Delta source review requested before new mode-free verification.

### rev-32 · 2026-10-24T12:33:33.002Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1220-delta
commit: 80d870e517ea3d2608fc4c322bb2ef3f01f34f20
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1220 authorized shared-fix delta source review — clear

Head 80d870e517ea3d2608fc4c322bb2ef3f01f34f20; tree d64671a4f1ce480b9b4a156a541ed91adfd03bd4; sole parent 518114d1f97b71d84a80782000d52d7cc8ab27e5. Origin matches, task tree clean, parent-to-head whitespace check clean. Scope delta, carrying rev-26's full source5/A-10903 and failed evidence3/A-10980. Direct claimant request 840a0374 addressed rev-32; free hold taken and prior reviewer informed.

## Standards

Coordinator decisions bb5deb75 and bb672747 read independently in topic-952 explicitly classify the old override failure as the known T-998 dev defect and authorize cherry-picking T-1226/65c47f8c, followed by delta review and fresh mode-free verification. The complete nine-file zero-context patch, with index/hunk coordinates removed, exactly matches that posted commit. Full diff differs only in surrounding inherited source context. No dev merge or branch-local repair; no T-1220 credential implementation, test assertion, tier or duration-policy change.

The shared MCP schema declares optional override:string; the spoke forwards it without inventing or dropping it. It still submits through the existing credential-bound hub connection. The unchanged dispatcher merge handler at hub/src/hub/dispatch.ts:1284 refuses every session override before merge work with “only the human may override verdicts”. Known-field recognition grants no human authority. Tool availability and actor verification remain earlier boundaries; unknown overide stays invalid_argument.

T1 controls retain FakeClock/in-memory dispatcher peers, no Git/process. They distinguish typed forbidden and its refusal notice from invalid_argument without a notice. The spoke stub observes the exact outgoing override, preserves typed hub refusal and proves malformed unknown fields send no additional request. Existing cleanup/receipt boundaries and free-only ask test remain. Matching session-permissions, hub README, canonical test notes and project-owned merge skill describe known fields versus authority. No new standards findings.

## Spec

The authorized shared fix resolves M8's concrete wrong diagnostic without changing the accepted C1–C3 security model. Carry A-10903's accepted per-session credential attribution, private shell delivery/rotation, async persistence/revalidation/rollback/drain, fixture migration, archive eligibility and corrected exact role-input setup. Identity-free shell behavior remains the explicit human decision, not OS isolation. These unchanged implementation areas are carried from the prior full audit, not claimed as newly repeated full review.

A-10989 independently inspected original exact-head local Darwin arm64 receipts: unchanged native permission/override test 1/1 (4.948610125 s test, native runner 5.4103245 s; collector wall 5454 ms); tool-arguments 10/10 (661.075334 ms native runner); spoke 2/2 (741.893625 ms native runner). All exits 0/no skips. npm run check exit 0, collector wall 29670 ms; generic lint report-only 133 findings/60 files, zero refusals. Raw command/stdout/stderr and exit records retained; these are local targeted/T0 results, not configured Linux passes.

Previous 4d9ac23a/A-10976 at 518114d1 remains failed historical evidence: T0–T2 passed, changed T3 183 passing identities/one override failure, Web and mapped T4 incomplete. Its 90 load repetitions and all five duration recommendations retain A-10980's attribution; no allowance installed by this cherry-pick. Earlier failed credential/progress receipts are not relabelled.

Clear delta source, findings []. C1–C3 remain runtime-unverified pending fresh ordinary configured mode-free verification at this exact unchanged head, including actual changed-T3, Web and mapped-T4 outcomes and timing/gate limits. No source change/dev merge before review if head changes; no claim of full suite, native-harness/OS isolation or stage closure. Standards 0 findings; Spec 0 findings. Reviewer used read-only source/Git/artifact inspection only, no execution, mutation, browser or delegation.
Durable audit A-10995.

### rev-32 · 2026-10-24T12:54:10.160Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-1220-evidence-4
commit: 80d870e517ea3d2608fc4c322bb2ef3f01f34f20
scope: evidence
findings: [{"severity":"medium","text":"M9: artifact fixture sends artifact.create as artifact-coord without its credential; configured Web setup fails with explicit missing/invalid credential before browser assertions. Migrate owned fixture actor authentication, retain security/UI assertions.","file":"web/test/artifacts.test.ts","line":250},{"severity":"medium","text":"M10: drawer fixture's task.claim sends only item-worker as.name and returns false at225. Use the already owned authenticated session boundary, preserving human/browser routing and claim/delivery assertions; fresh source review and complete configured receipt required.","file":"web/test/session-drawer.test.ts","line":225}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1220 replacement configured evidence — not clear

Exact head 80d870e517ea3d2608fc4c322bb2ef3f01f34f20; tree d64671a4f1ce480b9b4a156a541ed91adfd03bd4. Origin matches, task worktree clean. Source delta/A-10995 remains the accepted basis. Independently audited run ae8f4f61-3920-43ff-8ef8-cda878fca104 / A-11047 and the two failing setup sites. Scope evidence.

## Spec / blocking evidence

M9 medium — web/test/artifacts.test.ts:250–251. The local fixture creates an artifact as artifact-coord with only as.name, after role.set. The original runtime failure is explicit: “session \"artifact-coord\" credential is missing or invalid; reconnect this session's own MCP spoke to provision its shell credential, or resume with --relaunch”, followed by false !== true at line251. This occurs before the browser assertions. Complete the fixture's owned actor authentication rather than relaxing the credential requirement.

M10 medium — web/test/session-drawer.test.ts:225. The fixture's manual task.claim as item-worker returns false; original output is “AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: false !== true” at line225. Source shows a launched session and connected own spoke, but this separate UI call supplies only as.name. The missing-credential diagnosis is supported by that source and claimant 09e1e7d0; this reviewer performed no reproduction. Route setup through that owned authenticated session boundary, preserving actual browser/human behavior, claim authority and final UI delivery assertions. Audit remaining manual fixture actors for the same migration omission; introduce no blanket bypass.

These are assertion failures, not report-only duration warnings. C3's end-to-end configured integration remains incomplete; no overall pass/ready.

## Standards

No additional production finding. Both failures precede their browser behavior. The shared override correction is now proven by the formerly failing native merge-policy case passing at 1.040278624 s; do not revert its schema or human-only gate. New fixes require a fresh committed source review before another configured run; no unchanged-head retry or unauthorized dev merge.

## Actual configured execution

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-429076a6, Node v24.21.0, Neovim v0.12.5, workers 2 (Web 4). Host T0 exits0 (24.909 s), all T1 and fallback all hub/Neovim T2 exit0, changed T3 exits0 and mapped T4 exits0; Web exits1. Overall exit1 with an interruption footer. No passing Web receipt.

Raw progress records: 3127 ordinary outcomes, 3125 pass/2 fail, 447 passing file records/2 failing file records, zero skips/cancellations. Ninety additional load test/file records pass (18 identities ×5). The footer's3217 completed/3215 pass includes these repetitions and is not a count of independent ordinary tests.

Changed T3 executes24 files with184 passing identities once, selected-phase added wall216.707 s excluding wait. Mapped T4 inbox-verifier-load executes1 identity once (1.182219947 s), added wall2.086 s; T4 repetitions skipped as configured. Remaining general T3/T4 is not claimed covered.

Positive regressions retained: raw credential CLI9/9 plus45 actual repetitions; async credential IO7/7 plus35; progress9/9; one archive eligibility identity5/5 plus the Claude credential-environment identity5/5. Every18 repeated identity passes5/5. The old wrong-override failure is resolved, but these positives do not make the two new Web failures green.

Host gate marker4ca573b64009303a9c3c5b8a08a84990c2f725fe is reused remotely, not repeated. T1/T2/T3/T4/Web phase envelopes58/352/221/6/149 s differ from suite walls54.71/347.94/216.78/2.13/144.35 s. Droplet lifetime878 s/cost$0.0610 are machine accounting.

Generic duration/lint/ratchet remain report-only, static lint zero refusals. A-11047 retains the complete generated allowance JSON (owner E-1197, added2026-10-24, expires2026-10-31, 1.5x measured headroom):
- cli-identity unresponsive-hub stop: peak10.779 s, suggested16.168 s.
- Lead live-subtree launch/stop: peak9.089 s, suggested13.634 s.
- session-events process rows: peak9.387 s, suggested14.082 s.
- suite-remote-process slots after settlement failure: peak11.135 s, suggested16.702 s.
- tracker-ready-native restart/queued cleanup: peak8.960 s, suggested13.441 s.
These are measured recommendations for passing known identities, not installed allowances or the cause of exit1. Existing Web/scale/artifact would-fails and missing baselines remain retained. Prior run4d9ac23a/A-10976 remains historical failed evidence.

Disposition: not clear; C3 failed pending local fixture authority migration and a complete fresh exact-head receipt. C1/C2 retain their focused positive receipts but are not newly marked verified by this failed integration verdict. Claimant already plans the two fixture corrections, preserving UI assertions. No independent production diagnosis, tests, browser, Git mutation, edits or delegation by Reviewer. Standards0 additional findings; Spec/evidence2 medium blockers.
Durable audit A-11052.

Criteria: C3 failed (Configured integration still fails two Web fixture actor-authentication setup cases before browser assertions; complete migration and obtain fresh reviewed-head receipt.).

### impl-1220 · 2026-10-24T13:00:16.726Z

Pushed eb1fbfaf Web local-client auth fixture migrations (browser/UI assertions unchanged), then Coordinator-authorized rule11 dev merge e7ca9436f75624947ef8ed75d9b4013945482d18, parents eb1fbfaf +699a44dd. Both conflicts combined: credential directory join + custom-role dynamic names; authenticated item-lead root + Coordinator/closed-item controls. Incoming custom routing manual claim fixture migrated after original7/8 red. A-11064 retains all raw local receipts/provenance: Web12/12+7/7 before merge; integration custom8,item-lead12,credentials9,I/O7,archive14,progress9,verdict4,native-boundary29,docs3 pass; check0 (Darwin arm64, lint report133/60, zero refusals). Request delta source review. Coordinator8fa92a1e explicitly holds configured verification until T-1214 lands, a second authorized merge/help move and small delta review; no run submitted now.

### rev-31 · 2026-10-24T13:34:10.241Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1220-checkpoint
commit: e7ca9436f75624947ef8ed75d9b4013945482d18
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1220 authorized integration checkpoint — delta source clear

Head e7ca9436f75624947ef8ed75d9b4013945482d18, tree 383563d5c442db892d57bf17ac4719e9fcdbbf16. Parents eb1fbfaf6797c96cb39a0ee1466b1d285a8e735f (M9/M10 fixes) and dev 699a44dd1741e272ecd883c73c1aeda0215d6dff. Task/origin refs match, task worktree clean, parent-to-head whitespace check clean. Direct named resend 5131181b follows Coordinator fb43538c; free hold taken and prior reviewer rev-32 informed.

Read Coordinator decision 8fa92a1e independently: current-dev merge under rule 11 is authorized, both real-logic conflict sides must remain; source checkpoint review now, configured verification explicitly HELD until T-1214 lands, second authorized integration/help-line migration and another small delta review. This clearance does not release that hold.

Scope delta carries accepted full source5/A-10903 at 518114d1, accepted shared override delta/A-10995 at 80d870e5, and failed evidence4/A-11052. Prior M1–M8 corrections remain carried, not represented as a repeated full audit of incoming dev tasks.

## Standards

No findings. M9/M10 import corrections are confined to the local setup clients in web/test/artifacts.test.ts and web/test/session-drawer.test.ts, plus canonical guide updates. Both explicitly opt in to existing sessionUi; this helper authenticates only frames with an as object, preserving explicitly supplied credentials and leaving actor-free human frames untouched. It reads/writes only the fixture-owned Store. It is not a production credential bypass. The two manual Web actors are artifact-coord artifact.create and item-worker task.claim; existing UI, keep/readback/navigation/composer/destination assertions remain unchanged. Actual browser Web authentication is unchanged.

Incoming custom-role manual claim uses the same explicit helper, changing only its import and canonical guide relative to dev. Raw own-spoke launch/reconnect, self-verdict rejection and permission-refusal controls remain intact; no authentication regression is converted to a fixture-credential positive. Existing cli-session-credential.test.ts and session-credential-io.test.ts use their unchanged raw seams.

Inspected both-parent combined resolution and relevant incoming production diffs:
- sessions.ts retains join for private credential-directory I/O and resolve, while removing fixed ROLE_NAMES and retaining dynamic this.#core.roleNames() validation. All async credential persistence, current-caller revalidation, reservation rollback and cleanup/drain code is unchanged relative to eb1fbfaf.
- item-lead fixture retains explicit discovery.root for its authenticated owned Store and adds Coordinator setup/spoke alongside closed-item fallback/delivery assertions from T-1209. No closed-item control is dropped.
- Incoming core.roleNames integrations preserve stored-role authority and credential-bound admission; custom own-claim verification restrictions and closed-item Coordinator routing remain. Shared credential module, credential fixture, raw CLI/held-I/O tests, progress and archive workload files are unchanged by this merge.
- Incoming T-1098/T-1211/T-1231 scheduler/coverage work and matching docs are retained as upstream changes, not independently re-reviewed in full here.

Canonical docs for artifacts, drawer and custom-role fixtures accurately distinguish manual authenticated setup from human browser actions and retain raw permission boundaries. No tier, deadline, workload, duration allowance, dependency or role-permission relaxation in this correction. Original task skills/docs and shared override authority remain carried.

## Spec

M9/M10 source corrections resolved; no remaining source findings. The local fixture actors now reach their intended behavior after authenticating, while C1 attribution and C2 actor-free human decision remain unchanged. C3 own-adapter credential transport/rotation, private files, async serving-time lifecycle, dynamic caller checks, launch-failure rollback and archive cleanup are preserved. Dynamic custom role validation combines with credential provisioning; closed-item lead routing combines with owned authentication. No expanded trust model: same-OS-user accidental identity attribution, not a native sandbox isolation claim.

A-11064 inspected original per-command stdout/stderr/receipt files and native source envelopes. The recorded envelopes SHA256 matches provenance abe3dc6c736d10a9c1a167d87204d467ceaa1af6e3f7e57efbef85acdc4619ff. Original truncations remain labelled.
Premerge working tree based on 80d870e5, committed as eb1fbfaf: isolated pinned Headless Shell artifacts12/12 (native runner11568.791125ms), drawer7/7 (4296.3305ms), docs3/3; check exit0/24559ms collector wall. Browser profile ownership/process census retained in fixture, no human browser.
Authorized merge working tree later committed unchanged: custom8/8, item-lead12/12, raw credential9/9, I/O7/7, archive14/14, progress9/9, verdict4/4, native-boundary29/29, docs3/3; all native exits0, zero skips/fails. Check exit0/25027ms collector wall; lint report133/60, zero refusals. Receipt source fields correctly identify uncommitted merge source, not exact postcommit reruns.
Original custom fixture red retains7/8, false!==true on manual task.claim at166 before the import correction. These local Darwin arm64 targeted results support the checkpoint; no new configured result at e7ca9436 exists.

Historical ae8f4f61/A-11047 at80d870e5 remains failed overall: T0–T2/changed T3/mapped T4 passed, Web2 failed on M9/M10. Its90 extra load passes and known-T3 duration recommendations remain separate, not current-head proof or installed allowances. No final criterion marks issued here; C1–C3 claimant done, runtime settlement pending future reviewed head and actual configured result.

Disposition: delta source clear, findings []. Maintain Coordinator's NO CONFIGURED VERIFY hold. Wait for T-1214 landing notice, perform only authorized second merge/help-line move, request the small delta review, then one combined mode-free run after clearance/hold release. Do not enqueue. Reviewer only static source/Git/tracker/artifact reads, no test/build/browser/process or Git mutation/delegation.

Standards: 0 findings. Spec: 0 remaining source findings.
Durable checkpoint A-11088.

### impl-1220 · 2026-10-24T14:02:41.454Z

Final authorized merge55a993aa67299d3c15c4e12f8ec1c7874e509dda pushed, parents checkpoint-reviewed e7ca9436 + dev e053338b (T-1214/T-1239). T-1214 uses independent command string rows; moved credential guidance into TASK_USAGE/SUBSCRIPTIONS_USAGE entries, with only their frozen commands.json values changed. Export map/help template unchanged; tiers keeps all credential/help declarations. Original local working-tree receipts A-11154: frozen exports1, real CLI help bytes1, scratch Git merge2, existing usage1, raw credential9, docs3 pass; check0 Darwin arm64, lint report133/60 zero refusals. Coordinator8eb17d40 authorizes source delta review then one combined mode-free verify/evidence review/ready report. No suite submitted before verdict.

### rev-31 · 2026-10-24T14:05:09.040Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1220-final-integration
commit: 55a993aa67299d3c15c4e12f8ec1c7874e509dda
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1220 final authorized integration delta — clear

Head55a993aa67299d3c15c4e12f8ec1c7874e509dda; tree350259ca1364086ba9dd82a750a6a1405e6c787e. Parents checkpoint-cleared e7ca9436f75624947ef8ed75d9b4013945482d18 and incoming dev e053338bac873b11434b8fdc61a2a86516a63bd7. Pushed task ref matches; claimant reports clean. Scope delta, carrying source checkpoint A-11088, full accepted credential audits and raw Web/coupled integration receipts A-11064. Independently read Coordinator8fa92a1e's two-step integration instruction: first checkpoint review without verify, then T-1214 integration/help migration, small delta review and one combined mode-free run. Claimant cites final landing notice8eb17d40; incoming source independently contains landed T-1214. No runtime execution by Reviewer.

Standards and Spec: no delta findings. T-1214 uses one independent command-owned table row, which its interface permits; this merge preserves that landed implementation instead of imposing a different module layout. Compared with incoming dev, usage.ts changes only commandUsage.TASK_USAGE and commandUsage.SUBSCRIPTIONS_USAGE. Task help retains credential precedence/private session-bound fallback/known-session requirement/refusal recovery/identity-free-human wording; subscription help retains the known-session credential requirement. Against incoming dev, frozen commands.json changes exactly the same two keys; exports.json and help.txt blobs are identical to dev. Legacy named exports and INIT/UPDATE, RELEASE/PUBLISH/SYNC, SUBSCRIBE/UNSUBSCRIBE/SUBSCRIPTIONS composition remain incoming T-1214's architecture. Other command rows, T-1239/dev additions and complete help template survive.

Merged tiers retain every key/value from both parents: task credential CLI/IO tests remainT2; incoming cli-helpT2/compatibilityT1/native-Git-mergeT3 declarations remain. No tier removal/retiering, duration-baseline or allowance changes. The docs/index/README unions retain task credential guidance and incoming reporting/docs entries. Dispatcher differs from the checkpoint only by incoming dev's report-boundary log injection; credential frame/actor logic and prior checkpoint's closed-item/custom-role integration are preserved. No credential lifecycle, adapter, shared credential module, socket authority, raw credential tests, fixture-environment or corrected Web artifact/drawer source changes relative to e7ca9436. Incoming unrelated product changes are carried from dev, not claimed as a new full re-audit.

A-11154 inspected original stdout/stderr/receipt files with explicit precommit source attribution, Darwin arm64/Node24.21. All native receipts exit0/no signal:
- frozen export compatibility1/1 (body1.783584ms, Node75.027750ms);
- actual CLI complete help bytes1/1 (body132.387166ms, Node226.372459ms);
- sealed native Git merge/merge-tree cases2/2 (247.055500/239.658625ms, Node569.595667ms);
- existing usage1/1, raw credential CLI9/9 (Node2.410897375s), docs3/3;
- npm check0, collector wall27.109s, report-only lint133/60 and zero refusals.
The collector's whole-command wall and Node runner/body timings remain distinct. These ran on the uncommitted final merge tree subsequently committed unchanged; no exact-postcommit rerun or native Linux/task-suite pass inferred. A-11064 remains historical first-integration/Web evidence. Prior configured ae8f4f61/A-11047 and earlier failures remain failed overall; recommendations/partial passing phases were not relabelled as current evidence.

Final integration delta source clear, findings[]. C1–C3 claimant done; runtime verification remains outstanding at55a993aa. The prior Coordinator hold was for the T-1214 landing/integration now present; proceed with the single ordinary configured mode-free run covering both authorized integrations, without mode/executor overrides or extra repetitions. Route original result here and request evidence review before ready. Preserve this reviewed head; no further merge/source change without authorization and fresh review. No QA/landing/enqueue claim.
Durable review A-11159.

### rev-31 · 2026-10-24T14:28:02.592Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1220-evidence2
commit: 55a993aa67299d3c15c4e12f8ec1c7874e509dda
scope: evidence
findings: [{"severity":"medium","text":"M11: required native first-turn hard-hit identity fails `early hit saved: not within 15000 ms`; current runtime regression unresolved, T4/Web absent. Classify via focused sealed source-attributed controls; no shared-defect/flake exemption established and no unchanged full retry until disposition.","file":"hub/test/account-limited.test.ts","line":241}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1220 configured evidence disposition — not clear

Head55a993aa67299d3c15c4e12f8ec1c7874e509dda / tree350259ca1364086ba9dd82a750a6a1405e6c787e. Carries final integration source clearance A-11159, checkpoint A-11088 and original local A-11154. Independently inspected task.verify and original A-11196 for configured mode-free f5a08d89-311c-4d2d-9d8c-8bacf1c8898b. Reviewer read-only; no execution or diagnosis-by-rerun.

Actual failing receipt:
hub/test/account-limited.test.ts::a hard hit before the native first-turn response is retained through launch publication
Error: early hit saved: not within 15000 ms
at eventually (hub/test/harness.ts:848:9)
at TestContext.<anonymous> (hub/test/account-limited.test.ts:241:16)
Ordinary body17.043006785s; suite test failures explicitly records this identity.

M11 medium: current required changed-T3 native harness coverage contains one unresolved assertion failure. This is not merely a report-only duration warning: the limited mark never satisfied the bounded “early hit saved” observation. The test body at236 onward still launches native first-turn Codex with the limit fixture, then checks retained session/reset/one account-limited event. Against incoming dev, only the file's fixture imports switch to credential-aware sessionUi/sessionClandWithEnv; body/assertions are unchanged. That narrows diagnosis but does not establish cause, a shared baseline defect or a permitted flake. Previous parent success is historical positive evidence, not proof that this failure can be ignored.

Classify with focused sealed receipts and exact source attribution, comparing a valid base/control where needed. Retain original error before interpretation. Keep publication/limit and credential assertions, permissions and bounds intact. No unchanged-head full-suite retry until evidence supports a specific reviewed/Coordinator disposition. Any correction must be committed/pushed and source-reviewed before another configured run. No timeout increase, blanket allowance or permission weakening follows from this failure. Claimant's2b26e0e report starts focused local reproduction and explicitly has no independent base receipt yet.

Actual phase limits: exit1 overall. T0 exit0 (24.557s host gate), allT1 exit0, full fallback hub+NeovimT2 exit0. ChangedT3 phase exit1:184 passing identities/one failing identity across24files, selected phase added233.028s excludes machine wait. T4 mapped inbox-verifier guard and Web have zero execution receipts; absent later phases are not passing cover. Ordinary2912 tests =2911pass/1fail, no cancellations/skips/todo. Eighteen new-identity load groups each5/5 supply90 additional passes; interruption summary3002/3001pass/1fail includes those extras and is not an ordinary total. All9 raw CLI credential identities pass; that partial C1/C2 evidence does not settle the whole task.

Linux x64 6.8.0-142-generic,Node24.21,Neovim0.12.5; droplet c-8lon1 cland-v0-102f9125,workers2,lifetime776s,cost$0.0539. T0 log references reused host-gate tree0e0ab81b9fa0489085550d792dfdae5eda208c0d, not a remote exact-head check. T1envelope65s,T2 373s,T3 237s. Existing duration/test-lint/T3-ratchet notices remain report-only; printed advisory allowance stanzas are not installed source and cannot resolve this assertion failure. No new hard-duration-gate failure inferred from the report-only17s regression.

Evidence not clear. Fail C3 current runtime mark for unresolved native adapter/launch-publication regression and incomplete later selected phases; C1/C2 not independently failed, remain unverified pending final settlement. Existing source clear is retained as source history, not an overall pass. QA/ready/enqueue/landing remain outstanding.
Durable review A-11201.

Criteria: C3 failed (Configured f5a08d89 exits1 on native launch-publication/account-limit assertion; later mappedT4/Web absent. C1/C2 partial passes do not settle required harness cover.).
