---
id: T-84
kind: question
title: "Hierarchical multi-agent orchestration: prior art and failure modes"
state: closed
labels:
  - wayfinder:research
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:38.764Z
updated: 2026-10-09T19:56:58.833Z
---

## Question

How do existing systems model a multi-level hierarchy of agents, how do work and results flow up and down it, how is escalation to the human done, what are the levels and roles called, which failure modes are documented, and which three candidate shapes would fit cland?

## Context

Systems to cover: MetaGPT, CrewAI's hierarchical process, AutoGen/AG2 group and nested chats, LangGraph supervisor and hierarchical teams, the OpenAI Agents SDK handoffs, the Claude Agent SDK and Claude Code subagents and teams, plus organisational research on span of control and reporting lines (the human's analogy: strategic command, regional commanders, task leads, reporting upward). The human wants a hierarchy that grows with the project and is configured, not hard-coded, and rejects taking military terms literally.

## Deliverable

`docs/research/hierarchy-prior-art.md` on branch `research/hierarchy-prior-art`: the patterns with their names, how each routes reports, questions and escalation, the documented failure modes (overloaded supervisors, context lost across levels, duplicated work, runaway cost) and their mitigations; then three candidate shapes for cland (flat as today, two-level, N-level configurable), each with the vocabulary it would need and its trade-offs. The ticket "Session hierarchy: levels, reporting, routing and names" starts from it.

## Comments

### human · 2026-10-09T19:56:54.726Z

Resolution: research on branch research/hierarchy-prior-art, file docs/research/hierarchy-prior-art.md (commit 9f0096574a0488dbbb50e78485aa2630d694d73a).

- **Every framework is a tree with one top, and most stop at one supervising level by design.** The top (manager, supervisor, orchestrator, lead) takes the human's request, delegates by a tool call or a handoff, and gets one result back. Depth comes from nesting the same unit: LangGraph's supervisor of supervisors, AutoGen teams inside teams, Claude Code subagents three layers deep by default, AG2 a delegation depth of five. Claude Code agent teams forbid nesting: "teammates cannot spawn their own teammates".
- **Results come up summarised, and each system that summarises documents the loss.** MetaGPT cites the telephone game; LangChain's supervisor paraphrased its sub-agents incorrectly until verbatim forwarding and two other changes gave "a nearly 50% increase in performance"; Anthropic writes subagent output to files "to minimize the 'game of telephone'". The mitigations converge: structured artifacts instead of chat, verbatim forwarding, and complete briefs, because the delegate "know[s] nothing about the task" (CrewAI).
- **A question for the human goes to the top, and the stronger designs make that structural.** OpenAI Agents SDK approvals raised at any depth surface "on the outer run"; LangGraph interrupts surface to the top-level caller; Claude Code withholds `AskUserQuestion` from every subagent and shows teammates' permission prompts in the lead's session; in AG2's escalation pattern the top tier has no escalate tool. AutoGen warns that a human proxy inside a running team leaves it "in an unstable state that cannot be saved or resumed".
- **Overloaded supervisors are documented, and the remedies match the organisational literature.** LangGraph's supervisor "might start making poor decisions" as agents are added; Claude Code advises 3 to 5 teammates; Anthropic's lead blocks on its slowest subagent. The remedies: a smaller span (Graicunas and Urwick: five or six subordinates whose work interlocks; NIMS: 1:5 as a guideline), a new level when a span overflows (LangGraph hierarchical teams, NIMS divisions and groups), or less sent upward (Galbraith: exceptions overload a hierarchy, and self-contained tasks and lateral relations unload it; Fayol's "gang plank" lets peers settle a matter and inform their superiors).
- **Simon's dilemma is the trade-off between the three shapes.** A narrow span forces more levels, and every contact "must be carried upward until a common superior is found" and back down; a wide span weakens control. No source derives an optimum; NIMS calls its 1:5 a guideline.
- **Runaway cost and loops are capped in code everywhere.** Turns (OpenAI 10, Magentic-One 20, AG2 Classic 10 rounds), stalls (Magentic-One re-plans after 3), steps (LangGraph's recursion limit: 25 at 0.6.0, 10007 at 1.2.14), depth (Claude Code 3, AG2 5), concurrency (Claude Code 20), money (MetaGPT's $10 default budget, the Claude Agent SDK's `maxBudgetUsd`, AutoGen's `TokenUsageTermination`). Anthropic measured multi-agent runs at about 15 times the tokens of chat, with early lead agents "spawning 50 subagents for simple queries".
- **Duplicated and conflicting work is documented, with concrete mitigations.** Parallel subagents "performed the exact same searches" (Anthropic), built inconsistent parts (Cognition), overwrote each other's files while the lead did teammates' tasks (Claude Code), or delegated "back and forth indefinitely" (CrewAI); step repetition is the most frequent failure mode in the MAST corpus (15.7% of 1642 traces). Mitigations: an objective, output format and boundaries per delegate; claim-based task lists with locking; file ownership; no re-delegation by specialists.
- **Prior-art names mostly collide with cland's GLOSSARY.** The top is a manager, supervisor, orchestrator or lead; the leaves are workers, specialists, teammates or subagents. Orchestrator, main agent and lead are on the Coordinator's avoid list, worker on the Implementer's, supervisor on the Adapter's, agent on the Session's, report on the Verdict's, and T-90 already uses "crew". NIMS names levels by what they own: a Division is an area, a Group a function.
- **The three shapes trade the same costs.** Flat keeps one relay but makes the Coordinator's span the whole crew. Two-level caps the top's span and stops a chain's traffic at its middle node, at the price of one more relay, a parent link, a new role name, and Reviewer and QA sessions duplicated per chain or shared across chains. N-level configurable grows with the project and keeps every span small, but compounds relay loss per level and needs hub-enforced caps on depth, span and spend, because trees of agents grow on their own.

Open points for the ticket this research feeds: T-89 decides whether a middle node owns an output (an epic) or an area, what reaches the top (exceptions only, or digests), whether asks escalate level by level or go straight to the Coordinator, which caps (depth, span, concurrency, spend) the hub enforces, and names that avoid the GLOSSARY collisions listed in section 5 of the doc.

### human · 2026-10-09T19:56:58.833Z

Resolved: see the resolution comment
