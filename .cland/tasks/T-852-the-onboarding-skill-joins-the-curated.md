---
id: T-852
kind: task
title: The `onboarding` skill joins the curated set in its accepted wording, and `cland init` provisions it
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by: []
topic: topic-570
branch: t/T-852-the-onboarding-skill-joins-the-curated
created: 2026-10-19T08:10:02.575Z
updated: 2026-10-19T09:34:03.586Z
closed: 2026-10-19T09:34:03.586Z
---

## Summary

The prototype's onboarding skill becomes the 21st skill of the curated set, copied from 0ff421f8 with no change to its text. `cland init` provisions it and `cland update` adds it. A check keeps every `cland` command the skill names a real command.

## What to build

- **The files.**
  - Copy `.agents/skills/onboarding/` from 0ff421f8 into dev: SKILL.md, EMPTY.md, EXISTING.md, WELCOME.md, TOUR.md and `agents/openai.yaml`.
  - The only edit is the Codex flag: it must agree with the frontmatter. Recommended: drop `allow_implicit_invocation: false`, so setup's brief can start the skill on any harness (open question 3).
- **This repository.**
  - Add the `.claude/skills/onboarding` link beside the others.
  - `skills/README.md` says onboarding is one of cland's own skills, in the present tense.
- **Provisioning test.** The init test expects 21 skills. Its title changes from "20 curated skills", so carry its `durations.json` key in the same commit.
- **Command check.** A new `hub/test/skills-onboarding.test.ts` (T1) extracts every backticked `cland <command> [<subcommand>]` from the skill's five files and asserts that the CLI's usage text lists each one. It also asserts that each `cland config set <key>` names a key in `configKeys()`. Later tickets add their T2 cases to this file.

## Acceptance criteria

- [x] C1. `git diff 0ff421f8 -- .agents/skills/onboarding` on the branch shows no change except the removed Codex flag line and YAML quoting of the SKILL.md description with its value unchanged (source review).
  - done: impl-852 · 2026-10-19T08:13:15.545Z
  - verified: rev-30 [reviewer] · run rev-20261019-852-source · 2026-10-19T08:14:29.479Z · commit 0f40454460b8a801576ad9f2aa83375cccd2bf28
  - verified: rev-30 [reviewer] · run rev-20261019-852-final · 2026-10-19T08:33:11.214Z · commit 0f40454460b8a801576ad9f2aa83375cccd2bf28
- [x] C2. `cland init` in a temporary project provisions 21 skills, `onboarding` among them, with every file of it hashed in the manifest (T2, init.test.ts).
  - done: impl-852 · 2026-10-19T08:13:16.004Z
  - verified: rev-30 [reviewer] · run rev-20261019-852-final · 2026-10-19T08:33:11.214Z · commit 0f40454460b8a801576ad9f2aa83375cccd2bf28
- [x] C3. skills-invocation.test.ts passes with the onboarding skill present, so its Codex flag and its frontmatter agree (T1).
  - done: impl-852 · 2026-10-19T08:13:16.469Z
  - verified: rev-30 [reviewer] · run rev-20261019-852-final · 2026-10-19T08:33:11.214Z · commit 0f40454460b8a801576ad9f2aa83375cccd2bf28
- [x] C4. skills-onboarding.test.ts fails on a planted unknown command such as `cland crew add` and passes on the shipped files (T1); a command the skill names that an open v0.1.4 item still has to add (today only `cland setup`, owned by T-837) sits in a named pending list keyed by its owning item, and the test fails once usage lists that command while the entry remains.
  - done: impl-852 · 2026-10-19T08:13:16.927Z
  - verified: rev-30 [reviewer] · run rev-20261019-852-final · 2026-10-19T08:33:11.214Z · commit 0f40454460b8a801576ad9f2aa83375cccd2bf28
- [x] C5. This repository's `.claude/skills/onboarding` resolves to `.agents/skills/onboarding`, and `skills/README.md` lists onboarding among cland's own skills (source review).
  - done: impl-852 · 2026-10-19T08:13:17.298Z
  - verified: rev-30 [reviewer] · run rev-20261019-852-source · 2026-10-19T08:14:29.479Z · commit 0f40454460b8a801576ad9f2aa83375cccd2bf28
  - verified: rev-30 [reviewer] · run rev-20261019-852-final · 2026-10-19T08:33:11.214Z · commit 0f40454460b8a801576ad9f2aa83375cccd2bf28

## Comments

### impl-852 · 2026-10-19T08:10:54.307Z

Implementation seams: CLI usage text + configKeys() for the new T1 command check; existing init provisioning/manifest contract for the curated skill count. Source stays pinned to 0ff421f8 except the Codex policy flag, per E-616 decision 3. No per-item QA required by the parent plan.

### rev-30 · 2026-10-19T08:14:29.479Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-852-source
commit: 0f40454460b8a801576ad9f2aa83375cccd2bf28
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-5879 records exact comparison with accepted 0ff421f8: only approved same-value YAML quoting and Codex flag removal. Claude link and README satisfy C5; C1/C5 verified. New T1 command/config guard covers all five Markdown files, named T-837 setup exception and stale-entry rejection; init's complete 21-skill/hash assertions remain, and renamed duration identity retains its value. C2–C4 await final exact-head mode-free task evidence plus retained native init host receipt. No production behavior edits or new processes/waits. Reviewer performed read-only inspection, no tests.

Criteria: C1 verified, C5 verified.

### rev-30 · 2026-10-19T08:33:11.214Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-852-final
commit: 0f40454460b8a801576ad9f2aa83375cccd2bf28
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; no findings. A-5895 audits exact-head task gate A-5894 / 55f25e6c: 1477/1477 ordinary pass, zero fail/cancel/skip; invocation guard and both onboarding guards execute, new guards 5/5 each. Complete receipt: zero tier-mismatch rows, 397 groups all 5/5. A-5880 separately preserves Mac init 13/13 including 21-skill/every-file-hash proof (.811334542 s), with precommit captured-output provenance matching unchanged committed init/skill sources; no Linux T3 execution claimed from task gate. Accepted source exceptions/link/README remain as A-5879. C1–C5 verified. No Reviewer edits/tests; no QA outstanding.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-19T09:34:03.586Z

Merged d180dffc948465a691d61d2261853e68eac2b55b onto dev.
