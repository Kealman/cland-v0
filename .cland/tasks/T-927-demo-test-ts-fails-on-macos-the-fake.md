---
id: T-927
kind: task
title: "demo.test.ts fails on macOS: the fake droplet's prepare (verify-prepare.ts) exits 1 (cover #3, T-670)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-670
found_by: cover
topic: topic-682
branch: t/T-927-demo-test-ts-fails-on-macos-the-fake
created: 2026-10-20T02:12:06.078Z
updated: 2026-10-20T02:27:40.287Z
closed: 2026-10-20T02:27:40.287Z
---

## Summary

In stage cover #3's macOS run fb3edd9f (A-6951), `hub/test/demo.test.ts::demo frames deliver a named dev commit, preserve command results and stop after restart` fails. The fake droplet's delivery ran the configured `[verification] prepare` (`node hub/bin/verify-prepare.ts`, from T-670) and got `prepare failed (exit 1)` after `HEAD is now at 962f2ec Base`. The same test passed on the Linux shards of A-6948. The likely cause is that the prepare script, or the fake droplet's delivery command, uses a Linux-only tool (for example `sha256sum`) when the fake runs locally on macOS, or that the demo fixture lacks a file prepare needs.

## What to build

Find the failing command (capture the prepare output in the test's failure message). Make the prepare script and delivery portable across macOS and Linux (for example `shasum -a 256` fallback), or give the demo fixture the needed seed, keeping production droplet behaviour identical.

## Acceptance criteria

- [x] C1. The cause is named with the prepare output.
  - done: impl-927 · 2026-10-20T02:14:38.409Z
  - verified: rev-26 [reviewer] · run rev-20261020-927-source-1 · 2026-10-20T02:19:36.882Z · commit 4e4d33517efea90e1a9daa5883bfdab70006b667
  - verified: rev-26 [reviewer] · run rev-20261020-927-final-1 · 2026-10-20T02:23:23.729Z · commit 4e4d33517efea90e1a9daa5883bfdab70006b667
- [x] C2. demo.test.ts passes locally on macOS (single file, receipt in the report) and the mode-free droplet verify at the reviewed head is green; Linux T3 evidence for demo.test.ts comes from the next stage cover, not a pre-merge criterion.
  - done: impl-927 · 2026-10-20T02:22:49.862Z
  - verified: rev-26 [reviewer] · run rev-20261020-927-final-1 · 2026-10-20T02:23:23.729Z · commit 4e4d33517efea90e1a9daa5883bfdab70006b667

## Comments

### impl-927 · 2026-10-20T02:13:43.319Z

Reproduced locally on macOS: demo.test.ts 4 pass / 1 fail (21.128s), second demo.start fails. Diagnostic prepare injection emits `changed prepare must not run` followed by `prepare failed (exit 1)` (5.517s targeted repro). Root cause is beforeCreate's prepare=false fixture mutation persisting into the second new admission, not verify-prepare.ts or a platform command. Restoring commands before second admission; production prepare/delivery unchanged.

### rev-26 · 2026-10-20T02:19:36.882Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-927-source-1
commit: 4e4d33517efea90e1a9daa5883bfdab70006b667
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: no Standards or Spec findings. hub/test/demo.test.ts:64 restores the intended verification config before the second independent demo admission, while the persistent beforeCreate hook still mutates it after pinning; :72 adds the second lease command-plan assertion. Diagnostic stderr and fixture-leak cause are preserved in A-6959; production preparation/delivery and all existing assertions/bounds remain unchanged. C1 verified. C2 stays pending same-head mode-free gate and retained original Mac single-file output. Coordinator 17d63980 explicitly defers Linux demo T3 to next-stage landing coverage. Reviewer ran no tests.

Criteria: C1 verified.

### impl-927 · 2026-10-20T02:22:50.458Z

C2 complete at reviewed head 4e4d33517efea90e1a9daa5883bfdab70006b667: macOS demo.test.ts original 5/5 receipt A-6984 (20.650s, exit 0); mode-free droplet verify 534c2615-fa58-4162-8499-e9d0199b39dc green, A-6988, 561 pass / 0 fail. Executor linux x64, Node v24.21.0, Neovim v0.12.5, lifetime 125s, cost $0.0087. T3 demo Linux evidence remains next-stage cover per Coordinator decision; no claim of this T1/T2 gate running demo.test.ts. Awaiting Reviewer final same-head settlement.

### rev-26 · 2026-10-20T02:23:23.729Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-927-final-1
commit: 4e4d33517efea90e1a9daa5883bfdab70006b667
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; no findings. Source A-6983/C1 diagnosis A-6959 retained. C2 checked: A-6984 is original Mac demo.test.ts 5/5, exit 0, 20.650s, unchanged tested bytes. Mode-free 534c2615/A-6988 pins this exact head and finishes exit 0, 561/561, zero failures/cancellations/skips/TODO; host check and T1/T2 commands pass. Full-log audit found no duration-budget failures or tier mismatches. Selected T2 has no tests and demo T3 did not run on the droplet. Coordinator 17d63980 expressly accepts Mac proof plus same-head task gate; Linux demo T3 remains next-stage landing coverage. C1/C2 verified. Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T02:27:40.287Z

Merged 01f6dff720ba1a7210272647ee9550e908bd6224 onto dev.
