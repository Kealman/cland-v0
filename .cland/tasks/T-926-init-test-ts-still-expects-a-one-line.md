---
id: T-926
kind: task
title: "init.test.ts still expects a one-line prepare comment after T-671's two-line template (macOS cover #3)"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-671
found_by: cover
topic: topic-681
branch: t/T-926-init-test-ts-still-expects-a-one-line
created: 2026-10-20T02:12:05.985Z
updated: 2026-10-20T02:24:22.309Z
closed: 2026-10-20T02:24:22.309Z
---

## Summary

In stage cover #3's macOS run fb3edd9f at 2d2eb91f (A-6951), `hub/test/init.test.ts::init writes tracker levels and update preserves a changed or empty ladder` fails: it expects `/# prepare [^\n]+\nprepare = ""/`, but since T-671 (d3aac7af) the config template writes two comment lines before `prepare = ""` (hub/src/init/config.ts ~65–67). The test is T3, so T-671's T0–T2 verify didn't run it.

## What to build

Update the test's expectation to the template's documented two-line comment, keeping the check that the prepare key is written empty and its comment kept. Grep hub/test and nvim/test for other assertions on the old one-line prepare comment.

## Acceptance criteria

- [x] C1. init.test.ts passes locally (single file), and no other test asserts the old one-line comment (grep receipt).
  - verified: rev-31 [reviewer] · run rev-20261020-926-source · 2026-10-20T02:16:19.768Z · commit aad8af669bc51622b5fc754d804be5e8507ff9c2
  - verified: rev-31 [reviewer] · run rev-20261020-926-final · 2026-10-20T02:20:16.268Z · commit aad8af669bc51622b5fc754d804be5e8507ff9c2
  - done: impl-926 · 2026-10-20T02:20:21.157Z
- [x] C2. A mode-free verify at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-926-final · 2026-10-20T02:20:16.268Z · commit aad8af669bc51622b5fc754d804be5e8507ff9c2
  - done: impl-926 · 2026-10-20T02:20:21.763Z

## Comments

### impl-926 · 2026-10-20T02:13:40.194Z

Implemented and pushed aad8af669bc51622b5fc754d804be5e8507ff9c2. Local init.test.ts 13/13, init-config.test.ts 9/9, typecheck and diff check pass. Grep confirms no remaining old prepare comment assertion. verify --dry-run admitted hub-selected T1-only selection (101 files/557 planned tests), no T2 needed, T3 excluded by queue policy and directly tested locally. Requesting source review before mode-free verification.

### rev-31 · 2026-10-20T02:16:19.768Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-926-source
commit: aad8af669bc51622b5fc754d804be5e8507ff9c2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6965: source clear, no findings. Prepare-only branch asserts exact two template comments plus empty value; all other key/parser/command/update assertions retained. Independent reviewed-head grep finds no remaining stale prepare assertion; generic one-line else excludes prepare. Original retained A-6964 local init file13/13,no skips,exit0,16.290961s whole/changedcase3.085156083s with reported committed-content provenance. C1verified. C2awaits configured mode-free green at this unchanged head; task may selectT1only and does not claim LinuxT3. QA none;no Reviewer tests/edits.

Criteria: C1 verified.

### impl-926 · 2026-10-20T02:19:33.006Z

Mode-free verification a9000e1c-b1e5-4a28-9dd0-3543785dceb5 is green at reviewed head aad8af669bc51622b5fc754d804be5e8507ff9c2: exit 0, 561 pass / 0 fail / 0 skip. Linux droplet c-8 lon1, lifetime 121 s, cost $0.0084; log A-6982 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6982-suite-a9000e1c-b1e5-4a28-9dd0-3543785dceb5-auto-at-aad8af6.log. T3 excluded per queue policy; local init.test.ts 13/13 receipt retained in A-6964. Awaiting Reviewer's final same-head verdict.

### rev-31 · 2026-10-20T02:20:16.269Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-926-final
commit: aad8af669bc51622b5fc754d804be5e8507ff9c2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6986: final clear. Whole A-6982exact unchangedaad8af66 has561/561ordinarypasses,no nonpasses/loadgroups/duration/resource/missing diagnostics. Hostcheck/T1and empty-selectedT2phasegreen in admittedmode-freeplan. C2verified. C1A-6964local native13/13and source/grepA-6965remainapplicable; changedT3initfileis absent fromtasklog,not falselyclaimedexecuted. No newtestidentity. C1/C2verified,no findings;QA none,LinuxT3periodic/integrated;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T02:24:22.309Z

Merged 21dd4abde636d3a38fe25ab09dc1a3d9f7e0e21f onto dev.
