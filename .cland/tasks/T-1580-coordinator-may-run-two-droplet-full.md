---
id: T-1580
kind: task
title: Coordinator may run two droplet full suites at once (verification.coordinator_suites)
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-01T09:02:54.695Z
updated: 2026-11-01T09:02:54.695Z
---

## Summary

The hub admits one active suite per session (`hub/src/hub/suites.ts` `#existingSubmission`: "this session already has a suite queued or running"). So the Coordinator's full suites (stage covers, T4-needing items, integrated covers) run one at a time, about 40 min each, even when droplet slots and the daily cap have room. On 2026-11-01 at 09:01Z the human chose to allow two at once, as option 3 of ask 31d43750. The merge batches with T1–T3 (config e818d2dc) are the other half of that decision.

Hot files: `hub/src/hub/suites.ts`, `hub/src/init/config.ts`, `docs/agents/tests.md`.

## Acceptance criteria

- [ ] C1. A `[verification] coordinator_suites` setting (default 1) lets the Coordinator session hold up to that many active droplet suites with different submission keys at once; this project sets it to 2 (test).
- [ ] C2. A second active local suite for the same session is still refused with today's text, so the local machine never runs two Coordinator suites (test).
- [ ] C3. A submission whose key matches an active suite still joins it, and a submission over the cap is refused with today's text naming the cap (test).
- [ ] C4. Remote slots, the shard count, the remote budget and the daily spend cap still bound admission. A suite admitted under the cap but without a free slot queues, exactly as today (test).
- [ ] C5. Other roles keep one active suite per session, and the existing suite-admission test files pass with no test edited.
- [ ] C6. `docs/agents/tests.md` and `cland config` help describe the setting. Rule 19 applies: the project setting is committed only after the hub runs this code.
