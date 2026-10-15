---
id: T-490
kind: task
title: "suite-remote-budget test: candidate result not within 20 s when three remote callers run beside the local slot (Linux)"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-300
branch: t/T-490-suite-remote-budget-test-candidate
created: 2026-10-15T11:56:46.304Z
updated: 2026-10-15T15:31:04.979Z
---

## Problem

`hub/test/suite-remote-budget.test.ts:106/:131`, 'three remote callers run together beside the local slot, which a human takes next', failed on Linux with "candidate result: not within 20000 ms". It happened in T-486's droplet verify f45f0ae5 at 47c3b8cf (A-2956), and T-486 doesn't touch the file. T-435 fixed a different case in this file, the missed 'remote budget 1/1 full' notice.

## Acceptance criteria

- [x] C1. The case waits for the candidate result on an observed state rather than racing three remote callers' completion under load. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
  - done: impl-490 · 2026-10-15T15:17:25.346Z
  - verified: rev-30 [reviewer] · run rev-20261015-490-source · 2026-10-15T15:31:04.979Z · commit 34251b57aa6c1203b641be6ba0e75c7487d17c44
- [ ] C2. suite-remote-budget.test.ts passes 5/5 serially, whole file and alone, beside a local full run, plus once on a droplet in the task's verify.

## Comments

### impl-490 · 2026-10-15T15:09:02.506Z

Diagnosis: baseline named case passes quiet on Mac (9.52s); original Linux receipt A-2956 fails the remote-result loop at :131. A temporary probe delays remote candidate exit 18s and fake SSH log collection 3s, reproducing the exact 'candidate result: not within 20000 ms' at that loop (27.08s case total). The result deadline starts at barrier release, so it includes unfinished candidate execution plus log collection/release/report for three runs. Testing an observed runs/<id>/done boundary before the unchanged result wait. Probe changes will be removed.

### impl-490 · 2026-10-15T15:17:27.308Z

Final source committed/pushed as e13e972e after fetching/merging origin/dev (8389c3dd). Diff is four inserted lines in suite-remote-budget.test.ts. A-3099 records the controlled reproduction and root cause. One pre-merge quiet whole-file Mac run passed all 10 tests (56.03s); gathering the required serial passes on the committed head now, checking the first-come Mac window each time.

### impl-490 · 2026-10-15T15:29:47.873Z

Mac evidence complete at final committed/pushed head 34251b57aa6c1203b641be6ba0e75c7487d17c44: five serial QUIET whole-file passes, 10/10 tests each, 50 total and zero failures. File durations 67.228s, 63.999s, 57.953s, 61.280s, 61.449s. A-3120 holds all logs plus original baseline and controlled red/green probe. E-482 12:32Z Coordinator decision replaces beside-full-run overlap with quiet/loaded labels. C2's Linux droplet receipt remains pending until clear source review; QA policy none, no QA criteria.

### rev-30 · 2026-10-15T15:31:04.979Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-490-source
commit: 34251b57aa6c1203b641be6ba0e75c7487d17c44
scope: full

Source review clear at 34251b57aa6c1203b641be6ba0e75c7487d17c44, fixed point 7df53ebe38de56c5d352a29c245a76f42a872446 (three-dot diff), source commit e13e972ef0c789e503dacfffb1ac683b74ee6976. No high, medium or low findings.

Standards: four inserted lines in hub/test/suite-remote-budget.test.ts use the existing eventually helper and real per-run done receipts, consistent with hub/README.md's observed positive-wait guidance. All three observations run concurrently and are bounded at 20000 ms. Droplet run.sh writes the timestamp after candidate execution in its exit trap; fake provider deletion preserves the machine directories until fixture cleanup, so completed receipts remain observable. No new fixed delay, runtime change or fixture hook. Whitespace check passes. No baseline smell finding.

Spec: C1 verified. The observed completion boundary separates candidate execution from the unchanged candidate-result publication waits. Every original line/assertion and existing bound is retained, including three active remotes alongside local, human next-local admission, remote executor reports and empty-droplets cleanup. Commit body records the deadline-overlap root cause and controlled probe. Net branch diff against merged dev is only this four-line insertion; inherited dev integration introduces no task conflict.

Evidence read: A-3099 diagnosis and A-3120 raw logs. Controlled delayed probe reproduces exact candidate-result timeout before change (27.077 s), then passes with the same temporary delays after change (31.310 s); probe delays are absent from final source. Five serial quiet whole-file Mac runs at the requested head each pass 10/10, 50/50 overall, zero failures/cancellations/skips (67.228,63.999,57.953,61.280,61.449 s). Quiet labels satisfy Coordinator's E-482 12:32Z exception to the body's beside-full-run requirement. C2 remains unverified pending Linux task verification and accepted final gate.

Both review axes performed directly under the Reviewer no-delegation clause. No Reviewer tests or edits. Proceed with one cland verify --executor droplet at this exact reviewed head, reporting in this topic.

Criteria: C1 verified.
