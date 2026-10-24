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
updated: 2026-10-24T11:11:17.138Z
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
  - failed: rev-31 [reviewer] · 2026-10-24T11:11:17.138Z · note Async relaunch must recheck caller authority after persistence and roll back role reservations when credential preparation fails.

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
