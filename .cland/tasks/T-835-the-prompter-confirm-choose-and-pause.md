---
id: T-835
kind: task
title: "The prompter: confirm, choose and pause over readline, one interface per question"
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by: []
topic: topic-563
branch: t/T-835-the-prompter-confirm-choose-and-pause
created: 2026-10-19T06:34:12.616Z
updated: 2026-10-19T07:02:34.294Z
---

## Summary

Setup asks only three kinds of question. A small prompter over `node:readline/promises` asks them, with no library and one interface per question, closed before any child runs, because an open interface steals the keys meant for an installer or a login (Q-594, three of three runs). This ticket includes the one stream-level test of the real prompter that the epic asks for.

## What to build

- `confirm(question, default)`, `choose(question, choices, default)` and `pause(message)`, behind one interface that a fake prompter also implements. The prototype's `readlinePrompter` encodes the decisions and can be taken as it is:
  - Line mode with no raw mode.
  - The line iterator is created before the question is written, because a line that arrives early is otherwise lost.
  - The interface is closed after each answer.
  - End of input rejects with `Cancelled`, for this question and every later one.
- `confirm` shows `[Y/n]` or `[y/N]`, accepts y, yes, n and no, takes the default on Enter, and asks again on anything else.
- `choose` numbers its choices, accepts a number or a value, and takes the default on Enter.
- A fake prompter for the flow tests answers from a script and fails the test on a question the script did not expect.

## Acceptance criteria

- [x] C1. Over in-memory streams, confirm, choose and pause behave as described above, including the default on Enter and the repeated question on an invalid answer (T1).
  - done: impl-835 · 2026-10-19T06:39:43.743Z
  - verified: rev-31 [reviewer] · run rev-20261019-835-final · 2026-10-19T07:02:32.746Z · commit 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf
- [x] C2. After an answer, bytes still waiting on the input stream are not consumed: a reader attached after the question reads them all (T1, the stream-level check for the child-steals-keys risk).
  - done: impl-835 · 2026-10-19T06:39:44.208Z
  - verified: rev-31 [reviewer] · run rev-20261019-835-final · 2026-10-19T07:02:32.746Z · commit 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf
- [x] C3. End of input at a question rejects with `Cancelled`, and so does every later question (T1).
  - done: impl-835 · 2026-10-19T06:39:44.578Z
  - verified: rev-31 [reviewer] · run rev-20261019-835-final · 2026-10-19T07:02:32.746Z · commit 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf
- [x] C4. The fake prompter fails with the unexpected question's text when the flow asks something its script does not answer (T1).
  - done: impl-835 · 2026-10-19T06:39:45.045Z
  - verified: rev-31 [reviewer] · run rev-20261019-835-final · 2026-10-19T07:02:32.746Z · commit 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf

## Comments

### impl-835 · 2026-10-19T06:39:26.205Z

Implemented readlinePrompter and a reusable scriptedPrompter. T1 red→green slices cover confirm/choose defaults, retries and early replies, pause releasing the input, EOF cancellation, and unexpected scripted questions. Coordinator authorized the narrow test-lint pause-method correction (topic-563, decision f7407dde-b725-493d-9118-42aaa8f5042c); its separate T1 regression keeps timer pauses classified as machine resources. Host gates and whole-tree classification comparison are in progress.

### rev-31 · 2026-10-19T06:43:44.430Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-835-source
commit: 58b48e90d74903e9f4c28726d2b562f47f5cdcbd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-835 source review: clear

Head: 58b48e90d74903e9f4c28726d2b562f47f5cdcbd
Fixed base: 24ff4175ab5c787e0453e9f1f5978f17ddd79d7d
Earlier request head b8125994 is superseded by a doc-comment-only commit.
Scope: full. Six changed files; no post-review dev merge.

## Standards

Clear; no findings. The small Prompter seam uses injected streams and node:readline/promises with terminal:false. Each ask creates its line iterator before writing the question and closes its interface in finally, including errors and EOF. It uses no raw mode, prompt library, subprocess, socket or elapsed-time wait. The six public-interface tests use in-memory PassThrough streams and synchronous output-triggered replies; their T1 manifest entry is appropriate. The strict scripted fake shares the interface, verifies ordered text/RegExp and question kind, rejects invalid scripted choices, and exposes remaining steps/history for flow tests.

Separate lint audit: Coordinator decision f7407dde-b725-493d-9118-42aaa8f5042c independently authorizes the pause-method correction. It retains timer classification for bare pause calls, lexically resolved harness helpers and numeric method pauses, while permitting object prompt-message methods. Other timer names and fake-timer checks are unchanged. T1 controls cover allowed literal/variable prompt messages and refused bare duration, imported harness, namespace harness, timers/promises alias and numeric method forms, including the wall-clock finding. A-5832 reports all 420 existing files retain their direct classification; only this new stream test changes T2 to T1. This is an explicit approved heuristic boundary, not an assertion that every unknown object method can be semantically classified.

## Spec

Clear source:
- C1: confirm displays Y/n or y/N, accepts y/yes/n/no with whitespace/case handling, defaults on Enter and repeats invalid input. choose numbers labels, accepts numeric selection or value, defaults on Enter and repeats invalid answers. pause awaits a line. Tests exercise those public results and printed retries.
- C2: the interface is closed and input paused before the question promise resolves. The test then writes multiple lines before attaching the next reader and verifies exact bytes. This establishes the accepted post-settlement handoff.
- C3: EOF produces Cancelled for the active question, while ended/destroyed input rejects later confirm/choose/pause calls. Tests cover all three initial question types and no subsequent question output.
- C4: unexpected script exhaustion, text/RegExp mismatch and wrong question kind reject with the actual question text; invalid scripted choice also reports that question. Normal fake use follows the common interface and drains its script.

Handoff limit independently settled by Coordinator decision b29a44df-1a6a-4719-ae84-c18dea569075: C2 covers input written after prompt settlement, matching the accepted prototype/Q-594. Typed-ahead bytes in the answer's same chunk may be consumed by readline and are outside C2. The updated doc comment states that limit and directs the caller to type child input after its prompt. Implementer 79e8b939 reports the same behavior in prototype and candidate probes. No same-chunk preservation or follow-up is claimed.

A-5832 records the runtime-identical initial head's targeted prompter 6/6 in 0.097 s, lint 31/31 in 0.294 s and host lint/typecheck green. The only later change is the requested documentation sentence; final host check was reported running in the refreshed request. These are source-readiness receipts, not post-verdict execution evidence.

Result: clear source for one configured mode-free task verification at this exact head, with its normal host check. C1–C4 remain unverified until the receipt is audited. No full task suite or per-item QA. Any head change needs fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5838.

### impl-835 · 2026-10-19T06:44:16.394Z

Source review clear at 58b48e90 (A-5838). Final host npm run check passed. Required mode-free droplet verification submission refused by live hub on 2026-10-19: verify-tiers still classifies setup-prompter.test.ts as machine resources (notice 08c2cc24); no run created. Reported blocker to Coordinator, retaining unchanged reviewed head. No workaround or retry until an authorized capability/update decision.

### rev-31 · 2026-10-19T06:46:53.576Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-835-tier-delta
commit: 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-835 authorized tier delta review: clear

Head: 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf
Comparison: source-clear 58b48e90d74903e9f4c28726d2b562f47f5cdcbd / A-5838.
Scope: delta, as explicitly directed by Coordinator. No dev merge.

Standards: clear; no findings. Exactly two metadata changes: setup-prompter.test.ts changes its header to an honest temporary T3 explanation (in-memory streams only, no process), and tiers.json changes that file from T1 to T3. The header names the serving hub's older pause scanner and T-847's restoration condition. No runtime code, assertions, scanner implementation, baseline or allowance changes.

The prior admission refusal is binding. Coordinator decisions 80d167ad-e7b3-4fba-917a-8b6e54b4329c and 68a5ec24-32a9-44fa-a33b-01e0f2550541 independently authorize compliance with the stricter tier, including this header. No alternate submission path or hidden test/input change is used. The approved scanner correction remains unchanged; candidate classification still correctly recognizes the stream-only behavior.

Spec: source review A-5838 remains applicable to C1–C4 and both Coordinator decisions f7407dde (pause scanner) and b29a44df (post-settlement input handoff). C1/C3/C4's tests remain semantically pure; their temporary manifest classification is the explicitly authorized bootstrap exception, not a new process requirement. T-847 independently exists, blocked by T-835, and owns T1 restoration plus serving-hub admission proof after merge/restart. This review does not claim that follow-up is complete.

A-5841 records the refusal/compliance path and unchanged-runtime targeted prompter 6/6 in 0.077 s. Implementer 31ce817d confirms final host npm run check green at this unchanged head; earlier lint controls and whole-tree comparison remain applicable. No post-source verification evidence exists yet.

Result: source delta clear for one unchanged-head mode-free configured task verification through normal admission. C1–C4 remain unverified until its receipt and retained host evidence are audited. Temporary T3 native batch coverage/T-847 restoration remain separately attributed; do not claim that a T0–T2 task run executes the temporarily T3 prompter file. No full task run or per-item QA.

Findings: Standards 0; Spec 0.

Evidence: A-5843.

### rev-31 · 2026-10-19T07:02:32.746Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-835-final
commit: 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-835 final evidence review: clear

Head: 5202c99ab43aa2edaff6e2a4f456308e3a6cf5cf, unchanged from authorized tier-delta review / A-5843.
Run: 52d0fbf4-db76-45ad-ba93-c1a3618d2721 / A-5853, raw exit 0.
Scope: evidence. Branch tip and task receipt match; C1–C4 are claimant-done.

## Standards

Clear; no remaining findings. The separately authorized scanner correction positively passes its exact-head T1 regression in 0.019646353 s and five fresh load repetitions. All 31 test-lint cases pass (sum 0.806453802 test-seconds), preserving the broader binding/timer controls. No owned budget overrun, runtime tier mismatch, skip or quarantine is reported. All three ordinary phase failure arrays are empty and all 388 reported load-gate identities pass 5/5.

The five report-only runtime tier mismatches are outside T-835: the three previously tracked suite-close-component rows and the two suite-soak-component rows already reported for lead/Coordinator deduplication in T-669's review. Existing external budget overages, static lint findings and 51 missing baselines remain disclosed in A-5853; this is not a zero-debt/global-enforcement claim.

## Spec

Verify C1–C4 using the source review A-5838, authorized metadata delta A-5843, retained stream-host evidence A-5832/A-5841, and this positive task gate:
- C1: stream-only confirm/choose/pause tests cover accepted values, defaults, printed questions, invalid-answer retries and early synchronous replies.
- C2: the next-reader test verifies all bytes written after prompt settlement before attaching that reader. Coordinator b29a44df explicitly defines this accepted boundary; same-answer-chunk typed-ahead bytes may be consumed and are documented as outside it.
- C3: EOF cancels the active question and every later question through all three methods, without later prompt output.
- C4: the shared strict scripted fake rejects exhaustion, wrong text/RegExp, wrong kind and invalid choice with the unexpected question's text.

Execution limits: setup-prompter.test.ts is temporarily declared T3 solely to comply with the old serving hub's explicit admission refusal, per Coordinator 80d167ad/68a5ec24. It did not execute in this T0–T2 task receipt. A-5841 records its six ordinary host cases passing at this exact unchanged-runtime head in 0.077 s; no Linux prompter execution or five file repetitions is claimed. Its behavior is semantically T1; the temporary classification is an approved bootstrap exception. T-847 remains blocked on T-835 and owns restoring T1/removing the header after merge/restart, with serving-hub admission proof. Merge-batch T3 execution is separate landing evidence. This verdict does not mark that follow-up or deployment complete.

The initial refused submission produced no run; only the normal admitted replacement at the Coordinator-authorized head supplies task evidence. The scanner correction, runtime code and assertions were not altered to evade admission.

Ordinary totals: 1468 tests, 1468 pass, zero failure/cancelled/skip/TODO (373 whole-T1 phase, 863 hub component, 232 Neovim). Host check passes. Suite 775.50 s, load-gate extra wall 472.32 s, peak load 6.63. Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 854 s, cost $0.0593. Reported T3 ratchet equals base 2651.501 s with incomplete timings separately disclosed; it is not a measurement of the deferred temporary T3 file.

Result: final clear; C1–C4 verified. No further task run or per-item QA. T-847 and landing batch remain separate obligations.

Findings: Standards 0; Spec 0.

Evidence: A-5854.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
