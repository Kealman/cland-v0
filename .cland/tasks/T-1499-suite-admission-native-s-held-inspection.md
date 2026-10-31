---
id: T-1499
kind: task
title: suite-admission-native's held-inspection test binds a Unix socket path too long for macOS
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1484
found_by: cover
topic: topic-1264
branch: t/T-1499-suite-admission-native-s-held-inspection
created: 2026-10-31T04:19:20.467Z
updated: 2026-10-31T04:48:04.363Z
closed: 2026-10-31T04:48:04.363Z
---

## Summary

The 0.3.1 macOS stage cover 69228bbf / A-14816 at 7f0e3353b fails exactly one test. In `hub/test/suite-admission-native.test.ts`, "installed admission cleanup owns held inspection setup" fails with `listen EINVAL` at `hub/test/admission-exchange.ts:73`. The socket path is `/private/tmp/cland-suite-<uuid>/cland-admission-owner-XXXXXX/admission.sock`, which is 105 characters, above macOS's `sun_path` limit of 104 bytes including the NUL. Linux, with a 108-byte limit and a shorter `/tmp` root, passes every run (A-14811, A-14797, A-14802, A-14779). The failure is deterministic on macOS whenever the suite runs under its isolated temp root. It came in with T-1484 (0e4e223cb), which was verified on Linux only. It blocks the 0.3.1 macOS stage and release cover.

## What to build

Bind the admission exchange socket at a short path that stays under the macOS limit for any suite temp root. For example, use a short `mkdtemp` directory directly under the OS temp root with a short socket name, owned and removed by the same fixture. Or fail fast in the fixture with a clear message if a path would exceed the limit. Keep the test's assertions and ownership and cleanup proofs unchanged. Check every other test helper that binds Unix sockets under the suite temp root for the same risk (rule 20), and list them in the item.

## Acceptance criteria

- [x] C1. On macOS, running `hub/test/suite-admission-native.test.ts` alone under a suite-style temp root at least as long as `/private/tmp/cland-suite-<uuid>/` passes, and the fixture's socket paths stay under 104 bytes, with unchanged assertions.
  - done: impl-1499 · 2026-10-31T04:21:24.639Z
  - verified: rev-26 [reviewer] · run rev-20261031-1499-evidence-1 · 2026-10-31T04:41:38.304Z · commit cdbde53a06599cdbd44d90225ea4826f17ad3656

## Comments

### impl-1499 · 2026-10-31T04:20:39.594Z

Red reproduced locally on macOS arm64 / Node v24.21.0: isolated HOME/XDG/Git and filtered environment via fixtureEnvironment, TMPDIR=/private/tmp/cland-suite-mBnt14/12345678-1234-1234-1234-123456789012. node --test hub/test/suite-admission-native.test.ts: 5 pass / 3 fail; exact failure `Error: listen EINVAL: invalid argument .../cland-admission-owner-Oy7gRI/admission.sock` at admission-exchange.ts:73. Fix allocates private realpath(/tmp)/ca-XXXXXX/s independent of TMPDIR and removes only after existing positive drain barrier; assertions unchanged.

### impl-1499 · 2026-10-31T04:21:15.900Z

Socket-bind inventory (rg across all hub/test, nvim/test, web/test for listen/createServer, .sock, control paths and helper importers): admission-exchange.ts (all callers in suite-admission-native.test.ts) fixed; direct binds in hub/test/{web-auth,cli,harness-framing,test-admission,init-machine-lifecycle,verify-submission,cover-quiet,suite-admission,account-cli,codex-native,daemon}.test.ts, fakes/{legacy-remote-hub,codex/fake-codex}.ts; nvim/test/{stub-control.test,startup-budget-support,stub-hub}.ts. web/test has no direct Unix bind (production projectHub layout). Production hub layout already budgets inside/TMPDIR paths then /tmp fallback; fake Codex consumes the production adapter path. The other fixture names fit below 104 bytes with the reported /private/tmp/cland-suite-<uuid> root; kept unchanged. Neovim stub-hub receives control paths from shell-fixture, explorer-outline-fixture and component tests (stub/control/artifact-stub.sock). No wire/production contract changes. Arbitrarily deeper TMPDIR can affect remaining direct fixture paths; outside this XS admission blocker.

### rev-26 · 2026-10-31T04:23:14.213Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1499-source-1
commit: cdbde53a06599cdbd44d90225ea4826f17ad3656
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14818: full source clear. Private realpath(/tmp)/ca-XXXXXX/s listener independent of suiteTMPDIR; >=104-byte refusal before bind; private root removed only after unchanged inspection/native child/socket/listener drain, incomplete retains ownership. Long-parent variants preserve all existing assertions; consumer inventory checked, no production/wire changes. C1 done but runtime-unverified. A-14817 localMac8/8 is summarized evidence; supplemental original Mac outputs requested without rerun. Submit one mode-free frozen-head verify, then original evidence review retaining Mac-vs-Linux limits and advisory checks.

### rev-26 · 2026-10-31T04:41:38.304Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1499-evidence-1
commit: cdbde53a06599cdbd44d90225ea4826f17ad3656
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14822 supersedes A-14821 byte-count label: literal Mac TMPDIR68bytes, not recorded66; socket24bytes. C1verified from A-14819 originalMac native/outer0 exacthead8/8 under required longparent, unchanged assertions; baseline5/8EINVAL remains red. Separate401031e0/A-14820 Linux native0:5200IDs pair,4431ordinarypass/0adverse+125separate loadpasses. T0/T1/T2/changedT3file8once/Web0;remainingT3/T4unrun. Durationcheck2.769sphasewall excludingmachinewait vs1.694stestobserved; hosttypecheckreused. ActualHeadlessShell1248/156.0.8078.4, advisory122/59retained. Sourceownership/drainreviewA-14818 unchanged. Freshfetch/merge-tree thenready exactSHA; LinuxnotclaimedasMaclimitproof.

Criteria: C1 verified.

### coord · 2026-10-31T04:48:04.363Z

Merged 0212d40d726897bb629005b720c3599e94606f80 onto dev.
