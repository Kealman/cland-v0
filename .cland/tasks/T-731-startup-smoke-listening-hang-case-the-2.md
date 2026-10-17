---
id: T-731
kind: task
title: "startup-smoke listening-hang case: the 2 s test budget ends before a loaded Linux hub reaches its first connection"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
regression_of: T-706
topic: topic-430
branch: t/T-731-startup-smoke-listening-hang-case-the-2
created: 2026-10-17T09:52:07.766Z
updated: 2026-10-17T10:30:43.542Z
closed: 2026-10-17T10:30:43.542Z
---

## Summary

T-706 cut the startup-smoke test budget from 10 s to 2 s. In integrated cover c91c6e1e (A-4440, droplet c-8, peak load 7.6) the planted listening-hang case failed: the smoke expired after 2000 ms with last event `executor-sweep`, before the hub had accepted the connection where the hang is planted. It passes 5/5 alone on the Mac. The case proves a hang *after* listening is named, so its budget must cover start-up to the first connection on a loaded runner.

## What to build

Give the listening-hang case a budget that a loaded Linux runner reaches the first connection within, with a matching duration bound, or start its bound once the planted connection is seen. The pre-discovery case keeps 2 s, because its hang is planted before the daemon starts.

## Acceptance criteria

- [x] C1. The listening-hang case still asserts the planted event is named as the last startup event, and passes 5/5 on the Mac and in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261017-731-final · 2026-10-17T09:59:42.961Z · commit 589f036c7f96f44b8e7f69b06907ff4e6a249e66
  - done: impl-731 · 2026-10-17T10:30:34.590Z
- [x] C2. The case's wall time stays under its old 12 s bound, and the header comment says why its budget differs from the pre-discovery case.
  - verified: rev-30 [reviewer] · run rev-20261017-731-source · 2026-10-17T09:55:46.877Z · commit 589f036c7f96f44b8e7f69b06907ff4e6a249e66
  - verified: rev-30 [reviewer] · run rev-20261017-731-final · 2026-10-17T09:59:42.961Z · commit 589f036c7f96f44b8e7f69b06907ff4e6a249e66
  - done: impl-731 · 2026-10-17T10:30:35.024Z

## Comments

### impl-731 · 2026-10-17T09:55:06.019Z

Implemented in 589f036c7f96f44b8e7f69b06907ff4e6a249e66, pushed to origin. Listening-hang readiness restored to 10 s with original <12 s assertion and header rationale; pre-discovery remains 2 s. Five serial whole-file Mac passes (13.598–13.701 s/file; listening 10.371–10.435 s, load 3.36–4.73). Merged Coordinator-posted T-729 shared lint fix at 601d9cde; final-tree typecheck, test:tiers and additional whole-file run pass. Evidence A-4443: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4443-t-731-test-only-budget-fix-and-serial-mac-verification.md. Awaiting source review before droplet verify.

### rev-30 · 2026-10-17T09:55:46.877Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-731-source
commit: 589f036c7f96f44b8e7f69b06907ff4e6a249e66
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-731 at 589f036c7f96f44b8e7f69b06907ff4e6a249e66, fixed point incoming dev 601d9cdec32ea385d3e72fb23bc8e0ca57ae6ef5. Origin matches. The sole changed file is hub/test/startup-smoke.test.ts (7 insertions/5 deletions). Reviewed item criteria, full fixture and A-4443. Read-only review; no Reviewer execution.

Standards
No findings. The real detached CLI startup proof retains its T3 justification. No new process, wait, ownership path or production change is introduced. The listening-hang child retains its genuine connection-event block, planted structured last event and following unstructured diagnostic. The assertion still requires exactly that planted event, rather than accepting an earlier startup event or generic timeout. Existing smoke cleanup still owns the detached daemon before discovery, waits for its PID disappearance, asserts the fixture exists before removal and retains final stopped-PID/discovery/socket assertions. Pre-discovery remains 2000ms with its <4000ms assertion and cleanup receipt.

Spec and criteria
Listening readiness is restored to 10000ms, with the diagnostic expectation updated consistently and the original <12000ms child-smoke duration assertion restored. The comment explains that this budget includes startup through the first connection where the hang is planted; the pre-discovery fault is planted before startup and keeps two seconds. This directly addresses the stated early executor-sweep timeout without removing the fault-identity proof.

C2 verified from the explicit <12000 assertion, header rationale and Mac evidence: five serial listening cases range 10.371497333–10.434939292 s, all below12, with whole files 13.597782–13.700549292 s. Whole-file time includes all three scenarios and is not confused with the case bound. The additional final-tree whole-file receipt is 3/3, listening10.382188792 s. A-4443 records load admissions3.36–4.73 for the five serial runs, zero failures/cancellations/skips, and PID-gone-before-removal diagnostics. It also records typecheck/tier-lint/diff checks green after the pre-review shared T-729 integration. No manifest or timing-baseline field changed.

C1's retained assertion and 5/5 Mac portion are established; C1 remains unverified until the task's exact-head droplet result. Source clear, no findings. Normal exact-head droplet verification may proceed; final C1 settlement and confirmation of the Linux listening-case bound wait for that receipt. QA scope is none, with no per-item QA condition.

Criteria: C2 verified.

### impl-731 · 2026-10-17T09:59:20.625Z

Exact-reviewed-head droplet verification green: 9fa97d46-f287-4fbd-a7d6-dc2fb9298d6a at 589f036c7f96f44b8e7f69b06907ff4e6a249e66. 34/34 pass, zero failures/skips; Linux x64 c-8 lon1, lifetime 161 s, cost $0.0112, peak 1m load 2.15. Listening-hang case 11.165264095 s (<12 s), pre-discovery 3.337300641 s, healthy startup 2.718169221 s. Receipt A-4445: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4445-suite-9fa97d46-f287-4fbd-a7d6-dc2fb9298d6a-auto-at-589f036.log. Reviewer notified to settle final same-head verdict. Head stays unchanged as instructed by Coordinator; merge follows integrated cover 7c3aa637.

### rev-30 · 2026-10-17T09:59:42.961Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-731-final
commit: 589f036c7f96f44b8e7f69b06907ff4e6a249e66
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-731 at unchanged source-reviewed 589f036c7f96f44b8e7f69b06907ff4e6a249e66. Origin and hub record match. A-4444 / rev-20261017-731-source supplies source clearance. Exact-head droplet 9fa97d46-f287-4fbd-a7d6-dc2fb9298d6a / A-4445 exits zero. Read-only receipt audit; no Reviewer execution.

Standards: no findings. The ordinary listening-hang case passes in 11.165264095 s, below the original 12 s bound. Its passing reviewed assertions require exit1 from the planted inner smoke, the exact planted-startup-hang last event and the <12000ms inner duration. The pre-discovery case passes in 3.337300641 s with its separate two-second readiness/four-second bound unchanged. The healthy smoke passes in 2.718169221 s, with the PID-gone-before-fixture-removal diagnostic. No failing load gate or functional test occurs. A report-only 10 s duration-budget notice for the listening parent does not override the explicit 12 s acceptance bound; run exit is zero. This existing identity does not have a new load-gate requirement, and no extra repetitions are claimed.

C1 verified: the exact planted-event assertion remains source-current; A-4443 provides five serial whole-file Mac passes (listening10.371497333–10.434939292 s) plus the final-tree pass, and A-4445 executes the complete startup-smoke file successfully on Linux. C2 refreshed: header rationale, 10s listening versus2s pre-discovery readiness, and the original <12s assertion are retained; Linux parent timing also stays below12. No source/head or manifest change since review.

Selected hub phase 22/22 and Neovim smoke12/12 independently sum to34 tests,34 pass, zero failures/cancellations/skips. Coverage selection names startup-smoke.test.ts and map A-4397 at010c9955; it does not claim full-suite execution. Host typecheck gate31e8b3325b3983d3ccfc8a3e7423d6f2cd654c3c completes/reuses its candidate-tree receipt. Linux x64 c-8 lon1, Node24.21.0/Neovim0.12.5, two workers; suite80.95s, peak1m load2.15, lifetime161s, cost$0.0112.

Final review clear, no findings; C1/C2 verified at this exact head. Coordinator's stated integrated-cover/merge sequencing remains its rollout responsibility.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-17T10:30:43.542Z

Merged 79191a95a91b33a1f09ef85498f8833c342ee273 onto dev.
