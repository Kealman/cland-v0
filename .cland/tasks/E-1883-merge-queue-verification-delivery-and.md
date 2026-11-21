---
id: E-1883
kind: epic
title: Merge queue, verification, delivery and durations (0.4.1)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1542
branch: null
created: 2026-11-16T07:28:33.146Z
updated: 2026-11-21T18:04:19.848Z
closed: 2026-11-21T18:04:19.848Z
---

## Goal

The merge queue, verification runs, delivery and the duration manifest report and recover correctly: no lost results, no ghost slots, complete footers, and durations that stay valid.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1725, T-1582, T-1630, T-1633, T-1576, T-1848, T-1850, T-1635, T-1652, T-1843, T-1857, T-1729, T-1728, T-1575, T-1638, T-1809, T-1655. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261121-1883-1 · 2026-11-21T18:04:15.071Z · commit 767b8ce4f2b6935b20f660f073f022a94128dd85
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261121-1883-1 · 2026-11-21T18:04:15.071Z · commit 767b8ce4f2b6935b20f660f073f022a94128dd85

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1725
      - - T-1582
      - - T-1630
        - T-1633
      - - T-1576
      - - T-1848
      - - T-1850
      - - T-1843
        - T-1916
      - - T-1907
      - - T-1921
      - - T-1925
      - - T-1927
      - - T-1931
        - T-1935
      - - T-1950
      - - T-1954
      - - T-1960
      - - T-1964
      - - T-1968
      - - T-1973
      - - T-1982
      - - T-1984
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1635
      - - T-1652
      - - T-1857
      - - T-1729
      - - T-1728
      - - T-1575
      - - T-1958
      - - T-1952
      - - T-1957
      - - T-1976
      - - T-1975
      - - T-1993
      - - T-1956
      - - T-1999
      - - T-2004
      - - T-1991
        - T-1992
        - T-2011
      - - T-2015
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1638
      - - T-1809
      - - T-1655
  - name: stage 4
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1987
```

## Comments

### qa-1880 · 2026-11-21T18:04:15.071Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261121-1883-1
commit: 767b8ce4f2b6935b20f660f073f022a94128dd85
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-1883 QA qa-20261121-1883-1

Build 767b8ce4f2b6935b20f660f073f022a94128dd85; clean detached HEAD and ancestry checked. Brief correction 8f9e77d2aafed0c8fe937a3af28f3dc5fb783088 accepts stage or epic Linux cover, confirmed by Coordinator decision 46056b30. Kit pin 767b8ce4f2b6935b20f660f073f022a94128dd85; Node24.21.0 satisfies shipped >=24.13.0 <25. Later dev diff only qa/briefs. Approval not required; demo freshness.current=true. Evidence-only, no new suite/demo/browser execution.

Covers: Linux 5c6edd0d-1af8-41ae-baa5-b955d3ef9c35 (A-22521), macOS 811111ae-aa47-489a-ab99-a05643eeba51 (A-22525). Read producer result.json for aggregate, both Linux shards and macOS: code0, empty cause. Read structured command-end/finish receipts, provenance and owner hub results in topic-1631. Same requested head and tree885833ace636f29c911c696f4207b0ae369d71af, cached null. T0–T4/Web completed, extra T4 repetitions skipped (18 base files). Linux stage, x64 6.8.0-149-generic; macOS epic, arm64 27.0.0; Node24.21/Nvim0.12.5. Browser Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4; exact binary paths retained in source logs A-22521/A-22525. Linux owner totals9619 tests/9605 pass/14 skip; macOS9615/9614/1; both0 fail/cancel/todo. Extra structured finish records include load repetitions, not added to owner totals: Linux9893 test pass/14 skip/1319 file pass; macOS9902/1/1319. Budget/lint/ratchet/skip checker report-only. Skips not counted as passes. Linux shard lifetimes2455s/$0.1705 and2517s/$0.1748, total$0.3453, executor accounting not case wall time. No controlled performance comparison.

|Case|Result|Observation|
|---|---|---|
|M1|PASS|CLI open list no items|
|M2|PASS|46 closed children; 112 verified criteria;45 own landing ancestors;T-2011 explicit supersession by human exception and landed T-1992|
|M3|PASS|Linux stage cover exact head/tree producer code0 fail0|
|M4|PASS|macOS epic cover exact head/tree producer code0 fail0|

Commands: live root node hub/bin/cland.ts task list --under E-1883 --state open/closed; task.view every child; git log -1 --first-parent --format=%H --grep exact Item trailer at requested build; read named logs/structured receipts. Findings none; C1,C2 checked. T-2011 criteria not inferred as verified: recorded supersession satisfies allowed closure-reason alternative.

- T-1575: 3/3 verified. Merged 8431152db4252c852896053dcff283c439248590 onto dev.
- T-1576: 3/3 verified. Merged f9b490e176430503f4b818cda3f831ecfdf842cf onto dev.
- T-1582: 3/3 verified. Merged 1e4bceff6b8925eaf4b5bc1662af5a837bb80675 onto dev.
- T-1630: 3/3 verified. Merged 0305d08b04a7159f70e98a5959130eb87721ba38 onto dev.
- T-1633: 3/3 verified. Merged bb9613d63c7ae358c500f9c15f72b97f55d06792 onto dev.
- T-1635: 2/2 verified. Merged 9ff9581f30ba10bb03e207a26c5801108101f08b onto dev.
- T-1638: 3/3 verified. Merged 23c0612a4b29c7840b312f8efb4e4d8a209c2e0d onto dev.
- T-1652: 2/2 verified. Merged 4b7c7648ad36d029ac91fe685148583c78f33f87 onto dev.
- T-1655: 1/1 verified. Merged e569ca6f27d01e246c17e4bd9e45ac0190d2b0c1 onto dev.
- T-1725: 2/2 verified. Merged 01d2f05a4db1e33ba51374cb9f5ab18b7bcc96c2 onto dev.
- T-1728: 3/3 verified. Merged 5e3a2005c80cd62166b635f132a037a2aedf62fd onto dev.
- T-1729: 3/3 verified. Merged d34f6f3003c6488353c33cae6fce4dd0d98eab30 onto dev.
- T-1809: 3/3 verified. Merged c5ea7db2d50940d902a0b90970f2cd3b0807b373 onto dev.
- T-1843: 2/2 verified. Merged b57847bca2c2ebd9beb8e62651bd49faa9e8d97e onto dev.
- T-1848: 2/2 verified. Merged 289a5ab00ea29bf8ae90095f8221029a93d26658 onto dev.
- T-1850: 2/2 verified. Merged c722503c17dcf94a45519f5582f7ed81c5ec3ffb onto dev.
- T-1857: 2/2 verified. Merged e37b377398926cda0ba5985c02980b3444fb8ecd onto dev.
- T-1907: 2/2 verified. Merged 4c4fe3f985a1199de985bfe2936feb06a0b41b66 onto dev.
- T-1916: 2/2 verified. Merged 0e093db62ab29fee4202f7d7ccc560b783b85ec8 onto dev.
- T-1921: 2/2 verified. Merged e76c3841d362fe5500fc9dddc42683acfcd81786 onto dev.
- T-1925: 2/2 verified. Merged 6fa0c339073b5ec39bd630e9bd7fae6aac52513a onto dev.
- T-1927: 2/2 verified. Merged 297243fd914217f0def86a97cc09c318283b73a3 onto dev.
- T-1931: 3/3 verified. Merged 66bca5453d8c0fbd66b5f3fd725256221a4a08f1 onto dev.
- T-1935: 3/3 verified. Merged d040dbf7500b585bc707dda18155b197eab74405 onto dev.
- T-1950: 3/3 verified. Merged 91d59bbe8aa34f06ac43dc7e9b43483d036aa034 onto dev.
- T-1952: 2/2 verified. Merged db53a0cb9c36b39d634e08b30c3ce56b10766bc0 onto dev.
- T-1954: 2/2 verified. Merged 5718742e402c8d519ebfc120f4d13f729f3bec02 onto dev.
- T-1956: 2/2 verified. Merged 23e1a659a592d4b3ddf4cf6eefea61fbcad862d0 onto dev.
- T-1957: 2/2 verified. Merged 330472a528639340d234181f1336ba51930cf942 onto dev.
- T-1958: 3/3 verified. Merged 183f0f95dd77b2c815779a5f7425b90e161c1d3c onto dev.
- T-1960: 3/3 verified. Merged 3d6faf22a4fed5f726bdf4956b1c93d9f49c0d9b onto dev.
- T-1964: 3/3 verified. Merged a58fb46d5db735f54edd15fa9e3d227d2d0ec072 onto dev.
- T-1968: 2/2 verified. Merged 4bd320895f3d143fc83295728666be8290cdc4c8 onto dev.
- T-1973: 3/3 verified. Merged da95b9681af8bc97339aaf6271955ce2ab6470c4 onto dev.
- T-1975: 2/2 verified. Merged 2d7fe873efb8abfedda195bdccd4835ad0d62f0d onto dev.
- T-1976: 2/2 verified. Merged 157bf6b2f145e7edb88eb69ed3b29b6f67c4adcc onto dev.
- T-1982: 2/2 verified. Merged ba0e7650fe2915a88974dd5365cb9a25fa03b8ae onto dev.
- T-1984: 2/2 verified. Merged e9b6b6d95357fd06bd36c2c84fc8d8c6d5efefa1 onto dev.
- T-1987: 2/2 verified. Merged 14f80deb9676e8edd46c34bf4367b42891040199 onto dev.
- T-1991: 3/3 verified. Merged 4ccc058a5046770341d529d17e0ec40eb72d5025 onto dev.
- T-1992: 6/6 verified. Merged a8fc01d327616a3800b388a5c1ac1170a410edb0 onto dev.
- T-1993: 2/2 verified. Merged b34b2bd5fa32edb6fbca8a79a3974262f6f84444 onto dev.
- T-1999: 2/2 verified. Merged 90650a6b6bb10d79d48e780607a68056b3238621 onto dev.
- T-2004: 2/2 verified. Merged e3c0e9320d9ada99dbd2510737e33985416a51fd onto dev.
- T-2011: 0/3 verified. Superseded by the human's one-off rule 27 exception (General, 2026-11-19 18:36Z, answer to ask 2da0c7c7): T-1992 deletes unindexed run directories directly. This item's C3 (removal-time descendant recheck) moved to T-1992 as C6.
- T-2015: 4/4 verified. Merged 5fb7716c461e7215bf44c6d82459f9c98abd05a6 onto dev.
Evidence A-22528 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22528-e-1883-evidence-only-qa-at-767b8ce.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T18:04:19.848Z

Definition of done met: QA clear qa-20261121-1883-1 (qa-1880, A-22528) at dev 767b8ce4f, with C1 and C2 verified. All 46 children are closed; T-2011 was superseded by T-1992 under the human's exception. Cover pair at that commit: Linux droplet stage 5c6edd0d (A-22521) and macOS local epic 811111ae (A-22525).
