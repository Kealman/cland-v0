# cland

A terminal IDE for running and coordinating AI coding-agent harnesses. It is a single-user tool, one instance per project: one person drives many agent sessions from one place.

## Sessions and roles

**Harness**:
An external agent CLI program that cland runs and integrates, such as Claude Code, Codex, or OpenCode.
_Avoid_: agent tool, CLI agent, provider

**Session**:
One running interactive instance of a harness, with its own history and working state. A session has a name and at most one role.
_Avoid_: agent, process, terminal, instance

**Role**:
A function a session performs in the project's process. A role is assigned to a session and can move to another session mid-project; it does not depend on the harness or the model.
_Avoid_: persona, agent type, mode, seat

**Coordinator**:
The role that drives the work: it plans, decides, hands tasks to other sessions and to its own sub-agents, and is the only role that asks the human. Exactly one session holds it, or none.
_Avoid_: orchestrator, main agent, lead, driver

**Implementer**:
The role that carries out a unit of work and reports to the Coordinator.
_Avoid_: worker, developer, coder

**Reviewer**:
The role that reviews changes and returns a verdict to the Coordinator.
_Avoid_: code reviewer, judge

**QA**:
The role that exercises the running product and returns a verdict to the Coordinator.
_Avoid_: tester, verifier

**Role clause**:
The instruction text a role carries; the hub delivers it to the session that holds the role.
_Avoid_: system prompt, role prompt, persona text

**Handover note**:
The structured note that moves with a role to its next holder: goals now, work in flight, open decisions, what is waited on.
_Avoid_: summary, context dump, transcript

## Hub

**Hub**:
The per-project service through which sessions talk to each other and to the human; it holds the shared state and enforces the roles' permissions.
_Avoid_: bus, broker, server, bridge, daemon

**Spoke**:
The small MCP server that runs inside a session and holds that session's connection to the hub; the hub knows a session by its spoke.
_Avoid_: client, connector, plugin, channel

**Adapter**:
The hub-side component for one harness that launches, supervises and observes its sessions, delivers hub messages into them, and reports their state.
_Avoid_: driver, integration, supervisor, wrapper

## Chat

**Topic**:
A thread in the human's chat with agents. A topic has a title, a status (open, waiting for human, waiting for agent, closed) and at most one binding to a unit of work; messages in it address the Coordinator unless a role or a session is mentioned.
_Avoid_: thread, channel, conversation, chat

**General**:
The standing topic every project has for free conversation with the Coordinator; it is bound to no unit of work.
_Avoid_: lobby, main chat, default channel

**Agents topic**:
The standing, read-only topic that records agent-to-agent messages and the lifecycle events of sessions and roles.
_Avoid_: log, console, drivers channel, mirror

**Ask**:
A question the Coordinator puts to the human inside a topic, with options and room for a free answer. An open ask keeps its topic waiting for the human.
_Avoid_: prompt, poll, question dialog, request

## Work

**Item**:
An entry in the project's tracker: an epic, a spec, a task, a question or a map. An item has a stable id, a state, labels, an assignee, a parent and blocking edges, and lives as one Markdown file.
_Avoid_: ticket, issue, card, story

**Unit of work**:
A task or an epic: the kinds of item a topic can bind to.
_Avoid_: work item, job, assignment

**Claim**:
A session's live hold on an item while it works on it, kept by the hub; distinct from the item's assignee, its long-term owner.
_Avoid_: lock, checkout, assignment

**Verdict**:
A structured comment on an item that records the result of a review or a QA run: clear or not clear, by which session and role, from which run.
_Avoid_: review result, report, approval

**Territory**:
The local bare git repository that is the project's `origin`: where agents branch, push, get reviewed and merge, out of sight of GitHub.
_Avoid_: forge, local remote, agents' repo, mirror

**Task branch**:
The branch `t/<id>-<slug>` where one item's work happens, from `dev`, in its own worktree.
_Avoid_: feature branch, PR branch, topic branch

**Release**:
A versioned set of epics planned and shipped together: an item of kind release whose children are its contents. Releasing it is the act of moving `main` to the work, tagging it with the release's version and pushing to GitHub.
_Avoid_: deploy, publish, sync, push, milestone, iteration

**Unscheduled**:
An item that belongs to no release: it has no parent, or its parents reach no release. The items panel shows these as their own group under the current release.
_Avoid_: backlog (that is a status), orphan, loose

**Artifact**:
A file made by the human or an agent to show or hand something to the other side: a prompt draft, a diagram, an HTML page, a Markdown note. An artifact has an id, a kind, a status (draft, sent, shared, archived) and may bind to a topic; it is not committed unless promoted into the repo.
_Avoid_: scratch file, attachment, tmp file, output
