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

## Chat

**Hub**:
The service through which sessions talk to each other and to the human; the heart of agent-agent and agent-human collaboration.
_Avoid_: bus, broker, server, bridge

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

**Unit of work**:
A task or an epic in the tracker that a topic may bind to. Which entities exist is decided with the tracker.
_Avoid_: ticket, issue, item, story

**Artifact**:
A file made by the human or an agent to show or hand something to the other side: a prompt draft, a diagram, an HTML page, a Markdown note.
_Avoid_: scratch file, attachment, tmp file, output
