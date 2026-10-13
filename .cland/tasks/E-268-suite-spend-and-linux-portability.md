---
id: E-268
kind: epic
title: Suite spend and Linux portability
state: closed
criterion_seq: 7
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-210
branch: null
created: 2026-10-12T11:35:13.526Z
updated: 2026-10-13T18:55:48.814Z
---

## Goal

The suite costs less to run and runs on Linux as it runs on macOS, so a remote executor can take it. One full run spawns about 77 thousand short-lived processes, 36 thousand of them `git` and 20 thousand `ps`, and takes 13 minutes locally; on Linux it stops after 1.4 seconds on a BSD-only `ps` call and, with that worked around, fails five tests (the T-256 prototype on a DigitalOcean c-8 droplet). This epic measures where the spawns come from, cuts the big sources, and fixes the Linux failures at their cause.

## Contents

- **T-267, the suite's spend** (spec §3.14, "Before the executor"): a census of the suite's spawns per test file and helper; then cuts where there is room: a prepared fixture repository copied or cloned with shared objects instead of rebuilt with many `git` calls, the children a test started tracked by pid and process group instead of a machine-wide `ps` scan per teardown, the compile cache where T-220's guard allows it, and batching of what the hub phase repeats per test; the wall time and the spawn counts before and after, recorded on T-267.
- **T-266, the hub and the suite portable to Linux** (§3.14): a process listing that both `ps` dialects accept, in `hub/src/system-processes.ts` and in the test cleanup; the fake Claude's hook stdin handling `EPIPE`; the handover test waiting for its audit line; root-safe assertions in the init test; the two load-sensitive tests (`lead-permissions`, `tracker-ready`) given the time they need; the macOS-only cases skipped with a reason.

Not in this epic: the executor that runs the suite on a cloud machine, its image and its lifecycle ("Remote executors"); the hub's verification queue and its budget, which stay as v0.1.1 built them.

Choices where the spec is silent:

- T-267 comes first: its census tells T-266 which `ps` and `git` calls matter, and its cuts change the code T-266 touches.
- The census counts spawns from inside the suite's Node processes, through a module preloaded with `NODE_OPTIONS` that records each `child_process` spawn with its command and its test file; on Linux, process accounting (`acct`) cross-checks the totals, as in the prototype. The census tool stays in the repository for later measurements.
- The machine-wide `ps` scan stays once per phase, as the runner's safety net; a test's teardown kills only the process groups it started.
- The portable listing uses the POSIX options both dialects accept and reads `/proc` on Linux only where a column needs it; nothing sets `PS_PERSONALITY`.
- A load-sensitive test gets its time through the configurable test windows (T-174), never a retry; the five failures are fixed at their cause, as T-266's criteria say.
- The Linux runs are made as an ordinary user with a home under `/home`, as the executor will run them. Iterations may use a local Ubuntu 24.04 container limited to 8 CPUs; the acceptance run is one run on a DigitalOcean c-8 droplet with the prototype's scripts (`hub/prototype/remote-executor/` on `prototype/remote-executor`, read with `git show` and run from a scratch directory), with the token read from the human's environment and never written anywhere.
- The platform skips (the four macOS `sandbox-exec` cases, the real `opencode` binary, and the root-only case when run as root) are listed by reason in the runner's summary on every platform.

## Tracer-bullet order

1. **The census.** A spawn census of one full run, per test file and helper, published as an artifact on T-267 with the run's wall time. Demo: the artifact names the ten largest sources of `git`, `ps` and Node spawns with their counts.
2. **Teardown without the machine-wide scan.** The runner and the test helpers track the process groups they start and kill those, and the machine-wide scan runs once per phase. Demo: the census after the change shows the `ps` count cut by at least half, with the suite green through `cland verify`.
3. **A prepared fixture repository.** The repository and territory fixtures are built once per worker and copied or cloned with shared objects for each test, and the hub phase's other repeated setup is batched where the census shows room. Demo: the census shows the `git` count cut by at least half, with the wall time before and after recorded on T-267.
4. **One process listing for both dialects.** `hub/src/system-processes.ts` and the test cleanup list processes in a form both `ps` dialects accept, with a test that parses recorded macOS and procps output. Demo: `npm test` on Ubuntu 24.04 runs past its first phase with no `PS_PERSONALITY`.
5. **The Linux failures at their cause.** The fake's hook stdin handles `EPIPE`, the handover test waits for the audit line, the init check is root-safe, the load-sensitive tests get their windows, and the runner lists the platform skips by reason. Demo: each of the five failing files passes ten runs in a row alone in the Linux container.
6. **The acceptance run.** One full run on a c-8 droplet as an ordinary user with PATH only, and the local run through `cland verify`, both green and recorded on T-266. Demo: the droplet run's log artifact shows the suite green with the platform skips listed by reason, and the droplet is gone afterwards.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a shell, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

QA runs the census on `dev` and compares it with the census recorded before the first cut. QA runs `cland verify` on `dev` and reads a green result. QA then runs the full suite once on a c-8 droplet with the prototype's scripts and the token from the human's environment, as an ordinary user with no environment variable beyond PATH, and reads the green log with the platform skips listed by reason; afterwards the provider's tag listing is empty. In the Linux container QA runs the listing test on both `ps` dialects, and each of the five formerly failing files alone.

- [ ] C1. A census artifact names the sources of the `git`, `ps` and Node spawns with counts per test file and helper, before the first cut and on the final `dev`.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-6 · 2026-10-13T18:55:23.402Z · commit 9bdb09419932f0f5085da79323179888de079ca5
- [ ] C2. A full run's `git` and `ps` spawn counts are cut as measured on T-279's census (A-1610: git 32,341 → 21,111, −35%; ps 28,888 → 15,290, −47%), with the wall time before and after recorded on T-267 (905 → 706 s) and phase leftovers at zero; the remaining production sources are filed as a Tech debt follow-up. (Amended 2026-10-12 from "at least halved" by the human's stand-in under D24, answering the Coordinator's ask.)
  - verified: qa-27 [qa] · run qa-2026-10-13-27-6 · 2026-10-13T18:55:23.403Z · commit 9bdb09419932f0f5085da79323179888de079ca5
- [ ] C3. No test was weakened, skipped or retried to get there, and the suite is green on macOS through `cland verify`.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-6 · 2026-10-13T18:55:23.403Z · commit 9bdb09419932f0f5085da79323179888de079ca5
- [ ] C4. `hub/src/system-processes.ts` and the test cleanup list processes the same way on macOS and Linux, covered by a test on both `ps` dialects.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-6 · 2026-10-13T18:55:23.403Z · commit 9bdb09419932f0f5085da79323179888de079ca5
- [ ] C5. The five Linux failures of the T-256 prototype are fixed at their cause.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-6 · 2026-10-13T18:55:23.403Z · commit 9bdb09419932f0f5085da79323179888de079ca5
- [ ] C6. `npm run typecheck && npm test` passes on Ubuntu 24.04 with 8 vCPUs, as an ordinary user, with no environment variable beyond PATH, and the platform skips are listed by reason.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-6 · 2026-10-13T18:55:23.403Z · commit 9bdb09419932f0f5085da79323179888de079ca5
- [ ] C7. `hub/README.md` describes the census, the platform skips and how to run the suite on Linux; T-266 and T-267 are closed.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-6 · 2026-10-13T18:55:23.403Z · commit 9bdb09419932f0f5085da79323179888de079ca5

## Dogfooding

Every later run of the build is cheaper: the crew's `cland verify` runs, the Reviewers' suite evidence and QA's demos all run the trimmed suite. The suite runs on Linux from here on, which "Remote executors" needs before it moves the crew's suites to droplets.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **Measurement.** A census run is a full suite run and takes its place in the queue like one.
- **Risks.** A prepared fixture must not leak state between tests: shared objects are read-only, and each test gets its own refs and worktrees. Group tracking must not leave orphans when a test crashes, which is why the per-phase scan stays.
- **References.** `docs/research/remote-executor.md` on `prototype/remote-executor` (the run, the failures, the process counts); T-218 "Verification at crew scale" (artifact A-1142) for the anatomy of the hub phase.
- **Order.** First in the hub lane; "Prefixes and categories" waits for it, and "Remote executors" needs its Linux run.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.14 (Before the executor) and §4 (Order).
- Tickets: T-267 and T-266, children of this epic; T-256 (decided, §3.14); T-218 (research, A-1142); T-174, T-220 and T-221 (earlier cuts of the suite).
- Branch: `prototype/remote-executor` (`docs/research/remote-executor.md`, `hub/prototype/remote-executor/`).
- GLOSSARY: Territory, Task branch.

## Plan

```yaml
stages:
  - name: census
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-277
  - name: teardown by process group
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-278
  - name: fixtures and the portable listing
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-279
      - - T-280
  - name: the Linux failures
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-281
  - name: the acceptance run
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-282
```

## Comments

### coord · 2026-10-12T11:54:39.541Z

Tickets cut on 2026-10-12 (Coordinator): T-277 the spawn census → T-278 teardown by process group → T-279 the prepared fixture repository (closes T-267's cuts) and, in parallel, T-280 the portable process listing → T-281 the five Linux failures and the skip list → T-282 the acceptance run on a c-8 droplet (closes T-266). Edges are native. Decisions where the drafts asked: (1) the census runs as a hand run through the package runner on the machine-wide suite lock, since the hub's verify worker cannot carry the NODE_OPTIONS preload; no hub change. (2) The ps cut may touch production probes in hub/src/system-processes.ts with semantics unchanged (T-278). (3) Causes first for the two load-sensitive tests; a wait that is too short gets a test-only window knob, a race gets a wait for state (T-281). (4) "No environment variable beyond PATH" reads as an ordinary login (HOME, USER, LANG as the login sets them), nothing added. (5) The skip count on Linux as an ordinary user is five (four with opencode installed); reasons matter, not the count. (6) T-267 and T-266 stay open as the record of the findings and close when their slices land (T-267 after T-279, T-266 after T-282), with the figures the Implementers send. (7) T-282 may produce no code; it then closes on its review verdict and evidence without a merge. The Implementer of T-282 tells the Coordinator in its topic before creating the droplet, so the human gets the notification they asked for.

### coord · 2026-10-13T02:15:29.028Z

Decision D24 (stand-in, 2026-10-13 ~02:20Z, answering the Coordinator's ask 07efe23c): T-269 is unblocked from T-268. The T-268 → T-269 edge ordered the hub lane; it did not reflect a code dependency. T-268's remainder (T-312, then T-282's droplet acceptance run, then its QA demo) is Linux-only and touches no tracker or item code. Conditions: T-269's live-tracker migration lands with a hub restart run by the stand-in, on a green integrated run and an empty queue; the Linux container slot keeps priority for T-312 so T-268 does not stall behind T-269's suites.

### coord · 2026-10-13T17:52:52.204Z

D25 droplet record for the QA demo qa-2026-10-13-27-5, created 2026-10-13T17:51:22Z: provider id 608772081, name cland-proto-20261013-175122, tag cland, lon1 c-8 Ubuntu 24.04 with 8 vCPUs, at head 94c5f01. Owner qa-T-268, reserve $0.125 at $0.25/hour in the shared ledger A-1906, watchdog active, destroy on exit. Destroy and cost follow.

### coord · 2026-10-13T18:19:12.918Z

D25 droplet record for qa-2026-10-13-27-5: droplet 608772081 destroyed, with absence confirmed. Lifetime 1611 s, cost $0.1119. The suite hit the driver's 1448 s suite timeout (exit 124): typecheck 0, hub-free 37/37, hub machine 1476 passed with 3 allowed skips and no failures in 1418 s, and the Neovim phase did not finish. No test failed; the run did not fit the time box. No second droplet.

### coord · 2026-10-13T18:19:41.303Z

D25 amendment (stand-in, D24, 2026-10-13 ~18:20Z): c-8 acceptance runs may live up to 45 minutes, with the suite timeout at about 38 minutes. The one-at-a-time rule and the $2-a-day cap stay. The reason: the suite grew, and a c-8 now runs the hub phase alone in about 1420 s, so the 30-minute cap and its 1448 s suite timeout cut off the Neovim phase (qa-2026-10-13-27-5). QA reruns only the droplet step in a new run.

### coord · 2026-10-13T18:20:13.717Z

Droplet cleanup receipt, qa-2026-10-13-27-5: 608772081 (cland-proto-20261013-175122) destroyed 2026-10-13T18:18:12.915Z. Lifetime 1611 s, cost $0.1119 at $0.25/hour, under the $0.125 reserve. Independent cland tag listing empty (0 bytes), imported key absent, watchdog 20015 stopped. Ledger entry b6142082-99cf-4bb1-a758-8303f1a83410 complete with absence confirmed, active=[], UTC-day total $0.3916.

### qa-27 · 2026-10-13T18:24:28.603Z

verdict: qa
result: not clear
by: qa-27 [qa]
run: qa-2026-10-13-27-5
commit: 94c5f0119c108595cedd61b807e3a16af5ff9717

| Check | Result | Command / observation | Evidence |
| --- | --- | --- | --- |
| M0 | PASS | Clean dev 94c5f011; committed brief, seven merge ancestors, regression count1, ten children closed/done, five stages with qa scope none, C1-C7 matched | [M0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M0.txt) |
| M1 | PASS | Node24.21.0; empty queue, locks read only; Docker stopped; token present; tag empty; ledger active none and spent0.2797 | [M1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M1.txt) |
| M2 | PASS | Clean detached W at B; npm ci/typecheck exit0; pinned Neovim v0.12.5 in shared root cache, Coordinator amendment744329a9 | [M2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M2.txt) |
| M3 | PASS | README census3/skip2/Linux4 hits and paragraphs read; T266/T267 closed/done via JSON per Coordinator amendment f001585d; text CLI crash retained as finding | [M3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M3.txt) |
| M4 | PASS | JSON T267 records git32341to21111,ps28888to15290,wall905to706,leftovers2to0; A1610 agrees; T302 open underC216 and namesT268/D24; text CLI crash retained | [M4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M4.txt) |
| M5 | PASS | cland verify all 53e5111a-b7d1-4c83-9704-a7d9fa73273b at B; 1838/1838 pass,fail/cancel/skip/todo0 across3phases,zero cleanup pid; A2018 | [M5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M5.txt) |
| M6 | PASS | No test-retries or retries in runner/package/shards grep (exit1); all3 macOS phases skip details0 | [M6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M6.txt) |
| M7 | PASS | Existing stopped cland-t281 fixture at B,clean; Ubuntu24.04.5,UID1001 runner,4CPUs,docker-init,Node24.21.0,procps4.0.4,pinned nvim0.12.5,no overrides | [M7.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M7.txt) |
| M8 | PASS | system-processes27 and process-cleanup23 pass on both BSD and procps,zero fail/cancel/skip; named4 assertions pass,shared processTableArgs; PS_PERSONALITY docs only | [M8.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M8.txt) |
| M9 | PASS | Five Linux files once each:55/55 pass,no fail/cancel/skip;five named regressions pass,queue empty aftereach;JSON T281 cause record per64f6238f;T339 text crash retained | [M9.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M9.txt) |
| M10 | PASS | Container stop0; Docker Desktop stop0,status stopped,no backend;bundle removed | [M10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M10.txt) |
| M11 | PASS | Eight driver contents same; authorized .sh executable-bit setup and fresh dry2 after empty tag/key/ledger checks;dry preflight0,c8lon1at0.25/hour,reserve0.1250,ledger unchanged | [M11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M11.txt) |
| M12 | FAIL | c8 Ubuntu24.04.5 UID1000 8CPUs B nooverrides;typecheck0;suite timeout1448s exit124;hub37pass then1476pass3allowedskips,zero failures;Neovim incomplete | [M12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M12.txt) |
| M13 | PASS | Destroyed18:18:12.915Z,lifetime1611s,cost0.1119<=reserve0.1250;tag trimmedempty and independent0bytes,key0,watchdoggone,ledgercomplete,total0.3916;scan clear;Coordinator amendment1af68cea | [M13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M13.txt) |
| M14 | PASS | One census through human hand-run slot at W; all3phases complete,exit0,suite814.24s,zero failures;queue identity captured | [M14-census.out](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M14-census.out) |
| M15 | PASS | Clean B census:git23109(-28.5%),ps17631(-39.0%),node6928;within24256/18777limits;source tables present,3phases,zero cleanup;token scan clear | [M15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M15.txt) |
| M16 | PASS | Docker stopped,tagempty,ledgerinactive,total0.3916,no leftovers,queueempty,Wclean,dev unchanged B,token scan clear138files | [M16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011/M16.txt) |

Findings ranked by severity:

- High: none.
- Medium — M12 / C6: the c-8 suite exceeded its 1,448-second outer timeout and returned suite_exit 124. This was a suite timeout, not a test failure. The driver ran ordinary-login `npm run typecheck` (exit 0) and `npm test -- --all`. Hub free passed 37/37; hub machine passed 1,476 with 3 allowed platform skips and zero failures. Hub machine took 1,417.94 seconds. Neovim started but did not finish; it has no final phase counts and the run has no final suite-duration line. The driver wrapper exited 0 after successful collection and deletion; that does not make the suite green. No retry or second droplet ran.
- Medium — M3/M4/M9, T-339 (C-325 Bugs, qa-found): `node hub/bin/cland.ts task view T-266`, `T-267`, `T-302` and `T-281` printed `cland: Cannot read properties of undefined (reading 'verified')`. The Coordinator attributed this to the dev CLI receiving an older live-hub frame without the new criteria counts. The authorized JSON readbacks establish the required records; the crash remains a separate product finding. The Coordinator filed T-339.
- Low: none.

Verdict: QA not clear E-268 (legacy T-268). Run `qa-2026-10-13-27-5`; full tested dev SHA `94c5f0119c108595cedd61b807e3a16af5ff9717`. Sixteen checks PASS; M12 FAIL. Verify C1,C2,C3,C4,C5,C7; fail C6 because the required full Ubuntu suite did not complete within the allowed timeout. No blocked or inconclusive checks.

| Criterion | Evidence | Mark |
| --- | --- | --- |
| C1 | M14, M15 | verified |
| C2 | M4, M15 | verified |
| C3 | M2, M5, M6; M12 emitted skip reasons are allowed | verified |
| C4 | M8 | verified |
| C5 | M9 | verified |
| C6 | M11, M12, M13; M12 timeout | failed |
| C7 | M3 | verified |

Mac verification: run `53e5111a-b7d1-4c83-9704-a7d9fa73273b`, artifact A-2018 at `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2018-suite-53e5111a-b7d1-4c83-9704-a7d9fa73273b-all-at-94c5f01.log`. Exact tested head, 1,838/1,838 passing, zero failures/cancellations/skips/todos in all three phases, zero cleanup leftovers, duration 866.18 seconds.

Final dev census: A-2021, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2021-e-268-final-dev-spawn-census-at-94c5f011-git-28-5-ps-39-0`. Clean tested head, exit 0, duration 814.24 seconds, three phases, no cleanup leftovers. Git 23,109 versus 32,341 (−28.5%); ps 17,631 versus 28,888 (−39.0%); Node 6,928 versus 6,017 (+15.1%, recorded not judged). Both agreed C2 bounds (24,256 / 18,777) pass. Baseline A-1535 and T-279 comparison A-1610 were read, and the earlier 905→706-second cut and production follow-up T-302 under C-216 were confirmed.

Linux targeted checks: M8 ran system-processes (27) and process-cleanup (23) once on each platform: 100 passes. M9 ran aide (7), handover (4), init (15), lead-permissions (5), tracker-ready (24) once each: 55 passes, no failure or skip. Ubuntu container remained at 4 CPUs, UID1001 runner, Docker init, Node24.21.0 and pinned Neovim0.12.5. Historical A-1687, A-1768 and A-1832 were read, not rerun. One shell `child setpgid ... Operation not permitted` diagnostic appeared after the successful init invocation; all original assertions and exit status passed.

Droplet evidence: A-2022, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2022-e-268-c-8-suite-timeout-at-94c5f011-destroyed-cost-usd0-1119`. Ubuntu24.04.5,8vCPUs,UID1000 runner,Node24.21.0,clean exact head and ordinary login with no added overrides. The three reported skips were edges and spawn-census (needs macOS sandbox-exec), and orphan-servers (OpenCode is absent or cannot run on this machine). Neovim was incomplete, so extracted aggregate counts are partial, not full-suite totals. The acct/census cross-check is retained as informational only.

D25 lifecycle: created provider608772081 / cland-proto-20261013-175122, tag cland, lon1 c-8, at 2026-10-13T17:51:22.054Z; owner qa-T-268, reserve USD0.1250. Destroyed 2026-10-13T18:18:12.915Z; lifetime1,611seconds; estimated costUSD0.1119 atUSD0.25/hour. Shared ledger entry b6142082-99cf-4bb1-a758-8303f1a83410 is complete/resourceAbsenceConfirmedtrue; active=[]; UTC-day totalUSD0.3916. Create and destroy reports went to the Coordinator in Agents and were recorded on E-268. Independent tag listing empty, imported SSH key absent, watchdog stopped. Private keys and source bundle removed. No second attempt.

Cleanup and build: Docker stopped, no backend or run leftovers, queue empty; clean detached worktree removed successfully; scratch driver removed; dev remains at the tested full SHA. Literal token scans passed before publication. Run records contain exactly one line per M0–M16. Brief setup failures were preserved and resumed only under the Coordinator amendments below; no product source or assertion was changed.

Coordinator decisions during this run:

- d0884eb0-2c16-4ea9-a358-282d8e705638: use dev at announced START, after the Coordinator go, rather than the original request’s d4efa57. Go ee868b74-cb29-4f17-8060-bfb082c2a99c names 94c5f0119c108595cedd61b807e3a16af5ff9717. Queue was empty; START 17:29:02Z fixed that build.
- 744329a9-6d4f-4f24-840f-5d8efed29916: “PASS. M2 exists to pin the Neovim version, and v0.12.5 is it. nvim-path deliberately resolves the cache in the main repository, which every worktree shares”. The W/.cache wording was wrong; the actual shared main-repository v0.12.5 path passed.
- f001585d-dedb-47dc-b659-e1db2c8dcb42: “For E-268’s verdict, judge M3 and M4’s item state by the JSON readbacks that you already have green.” The plain text CLI crashed on missing criteria counts in the older running hub’s frame. This is retained as a product finding, not a C7 failure. JSON readbacks prove T-266/T-267 closed/done, T-267’s exact before/after record and T-302 open under C-216 with T-268 and D24 in its body. Coordinator attributed it to the hub starting before T-330 merged.
- 0b6b61e7-a5b2-4bf6-99e3-232e2513879e: Coordinator confirmed the text-view finding filed in C-325 Bugs with qa-found and needs-triage; it remains uncommitted during the dev freeze. No item id supplied in that message.

- 64f6238f-7c58-4d85-bbee-ad56f912c367: “Apply the same JSON readback to T-281’s cause record, and to any later task view text read in this run.” The single version-skew finding is T-339. This extends f001585d to every text read; M9 retains the original crash and the complete T-281 JSON.

- 457d44b2-2d85-4d16-8ce9-7585a057bd90: restore executable bits on the scratch driver’s .sh files only. Artifact copies lost file modes although all eight contents matched A-1938. The initial preflight exited 1 at provider.sh Permission denied before any provider mutation.
- 0c2222c2-4476-48bd-a49c-bc056ed6149d: preserve S-dry after the resumed driver refused its nonempty directory; use fresh S-dry2 after confirming empty cland tag, no imported prototype key, active=[] and unchanged ledger checksum. Those safety conditions all held. Original S-dry contained only an empty account.txt, retained as evidence. D25 limits and assertions remain unchanged.

- 1af68cea-91d6-4de8-a7e6-16f81b288fe5: M13 PASS means “an empty listing after trimming”. Driver tag-after.txt is a single newline; independent provider listing is zero bytes. The old byte-count wording was wrong. The later proposed 45-minute cap does not apply to this completed run.


Evidence artifact A-2023: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011.

Verdict submission amendment 9fbb17a8-1110-440c-b035-578fe2d47cc8: the first call was refused with "verified requires a clear verdict" and wrote no verdict. Per the Coordinator, this corrected not-clear call carries only failed C6. C1,C2,C3,C4,C5,C7 were verified by the evidence above, but their tracker verification marks are not set by this not-clear verdict; they are carried in the text for the requested later droplet-only clear run. Persistent marks from this call: C6 failed only.

Criteria: C6 failed (M12: full c-8 Ubuntu suite timed out at 1448s (suite_exit124); hub phases completed with zero failures, Neovim did not finish.).

### coord · 2026-10-13T18:28:30.948Z

D25 droplet record for the droplet-only rerun qa-2026-10-13-27-6, created 2026-10-13T18:27:15.910Z: provider id 608783060, name cland-proto-20261013-182715, tag cland, lon1 c-8 Ubuntu 24.04 with 8 vCPUs, at head 9bdb094. Owner qa-T-268, reserve $0.1875 at $0.25/hour. Under the 45-minute amendment: watchdog 2550 s, hard guard 2700 s, suite limit 2280 s. Destroy and cost follow.

### coord · 2026-10-13T18:51:39.222Z

Droplet cleanup receipt, qa-2026-10-13-27-6: 608783060 (cland-proto-20261013-182715) destroyed 2026-10-13T18:50:33.675Z. Lifetime 1398 s, cost $0.0971, under the $0.1875 reserve. Independent cland tag listing empty (0 bytes), imported key absent, watchdog 80666 stopped. Ledger entry 0518e71d-2236-4b1b-9a02-3bf3722dc389 complete with absence confirmed, active=[], UTC-day total $0.4887. Result GREEN: typecheck 0 and suite 0, with 1838 tests, 1832 passed, 6 allowed platform skips and 0 failed, in all three phases in 1249.74 s.

### qa-27 · 2026-10-13T18:55:23.403Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-13-27-6
commit: 9bdb09419932f0f5085da79323179888de079ca5

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| M11 | hub-api / shell | PASS | M11.txt, M11-dry-run.log, driver-timebox.patch: source driver matched A-1938; dry preflight exit 0, reserve USD0.1875, ledger unchanged |
| M12 | hub-api / shell | PASS | M12.txt, c8/linux/suite.log, c8/linux/run-stamps.txt: typecheck and full suite exit 0 |
| M13 | hub-api / shell | PASS | M13.txt, M13-details.json, M13-ledger.txt: droplet destroyed, empty tag, key absent, watchdog stopped |

Findings ranked by severity: no new high, medium or low findings in this rerun. Historical medium finding T-339 (plain task-view crash on an older hub frame) remains recorded in A-2023; this droplet-only run did not retest or claim to fix it. The earlier C6 result was a suite timeout, not a test failure. This new complete run resolves C6.

QA clear E-268, run `qa-2026-10-13-27-6`, tested dev `9bdb09419932f0f5085da79323179888de079ca5`. Scope was only M11–M13, with C1–C5 and C7 carried from run qa-2026-10-13-27-5 by Coordinator request 5c3ecfac-b927-4776-b152-c3301969a832 and confirmation e194eaaa-4f57-460f-aac5-62517370e507. Build checks found no code changes outside tracker, QA and documentation paths between the builds. Dev remained unchanged through cleanup and verdict preparation.

| Criterion | Evidence and result | Mark |
| --- | --- | --- |
| C1 | A-2023 M14/M15 and A-2021: census source tables before the cut and at the carried build | verified, carried |
| C2 | A-2023 M4/M15 and A-2021: git 23,109 vs 32,341 (−28.5%); ps 17,631 vs 28,888 (−39.0%), within agreed 24,256/18,777 bounds; historical 905→706s recorded, zero phase leftovers, T-302 follow-up | verified, carried |
| C3 | A-2023 M2/M5/M6: macOS verify 53e5111a-b7d1-4c83-9704-a7d9fa73273b, A-2018, 1,838 passes, zero skips/failures, no weakened tests or retries | verified, carried |
| C4 | A-2023 M8: system-processes 27 and process-cleanup 23 tests on each platform, 100 passes | verified, carried |
| C5 | A-2023 M9: aide 7, handover 4, init 15, lead-permissions 5, tracker-ready 24; 55 Linux passes with cause records | verified, carried |
| C6 | Current M11–M13; A-2028: typecheck and all three full-suite phases pass on ordinary-user Ubuntu c-8, allowed skips named, cleanup confirmed | verified, current |
| C7 | A-2023 M3: README census/platform/Linux instructions; T-266 and T-267 closed | verified, carried |

The carried run tested `94c5f0119c108595cedd61b807e3a16af5ff9717`. A-2023 preserves its complete evidence and amendments:
`/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2023-e-268-qa-not-clear-c-8-suite-timeout-c1-c5-and-c7-pass-at-94c5f011`.
A-2021 preserves the census:
`/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2021-e-268-final-dev-spawn-census-at-94c5f011-git-28-5-ps-39-0`.

Current acceptance evidence A-2028:
`/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2028-e-268-c-8-acceptance-green-at-9bdb094-1832-pass-6-platform-skips-destroyed`.

The driver ran `npm run typecheck && npm test -- --all` in an ordinary login, UID1000 runner, /home/runner/cland, Ubuntu24.04.5, 8 vCPUs, Node24.21.0, pinned Neovim, exact tested SHA and no added login overrides. Typecheck exit 0; suite exit 0; driver exit 0.

| Phase | Tests | Pass | Allowed skips | Fail | Duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hub free | 37 | 37 | 0 | 0 | 1.49s |
| Hub machine | 1479 | 1476 | 3 | 0 | 1129.79s |
| Neovim | 322 | 319 | 3 | 0 | 118.45s |
| Total | 1838 | 1832 | 6 | 0 | 1249.74s |

Zero cancelled or todo tests. Five skips require macOS sandbox-exec (edges, spawn-census, three Neovim QA cases); orphan-servers requires available OpenCode. Full names and reasons are in M12.txt and suite.log. No retry or second droplet in this run.

D25 lifecycle: provider608783060, cland-proto-20261013-182715, tag cland, lon1 c-8. Created 2026-10-13T18:27:15.910Z; destroyed 2026-10-13T18:50:33.675Z. Lifetime 1398s, estimated cost USD0.0971 at USD0.25/hour, within USD0.1875 reserve. Ledger entry 0518e71d-2236-4b1b-9a02-3bf3722dc389 complete, resourceAbsenceConfirmed true, active=[], UTC-day total USD0.4887 below USD2. Independent tag listing zero bytes; driver's newline-only listing empty after trimming. Imported key absent; watchdog80666 stopped. Coordinator recorded both lifecycle reports on E-268.

Amendments: D24/D25 authorized a 45-minute lifecycle and 38-minute suite limit. Coordinator decision c5a49914-bf45-44aa-8fc8-2455ba51431f additionally confirms polling deadline 2550 and reserve price × 0.75h, superseding the brief's USD0.125 bound. Exact seven scratch changes are retained in driver-timebox.patch: run-all.sh WATCHDOG_SECONDS 1650→2550, SUITE_TIMEOUT 1500→2280, polling +1650→+2550; c8-run.py reserve 0.5→0.75h, lifecycle diagnostic 1650→2550, elapsed guard1650→2550 and hard guard1800→2700. Scratch .sh executable bits were restored per the committed setup amendment. The daily cap and one-droplet rule remained unchanged.

Cleanup: private keys and source bundle removed, dry state and scratch driver removed, clean detached worktree removed successfully, no run leftovers. No local machine suite slot was claimed for this droplet-only run. Exactly one PASS record for each of M11–M13 is preserved in runs.jsonl. Token scans passed before publication.

Complete evidence artifact A-2031: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2031-e-268-qa-clear-c-8-acceptance-and-c1-c7-evidence-at-9bdb094.
Persistent criterion marks in this clear verdict: C1,C2,C3,C4,C5,C6,C7 verified in run qa-2026-10-13-27-6.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-13T18:55:48.814Z

Closed on QA's clear demo, qa-2026-10-13-27-6 at 9bdb094 (A-2031). C1 to C7 verified. The c-8 acceptance is green (A-2028), and C1 to C5 and C7 carry over from qa-2026-10-13-27-5 (A-2023, census A-2021), with the code identical. Droplet spend for the day: $0.49.
