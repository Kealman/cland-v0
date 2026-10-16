---
id: T-621
kind: task
title: Codex lists implement, to-spec, to-tickets, triage and wayfinder
state: open
status: in progress
size: XS
criterion_seq: 4
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by: []
topic: topic-385
branch: t/T-621-codex-lists-implement-to-spec-to-tickets
created: 2026-10-16T15:57:48.700Z
updated: 2026-10-16T19:07:22.450Z
---

## Summary

Make each kept skill's Codex flag in `agents/openai.yaml` agree with its frontmatter, so the skills that Claude Code and OpenCode may already invoke on their own are listed by Codex too, and a project on Codex alone can run the Coordinator's skills.

## What to build

This repository's first commit removed `disable-model-invocation: true` from the frontmatter of several upstream skills but left `policy.allow_implicit_invocation: false` in their `agents/openai.yaml`. Codex therefore hides implement, to-spec, to-tickets, triage and wayfinder (and retro, the sixth kept skill in that state) while Claude Code lists them. Each kept skill's Codex flag now follows its frontmatter: a skill without `disable-model-invocation: true` carries no `allow_implicit_invocation: false`, and a skill that keeps the frontmatter flag (handover) keeps the Codex flag.

A test pins the rule for the whole set, so a later edit cannot let the two flags drift apart again.

## Acceptance criteria

- [x] C1. The `agents/openai.yaml` of implement, to-spec, to-tickets, triage, wayfinder and retro no longer sets `allow_implicit_invocation: false`, and their `interface` block is unchanged.
  - verified: rev-31 [reviewer] · run rev-20261016-621-source · 2026-10-16T17:23:29.930Z · commit 41ada2ca649539af7d810f49555aed299dc94652
  - done: impl-621 · 2026-10-16T19:07:21.369Z
- [x] C2. handover keeps both `disable-model-invocation: true` and `allow_implicit_invocation: false`.
  - verified: rev-31 [reviewer] · run rev-20261016-621-source · 2026-10-16T17:23:29.930Z · commit 41ada2ca649539af7d810f49555aed299dc94652
  - done: impl-621 · 2026-10-16T19:07:22.065Z
- [x] C3. A new test reads every skill folder of the shipped set and fails when a skill's `allow_implicit_invocation: false` and its `disable-model-invocation: true` are not both present or both absent.
  - done: impl-621 · 2026-10-16T19:07:22.450Z

## Comments

### impl-621 · 2026-10-16T16:00:07.094Z

Implemented removal of policy overrides in six openai.yaml files, preserving interface text. New filesystem metadata regression reads every shipped skill (including skills with no optional Codex metadata); pre-fix it identified all six intended mismatches. After fix, only nine mismatches remain, all in T-620's dropped set. Waiting for that cut on origin/dev before green test/source review; no dropped skill files changed. New test is classified free in shards.json.

### coord · 2026-10-16T16:00:48.328Z

Coordinator, 2026-10-16: C4 (a real Codex session's skill list after a fresh cland init) was removed from this ticket. It's verified at E-615's epic demo, whose DoD has QA read Codex's list on this Mac (E-615 C3). This ticket's C3 test guards the flag-to-frontmatter parity.

### impl-621 · 2026-10-16T17:22:37.206Z

Merged origin/dev 245857c7 (T-620 cut) before first review. Exact review head 41ada2ca649539af7d810f49555aed299dc94652 is pushed. Targeted new file passes (1 test, 29 ms); npm run typecheck exit 0; shard lint and diff check exit 0. C1–C3 complete; C4 moved to E-615 QA by Coordinator. Requesting source review before droplet verification.

### rev-31 · 2026-10-16T17:23:29.930Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-621-source
commit: 41ada2ca649539af7d810f49555aed299dc94652
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0 findings, A-4064. Six YAML files remove only policy/allow_implicit_invocation:false; interface text unchanged. Handover byte-unchanged and both explicit-only flags independently read. New free test dynamically enumerates shipped source directories, parses real frontmatter/optional YAML, reports mismatches in either direction, propagates nonmissing errors. A-3948 red proof and A-4060 post-T-620 targeted1of1/typecheck/shards green; ref/diffcheck confirmed. C1/C2 verified; C3 final execution awaits fresh exact-head no-mode droplet gate. Former C4 explicitly moved to E-615 QA by Coordinator item comment, no real-session listing claimed. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified.

### impl-621 · 2026-10-16T19:07:02.201Z

Droplet verification 2a0b0a78 / A-4130 at source-reviewed 41ada2ca: new parity test passed and load gate 5/5. Overall exit 1: known T-585 schedule assertion (second launch PID before expected schedule), known T-657/T-526 suite SIGKILL null PID candidate, plus T-603 pinned/inherited directory budget entries addressed by posted shared fix ad5e2c86. Reported to supervising lead; holding head and unrelated diagnosis pending Coordinator direction.

### rev-31 · 2026-10-16T19:07:08.378Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-621-evidence-1
commit: 41ada2ca649539af7d810f49555aed299dc94652
scope: evidence
findings: [{"severity":"medium","text":"External T-585 next-launch scheduling assertion returns PID29600 instead ofnull, leaving gate red.","file":"hub/test/claude-code-adapter.test.ts","line":349},{"severity":"medium","text":"External T-526-family crash-result case calls process.kill(null), failing ERR_INVALID_ARG_TYPE.","file":"hub/test/suite.test.ts","line":52},{"severity":"medium","text":"Two external T-603 cases pass behavior but exceed new-case duration budget at6.800s/5.902s versus5s; shared allowance disposition required.","file":"hub/test/claude-code-adapter.test.ts"}]
finding_counts: {"high":0,"medium":3,"low":0}

Evidence not clear, A-4131. Independently inspected exact-head2a0b0a78/A-4130 exit1:1969pass/2fail/5skip, Neovim smoke not reached. Own parity test ordinary green and5of5 load repetitions; C1/C2 source marks remain current, C3 pending final gate/disposition. Three external blockers recorded, no passing task criterion failed. Bugs/S aside for existing T-585 and T-526 signatures; Tech debt/XS for existing T-603 allowance gaps. No scope expansion or exception assumed; await lead/Coordinator direction. Current claimant C1–C3 done marks absent; submit supported marks with evidence. Lifetime1594s/cost$0.1107 perhub. No Reviewer edits/tests.
