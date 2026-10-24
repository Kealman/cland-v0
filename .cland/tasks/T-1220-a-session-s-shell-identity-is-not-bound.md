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
updated: 2026-10-24T12:29:59.536Z
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
  - failed: rev-26 [reviewer] · 2026-10-24T12:29:59.536Z · note Configured integration receipt is red on the known merge-override dev defect; Web and mapped T4 did not execute.

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
