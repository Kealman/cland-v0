---
id: T-1540
kind: task
title: suite-tiers shipped-allowance owner test exceeds the 5 s T1 ceiling on a fresh droplet
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
regression_of: T-1504
found_by: cover
topic: topic-1285
branch: t/T-1540-suite-tiers-shipped-allowance-owner-test
created: 2026-10-31T21:31:33.760Z
updated: 2026-10-31T21:57:49.954Z
closed: 2026-10-31T21:57:49.954Z
---

## Summary

T-1504's new T1 test `suite-tiers.test.ts::shipped allowances retain valid standing owners without manifest migration` ran 5.579 s against the enforced 5 s per-test ceiling on shard-2 of the 0.3.2 release cover ba2f405a (A-15079, a fresh occasion droplet). The shard stopped after T1, which left the cover red. In other runs the test took 0.97–2.31 s (11 samples). Make the test check owners without its current cost, most likely its read of the whole tracker or durations manifest, so it fits T1 comfortably on a cold droplet.

## Acceptance criteria

- [x] C1. The item records what the test reads, and the change makes it resolve only the owners the shipped manifest names (or uses an equivalent bounded fixture), with the same assertion that every shipped allowance has a standing owner.
  - done: impl-1540 · 2026-10-31T21:33:54.997Z
  - verified: rev-26 [reviewer] · run rev-20261031-1540-source-1 · 2026-10-31T21:35:21.142Z · commit 15e0f7f11a39bb531ce880e9b6f325caa8460f8e
  - verified: rev-26 [reviewer] · run rev-20261031-1540-evidence-1 · 2026-10-31T21:51:29.583Z · commit 15e0f7f11a39bb531ce880e9b6f325caa8460f8e
- [x] C2. The test runs under 1 s on the item's mode-free droplet verify and in 10 local sequential runs, and no duration allowance is added for it.
  - done: impl-1540 · 2026-10-31T21:50:52.451Z
  - verified: rev-26 [reviewer] · run rev-20261031-1540-evidence-1 · 2026-10-31T21:51:29.583Z · commit 15e0f7f11a39bb531ce880e9b6f325caa8460f8e

## Comments

### impl-1540 · 2026-10-31T21:32:28.466Z

Investigation: suite-tiers shipped-owner test reads hub/test/durations.json (1,020,525 bytes, 356 allowances, one distinct owner E-880), globs/copies only owner ancestry, then durationOwners parses that scratch ancestry. Its negative control passes the entire JSON source to lintDurationManifest, invoking YAML parseDocument on the 1 MB baseline solely for an error-location diagnostic. Proposed seam: existing shipped-owner assertion with a <1 s elapsed receipt; retain source-location coverage in existing delivery task/epic tests. No production contract changes or new duration allowance.

### rev-26 · 2026-10-31T21:35:21.142Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1540-source-1
commit: 15e0f7f11a39bb531ce880e9b6f325caa8460f8e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15085 full two-file source audit clear. C1 verified: recorded1,020,525byte/356allowance/E-880 manifest reads and bounded owner-ancestry copying/resolution; complete valid-owner lint and exact shipped-entry delivery-owner rejection assertions retained. Only source is omitted from the negative call, avoiding unused YAML location parse; small task/epic fixtures retain exact source-line/key/kind/suggestion diagnostics. Production/manifest/allowances/gates unchanged. Independently checked original A-15079 named base5.579148935s and hard5s refusal, distinct from report-only0.5s advisory. Local prechange326.8ms did not reproduce timing failure; ten26–30ms local samples remain summary evidence, not original raw records. C2 runtime unverified pending exact-head droplet<1s and original ten-local-run receipts. No findings, reviewer workloads or full/browser claims.

Criteria: C1 verified.

### rev-26 · 2026-10-31T21:51:29.583Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1540-evidence-1
commit: 15e0f7f11a39bb531ce880e9b6f325caa8460f8e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-15088 original-record evidence clear. C1 source unchanged; C2 verified: exact named droplet finish6942 passes0.040966994s<1s, small task/epic source-line controls pass6932/6937. A-15086 original ten sequential local fresh-process outputs each1/1 and0adverse:26.153917–29.354333ms percase,120.127–138.819875ms wholeprocess, Macarm64Node24.21, source-equivalent precommit records; subsequentfastforward onlyroles.toml. No duration manifest/allowance change. Independently5311 complete matching pairs:4521ordinarytest/520file plus135loadtest/135loadfile passes, four empty failure arrays, no adverse/unpaired. T0/T1/allfallbackT2 inclNeovim/Webexit0; T3/T4unrun. Exact head/candidate provenance checked, only1541excludedtracker/rules difference, Linuxx64dropletNode24.21/Nvim0.12.5 actualShell1248Chrome156.0.8078.4, cache/occasionnull/skips[]. Hosttypecheckreuse and report-mode advisories retained. Original releasehard5sfailure not relabelled; no newgate/allowance/reviewerworkload.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-31T21:57:49.954Z

Merged 95413f7ebc1948e17ac53a8c2539a58ec078343e onto dev.
