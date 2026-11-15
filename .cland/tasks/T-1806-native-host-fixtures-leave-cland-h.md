---
id: T-1806
kind: task
title: Native host fixtures leave cland-h-* socket directories in /tmp, and /tmp holds about 90 historical native-fixture roots
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: t/T-1806-native-host-fixtures-leave-cland-h
created: 2026-11-10T18:13:37.516Z
updated: 2026-11-15T06:38:05.475Z
---

## Summary

A run of `hub/test/host-create-ready.test.ts` (12/12 pass, macOS, 2026-11-10 18:13Z, at T-1780's 678733ec5) left ten new `cland-h-*` entries in `/tmp`, though the per-user TMPDIR and the fixture roots (`hc-`, `lwb-`) stayed 0 → 0. Host socket directories created outside the fixture's scratch root therefore survive the file. `/tmp` also holds about 90 older native-fixture roots (`cland-suite-*`, `hc-`, `sf-`, `cland-ssh`, receipt directories); the newest seen was dated 2026-11-09 16:51Z. They are the T-1676 class and belong to no running item.

## Evidence

- impl-1780's exact before/after name sets in topic-1467: `/tmp` went 17929 → 17939, ten added `cland-h-*`, none removed.
- impl-1778's and impl-1779's scoped inventories (83, then 86 historical roots); the stage-2 brief draft's census found 92 `cland-suite-*` entries.

## Acceptance criteria

- [ ] C1. Native host fixtures create their socket directories under the file's scratch root, or register their disposal at allocation, so an exact `/tmp` name set reads unchanged across host-create-ready, host-destroy-native and host-restart (test).
- [ ] C2. A one-off cleanup removes only the historical roots that a census proves dead (no live process, no open file, owner absent), by literal path, and keeps a receipt listing each path (test).
- [ ] C3. A shared inventory helper gives tests and QA briefs one exact before/after name-set check (test).

## Comments

### coord · 2026-11-10T20:55:02.899Z

More evidence (qa-678, E-1535 stage-2 QA at 121ec8bef, 2026-11-10 20:54Z): 21 new dead `/private/tmp/cland-h-*` directories across native rows 60 and 64–73, each holding agent.sock, ctl.sock and git.sock or empty, with no open PID. The producer is `records.ts` `hostPaths` (lines 66–74), reached through `createHost` from `host-create-fixture.ts` and from `host-provision-gate.test.ts` (`tempProject(t,'pg-','/tmp')`); the fixtures' own roots are removed. C1 should place `hostPaths`' socket directory under the caller's scratch root, or register its disposal at allocation.

### coord · 2026-11-11T12:52:07.761Z

Further observation, 2026-11-11 12:52Z: impl-1810's T-1810 native slot (host-restart, host-destroy-native, host-stop at e55f4838b) left four more `cland-h-*` directories in /private/tmp after joined shutdown (A-18704, /private/tmp names 21093 → 21100, including three declared log captures). os.tmpdir() sets were equal (9876). Each native lane adds a few per slot; stage-3 QA attributed 24. Worth a fix before the v0.4 release run, whose native runs will add many more.

### coord · 2026-11-11T18:17:46.800Z

Census 2026-11-11 18:17Z (impl-1794): /private/tmp now holds 17,514 `cland-h-*` names. That's the accumulated scale this item's C2 dead-root cleanup must handle with a census-proven, literal-path receipt, and the reason to land C1 before the v0.4 release run. Separately, a crashed native run (T-1794's slot 1, RangeError) left `cland-account-fixture-VXL3Gi` in the per-user TMPDIR without a fixture-owner receipt; it is retained under rule 12 until its descendants are proved closed. A crash-safe owner receipt for account fixture roots belongs in this item's scope.

### coord · 2026-11-12T09:44:50.152Z

Census 2026-11-12 09:44Z (impl-1813's final-head native slot, /private/tmp on the macOS host): cland-h-* 17,640 (+6 per native login file run, +12 for two files), plus pre-existing ct-* 1,015 and hc-* 11 that no current run added or removed. ct-<32> is the shared fixture-sockets reciprocal alias used by hostDirectory, so these 1,015 are a second accumulated class beside cland-h-*: include it when this item is triaged.

### coord · 2026-11-12T18:27:52.318Z

Attribution for the ct-* class (2026-11-12): /private/tmp ct-* went 1,015 → 1,022 between 10:13Z and 18:27Z. All seven new roots date 16:23–16:35Z, inside the local macOS stage cover 7429dc82 (16:21–17:50Z, A-19081, workers 1, full suite), while every lane's native slot that day showed ct- unchanged. So full local suites leave ct-<32> fixture-sockets aliases behind, and the 1,015 historical ones are most likely the same producer over earlier local covers. Include the full-suite path in C1, not only the single native files.

### coord · 2026-11-14T15:55:23.891Z

More evidence (2026-11-14): the unchanged hub/test/host-status.test.ts (and doctor-remotes in a combined run) adds two cland-h-* directories per run on macOS. Seen by impl-1829 at 14:30Z and 14:41Z (A-19382) and impl-1830 at 15:55Z; lone runs of the new doctor-hosts and setup-hosts cases had delta 0. T-1806 should land before the v0.4 release run.

### coord · 2026-11-14T18:00:01.740Z

More evidence (T-1831, 2026-11-14 17:59Z): hub/test/login-add.test.ts alone leaves one cland-h-* directory per run, both at the T-1831 candidate (cland-h-b7c1524e37085057fd7e) and at an isolated origin/dev baseline (cland-h-9b7a2b13ce5894e77b4c), so the leak predates T-1831. Both left in place.

### coord · 2026-11-14T22:17:27.687Z

Occurrence in E-1537 stage-3 QA at 932f3018c (run qa-e1537s3-2026-11-14-qa678-1, evidence A-19436, rows 63/81/88 and the R-6 setup replay). Six dead fallback socket directories come from `hub/src/host/records.ts:66–76`: one native login-add directory, two original qa hosts, two replay qa hosts and one agents login host. None has an open PID, and all six were left untouched. Per-path attribution: A-19436 residue-trace.json. The scratch fake-host runs leak too, not only native fixtures.
