---
id: T-720
kind: task
title: Load-gate repetitions keep the failed repetition's assertion and stack in the suite log
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-418
branch: t/T-720-load-gate-repetitions-keep-the-failed
created: 2026-10-16T20:17:40.486Z
updated: 2026-10-17T05:12:34.399Z
---

## Summary

A load-gate repetition that fails is reported only as a count ("4/5 passed"). Its assertion, error and stack are dropped from the durable suite log, so nobody can tell an owned failure from a shared one or diagnose it after the run. T-635's run 7d03777a (A-4175) is the case that showed it.

## What to build

The load gate keeps, for each failed repetition, the test's assertion message, error and stack in the suite log and the result artifact, next to the counts. Passing repetitions stay as counts. Diagnostics follow the existing redaction rules: no environment values or command lines.

## Acceptance criteria

- [x] C1. A planted test that fails one of five load-gate repetitions shows that repetition's assertion message and stack in the durable suite log and the result artifact, proved by a runner test.
  - done: impl-720 · 2026-10-17T05:12:13.077Z
- [x] C2. Passing repetitions are still reported only as counts, and the reported diagnostics carry no environment value, proved by the same test file.
  - done: impl-720 · 2026-10-17T05:12:13.290Z

## Comments

### coord · 2026-10-16T23:14:56.500Z

Coordinator, scope addition from T-681's run c1d75969 (A-4239). One load-gate repetition of a new test failed fast, kept running and never reported. It held the machine phase until the 60-minute run timeout, so 97 identities started and 96 finished 5/5 with nothing to show which one hung. Besides keeping the failed repetition's assertion and stack, this ticket also bounds each repetition by the test's own per-test timeout, and on expiry records it as a timed-out repetition with its diagnostics. The rest of the run then finishes.

### impl-720 · 2026-10-17T04:13:39.055Z

Implementing durable per-repetition diagnostics and an external repetition deadline, with runner regression proof at the existing package-runner seam. Read E-676 and Test levels; no per-item QA required by the stage policy.

### impl-720 · 2026-10-17T04:17:37.665Z

Pushed review head 5f4f2d722c9eebe4e76fe433411dee8031178b21, with origin/dev e443f8f4 merged before first review. Evidence A-4299 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4299-t-720-implementation-and-targeted-verification.md. Reviewer request delivered; typecheck, tier lint, runner (20/20, 27.283s), pure diagnostics (2/2, 0.067s) and selection (86/86, 18.587s) checks are green. Awaiting source verdict before droplet verify.

### rev-30 · 2026-10-17T04:19:03.156Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-720-source
commit: 5f4f2d722c9eebe4e76fe433411dee8031178b21
scope: full
findings: [{"severity":"medium","text":"M1: Diagnostic redaction leaks multiline command invocations and escaped environment values. The command replacement consumes only [^\\n]*, so a normal exec/execFile error containing a multiline -e/script argument retains its later command lines in both message and stack. Environment replacement matches only raw values, so a newline-containing value rendered with JSON escaping is retained. Sanitize the complete command-error representation and escaped environment representations, with regressions through the reporter/log/summary path.","file":"hub/src/suite-load-diagnostics.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review T-720 at 5f4f2d722c9eebe4e76fe433411dee8031178b21, fixed point e443f8f4 (merged before first review). Origin branch resolves to the requested head. Read-only review; no Reviewer execution.

## Standards
No findings. New pure serializer/redactor tests are T1 with a sorted manifest entry. Runner regressions state the real Node process-lifecycle contract, use a listening socket rather than a long sleep, wait for completed package execution before checking exact worker disappearance, and retain continuation assertions. Existing assertions are preserved.

## Spec
Medium M1 — hub/src/suite-load-diagnostics.ts:25–26: redaction is incomplete for representations the newly retained error message/stack may contain. A command failure containing a multiline argument, for example a message beginning "Command failed: node -e ..." followed by another script line, is replaced only through its first newline because the regex ends in [^\n]*. Later invocation lines remain verbatim. This is a normal possible shape of child_process exec/execFile errors with multiline script arguments, not an arbitrary property the serializer can omit. Likewise, matching raw environment values does not remove their JSON-escaped form: for PRIVATE containing a newline, an assertion message containing JSON.stringify(PRIVATE) retains its escaped contents. These retained strings cross the reporter receipt and are copied into the full durable log/result summary. Add conservative command-error handling and escaped-value coverage, including reporter/log/summary assertions. C2 fails until this is corrected.

The failure record otherwise carries repetition index, nested assertion/error/stack and timeout metadata; the summary copies full records without its normal 200-character failure clipping. Configured timeout plus 250 ms external deadline, identity-verified cleanup and continuation match primary Coordinator decision 79cb0fb5 in topic-418. The scope explicitly does not require discovering per-test override values.

A-4299 reports targeted runner 20/20, pure diagnostic 2/2, selection 86/86, typecheck and tier lint. Existing redaction tests cover a single-line command and a simple unescaped environment token, so they do not establish the missing cases. C1 and timeout runtime evidence remain pending; no full task verification has been submitted.

Verdict not clear. Fix M1 and request source review at the new head before verification.

Criteria: C2 failed (M1: Multiline command error contents and escaped environment values remain in emitted diagnostics; add conservative redaction and end-to-end regressions.).

### impl-720 · 2026-10-17T04:21:06.032Z

M1 fixed at pushed head bcf2c655f86bf22aa7403608123e73facc4c53eb: redact entire multiline command tail and raw/JSON-escaped environment values, retaining actual stack frames. Direct reporter receipt plus package log/summary regressions prove redaction. Typecheck/tier lint pass; runner 20/20 (28.222s), pure/reporter 4/4 (0.070s), final reporter-default package regression 1/1 (1.384s). No dev merge since first review. Requesting new-head source review before verify.

### rev-30 · 2026-10-17T04:21:29.525Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-720-redaction-correction
commit: bcf2c655f86bf22aa7403608123e73facc4c53eb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source review T-720 at bcf2c655f86bf22aa7403608123e73facc4c53eb, delta from 5f4f2d722c9eebe4e76fe433411dee8031178b21. One correction commit, no dev merge; origin branch matches. Read-only review, no Reviewer execution.

## Standards
No findings. Direct reporter receipt coverage remains T1 (in-memory Transform, no process/socket/real-time wait). Existing real runner lifecycle regression remains justified T3. No assertion weakening in the deadline/cleanup/continuation proof.

## Spec
M1 resolved. Redaction now removes the entire multiline command-message tail and matches both literal and JSON-escaped environment values. For Error.stack, the exact captured message is replaced as a unit before independently preserving its frame suffix; command text that resembles a frame inside the message is not mistaken for a real frame. Reporter env injection defaults to process.env in production.

New pure and reporter receipt tests assert multiline invocation continuation and escaped secret contents are absent while actual frames remain. The package-runner nested assertion now plants both cases, checks the entire captured log for absence, retains assertion/error/frame checks, and verifies the same sanitized diagnostic record survives suiteSummary. The original one-failed-of-five, passing control, all-attempts and exact-worker teardown assertions remain intact. The unchanged configured deadline plus 250 ms grace follows primary Coordinator 79cb0fb5.

Claimant correction evidence: typecheck/tier lint green; durations-runner 20/20 in 28.222 s; pure/reporter 4/4 in 0.070 s; focused final package diagnostic 1/1 in 1.384 s. Prior selection 86/86 applies to unchanged selection source.

Source clear with no remaining findings. C1/C2 remain unverified pending normal mode-free same-head droplet verification; this is source clearance, not final runtime settlement.

### rev-30 · 2026-10-17T05:10:42.175Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-720-first-gate
commit: bcf2c655f86bf22aa7403608123e73facc4c53eb
scope: evidence
findings: [{"severity":"medium","text":"M2: Both owned runner regressions assume stack text keeps fixture.test.ts despite deliberate redaction of every environment value. A-4313 ordinary assertions at lines 99 and 137 instead receive fixture.[redacted].ts and both identities fail 0/5 repetitions. Make the fixture environment/assertions deterministic under required redaction, retaining real frame, sanitized-content, continuation and exact-worker checks; do not weaken redaction.","file":"hub/test/durations-runner.test.ts","line":99},{"severity":"medium","text":"M3: The new outer-deadline regression has no measured duration allowance and fails the existing hard 5 s gate at 6.977 s in A-4313. Add a reasoned allowance with open owner and required UTC dates, or remove the demonstrated overhead while preserving the lifecycle proof.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence review T-720 at unchanged source-cleared bcf2c655f86bf22aa7403608123e73facc4c53eb. Completed normal mode-free Linux droplet 2119172a-b7c8-415e-aaba-a9050b1dff33 / A-4313 exits 1: 2077 tests, 2070 passed, 2 failed, 5 skipped, no cancelled tests. Hub stops before Neovim.

## Standards
Medium M3 — hub/test/durations.json: the newly added outer-deadline lifecycle test takes 6.977197643 s and has no allowance, yielding the explicit hard duration-budget failure. Any new allowance needs the documented reason, open owner and UTC added/expires dates, rather than relaxing the global gate.

## Spec
Medium M2 — hub/test/durations-runner.test.ts:99 (also :137): both owned runner cases fail their literal fixture.test.ts stack regex because required environment redaction produces fixture.[redacted].ts in this environment. Ordinary failure details are at A-4313 lines 4939 onward. Each identity then fails all 5/5 load repetitions with the same assertion; this is not an unexplained timeout or shared defect. Retain redaction and make the regression setup/assertions account for the sanitized representation while proving real stack/frame retention. Preserve the secret/command absence, count, summary, completion and exact-worker assertions.

The new diagnostic path supplies the failed assertions and nested stacks in the durable log. The timeout fixture also shows timed out (outer deadline), retained earlier assertion and successful remaining-count/following-identity checks before reaching its failing stack regex. Its later summary/attempt-count/PID-gone assertions were not reached, so this receipt does not establish those checks. Original M1 multiline/escaped redaction is not reopened by this evidence.

C1 and C2 fail evidence settlement because their designated owned regression file is red; the added timeout scope also remains unverified. Source correction A-4306 remains the reviewed implementation, but a failed runtime receipt cannot be final clear. Fix M2/M3, request new-head source review, then verify only after that clearance. No Reviewer execution or edits.

Criteria: C1 failed (M2: Both owned runner regressions fail literal stack-filename assertions ordinarily and 0/5 load gates; later summary/cleanup checks are not established.), C2 failed (M2/M3: Runner proof is red under required environment redaction and the new timeout case fails its hard 5 s duration budget at 6.977 s.).

### impl-720 · 2026-10-17T05:12:13.579Z

Pushed 92ab691b620d5e6d41457fab171b141621387b7f for M2/M3. Reproduced both A-4313 path assertions with a controlled harmless collision; retained that collision and corrected exact sanitized source-frame expectations. All diagnostic, summary, privacy, all-five, next-identity and exact-PID assertions remain. Added 8s dated lifecycle allowance based on Linux 6.977s, owned by open E-676 until stage-close duration refresh. Production code unchanged. Typecheck, tier lint, duration owner/date lint pass; runner 20/20 in 27.319s at load below 4. New-head review requested before retry.

### rev-30 · 2026-10-17T05:12:34.399Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-720-frame-correction
commit: 92ab691b620d5e6d41457fab171b141621387b7f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction review T-720 at 92ab691b620d5e6d41457fab171b141621387b7f, delta from bcf2c655f86bf22aa7403608123e73facc4c53eb. Two files only, one commit; no dev merge; origin branch matches. Read-only review.

## Standards
No findings. The measured allowance is 8 s, names the actual lifecycle work and A-4313's Linux 6.977 s observation, uses open parent E-676 and UTC 2026-10-17 / 2026-10-24 (seven days). No timing baseline, global gate or load-gate exemption changes.

## Spec
M2 resolved in source: the fixture now deliberately supplies the harmless env value test, reproducing the observed source-filename collision on every machine. Both frame assertions require the expected sanitized fixture.[redacted].ts path and an actual at frame. Redaction is not weakened. Nested assertion/error, private value/command absence, repetition identity/count, summary retention, all-five completion, following identity and exact worker PID-gone assertions remain.
M3 resolved in source by the reasoned measured allowance. Production serializer, reporter, deadline, cleanup and continuation code is byte-unchanged from A-4306's source review; original M1 remains resolved.

Claimant reports controlled red-before/green-after for the collision, whole runner 20/20 in 27.319 s, typecheck/tier lint and duration owner/date lint green. The failed old-head A-4313 is retained as failure/measurement evidence, not substituted for a new-head green.

Source clear with no remaining findings. C1/C2 await normal mode-free same-head droplet verification and remain unverified.
