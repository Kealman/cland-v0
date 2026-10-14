---
id: T-349
kind: task
title: "The second backend's gate: the MicroVM experiment of docs/research/do-microvms.md, run once by the human or by a session the human names, with its summary on E-271 and the decision it settles"
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - ready-for-human
assignee: null
parent: E-271
blocked_by: []
topic: null
branch: null
created: 2026-10-13T20:53:46.294Z
updated: 2026-10-14T16:41:57.350Z
closed: 2026-10-14T03:36:38.646Z
---

## Summary

This ticket needs the human's go before anything runs. It creates billable DigitalOcean resources: about $0.12, and about $0.45 if the suite hangs until its timeout. One full cland suite runs once on an 8 vCPU DigitalOcean MicroVM with the script in the research note's Appendix A. The summary goes on E-271 as an artifact, with pass or fail on each of the four conditions. A pass files the MicroVM backend in Follow-ups for a later release. There is no code in this ticket, and it closes on evidence, as T-282 did.

## Parent

E-271: Remote executors, tracer bullet 6 of 6, "The second backend's gate". Spec: `docs/spec/v0.1.2.md` §3.14: MicroVMs become the second backend behind the same interface only once one experiment passes; Fly Machines come third. The epic's choice: the human runs it, or names in an answer to the Coordinator's ask the session that runs it. Research: `docs/research/do-microvms.md` on `research/do-microvms`, §7 "The experiment that settles it" and Appendix A (the script).

## What to build

Nothing in the repository. The steps:

1. **The go.** The Coordinator asks the human, with `ask`, for the go, the run's time and who runs it: the human, or a session the human names. Under D24 the stand-in may answer, and it names the session if it does. Nothing is created before the answer, and the answer is recorded on this item.
2. **Before the run.** The runner checks four things:
   - the MicroVM API's current state against the note: it was a public preview three days old when the script was written on 2026-10-12, so read the OpenAPI files and doctl's release notes for changes;
   - that `GET /v2/microvms?tag_name=cland-microvm-exp` is empty;
   - that the day's droplet spend leaves room under the cap;
   - that `DIGITALOCEAN_TOKEN` has the microvm scopes. The runner checks presence only and never prints the value.
3. **The run.** Extract the script exactly as §7 "How to run it" says, and run it with `REF=dev` and `OUT=/tmp/cland-microvm-exp`. Never commit the script, never check out `research/do-microvms`, never edit the token into a file.
4. **The judgement.** Judge each condition from §7 against the outputs (`summary.txt`, `guest.txt`, `checkpoint.json`, `pause.txt`, `idle.txt`, the stamps, the samples and the logs):
   - (a) The suite completes, fails no test that passes on a c-8 droplet, and logs no EAGAIN, EMFILE, ENOMEM or "Resource temporarily unavailable".
   - (b) The pids and process limits leave at least ten times the droplet's peaks of 95 processes and 694 threads.
   - (c) Typecheck and suite run within about 10 percent of a current c-8 droplet, with steal under 5 percent. The note's 1070 s came from the droplet's 972 s on 2026-10-12. The suite has grown since: A-2028 at `9bdb094` ran all three phases on c-8 in 1249.74 s. Settled by the stand-in under D24 (2026-10-13): the bound is today's c-8 full suite plus 10 percent, 1249.74 s × 1.1 ≈ 1375 s. The go names the runner, by default the stand-in from the human's shell.
   - (d) The checkpoint clone is running within seconds, and the paused process survives the pause.

   Also record step 10's answer, what counts as idle, since it decides how a MicroVM run is kept awake.
5. **The record.** Scan every file for the token while it is still in the environment, as T-282's `scan-token.py` did. Then publish the summary and the raw outputs as one artifact in E-271's topic, with each condition's pass or fail and its numbers, the wall time, the cost, and the empty `cland-microvm-exp` listing after cleanup.
6. **The decision.** On a pass, the Coordinator files "DigitalOcean MicroVMs as the second executor backend" in Follow-ups (C-326) for a later release. It links this artifact and lists what the interface already has for it: `paused`, the exec transport and checkpoint as `prepare`. On a fail, the result stays on E-271 and nothing is filed. A partial result, such as a pass on limits and a fail on speed, counts as a fail, as the research note's §6 says.

**Out of scope.** The MicroVM backend itself, and Fly Machines.

**Constraints.**

- Billable resources are created only after the recorded go. The script deletes what it made on exit. A leftover MicroVM pauses itself 60 minutes after the last poll, and the runner deletes it by tag.
- The token is never printed, stored or committed, and never placed in an artifact.
- The account's droplets, the human's n8n droplet included, are never touched.
- Everything is in English.

## Acceptance criteria

- [x] C1. The go, from the human or the stand-in under D24 naming the runner, is recorded on this item before any create.
  - done: human · 2026-10-14T03:06:14.762Z
- [x] C2. The summary artifact in E-271's topic shows pass or fail on each of the four conditions, with their numbers, step 10's idle answer, the wall time and the cost.
  - done: human · 2026-10-14T03:36:34.182Z
- [x] C3. After the run, `GET /v2/microvms?tag_name=cland-microvm-exp` and the checkpoint listing are empty, and the item records it.
  - done: human · 2026-10-14T03:36:35.178Z
- [x] C4. The published files are clear of the token by a literal scan made while the token was available.
  - done: human · 2026-10-14T03:36:36.134Z
- [x] C5. On a pass, the MicroVM backend is filed under Follow-ups with a link to the artifact. On a fail, E-271 records the result and nothing is filed.
  - done: coord · 2026-10-14T16:41:57.350Z

## Comments

### human · 2026-10-14T03:06:14.548Z

Go recorded by the stand-in under D24 (2026-10-14 ~02:45Z): the runner is the stand-in cland-impl from the human's shell. Preconditions checked: options call answers with microvm and exec_pty enabled (limits: 50 MicroVMs, 16 GiB, idle max 7200 s); GET /v2/microvms?tag_name=cland-microvm-exp is empty, all MicroVM and checkpoint listings are empty; executor ledger today $0.00, no cland droplets; token present in the shell environment (presence only). Script extracted from research/do-microvms Appendix A (222 lines, parses), run with REF=dev OUT=/tmp/cland-microvm-exp. Speed bound ≈1375 s per D24.

### human · 2026-10-14T03:16:37.001Z

Run 1 (02:46–03:14Z, stand-in): base MicroVM running in 22 s; provisioning 34 s; bundle delivery 38 s; prep (clone, npm ci, Neovim) 36 s; checkpoint 53 s; clone from checkpoint running in 1.4 s; typecheck ok in 13 s; the suite died 2 s in, after its 37 hub-free tests, in the runner's process sweep: `ps -ww -e -o pid=,ppid=,pgid=,lstart=,stat=,command=` exit 1 with no output. Cause: the Appendix A script (2026-10-12) sets PS_PERSONALITY=bsd for the run, and T-280 (merged 2026-10-13) moved the listing to the POSIX form and requires that nothing sets PS_PERSONALITY; under it procps misreads -e. Pause: 412 ms, exec after resume 770 ms, background sleeper alive. Idle: a busy loop with no traffic was paused after 63 s, an exec every 30 s kept it running (CPU work is not activity). Limits: pid_max 32768, threads-max 128085, no pids/cpu/memory cgroup caps, Max processes 64042, 8 vCPU AMD EPYC, 16 GiB. Listings after cleanup: 0 MicroVMs with the tag, 0 checkpoints; token scan of the outputs clean. Checkpoint reports memory_bytes 360777327160 (an API oddity, noted). Decision under D24: one rerun with PS_PERSONALITY removed from the suite step (a script defect, not a MicroVM property); both runs go into the artifact.

### human · 2026-10-14T03:36:33.941Z

Run 2 (02:36–03:34Z, PS_PERSONALITY removed): the suite ran 784.9 s on the hub phases (hub free 1.1 s, hub machine 783.7 s on 4 workers, peak load 9.49, steal 0 %); 1572 tests, 1523 pass, 45 fail, 4 skipped; the Neovim phase did not run. 44 failures are the executor test files, all rooted in `spawn ssh-keygen ENOENT` (the Appendix A provisioning installs no openssh-client, which T-343+ need since 2026-10-13); 1 failure is task-prefixes' two-thousand-items case on EMFILE: the workload container's open-file limit is 1024 soft and hard. Verdict: FAIL as run (partial result, §6), with (b) limits and (d) checkpoint/pause passing in both runs and (c) speed passing on the measured phases (≈45 % faster than the c-8's hub phase). Idle: CPU work is not activity; an exec every 30 s keeps the MicroVM alive. Costs ≈ $0.15 + $0.24 ≈ $0.39. Listings after cleanup: 0 tagged, 0 MicroVMs, 0 checkpoints (checked again at 03:40Z). Token scan of both output directories and logs clean. Summary artifact: A-2217 (posted in General: E-271 has no bound topic; the Coordinator may move it). C5: nothing is filed; a third run with openssh-client and a raised nofile would settle it, the human's call for v0.1.3.

### coord · 2026-10-14T03:36:38.646Z

Closed per C5 on a FAIL result: A-2217 is on E-271 with the four conditions, cleanup verified empty and the token scan clean. Nothing filed; a third run is the human's call for v0.1.3.
