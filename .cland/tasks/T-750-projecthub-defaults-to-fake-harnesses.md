---
id: T-750
kind: task
title: projectHub defaults to fake harnesses and fake probes; native probes become opt-in
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-459
branch: t/T-750-projecthub-defaults-to-fake-harnesses
created: 2026-10-17T18:44:08.555Z
updated: 2026-10-17T21:58:24.990Z
---

## Summary

T-748's first runtime trip list (A-4702, A-4703; run f6262d9d) found 424 report-only resource uses in 52 T1/T2 hub files. Most of route R1 (34 files) come from one root: projectHub's default native probes (git, ps, doctor bootstrap) run unless a test passes `probes: 'fake'`. Flipping the default removes the bulk at once.

## What to build

projectHub (and the fixtures built on it) default to `harnesses: 'fake'` and `probes: 'fake'`, with injected Git/readBase facts where a test needs branch state. Tests that really prove native behaviour opt in with an explicit `native` option and carry a T3 header. Every assertion keeps its meaning. The T3 native contract files stay native.

## Acceptance criteria

- [ ] C1. The runtime tripwire (T-748) reports no child_process trip in the R1 projectHub files listed in A-4703 (session-*, lead-*, heartbeat, handover, item-lead, permissions, rule-cli, project-clock, in-process-spoke, fake-harness, adapter-composition, codex-*/opencode-native, skills-tracker, suite-protocol, suite-close-component), proved by a full droplet run's trip report.
- [ ] C2. Every test that relied on native defaults either opts in explicitly in a T3 file or is rewritten with injected facts; the review request maps each, with Mac 5/5 medians before and after.

## Comments

### impl-750 · 2026-10-17T21:50:47.963Z

Initial origin/dev merge is current (9bd3425c). Reading A-4702/A-4703; serial Mac before measurements running for 23 R1/default-probe census files, gated on load1 <15. Inventory includes ~100 direct projectHub callers; requested scope decision for native opt-in churn and full droplet backstop. Implementation will preserve injected adapters/Git/readBase precedence.

### impl-750 · 2026-10-17T21:57:23.730Z

Coordinator decisions: named nativeProjectHub wrapper and import-only T3 opt-ins; 5/5 Mac only for R1/body rewrites, ~10 native import samples; authorized full droplet all at reviewed head. Native imports now mapped incl callback-only imports; direct native stdin CLI case moves to T3, resume uses T-745's transferred tempProject commit (8e45aca9), manual/post-merge stop assertions split T2/T3. Baseline suite-close proof A-4752 sent to T-751, which owns its shared remote fact migration.

### coord · 2026-10-17T21:58:24.990Z

Scope note (coord, 21:58Z): trips that reach R1 files through fixtures owned by T-751 are T-751's residual and are judged under T-751's C1. These fixtures are close-run-fixture and remote-fixture, for example in suite-close-component. T-750's C1 counts every other R1 row. The review request and full-run evidence name those rows as "T-751-owned residual".
