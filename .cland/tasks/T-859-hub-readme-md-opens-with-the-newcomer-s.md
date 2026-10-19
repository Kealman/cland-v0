---
id: T-859
kind: task
title: "`hub/README.md` opens with the newcomer's first page, and the glossary's four entries match the shipped onboarding"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by: []
topic: topic-590
branch: t/T-859-hub-readme-md-opens-with-the-newcomer-s
created: 2026-10-19T08:10:03.196Z
updated: 2026-10-19T14:42:44.009Z
closed: 2026-10-19T14:42:44.009Z
---

## Summary

A newcomer opening `hub/README.md` first meets four steps:
1. the checkout install line Q-592 recorded;
2. `cland init` in an empty folder or a full clone;
3. `cland setup`;
4. the workbench, where the Aide leads the onboarding.

The module reference follows below. GLOSSARY.md's Setup, Onboarding, Tour and Welcome note, written at planning time, are checked against the shipped flow and amended where it changed.

## What to build

- **The first page**, at the top of `hub/README.md`, before "Modules":
  - The checkout install line from spec §3.1, with the tag this release ships (open question 7). It also says what is needed (Node 24, git) and, while the repository needs one, the credentials note.
  - `cland init` in the project folder: an empty folder or a full clone; a shallow clone is refused.
  - `cland setup`, which readies the harnesses and opens the workbench on the Aide.
  - That `cland` reopens the workbench later.
  - One line each on what setup and the onboarding do, using the glossary's words.
- **GLOSSARY.md.**
  - Onboarding names the commit and push and the Coordinator's start on the human's ok.
  - Welcome note names its title "Welcome aboard" as a note in General.
  - Setup and Tour are kept if they still match.
  - No "wizard" term appears.

## Acceptance criteria

- [x] C1. `hub/README.md`'s first section, before "Modules", gives the checkout install line, `cland init`, `cland setup` and the workbench in that order (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-859-source-corrected · 2026-10-19T14:42:26.588Z · commit 19887c192ce7d5b5f204b3d29f5b2cc5ace55093
  - done: impl-859 · 2026-10-19T14:42:37.239Z
- [x] C2. The install line equals spec §3.1's line with the tag the Coordinator chose (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-859-source-corrected · 2026-10-19T14:42:26.588Z · commit 19887c192ce7d5b5f204b3d29f5b2cc5ace55093
  - done: impl-859 · 2026-10-19T14:42:37.716Z
- [x] C3. GLOSSARY.md defines Setup, Onboarding, Tour and Welcome note consistently with SKILL.md at the branch head, and Onboarding names the commit, the push and the Coordinator's launch on the human's ok (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-859-source-corrected · 2026-10-19T14:42:26.588Z · commit 19887c192ce7d5b5f204b3d29f5b2cc5ace55093
  - done: impl-859 · 2026-10-19T14:42:38.281Z

## Comments

### impl-859 · 2026-10-19T13:33:56.340Z

Drafted only hub/README.md's opening and GLOSSARY.md. First page uses spec §3.1's exact checkout line with v0.1.4, distinguishes the shallow cland checkout from a full project clone, then init/setup/workbench. Glossary preserves Setup/Tour, adds the Aide commit/push/start and map-only exception, and names Welcome aboard. Repository is public (https://github.com/Kealman/cland-v0), so E-616 decision 7 omits a credentials note. Awaiting T-856 landing before first source review per Coordinator decision 47ad5264.

### impl-859 · 2026-10-19T14:40:14.634Z

Merged origin/dev once as authorized after T-856 landed, then compared shipped SKILL.md §7 with glossary: aligned without further edits. Pushed 430b5f2a04c9b40d7d94500bba4f443c6d8385ee. Post-merge typecheck, document assertions and diff checks passed; fresh-fetch merge-tree passed. Review evidence A-6089 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6089-t-859-source-review-evidence-at-430b5f2a.md. Requesting first source review; mode-free verification follows its clear verdict.

### rev-30 · 2026-10-19T14:41:33.493Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-859-source
commit: 430b5f2a04c9b40d7d94500bba4f443c6d8385ee
scope: full
findings: [{"severity":"medium","text":"M1: Setup still says that without a terminal it only reports open work, but shipped --install runs an installer and --yes permits trust writes without a terminal. C3 explicitly requires the Setup definition to match the shipped flow. Qualify detection-only as the default without explicit action flags and reflect their exceptions.","file":"GLOSSARY.md","line":24}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-6090. One medium M1 at GLOSSARY.md:24: unconditional nonterminal 'only reports' omits already-shipped explicit --install actions and --yes trust writes, contradicting the preserved README Setup reference and C3. Correct this wording, keeping default detection-only behavior distinct from explicit flags. C1 first-page sequence and C2 exact spec command with E-616 decision-7 v0.1.4 tag check out; Onboarding/map-only/Welcome aboard/Tour mapping matches shipped SKILL. No new runtime code/test needed. Request fresh source review after wording correction; no verify at 430b5f2a or post-review dev merge. Reviewer ran no tests/install.

Criteria: C3 failed (Setup definition incorrectly states unconditional nonterminal report-only behavior despite shipped explicit --install/--yes actions.).

### impl-859 · 2026-10-19T14:42:03.496Z

Fixed source finding M1/C3 at 19887c19: Setup's nonterminal behavior is report-only by default, with explicit options authorising installation and trust writes. Compared shipped harnesses/trust steps and detailed setup reference. Wording-only change, no dev merge. git diff --check and fresh-fetch merge-tree passed. Pushed correction; evidence A-6091. Requesting fresh source review before verification.

### impl-859 · 2026-10-19T14:42:08.894Z

Artifact-id correction: M1 correction evidence is A-6092, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6092-t-859-m1-correction.md; prior comment's A-6091 was a typo.

### rev-30 · 2026-10-19T14:42:26.588Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-859-source-corrected
commit: 19887c192ce7d5b5f204b3d29f5b2cc5ace55093
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-6093. M1 resolved by qualifying nonterminal detection/reporting as default and acknowledging explicit installation/trust action options. Exactly one glossary line changed, no dev merge. A-6090's first-page order, exact spec checkout command with Coordinator v0.1.4 decision, shipped onboarding commit/push/launch/map-only sequence, Welcome aboard and Tour mappings remain intact. C1–C3 are source-review criteria and verified. Final exact-head mode-free task receipt still required; E-617 owns released-tag checkout execution. No Reviewer tests/install or new prose test.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T14:42:44.009Z

Merged 998f417800d017b856c3ec7d5418a83e3a33b86d onto dev.
