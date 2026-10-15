# cland

A terminal IDE for running and coordinating AI coding-agent harnesses. It is a single-user tool, one instance per project: one person drives many agent sessions from one place.

## Sessions and roles

**Harness**:
An external agent CLI program that cland runs and integrates, such as Claude Code, Codex, or OpenCode.
_Avoid_: agent tool, CLI agent, provider

**Account**:
A harness login a session runs under, named in the user-level registry by its directory (or database path), never by a secret.
_Avoid_: credential, token, profile

**Limited account**:
An account marked after a limit-hit signal, refusing new launches until its reset or `cland account clear`.
_Avoid_: throttled account, signed-out account, exhausted session

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
_Avoid_: notification (that is the events view, not the inbox), signal, hook, trigger

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
A decision question sent up the lead chain in a topic: each lead answers locally or forwards it unchanged one level, and only the Coordinator asks the human. An open ask keeps its topic waiting for its current receiving party.
_Avoid_: prompt, poll, question dialog, request

**Request**:
A message to the human that asks for an act of theirs: a review, a QA run or a handover. It waits in the inbox until the human answers, gives the verdict or declines it.
_Avoid_: ask (that is a question or an approval), ping, mention

## Work

**Item**:
An entry in the project's tracker: a release, an epic, a spec, a task, a question or a map. An item has a stable id, a state, labels, an assignee, a parent and blocking edges, and lives as one Markdown file; a task also has a status and a rank.
_Avoid_: ticket, issue, card, story

**Unit of work**:
A task or an epic: the kinds of item a topic can bind to.
_Avoid_: work item, job, assignment

**Claim**:
A session's live hold on an item while it works on it, kept by the hub; distinct from the item's assignee, its long-term owner. A Reviewer or QA holds an item for verification beside the Implementer's claim, tagged with the role; that hold is not a claim.
_Avoid_: lock, checkout, assignment

**Verdict**:
A structured comment on an item that records the result of a review or a QA run: clear or not clear, by which session and role, from which run and, for a review, its scope.
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
An item with no container at all: no parent. The explorer and the items panel show these as their own root; an item in a category is not unscheduled.
_Avoid_: backlog (that is a status), orphan, loose

**Category**:
A root-level container for items that belong to no release or epic: Tech debt, Bugs, Follow-ups, Ideas and others the human adds. Items gather there from the agents' work until the human or the Coordinator promotes them into a release or an epic.
_Avoid_: label, bucket, backlog (that is a status), unscheduled (no container at all)

**Status**:
Where a task is in its workflow: backlog, planned, in progress, review, qa, ready or done. The hub moves it on claims, verdicts, merges and closes, and on an epic plan's current stage; the Coordinator and the human may set it directly. Containers, questions and specs have none.
_Avoid_: state (that is open or closed), stage (that is a step of a plan), column, phase

**Size**:
An ex-ante class of a task (XS, S, M, L or XL), set by whoever files it.
_Avoid_: estimate, points

**Rank**:
A task's or epic's place among its siblings. The lowest rank is next; moving an item to the top is how it is made a priority.
_Avoid_: priority, order, weight, position

**Artifact**:
A file, or a folder with an entry file, that a session or the human shows to others: it has an id `A-<n>`, a kind, a status and an author. The human's and an Aide's artifacts live until deleted by hand; an agent's lives with its topic unless kept or promoted into the repository.
_Avoid_: attachment, upload, document, file (that is a kind), output

**Explorer**:
The centre view of the item tree: a release, its epics and their tasks, with the categories and the unscheduled items as further roots; it folds in place, scopes to a node and shows the Card of the row under the cursor. It changes nothing by hand: the human steers through a message to the Coordinator.
_Avoid_: tree view, browser, board (the side panel), item view (now the Card)

**Card**:
The human's picture of one item in the Explorer: the Summary, the facts, the progress, the latest verdict and the relations, with the agents' text folded away.
_Avoid_: item view, details pane, preview

**Summary**:
One to three sentences in an item that say what it is about, written by whoever creates the item; the first paragraph of the first section that is not Parent stands in when it is missing.
_Avoid_: description (that is the whole body), abstract, goal (an epic's section)

**Events view**:
The list of notifications and events the inbox no longer shows, newest first and capped: where the human looks when something happened, not when something needs them.
_Avoid_: log (the Agents topic is the sessions' output), notifications panel

**Web workbench**:
The browser client of the hub: everything the Neovim workbench shows and does, in a page the hub serves on the human's machine or network. One of two clients of one protocol; Neovim is the other.
_Avoid_: web app, dashboard, portal, the site

**Rail**:
The web workbench's persistent left column of areas (Inbox, Items, Sessions, Topics, Events, Artifacts, Accounts); it collapses to icons. Board, Graph and Plan are views inside the Items area, not areas.
_Avoid_: sidebar (that is the Neovim panel), menu, tabs

**Drawer**:
The web workbench's right-hand pane that shows the card of the selected item or the thread of the selected session, topic or inbox row; closed when nothing is selected or while the main area is split.
_Avoid_: panel, modal, popup, inspector

**Snapshot**:
What the hub sends a client at connection: the state of items, sessions, topics, the inbox, the first page of events and the accounts, stamped with an epoch and a sequence number, from which deltas continue.
_Avoid_: dump, initial load, sync

**Delta**:
One pushed change from the hub after the snapshot, numbered in sequence within the epoch so that a client that reconnects can resume from the last number it saw.
_Avoid_: event (that is what the hub announces; a delta is how a client learns of it), patch, diff

**Rulebook**:
The project's own rules for how its work is done, kept with the project and fed into every role's clause and brief; rules are added as the work goes, by the human or by the Coordinator when the human states one.
_Avoid_: memory (a session's private notes), guidelines, AGENTS.md (the static instructions)

**Rule**:
One entry of the Rulebook: a number ("rule 12", never a letter prefix, which items use), a scope of roles, the date, the reason and a status; active until retired.
_Avoid_: policy (that is the launch policy of a role), preference, tip

**Heartbeat**:
A delivery the hub sends a session at a set interval with a digest of what is in flight and what looks stale, so that a Coordinator wakes and checks when no event comes; never a needs-you.
_Avoid_: cron, poll, ping (that is the connection's keepalive), timer

**Follows**:
The relation that orders epics within a lane: it is met when the predecessor closes, or has task children all closed with its last ticket merged. Until the predecessor’s demo verdict or closure, a merge hold keeps the following epic’s tickets off files changed by the predecessor’s merges; dependencies remain blocked by.
_Avoid_: blocked by, after, depends on

**Executor**:
Where a verification run executes, behind one interface. The queue, the cache and the report are the same on every executor; a remote machine is held through a [Lease](#lease).

<a id="lease"></a>
**Lease**:
The hub's durable record of one remote machine, written before its creation and held until its deletion is confirmed.
