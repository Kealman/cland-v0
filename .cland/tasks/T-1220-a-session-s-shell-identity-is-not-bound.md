---
id: T-1220
kind: task
title: A session's shell identity is not bound to a per-session credential
state: open
status: review
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
updated: 2026-10-24T11:00:57.872Z
---

## Summary

Found by impl-1219 while answering T-1219's C3 (2026-10-24 09:32Z; evidence artifact in topic-951). CLI calls from a session's shell authenticate to the hub with the project-wide discovery secret. The session identity they then present (name, id, role) is taken from environment variables and is not checked against a per-session credential such as the launch token. So a process running in one session's shell can act as another session, and a shell that presents no identity acts as the human. The second part is already documented behaviour.

Trust model today: every session runs as the same OS user on one machine. This gap matters because cland's guardrails (role permissions, the rule that a peer message is never the human's approval, verdict authorship, merge rights) assume each session acts only as itself.

## Acceptance criteria

- [x] C1. A shell CLI call is attributed to a session only when it presents that session's own per-session credential; a call presenting another session's identity is refused, shown in a sealed real-hub test.
  - done: impl-1220 · 2026-10-24T10:13:17.395Z
- [x] C2. A shell that presents no session identity keeps acting as the human, as today (human decision, General 2026-10-24 09:35Z, answer to ask a4e7c1e1); docs state this, and a test pins it.
  - done: impl-1220 · 2026-10-24T10:13:17.528Z
- [x] C3. Harness adapters (Claude Code, Codex, OpenCode) deliver the credential to their own shells only, and docs describe the trust model.
  - done: impl-1220 · 2026-10-24T11:00:21.245Z

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
