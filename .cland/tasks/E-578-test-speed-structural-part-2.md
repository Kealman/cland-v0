---
id: E-578
kind: epic
title: "Test speed: structural, part 2"
state: open
labels:
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-16T06:35:58.703Z
updated: 2026-10-19T22:37:32.652Z
---

## Summary
Carried over from E-387 in v0.1.3 by the human's decision on 2026-10-16 (ask 396ec11a). E-387 closed on a measured 743 daemon starts per full run (census A-3775). This epic takes the remaining structural test-speed targets: under 600 daemon starts (T-575), the two-shard stage-run wall time (T-520), and, by the human's decision of 2026-10-16 (ask 6a7185b6), E-387's unmet hub-test-time, verify-time, worker-default and T-393 C5 targets.

## Definition of done
- [ ] C1. (D1) A full-run spawn census shows daemon starts under 600 (T-575).
- [ ] C2. (D2) A two-shard stage run's wall time meets T-520's target.
- [ ] C3. (D3) Hub test-time on one slot falls by at least 15% against the quick-wins epic's after run (A-2714) on common tests, measured on a quiet Mac (from E-387).
- [ ] C4. (D4) A typical hub task's `cland verify` selects by coverage and finishes in under 5 minutes, and the replay of the last 40 merges meets the human's bar, with T-394 C5–C7's results posted (from E-387).
- [ ] C5. (D5) The worker defaults are set from a recorded measurement, locally and on c-16, with T-396's table filled in (from E-387).
- [ ] C6. (D6) T-393's 20 migrated files run at least 20% faster than before the migration, judged after merge (T-393 C5, from E-387).

## Plan

```yaml
stages:
  - name: the measured targets
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-575
      - - T-520
```

## Comments

### coord · 2026-10-19T22:37:32.652Z

Disposition D71 (stand-in under D24, ask 1298ecf4, 2026-10-19 22:37Z), applying D66: C2–C6 are speed or measurement targets. The measured values count as meeting them for v0.1.4, and how to reach the original targets goes to E-880 (Ideas). QA records each measured value with its source (run id or artifact) in its verdict and marks C2–C6 verified under D71. Where no measurement exists at all, the verdict says so, and the criterion is verified under D71 only if a value is recorded somewhere. C1 (spawn starts < 600) is judged as written.
