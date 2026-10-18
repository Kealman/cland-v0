---
id: T-761
kind: task
title: test:tiers refuses a duration allowance owned by a task, so a merge can't make dev's manifest invalid
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-514
branch: t/T-761-test-tiers-refuses-a-duration-allowance
created: 2026-10-17T22:53:23.993Z
updated: 2026-10-18T14:44:54.228Z
---

## Summary

On 2026-10-17 at 22:53Z, T-707 merged nine scenario allowances in hub/test/durations.json that named T-707 as their owner. Merging closed T-707, and verify-tiers then refused every run on dev with "duration allowance has closed owner T-707". coord re-owned them to E-677 in 315af806. The task's own review and verify passed, because the owner was still open then.

## What to build

The static gate (`npm run test:tiers`, in T0) refuses an allowance whose owner is a task-kind item and names the open container to use instead. An epic, release or category owner stays valid while it is open.

## Acceptance criteria

- [x] C1. A T1 test feeds test:tiers's manifest check an allowance owned by an open task, gets a refusal naming the line and saying an epic owner is required, and fails before the fix.
  - done: impl-761 · 2026-10-18T14:43:51.812Z

## Comments

### impl-761 · 2026-10-18T14:30:29.125Z

T1 regression written at lintHubShards (test:tiers manifest seam), before implementation. It requires task-owner refusal with owner line, allowance key and parent epic E-482. Cover-quiet blocks the first red run; no tests run. git fetch origin plus test:lint and typecheck passed.

### rev-31 · 2026-10-18T14:43:08.523Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-761-source-1
commit: 0a78b6246969dbfaf8267f2b6d657484e9a68103
scope: full
findings: [{"severity":"medium","text":"Owner diagnostic location searches quoted text without property boundaries; valid earlier reason values can redirect the reported line to another owner's entry.","file":"hub/src/suite-durations.ts","line":105}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-761 source review

Commit: 0a78b6246969dbfaf8267f2b6d657484e9a68103
Fixed base: 2a3aa788d8fa47f2c6c4f688e9e822f84dcfd1b9
Run: rev-20261018-761-source-1
Scope: full
Result: not clear

Reviewed task C1, five-file diff, checkout and immutable-tree manifest gates, live tracker owner metadata, and T1 controls. No Reviewer tests or edits.

## Standards
No findings. Tests use scratch manifests/tracker files and the existing in-process manifest seam, with supplied legacy keys avoiding native Git. No new processes, sockets, wall-clock wait or allowance. Existing duration fixtures change to epic owner metadata without removing behavior checks. A-5347 records the missing-rejection red; A-5351 reports serial suite-tiers 13/13 (.497 s), runner-budget 3/3 (.100 s), duration-budget 6/6 (.262 s), tiers/lint/typecheck/diff checks green.

## Spec
Medium M1 — hub/src/suite-durations.ts:105 (C1): the exact owner-line diagnostic is based on substring search rather than JSON property identity. It finds the first JSON-quoted allowance key text after allow, then the next quoted owner text. A valid earlier epic-owned allowance can put the later task-owned key in its reason value (reason before owner); the lookup then reports the earlier epic owner's line for the rejected task. An owner string in another value is likewise not a property boundary. The task refusal itself still occurs, but C1's required line does not reliably identify its owner entry.

Use structural node ranges for the selected allow property and its owner property and add the valid reason-value collision as a red-capable control. Implementer a80b7daf-16a1-4437-b664-369aa25e56cb confirms no structural guarantee excludes it and will correct the lookup before a fresh review. Do not verify this head.

Other behavior is aligned: owners are identified by kind/state from the live authoritative tracker, not id prefix; open tasks refuse while epic/release/category and old T-prefixed epic fixtures remain accepted; closed/unknown owners still refuse. Ancestor traversal is cycle-bounded and finds an open container for guidance. Both checkout and immutable merge-tree lint pass manifest source and structured owner facts into the same validator. Legacy/dates/budget decisions remain intact.

C1 fails the exact source-location diagnostic requirement. No final execution criterion verified; no per-item QA.

Standards: zero findings. Spec: one medium finding.

Artifact A-5357.

Criteria: C1 failed (Substring lookup can report an earlier allowance owner's line when its reason equals the rejected task allowance key.).

### impl-761 · 2026-10-18T14:43:41.331Z

Addressed source review M1/C1: a reason equal to the later allowance key now reproduces red (A-5358), then passes after locating the actual allow[key].owner property with structural document ranges. suite-tiers 13/13 (1.029s); final lint, typecheck, test:tiers and diff check pass. No dev merge after first source review (rule 11). Fresh source review follows.

### rev-31 · 2026-10-18T14:44:54.228Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-761-source-2
commit: 39bc9862593cfba04eefcb6ba5e6a012813805f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-761 corrected source review

Commit: 39bc9862593cfba04eefcb6ba5e6a012813805f0
Fixed base: 2a3aa788d8fa47f2c6c4f688e9e822f84dcfd1b9
Run: rev-20261018-761-source-2
Scope: full
Result: clear

Reviewed the two-file correction against 0a78b624 and retained the full task assessment from source-1. Origin matches this head; parent is 0a78b624 and no dev merge occurred after first review. No Reviewer test execution or edits.

## Standards
No findings. Uses the existing yaml dependency and its structural document nodes/ranges to locate JSON source fields, without new dependencies or runtime resources. The T1 fixture remains in-process; prior duration-decision tests keep their assertions and epic metadata. A-5358 is the retained red for the added valid reason-value collision: prior lookup reported line 19 instead of the selected task owner's line. Corrected suite-tiers 13/13 in 1.029 s (target .030 s), tiers/lint/typecheck/diff checks reported green; unchanged other touched files retain 3/3 and 6/6 targeted evidence.

## Spec
M1/C1 resolved. Source location selects the allow map, the exact allowance key, then the actual owner property key and its range start. It cannot confuse a reason value equal to another allowance key or another scalar equal to owner with those properties. The original exact-line assertion remains and now includes that earlier reason collision.

Kind/state owner lookup, cycle-bounded ancestor guidance, live authoritative tracker semantics and checkout/immutable-tree lint wiring remain unchanged from the reviewed implementation. Open task owners refuse with key, task id, actual source line and open epic/container guidance. Open epic/release/category owners and old T-prefixed epic owners remain valid; closed and unknown owners still refuse. No duration limit, dates, legacy policy or manifest ownership change is introduced.

Source clear with no remaining findings. C1 awaits the exact-head post-source-clear mode-free task receipt; source clearance does not claim execution completion. No per-item QA.

Standards: zero findings. Spec: zero findings.

Artifact A-5363.
