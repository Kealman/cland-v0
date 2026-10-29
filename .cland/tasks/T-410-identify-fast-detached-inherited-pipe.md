---
id: T-410
kind: task
title: Identify fast detached inherited-pipe writers after a stalled run so the hub can reap them
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:09:09.281Z
updated: 2026-10-29T15:59:44.158Z
---

## Summary

T-385 ends a stalled verify run even when one detached child is left that can't be verified. It writes to the run's inherited stdio but was reparented before any ownership snapshot. The run reports "cleanup incomplete" and warns the human, and the queue moves on. Safely identifying such a writer after its ancestry is lost would let the hub reap it instead of only warning.

## Evidence (impl-385, 2026-10-14)

- macOS Node stdio uses Unix sockets. Structured `lsof` output reports peer-like addresses with no usable inode or own-endpoint field.
- Getting the stream file descriptors directly needs Node's private handles.
- An exact kernel endpoint mapping needs platform-specific inspection and validation, macOS and Linux each.

## Acceptance criteria

- [ ] C1. On macOS and Linux, the hub identifies the processes holding the write end of a run's stdio pipe or socket after their parent exits, with a documented method and its failure modes.
- [ ] C2. The stall path reaps identified writers. Unidentifiable ones stay reported as now, and unrelated processes are never touched.
- [ ] C3. A regression spawns a fast detached writer that inherits the pipe and proves it is reaped on both platforms. The Linux run happens on a droplet.
