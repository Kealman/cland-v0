---
id: T-865
kind: task
title: cland hub start kills a hub whose startup ready check stalls tracker storage past the 15 s probe deadline
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-19T10:23:43.735Z
updated: 2026-10-19T10:23:43.735Z
---

## Summary

During restart #18 (2026-10-19 10:19–10:21Z) `cland hub start` SIGKILLed two fresh hubs (pid 2351 at 10:19, pid 17448 at 10:20). Each logged "serving" after about 12 s. Its startup ready check then stalled tracker storage for about 7 s (`tracker-storage-stalled` on T-837, then T-848, thresholdMs 5000). The CLI's 15 s probe got no answer, and hub/src/cli/hub.ts (~141) killed the child. A second `cland hub start` failed the same way. The stand-in started the hub directly with `hub serve --starter` to get past the deadline.

## Notes

- After this start the stored suite-jobs blob is 221 KB (2 bytes after restart #17); relevant to T-813's startup work.
- Earlier class: T-293 and T-813 (hub logs listening but does not serve).

## Acceptance criteria

- [ ] C1. The status probe answers while the startup ready check runs, or the ready check yields so the probe gets a reply within the start deadline. A component test holds the ready check's tracker work and shows `cland hub start` still reports the started hub.
- [ ] C2. When the deadline does pass, the CLI names the step the hub was still in (from its log) before killing it, and the suite-jobs blob size at start is logged.
