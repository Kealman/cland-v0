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
The role that leads the root of the item tree: it plans, decides, launches Leads and sessions, merges what no Lead owns, releases, and is the only role that asks the human. Exactly one session holds it, or none.
_Avoid_: orchestrator, main agent, driver, manager

**Implementer**:
The role that carries out a unit of work and reports to the Coordinator.
_Avoid_: worker, developer, coder

**Reviewer**:
The role that reviews changes and returns a verdict to the Coordinator.
_Avoid_: code reviewer, judge

**QA**:
The role that exercises the running product and returns a verdict to the Coordinator.
_Avoid_: tester, verifier

**Aide**:
A session that works for the human alone: it holds no crew duty, is addressed by name only, and speaks for the human, decisions included. It can create and change items and artifacts and message any session, but never launches sessions, merges, hands over or asks.
_Avoid_: assistant, helper, personal session, scratch session, human session

**Lead**:
The session that owns a node of the item tree and receives its reports: the Coordinator for the root, a session of the role Lead for an epic or a release, the Implementer for the item it claims. One lead per node, or none.
_Avoid_: manager, supervisor, commander, owner, parent

**Crew**:
The project's staffing policy: which roles run as one session per item, as a pool or as a singleton, how long they keep context, and which levels of the item tree get dedicated Leads. A file the Coordinator edits after talking to the human.
_Avoid_: team (the harnesses use it for in-harness agents), staff, fleet, org chart

**Pool**:
A set of reusable sessions of one role, capped in size, from which a lead takes an idle member instead of launching a new session.
_Avoid_: queue, farm, cluster

**Event**:
A change the hub announces: a session's state, a task's status, claim, verdict or criterion, a topic's wait, a usage threshold, an artifact. Delivered to subscribed sessions like a message, digested at the next turn by default.
_Avoid_: notification (that is the human's inbox), signal, hook, trigger

**Subscription**:
A session's standing request to receive certain events about a subject: a session, an item, a topic, a role or a node of the item tree. A lead holds one for its subtree by default.
_Avoid_: watch, monitor, listener, poll

**Plan**:
How an epic will be worked: its stages, the lanes in each, and the QA policy per stage. Written by the Coordinator or the epic's Lead before the epic starts, kept in the epic's file, read by the merge gate.
_Avoid_: roadmap, schedule, breakdown, sprint plan

**Stage**:
One step of a plan: the lanes worked in parallel and the QA policy that closes the step. Stages run in order.
_Avoid_: phase, milestone, sprint, iteration

**Lane**:
An ordered list of items in a stage that one session takes in turn, or one session per item. The crew policy per-group means one session per lane.
_Avoid_: group, batch, track, stream

**Palette**:
The one floating search over everything in cland: items, sessions, topics, artifacts and every action, each action with its key. A prefix narrows it to one kind.
_Avoid_: picker, finder, command bar, spotlight, launcher

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
An entry in the project's tracker: a release, an epic, a spec, a task, a question or a map. An item has a stable id, a state, labels, an assignee, a parent and blocking edges, and lives as one Markdown file; a task also has a status and a rank.
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

**Criterion**:
One acceptance condition of a task, with a stable id and marks: done by the implementer, verified by a reviewer or QA, or failed by a verifier. A task merges only when every criterion is done and verified.
_Avoid_: checkbox, requirement, check, test case

**Layer**:
How much attention a thing asks of the human: now, watch, background or archive. Every message, event, session, item and artifact sits in one by default; the human may pin or mute it.
_Avoid_: priority, level (that is the item hierarchy), importance, tier

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

**Status**:
Where a task is in its workflow: backlog, planned, in progress, review, qa, ready or done. The hub moves it on claims, verdicts, merges and closes; the Coordinator and the human may set it directly. Containers, questions and specs have none.
_Avoid_: state (that is open or closed), stage (that is a step of a plan), column, phase

**Rank**:
A task's or epic's place among its siblings. The lowest rank is next; moving an item to the top is how it is made a priority.
_Avoid_: priority, order, weight, position

**Artifact**:
A file, or a folder with an entry file, that a session or the human shows to others: it has an id `A-<n>`, a kind, a status and an author. The human's and an Aide's artifacts live until deleted by hand; an agent's lives with its topic unless kept or promoted into the repository.
_Avoid_: attachment, upload, document, file (that is a kind), output
