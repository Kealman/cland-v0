---
id: T-1879
kind: task
title: Re-size the 469 duration allowances renewed on 2026-11-16 from the v0.4.0 release logs (C-216 entries expire 2026-11-23)
state: open
status: review
size: S
criterion_seq: 3
labels:
  - release-blocker
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1531
branch: t/T-1879-re-size-the-113-duration-allowances
created: 2026-11-16T07:04:58.109Z
updated: 2026-11-16T07:36:31.817Z
---

## Summary

469 dated duration allowances were due to expire between 2026-11-18 and 2026-11-23: 138 owned by C-216 and 331 by the legacy owner E-880 (274 of those on 2026-11-19). An expired allowance makes the manifest lint throw (`expired duration allowance …`, `lintDurationManifest` in `hub/src/suite-durations.ts`), and that would fail every suite. On 2026-11-16 the Coordinator renewed their dates only, with sizes unchanged and a renewal note appended to each reason (commit on dev before 8195993ca):
- C-216 entries: added 2026-11-16, expires 2026-11-23, the 7-day limit;
- E-880 entries: added 2026-11-16, expires 2026-12-16, inside D72's 31-day limit. 4 E-880 entries renewed in the first pass expire on 2026-11-23.

This item re-sizes them from evidence. **The C-216 entries expire again on 2026-11-23 at 00:00 UTC.** Before that, re-size or renew them, or every suite fails again.

## What to build

For each renewed allowance, read the slowest passing Linux sample in the v0.4.0 release-period logs: the release suite A-19794, the stage covers A-19785 and A-19789, the soak A-19799 (partial) and recent batch logs. Then either:
- set the allowance to about 1.5× that sample, with owner C-216, at most 7 days, and a reason naming the sample;
- or remove it when the test now fits its tier default.

For the E-880 legacy entries, follow D72 and D73: they stay owned by E-880 until T-931 decides how enforcement returns, but a test now under its tier default loses its allowance. Use the hub's duration tooling where it supports this. Separately, the heartbeat warns only 48 h ahead, and the 274 entries expiring 2026-11-19 didn't show in it. Add a lint warning at about 5 days, or file that.

## Acceptance criteria

- [x] C1. Every renewed C-216 allowance is re-sized or removed from a named log sample before 2026-11-23 00:00 UTC, and `npm run test:tiers` and the manifest lint pass at a simulated date after that (test).
  - done: impl-1879 · 2026-11-16T07:32:43.437Z
- [x] C2. The E-880 entries are re-sized or removed from a named sample, or kept with D72's owner and a reason naming the sample, before 2026-12-16 (test).
  - done: impl-1879 · 2026-11-16T07:32:43.754Z
- [x] C3. Expiry warnings reach the Coordinator far enough ahead to act, at least 5 days, or a filed item says why not (test).
  - done: impl-1879 · 2026-11-16T07:32:43.963Z

## Comments

### impl-1879 · 2026-11-16T07:14:55.944Z

Rule 20 warning consumer sweep: durationAllowanceWarnings/readDurationAllowanceWarnings -> hub/src/hub/server.ts default heartbeat reader and hub/src/hub/dispatch.ts periodic report. hub/test/heartbeat.test.ts and hub/test/suite-soak-component.test.ts assert warning text and are migrated. CLI hub/test/lint-tiers.ts now imports shared reader; durations.test.ts scratch CLI import fixture migrated. Search covered hub/nvim/web, .agents shipped skills, qa briefs, docs and all tiers via symbol names plus warning text (48h/48-hour/duration allowance/durationWarnings). Neovim/web consume ordinary message text without duration-specific parsing; protocol fields and persisted shapes unchanged, so old message strings remain compatible. docs/hub/running.md, hub/README.md, docs/agents/tests.md updated. 469 entries: C-216 100 removed/38 resized; E-880 200 removed/130 resized/1 unchanged ratchet cap per Coordinator decision 12ad0b5a. Date requirement superseded by Coordinator e38c475c: green added+6d23h, red at expiry; E-880 green added+30d.

### rev-35 · 2026-11-16T07:26:26.945Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1879-source-1
commit: d7bf02097765203299c44d24d6500194e0569152
scope: full
findings: [{"severity":"medium","text":"Generated sizing used raw object tiers and generic5s/60s instead of normalizedT3 10s/120s.23 audit budgets wrong;11 selected under-default retentions (1C-216/10E-880), including host-ssh and OpenCode file, contradict remove-if-fits policy. Recompute all469 through production tier reader.","file":"hub/test/durations.json","line":12529},{"severity":"medium","text":"Passing recent batch A-19743 omitted from census; integrated load pass30.659327257s exceeds selected29.121779533. Case46->43.683/file49 removal unsupported. Include comprehensive recent batch census and follow Coordinator92ff24e2 keep46/49 unless larger positive sample; preserve original469 lineage.","file":"hub/test/durations.json","line":13772}]
finding_counts: {"high":0,"medium":2,"low":0}

A-19814 completed Standards/Spec review. Independently streamed all72selected logs:468 positive test/file maxima match chosen corpus, no arithmetic mismatch.469rows exactly cover changed allowance keys;25unrelated unchanged, report mode and ratchet exception retained. Two confirmed sizing/census defects remain, warning implementation has no new finding. Corrected date requirements e38c475c/8576bc01 respected.807consumer/16unknown union and honest A-19812 original capture limits retained. C3 unverified pending configured evidence, not failed for unexecuted phases. Hold released; consolidate fixes, fresh exact-head source review before verification. No Reviewer runtime/provenance rerun.

Criteria: C1 failed (Wrong normalized C-216 default/removal decision and incomplete recent passing-sample census invalidate requested evidence-based allowance decisions.), C2 failed (Ten E-880 selected peaks fit normalizedT3 defaults but were retained using generic5s/60s budgets; recompute removals using production tier policy.).

### impl-1879 · 2026-11-16T07:32:42.892Z

Corrected both medium review findings at df5624c4d2d6bf5cb0fe48ce9f22ba1e009bf8a3; no dev merge after first review. A-19815 replaces A-19807: all469 original inputs preserved, 429 suite logs in Nov9–Nov16 07:10Z across all branches/occasions, 396 explicit platform receipts and 33 unknown-platform exclusions retained. Production readTierAssignments + TIER_BUDGETS replace raw object-tier/generic defaults. Counts C-216100 remove/36 resize/2 explicit keep caps46/49; E-880206 remove/124 resize/1 ratchet keep. A19743 included; identical peak also in duplicate A19742. Fresh native full command receipts A-19816 at exact head: targeted8+23+2+18+38 tests green sequentially on macOS arm64 Node24.21.0, no browser. test:tiers, hub typecheck, wording lint green. Date proof whole manifest green Nov22 23Z/red Nov23 00Z; renewed125-entry E-880 subset green Dec16 23Z/red Dec17 00Z, 63 excluded keys listed with earliest expiry Nov23. Byte-preservation check green for25 unrelated allowance values and outside allow except two renamed heartbeat baselines. A-19817 preserves807 consumer/16 unknown graph union with explicit executed versus deferred status. Launchers A-19818/19/20; narrowed token/bearer scan with synthetic positive control before new publications, exact scope in A-19816. Original provenance gaps remain in A-19812, not replaced by new receipt claims. Configured suite remains pending fresh source review.

### rev-35 · 2026-11-16T07:36:31.817Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1879-source-2
commit: df5624c4d2d6bf5cb0fe48ce9f22ba1e009bf8a3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19829 records corrected source clear. All469 input rows/decisions preserved; production normalized tiers/budgets and current manifest entries independently match. Streamed429logs (316Linux/80Mac/33unavailable platform):468positiveLinux peaks all match audit, includesA19743. Counts C216100remove/36resize/2keep46/49; E880206remove/124resize/1ratchet.25unrelated unchanged; mode report, original baseline only2title renames. Effective date controls/targeted89test positives in new A19816 checked, manifest hash matches;807consumer/16unknown union and capture limits retained. Previous findings resolved. C1–C3 unverified pending configured same-head receipt; hold released, mode-free verify at unchanged head permitted. No Reviewer runtime work.
