# cland

A terminal IDE for running and coordinating AI coding-agent harnesses. It is a single-user tool, one instance per project: one person drives many agent sessions from one place.

## Language

**Harness**:
An external agent CLI program that cland runs and integrates, such as Claude Code, Codex, or OpenCode.
_Avoid_: agent tool, CLI agent, provider

**Session**:
One running interactive instance of a harness, with its own history and working state.
_Avoid_: agent, process, terminal, instance

**Role**:
A function a session performs in the project's process, such as Coordinator, Reviewer, or QA. A role is assigned to a session and can move to another session mid-project; it does not depend on the harness or the model.
_Avoid_: persona, agent type, mode

**Coordinator**:
The role that drives the work: it plans, decides, and hands tasks to other sessions and to its own sub-agents.
_Avoid_: orchestrator, main agent, lead

**Hub**:
The service through which sessions talk to each other and to the human; the heart of agent-agent and agent-human collaboration.
_Avoid_: bus, broker, server, bridge

**Topic**:
A thread in the human's chat with agents. A topic has a status and may be bound to a unit of work such as a task or an epic.
_Avoid_: thread, channel, conversation, chat

**Artifact**:
A file made by the human or an agent to show or hand something to the other side: a prompt draft, a diagram, an HTML page, a Markdown note.
_Avoid_: scratch file, attachment, tmp file, output
