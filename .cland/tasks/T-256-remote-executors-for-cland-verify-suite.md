---
id: T-256
kind: task
title: "Remote executors for cland verify: suite runs on cloud VMs behind a provider-agnostic executor interface (DigitalOcean first)"
state: open
status: backlog
labels:
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T08:21:26.188Z
updated: 2026-10-12T09:36:23.012Z
---

Remote executors for `cland verify`: suite runs on cloud VMs through a provider-agnostic executor interface, so the crew stops queueing behind one machine and the project pays per minute.

Decision context (human, 2026-10-12, after the remote-runner market research): cland writes its own orchestration on bare VMs rather than buying a managed runner service, because it is cheaper, has no vendor concurrency or process limits, and lets a user bring any cloud they already have. Managed services (Fly Machines, Namespace, E2B) stay possible as later backends behind the same interface.

Numbers from the v0.1 run (artifact suite logs, 2026-10-09..12): 229 full-suite runs, 42.8 machine-hours, median run 13 min, 60 h of lock wait. On DigitalOcean CPU-Optimized 8 vCPU (≈$0.0042/min) the whole release 0.1 would have cost ≈$11; at 40 runs/day ≈$70/month. Fly ≈$16 / $105, Namespace ≈$21 / $134, GitHub hosted 8-core ≈$57 / $370. The suite is Linux-portable (Neovim phase headless; three darwin mentions in code).

Scope to grill with the human:
- Executor interface in `cland verify`: create machine from image/cloud-init, wait for SSH, run the suite command on a given tree, collect output and the suite artifact, destroy. The local machine is one executor; cloud VMs another.
- First backend: DigitalOcean (per-second billing, 60 s minimum). Hetzner/Vultr next (hourly billing, so a "machine per hour with a queue" policy rather than "machine per run"). Policy is a backend parameter.
- Tree delivery: `git bundle` of the candidate commit or read access to the territory; Node 24 + Neovim + git in the image.
- Lifecycle safety: run timeout, guaranteed destroy even when the hub dies, orphan sweep by tag (a forgotten 8 vCPU VM costs ≈$6/day), per-day spend cap.
- Results flow back into the hub exactly as `cland suite` posts them today (ticket, artifact, verdict evidence, tree-hash cache from T-233).
- Secrets: the provider token lives with the human; the hub reads it, never stores it in the tracker or artifacts.
- Warm pool option: keep one machine up for short runs; spot/preemptible instances where offered.
- Before building: one real suite run on a DigitalOcean 8 vCPU VM to measure duration and confirm no process-limit issue.

Non-goals: macOS runners (5–15× the price, 24 h minimums at Scaleway/AWS); fine-grained impact analysis; replacing the local executor.

Relates to T-218 (verification research, "later: remote executors"), T-232 (`cland verify` scheduler), T-233 (result cache), T-215 (shards).

## Comments

### human · 2026-10-12T09:36:23.012Z

Prototype result (2026-10-12): the full suite on a DigitalOcean c-8 droplet in lon1 (8 vCPU Xeon 8358, 16 GB),
built from bare ubuntu-24-04-x64 and provisioned by cloud-init. The tree was a5c207b (dev), whose code matches
78508e8, the commit of the local run A-1500.

The branch is prototype/remote-executor at eccc31d, on the territory and never merged. It holds the scripts in
hub/prototype/remote-executor/ and the write-up in docs/research/remote-executor.md.

Answer

1. Not as-is. On Linux, `npm test` dies after 1.4 s, right after the 30 hub free tests. The runner's sweep between
   phases calls `ps ww -axo …` (hub/test/process-cleanup.ts:16), and procps-ng rejects it ("must set personality
   to get -x option"). Production code makes the same call (hub/src/system-processes.ts:31).
2. With PS_PERSONALITY=bsd in the environment, and no code change, the suite runs. Of 1623 tests, 1612 passed,
   5 failed and 6 were skipped. Locally, A-1500 passed all 1623.

Timings in seconds. Local is the median of the 11 most recent successful full runs (A-1429 to A-1500), with
A-1500 in parentheses.

  step                                  droplet   local
  create (API call until active)          19.5
  boot (active until SSH accepts)          7.4
  provisioning (until cloud-init done)    49.3    the script itself was 16.8
  tree delivery (6.0 MB bundle)            6.6    0.3 bundle + 5.0 copy + 1.3 clone
  npm ci                                   2.6
  pinned Neovim into .cache                1.1
  ready to run, from the create call      86.2      0
  typecheck                               11.5    about 4 (inferred)
  hub free phase                           1.1    0.72 (0.72)
  hub machine phase                      856.5    759.4 (683.9)
  Neovim phase (run alone)               102.6    96.3 (92.6)
  suite total                          about 960  856.1 (777.8)   hub phases 857.7 + Neovim 102.6
  collect                                  2.9
  destroy                                  0.8
  end to end, scripted                about 1060  about 860

Failing tests, with each file then run alone on the idle VM:

- aide.test.ts:28, "cland init writes the Aide defaults and CLI launches several Aides …". Failed 4 of 6 alone.
  The fake Claude session dies on an uncaught EPIPE at hub/test/fakes/claude-code/fake-claude.ts:227: the hook
  stdin has no 'error' listener, and Ubuntu's dash `sh` exits before the write.
- handover.test.ts:187, "a handover without a complete note is refused …". Failed 1 of 1 alone. The test reads
  hub.log before the last audit line is on disk; most likely a race.
- init.test.ts:123, "cland init on an empty repository … no machine path". Failed 1 of 1 alone. As root, HOME is
  /root, and a skill's text contains "App/root". A false positive caused by running as root.
- lead-permissions.test.ts:84 and tracker-ready.test.ts:586. Both pass alone; they time out or race only under
  the full run's load.

Skipped on the VM: four tests that need macOS sandbox-exec, one that needs a real opencode binary, and one
skills-qa case that skips itself as root.

Processes and limits, from the full run:

- Peaks: 95 user-space processes, 694 threads, 55 Node processes, 334 /proc entries including kernel threads.
- 1-minute load: peak 11.5, p50 7.7, on 8 vCPUs.
- VM limits: TasksMax 42117, ulimit -u 63815, threads-max 127630, pid_max 4194304.
- No log reported EMFILE, ENOSPC, EAGAIN or ENOMEM.
- Process accounting counted 77132 process exits during the run: git 36621, ps 20599, Node about 9000.
  This is churn, not concurrency.

Cost: the droplet lived 1840 s, which is $0.128 at $0.25/h. That includes about 13 minutes of diagnosis and
gaps. A scripted run would be about 1060 s, or $0.074. Afterwards, no droplet tagged cland-prototype and no
cland-prototype SSH key remained.

The write-up also covers what an executor interface needs and the open questions:

- Linux portability: the ps calls and the fake's EPIPE.
- Running as a non-root user.
- Load-sensitive tests on 8 vCPUs.
- Passing CLAND_SUITE_SELECTION, since a bundle has no origin/dev.
- Image or snapshot caching to cut the 76 s acquire time.
- A hub-independent watchdog, and a scoped token.
