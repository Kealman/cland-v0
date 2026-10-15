---
id: T-446
kind: task
title: artifact-browser attachments test connects before its Neovim socket is up (ECONNREFUSED under load)
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-285
branch: t/T-446-artifact-browser-attachments-test
created: 2026-10-15T00:52:28.303Z
updated: 2026-10-15T09:37:00.096Z
closed: 2026-10-15T09:37:00.096Z
---

## Summary

`nvim/test/artifact-browser.test.ts:216` ('pending message attachments survive both a refused and an accepted ask answer') failed in integrated cover 55432184 at 131b7629 (A-2627) after 0.9 s, with `connect ECONNREFUSED` on the fixture's nvim.sock. The peak load was 18.6, with a census run and targeted runs beside it. Alone at the same head it passed 5/5 (2026-10-15 00:50Z). The test connects before Neovim's listen socket exists, so it should wait for the socket, or retry the connect with a bound, before its first RPC.

## Acceptance criteria

- [x] C1. The test, or its harness, waits for the socket to accept before connecting, and the file passes 5/5 beside a local full run.
  - done: impl-446 · 2026-10-15T09:25:55.447Z
  - verified: rev-30 [reviewer] · run rev-20261015-446-final · 2026-10-15T09:36:42.166Z · commit 18edb7b127e553c808af8473e14594965fd4f594

## Comments

### impl-446 · 2026-10-15T09:23:37.264Z

Diagnosis: startClient waited for existsSync(nvim.sock), which can become true after bind but before listen. A CLAND_NVIM wrapper that binds without listening for 200ms made the existing attachment test fail with ECONNREFUSED (1/1 red); the same test passes with the fix (1/1 green). Startup now retries only ENOENT/ECONNREFUSED within the unchanged 10s deadline and preserves stderr/cause on exhaustion. Running 5 serial full-file checks beside impl-454 full local verification 7a4f3460-addb-4197-84c7-0208ec7f5e9d.

### impl-446 · 2026-10-15T09:25:56.361Z

Implemented and pushed 18edb7b1 on t/T-446-artifact-browser-attachments-test after fetching/merging origin/dev (already current). C1 loaded proof: artifact-browser.test.ts 5/5, each 11/11 and zero skips, queue-confirmed full local run 7a4f3460 active throughout. Forced bind/listen gap fails original attachment test with ECONNREFUSED and passes fixed source; npm run typecheck and diff checks pass. Evidence A-2819: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2819-t-446-socket-bind-listen-red-green-and-five-loaded-passes.md. No timeout/assertion widening; no per-item QA brief required per Coordinator. Post-review diff-selected droplet verification will provide Linux evidence.

### rev-30 · 2026-10-15T09:33:59.502Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-446-source
commit: 18edb7b127e553c808af8473e14594965fd4f594
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings against repo test guidance or baseline smells.
Spec: nvim/test/harness.ts:89–102 retries actual initial socket connection only for ENOENT/ECONNREFUSED under the existing 10-second deadline. Line 120 attaches the accepted channel directly. Restart at line 141 preserves its original connect-and-attach sequence. Close hooks, notification registration, PID ownership and all artifact attachment assertions remain intact.

A-2819 supports forced-gap red/green and 5/5 serial loaded file passes (11/11 each, zero skips; before/after receipts for impl-454 full local run 7a4f3460). C1 is left unverified during this source pass; final criterion verification and verdict await same-head post-source Linux verification.

### impl-446 · 2026-10-15T09:35:06.853Z

Source review clear at 18edb7b1 (rev-20261015-446-source). Normal diff-selected verify 498bdf8a-326b-4c5f-8372-bf14e4fb5aaf fell back locally because remote budget was 4/4. Coordinator decision d5f9fb7f (09:34:56Z): let this gate run stand, no resubmit; E-482 epic QA supplies the per-file Linux droplet proof. Load pause applies only to targeted repeats. Waiting for this same-head gate result.

### impl-446 · 2026-10-15T09:36:27.215Z

Same-head gate 498bdf8a finished exit 0 at 18edb7b127e553c808af8473e14594965fd4f594: nvim-only selection, 403 tests/pass, zero failures/skips. Executor local darwin arm64 (remote 4/4 fallback, accepted by Coordinator); Linux coverage remains E-482 epic QA. Log A-2834: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2834-suite-498bdf8a-326b-4c5f-8372-bf14e4fb5aaf-auto-at-18edb7b.log. Reviewer received result directly; awaiting final verdict.

### rev-30 · 2026-10-15T09:36:42.166Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-446-final
commit: 18edb7b127e553c808af8473e14594965fd4f594
scope: evidence

Final review clear; no high, medium or low findings. Same head as source review and current branch tip.

Standards: source verdict rev-20261015-446-source stands, no findings.
Spec: C1 verified from accepted-socket startup source and A-2819's forced-gap red/green plus 5/5 serial loaded artifact-browser file runs (11/11 each).

Gate 498bdf8a-326b-4c5f-8372-bf14e4fb5aaf / A-2834: exit 0, typecheck green, nvim-only + hub smoke, 403 passed, 0 failed/cancelled/skipped, local darwin arm64 at exact 18edb7b127e553c808af8473e14594965fd4f594. Remote budget 4/4 caused local fallback. Per confirmed Coordinator decision d5f9fb7f, this is the accepted task gate; no resubmit. Linux per-file droplet proof remains assigned to E-482 epic QA.

Criteria: C1 verified.

### coord · 2026-10-15T09:37:00.096Z

Merged 5c4928626aaa9922802117c0ab5a4ff1a3bfefab onto dev.
