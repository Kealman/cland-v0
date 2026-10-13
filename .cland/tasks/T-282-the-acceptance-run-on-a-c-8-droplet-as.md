---
id: T-282
kind: task
title: The acceptance run on a c-8 droplet as an ordinary user, and locally
state: open
status: in progress
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-268
blocked_by:
  - T-281
  - T-312
topic: topic-195
branch: t/T-282-the-acceptance-run-on-a-c-8-droplet-as
created: 2026-10-12T11:54:20.829Z
updated: 2026-10-13T09:06:07.929Z
---

## Summary

Prove the epic's result where the remote executor will run it: one full `npm run typecheck && npm test` on a fresh DigitalOcean c-8 droplet as an ordinary user with nothing added to the login environment, green with the platform skips listed by reason, and the same tree green locally through `cland verify`. The droplet is destroyed afterwards and both results are recorded on T-266.

## Parent

T-268: Suite spend and Linux portability. Realises T-266 (the hub and the suite portable to Linux) under epic T-268, slice 6 of 6; with this slice T-266 is complete. Spec: docs/spec/v0.1.2.md §3.14 ("Before the executor") and §4 (Secrets).

## What to build

One measured run, driven by the prototype's scripts, at the head of this task's branch (current `dev` with slices 1 to 5 merged).

- **The scripts.** Read `hub/prototype/remote-executor/` from the branch `prototype/remote-executor` with `git show` and copy them into a scratch directory outside the repository; never check the branch out and never commit them. Adapt them only as this run needs: the user data creates an ordinary user with a home under `/home`, the tree is cloned into that home, `npm ci`, the typecheck and the suite run as that user from a login with nothing added (no `PS_PERSONALITY`, no `CLAND_*` variable; the prototype's `SUITE_PS_PERSONALITY` stays unset; "nothing beyond PATH" means an ordinary login, so HOME, USER and LANG as the login sets them, by the Coordinator's reading of 2026-10-12), and process accounting (`acct`) stays on for the run. The watchdog, the tag and the destroy on every exit path stay as they are.
- **Before the droplet.** Tell the Coordinator (`to: coordinator`) in this item's topic, before the create call, that the droplet is about to be created: size, region, expected lifetime and cost (about $0.07 to $0.13). The human asked for a notification before the first real droplet. Wait for no answer unless the Coordinator asks you to.
- **The run.** One run on a `c-8` droplet (the prototype's region fallback: lon1, nyc1 or sfo2 offer it), the whole suite (`--all`, since a bundle carries no `origin/dev`), under the prototype's timeout. Collect the log, the runner's phase and skip lines, and the `acct` counts per command. Destroy the droplet and the imported SSH key; list the tag afterwards and record that it is empty.
- **The census cross-check.** Compare the `acct` totals of `git`, `ps` and Node exits with the census of slice 3 (the epic's choice: process accounting cross-checks the census on Linux). Name the difference and its known cause (the census does not see non-Node spawns such as git hooks).
- **Locally.** Request `cland verify all` on the same head and read a green result.
- **Record.** Publish the droplet run's log (with the skip list, the phase timings and the `acct` counts) and the local result as artifacts in this item's topic, and send the Coordinator (`to: coordinator`) the figures for T-266: pass, fail and skip counts on both, the droplet's lifetime and cost, the empty tag listing.
- **Fix at cause.** If the droplet run finds a failure the container did not, fix it at its cause in this ticket with a test, as slice 5 does, and run once more. No retry, no skip.
- **If no code changes result**, say so in the report: the Coordinator then closes the item on its review verdict and the recorded evidence instead of a merge.

Demo, as the epic words it: the droplet run's log artifact shows the suite green with the platform skips listed by reason, and the droplet is gone afterwards.

Out of scope: the remote executor itself, its image and lifecycle (epic T-271); any change to the hub's verification queue or budget.

Constraints:
- The DigitalOcean token (`DIGITALOCEAN_TOKEN`) is read from the environment at use and never stored, printed, logged, copied to the droplet, or written into an item, a comment, an artifact or a commit. Check every published log for it before publishing. The account's pre-existing droplet `dockeronubuntu2204-s-2vcpu-2gb-fra1-01` (tag n8n) is the human's own: never touch it; act only on droplets carrying the prototype's `cland` tag.
- One acceptance run on the droplet; iterations happen in the local Ubuntu 24.04 container limited to 8 CPUs. Never leave a droplet running: the watchdog stays armed, and the tag listing is empty when you finish.
- Suites for review run through `cland verify`. Commit on the task branch, push to `origin`; `dev` only through `cland merge`. English everywhere.

## Acceptance criteria

- [x] C1. The Coordinator was told in this item's topic before the droplet was created.
  - done: impl-282 · 2026-10-13T07:23:44.354Z
  - verified: rev-26 [reviewer] · run rev-20261013-282-initial · 2026-10-13T07:26:32.022Z · commit 7eab38f67e1fd783148b30d175b37734f6410984
- [ ] C2. The droplet run's log artifact shows `npm run typecheck && npm test` green on Ubuntu 24.04 with 8 vCPUs, as an ordinary user with a home under `/home`, with nothing added to the login environment, and the runner's list of platform skips by reason.
  - failed: rev-26 [reviewer] · 2026-10-13T07:48:31.820Z · note A-1846 c-8 full run fails inbox-workload.test.ts:102 hold-response wait; hub1fail and Neovim never starts.
- [ ] C3. The droplet and the SSH key were destroyed; the tag listing afterwards is empty and is recorded in the item.
  - verified: rev-26 [reviewer] · run rev-20261013-282-1 · 2026-10-13T07:47:44.926Z · commit 7eab38f67e1fd783148b30d175b37734f6410984
- [ ] C4. The `acct` totals for `git`, `ps` and Node are compared with the census of slice 3, and the difference is explained.
  - failed: rev-26 [reviewer] · 2026-10-13T07:49:49.251Z · note A-1846 Node acct count 1,843 is explicitly a lower bound; runtime command classification remains incomplete.
- [ ] C5. No published log, comment or artifact contains the token.
  - verified: rev-26 [reviewer] · run rev-20261013-282-1 · 2026-10-13T07:47:45.265Z · commit 7eab38f67e1fd783148b30d175b37734f6410984
- [x] C6. The suite is green on macOS through `cland verify` at the same head, and no test is weakened, skipped or retried.
  - done: impl-282 · 2026-10-13T07:24:42.456Z
  - verified: rev-26 [reviewer] · run rev-20261013-282-initial · 2026-10-13T07:26:33.197Z · commit 7eab38f67e1fd783148b30d175b37734f6410984

## Comments

### impl-282 · 2026-10-13T07:21:29.905Z

Acceptance setup complete at clean head 7eab38f67e1fd783148b30d175b37734f6410984 (T-312 a071775 included). Fresh origin/dev fetch/merge performed. Before create, Coordinator notified in topic-195 of c-8/lon1, 20–30 minute/$0.08–$0.13 plan; explicit go received at 07:20:20Z. Plan A-1839. One prototype-driven acceptance invocation launched with required cland tag, ordinary /home/runner login, acct, 4500s timeout/6600s watchdog and exit/signal destruction. Scripts stay outside repo. No candidate code changes.

### impl-282 · 2026-10-13T07:22:48.017Z

First attempt is a provisioning stop, not an acceptance run: doctl create --wait returned status new and an empty PublicIPv4, so no SSH/login/install/typecheck/test ran. Driver terminated before diagnosis; exit trap destroyed owned droplet 608626194 and imported key 60056355. Post-cleanup cland tag listing [] and imported-key listing []. Lifetime 42s; cost $0.0042 at $0.25/h (60s minimum). Host log scanned clear and published in topic-195. Scratch driver now polls its exact cland-tagged/name-matched droplet for both active and public IPv4, with a 300s deadline; deadline failure triggers destruction. Fresh second preflight confirms empty tag and same c-8/lon1 price. Awaiting new Coordinator go before any second create.

### impl-282 · 2026-10-13T07:36:12.387Z

Local same-head proof received: cland verify all 94880be0-b9fe-4ac8-b30e-78386dce65ec at 7eab38f67e1fd783148b30d175b37734f6410984, typecheck green, 1750/1750 passes, zero fail/cancel/skip/todo. Hub reused identical full candidate tree 6e7801f3a6c8f010d211d266bb943fe0e4f3de60 from original T-312 macOS run 4e40bdda at 01a51c5; this was a cache hit, not new local execution or retry. Requested-head artifact A-1841 in topic-195 scanned clear for token bytes. Coordinator decision 85365fed explicitly waived a later dev merge to preserve same-head evidence. Successful second provisioning confirmed c-8/lon1 Ubuntu24.04, ordinary uid1000 runner/home under /home, normal login env, 8 CPUs, Node24.21.0. Droplet typecheck0 and hermetic36/36; full machine shard ongoing, no second suite invocation.

### impl-282 · 2026-10-13T07:45:26.820Z

Acceptance failed evidence A-1846: Ubuntu24.04/c-8 ordinary login, typecheck0, hub1443tests/1439pass/1fail/3existing skips, no cancel/todo; Neovim not reached. inbox-workload.test.ts archive startup bounded-work case failed at line102 waiting for100 protocol hold results within15000ms (before later sweep-count bounds). Full suite998.7s. Droplet608626603 destroyed; imported key60056385 absent in fresh listing; cland tag[] freshly confirmed, then remaining watchdog stopped. Lifecycle1130s/$0.0784, total incl first provisioning stop about$0.0826. Immediate stale key listing is retained beside fresh receipts; all35bundle files token-scanned clear. acct global git24965/ps15928, runner git24965/ps15628; Node name totals are preliminary because Linux acct also records runtime thread names, not just MainThread/node. No second droplet suite or retries. Coordinator directed macOS alone/CPU-contention diagnosis before container request; exact failing case launched unchanged locally.

### rev-26 · 2026-10-13T07:48:31.820Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261013-282-1
commit: 7eab38f67e1fd783148b30d175b37734f6410984

Medium: hub/test/inbox-workload.test.ts:102 — actual c-8 run times out waiting for 100 hold responses before later sweep bounds; C2 green all-phase acceptance absent. Cause not established by this log.
Medium: A-1846/index.md:72 — Node acct1834/1843-style count is declared MainThread+node lower bound with runtime names unclassified; C4 complete Node comparison remains pending.
Low: A-1846/index.md:76 — summary says 256 protocol holds, but source at101–102 sends and waits for100; correct evidence wording.
C1/C6 previously verified; C3 fresh exact-resource absence receipts and C5 independent literal-token scan of39 published evidence/tracker files verified separately. A-1847 records scope and evidence. Failed log preserved; no retry or loosening authorized by this verdict.

Criteria: C2 failed (A-1846 c-8 full run fails inbox-workload.test.ts:102 hold-response wait; hub1fail and Neovim never starts.), C4 failed (A-1846 Node acct1834/1843-style figure is explicitly a lower bound; runtime command classification remains incomplete.).

### impl-282 · 2026-10-13T08:32:30.096Z

Cause at failed7eab38f proved by A-1857: each hold release synchronously hydrated unrelated retained tracker rows in #changed and topic ancestry; under16CPU workers/4CPU cap all100unique successful replies were present at26.025s, but15000ms eventual wait had expired. Native writes0.53ms; no dropped-frame cause. Complete source comparison then found both paths already fixed by T-314deb88d3. Coordinator authorized regression-only commit516870128721f5ecb0920fbf40d61ae12ea62ef5 on currentdev731fff4, pushed to origin. New minimized real-protocol case fails pristine7eab38f with344indexed queries (>100), passes currentdev with24; full inbox-workload file6/6green50.12s. Initial pristine dependency setup failure retained separately, never counted as red proof. No existing2000-item/time/sweep assertion changed. T-282 now has a regression change and merges normally; no source cherry-picks needed elsewhere. Requested post-T-315 container slot for original16-worker case then ten complete file runs, before fresh droplet acceptance.

### impl-282 · 2026-10-13T09:06:07.929Z

First post-regression Linux proof A-1864 at5168701 passed the original100-hold response/sweep section under16busy workers in unchanged4CPU container, but the later stop-7 OS ps probe failed. Ten-alone stage was not invoked. All workers/container/Desktop stopped before END. Coordinator classified this whole-case synthetic ps starvation outside acceptance, filed followupT-320 underT-216 needs-triage, and approved a fresh proof with16workers limited to the hold burst, reaped after unchanged sweep assertion and before stop phase, then ten unchanged full-file runs alone. Waiting for T-31511d93365 completion and empty queue; no assertion/deadline/retry/settings changed.
