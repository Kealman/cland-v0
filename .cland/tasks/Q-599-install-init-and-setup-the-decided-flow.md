---
id: Q-599
kind: question
title: "Init and setup: the decided flow"
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: M-591
blocked_by:
  - Q-592
  - Q-593
  - Q-594
  - Q-597
topic: null
branch: null
created: 2026-10-16T11:26:11.880Z
updated: 2026-10-16T13:02:58.124Z
---

## Question

Init and setup as the decided flow, on the harness research, the prior-art research and the setup prototype: `cland init` on an empty folder and on a project whose default branch is not main; the setup steps in order, the accounts registration, doctor's strictness; the Aide in the terminal and the answer to the trust prompts (T-603); what `cland` prints in a folder without `.cland/`; the package version at release. The install command on a fresh machine is deferred (the human, 2026-10-16): 0.1.4 assumes cland installed from the checkout on the human's machine; Q-592's findings stand for later.

## Comments

### human · 2026-10-16T13:02:58.124Z

Open questions raised by the setup prototype (Q-597, prototype/setup at 187123a1), to be decided here with the human after the live try:

1. A repository with no commit keeps init's old path (no first commit) because the existing init tests define it: should it get the first commit too, like an empty folder?
2. A non-empty folder without Git gets no repository: does init create one and commit the human's files, or refuse with a line?
3. Trust goes to the favourite harness only, so a Codex favourite leaves a Claude Code Coordinator untrusted: grant trust for every installed harness?
4. Setup grants trust without asking, as decided: keep, or ask once as the harness's own dialog does?
5. A declined install is offered again on every run: remember the refusal (in config.toml?) or keep re-offering?
6. The accounts question writes the machine-wide registry (`~/.config/cland/accounts.toml`, read by every project's hub): default to No?
7. In Claude Code's attach, Ctrl+Z suspends setup together with the attach: acceptable?
8. Init's first commit uses Git's identity; a machine without user.name/email (a droplet) fails: init commits with a fallback identity (`cland <cland@local>`) when none is set?
9. Codex 0.163.0 is outside doctor's tested range and setup only repeats the warning: offer the pinned install (`--release 0.160.0`) as a step?
Also from the build: a path-less Claude Code account selects no CLAUDE_CONFIG_DIR unless the hub has one (fixed in the prototype beside T-603); real installers, logins, attach and hub start were not exercised (fakes and a stand-in hub); Codex's config/batchWrite and account/read answered only by the fake.
