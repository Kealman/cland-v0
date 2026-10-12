---
id: T-257
kind: task
title: "Stopped sessions: resume the same session, archive one from the panel, and a cleanup rule so stopped sessions do not pile up"
state: open
status: backlog
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T08:33:25.047Z
updated: 2026-10-12T08:33:25.047Z
---

Observation from the human (2026-10-12, after v0.1.1), relayed by the cland-design session.

In the sessions panel a stopped Aide (aide-1, "Claude Code · claude-opus-5-5 · unknown · died") sits in its own STOPPED group inside NOW, because an Aide is the human's own session. The human finds that fine in itself but misses three things:

- Resume: a way to start the same session again, with its context (the harness's own resume, for Claude Code `--resume <id>`), not only to launch a new Aide.
- Archive: a way to remove it from the list. Today `A` only shows or hides the ARCHIVE section (it appeared with 0 and nothing moved); no action archives a session.
- Cleanup: a rule that keeps stopped sessions from piling up forever ("more (206)" in the background layer): automatic archival after a time or once the session's item merged, a cap on the background group, or a `cland session prune`; the journal keeps the history, the panel forgets.

Facts in the build: the panel groups sessions by layer (now, watch, background, archive) with `A` toggling the archive section and `za` folding the background "more" fold; the hub resumes its adapters at daemon start but offers the human no resume of a stopped session; no retention rule exists for stopped sessions.

Relates to spec §3.3 (Aide), §3.5 (layers, pins and archive), §3.11 (the sessions panel), and epic T-229 (session lifecycle, v0.1.1). To grill with the human in v0.1.2, together with T-239 and T-247.
