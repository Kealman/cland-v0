---
id: E-1881
kind: epic
title: Load and timing flakes (0.4.1)
state: open
criterion_seq: 3
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1532
branch: null
created: 2026-11-16T07:28:32.737Z
updated: 2026-11-23T17:35:11.289Z
---

## Goal

Load and timing flakes stop reddening covers and batches. Setup waits scale with load (H-1 in E-1888 lands first), and each listed item fixes its own fixed wait or deadline, or is re-measured after H-1 and closed with evidence.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1697, T-1731, T-1703, T-1724, T-1841, T-1796, T-1736, T-1641, T-1689, T-1758, T-1761, T-1798, T-1642, T-1643, T-1634, T-1873, T-1695, T-1875. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261121-1881-1 · 2026-11-21T18:03:33.388Z · commit 767b8ce4f2b6935b20f660f073f022a94128dd85
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261121-1881-1 · 2026-11-21T18:03:33.388Z · commit 767b8ce4f2b6935b20f660f073f022a94128dd85


## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1697
      - - T-1731
      - - T-1703
      - - T-1724
      - - T-1796
        - T-1841
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1736
        - T-1641
      - - T-1758
      - - T-1761
      - - T-1798
      - - T-1642
      - - T-1643
      - - T-1634
      - - T-1873
      - - T-1695
      - - T-1875
      - - T-1906
      - - T-1937
      - - T-1947
      - - T-1951
      - - T-1939
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1911
      - - T-1980
      - - T-1983
      - - T-1985
      - - T-1986
```

## Comments

### qa-1880 · 2026-11-21T18:03:33.388Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261121-1881-1
commit: 767b8ce4f2b6935b20f660f073f022a94128dd85
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-1881 QA qa-20261121-1881-1

Build 767b8ce4f2b6935b20f660f073f022a94128dd85; clean detached HEAD and ancestry checked. Brief correction 8f9e77d2aafed0c8fe937a3af28f3dc5fb783088 accepts stage or epic Linux cover, confirmed by Coordinator decision 46056b30. Kit pin 767b8ce4f2b6935b20f660f073f022a94128dd85; Node24.21.0 satisfies shipped >=24.13.0 <25. Later dev diff only qa/briefs. Approval not required; demo freshness.current=true. Evidence-only, no new suite/demo/browser execution.

Covers: Linux 5c6edd0d-1af8-41ae-baa5-b955d3ef9c35 (A-22521), macOS 811111ae-aa47-489a-ab99-a05643eeba51 (A-22525). Read producer result.json for aggregate, both Linux shards and macOS: code0, empty cause. Read structured command-end/finish receipts, provenance and owner hub results in topic-1631. Same requested head and tree885833ace636f29c911c696f4207b0ae369d71af, cached null. T0–T4/Web completed, extra T4 repetitions skipped (18 base files). Linux stage, x64 6.8.0-149-generic; macOS epic, arm64 27.0.0; Node24.21/Nvim0.12.5. Browser Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4; exact binary paths retained in source logs A-22521/A-22525. Linux owner totals9619 tests/9605 pass/14 skip; macOS9615/9614/1; both0 fail/cancel/todo. Extra structured finish records include load repetitions, not added to owner totals: Linux9893 test pass/14 skip/1319 file pass; macOS9902/1/1319. Budget/lint/ratchet/skip checker report-only. Skips not counted as passes. Linux shard lifetimes2455s/$0.1705 and2517s/$0.1748, total$0.3453, executor accounting not case wall time. No controlled performance comparison.

C3 remains unmet and out of scope by human decision ask cdaedf29, analysis A-22306, as Coordinator request and committed brief specify. No C3 mark. T-1689 has 0/1 verified but closed with explicit reason covered by T-1863; ancestral covering landing141f7ca19d6a3227338b30667ba9e6d82e8902a0 confirmed. Slowed-I/O variant was not separately proven; closure reason retains this limitation.

|Case|Result|Observation|
|---|---|---|
|M1|PASS|Live CLI open list no items|
|M2|PASS|28 closed children; 55 verified criteria;27 own landing ancestors and1 recorded covered-elsewhere closure|
|M3|PASS|Linux stage cover exact head/tree, producer code0, fail0|
|M4|PASS|macOS epic cover exact head/tree, producer code0, fail0|

Commands: node hub/bin/cland.ts task list --under E-1881 --state open/closed; task.view every child; git log -1 --first-parent --format=%H --grep exact Item trailer at requested build; read named cover logs/receipts. Findings none; verify C1,C2 only.

- T-1634: 2/2 verified. Merged b48adda4010564e56e5ca6fb7b0da0e696106a48 onto dev.
- T-1641: 2/2 verified. Merged 651c1baa56bf9139125158300ba61df93dfd6389 onto dev.
- T-1642: 2/2 verified. Merged 7182b5f906ff8c7d008a8209942959c3e3483b30 onto dev.
- T-1643: 2/2 verified. Merged c0876d1ca3aa04bd89fd1a0078146edb7cfdeff4 onto dev.
- T-1689: 0/1 verified. Closed as covered by T-1863 (merged 141f7ca19, 2026-11-15 14:57). T-1863 reproduced this exact refusal-identity race deterministically (queued run with a null PID) and repaired it with recorded-PID readiness, a zero-signal refusal observer and a human SIGTERM positive control, with Linux arm64 Docker 20/20 at load 8–12 (A-19637–39). Recurrence check, 2026-11-19 19:16Z: of 654 suite logs since that merge, 313 ran this case, and none contain `✖ suite cancel refuses another session`. The positive control is pre-fix log A-19475, which matches twice. The slowed-I/O variant in C1 isn't proven separately; reopen this with the failing log if the case fails again.
- T-1695: 2/2 verified. Merged c352aade521e49d98875af1f557db8a200db457f onto dev.
- T-1697: 3/3 verified. Merged 56bfb920b3978871982d112664bd6db38eda044b onto dev.
- T-1703: 2/2 verified. Merged 64941afb8c3dc70ac2a573bfd6dae635ee22367f onto dev.
- T-1724: 2/2 verified. Merged 265afdb850b8b61018d06d834d02144eedbd6f93 onto dev.
- T-1731: 2/2 verified. Merged 66bce8751d6dc928f9d28fe73fd3a61956a600d6 onto dev.
- T-1736: 2/2 verified. Merged 692960bf115ba82d31bd5f3bbaf7d0c93bd4120e onto dev.
- T-1758: 2/2 verified. Merged d589cd4015420d50280e94a32b1f9b68c7e4f79c onto dev.
- T-1761: 2/2 verified. Merged 6b8f2939341b9ce43d41142f066125b03bd12700 onto dev.
- T-1796: 2/2 verified. Merged f6c633fae418114e334a19f0ec4e8bea8c555292 onto dev.
- T-1798: 2/2 verified. Merged 93de390a41c2c07c4f19939032f9fff0c2db254b onto dev.
- T-1841: 2/2 verified. Merged a48588f9f48903dc05bbd85b21e393986a68559b onto dev.
- T-1873: 2/2 verified. Merged 39f9bf166b9ec122dd78ee46d9fed653f9a302fd onto dev.
- T-1875: 2/2 verified. Merged 3284e79ca6df19ee9a146f20223f89ca72ed1c8a onto dev.
- T-1906: 2/2 verified. Merged 0449970d182979590932c81c2280be2c1b06d86f onto dev.
- T-1911: 2/2 verified. Merged 2fcc28bca18d6936452e484306bec937485b9dc1 onto dev.
- T-1937: 2/2 verified. Merged 0c2540bc52d2a6958fd80e88f87858e41c114e00 onto dev.
- T-1939: 2/2 verified. Merged fd2f1d484aff3b13fccf892b3ed54e198717a43f onto dev.
- T-1947: 2/2 verified. Merged 6d2b1231ae1079ca0ba2abbdd6097659150dee0c onto dev.
- T-1951: 2/2 verified. Merged 54e153e088ef44a9991bd45ded5f1b0a08a9f0af onto dev.
- T-1980: 2/2 verified. Merged 411a304315ce2e5d89dfb3838757f83350cc9bb4 onto dev.
- T-1983: 2/2 verified. Merged c07fd81ddba64108affd45d0df20ad1343d83182 onto dev.
- T-1985: 2/2 verified. Merged 55479f075e6dbcec4f98201f16c3e8fd2cd8b42b onto dev.
- T-1986: 2/2 verified. Merged 9657c2b1c9f0bb7bfa959b141b18499f2b2b0b4b onto dev.
Evidence A-22527 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22527-e-1881-evidence-only-qa-at-767b8ce.md. Export scanner initially refused browser-path paragraph; paths omitted, source logs retained, publication scan passed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-23T17:34:56.504Z

C3 removed by the human's decision. On 2026-11-23 17:34Z, the human answered ask 4e6ed26e: «Разрешаю тебе снять C3 с E-1881 с записанной причиной и закрыть эпик». This follows the earlier decision on ask cdaedf29 to close with the reason recorded, since C3 was not met (A-22306), with the follow-up work done as a separate 0.4.1 task. C3 was not met at the DoD build. QA verified C1 and C2 (A-22527), all 28 tasks are closed, and the T-2046 follow-up has landed.
