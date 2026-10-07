# Roles are hub-held state delivered as events

A role (Coordinator, Implementer, Reviewer, QA) is assigned to a session by the human and can move to another session mid-project, independently of harness and model. Everything role-bound lives in the hub: the role clause, the skill list, the hub permissions, the launch defaults, the handover note, and the role-addressed state (topics waiting for the role, open asks, task claims). The hub delivers the clause as an event on assignment and on every reconnect; harness-native instruction files carry only the generic "you are a cland session" part; a session transcript never moves with a role.

## Considered options

- **Role clause through harness-native instructions** (`-c developer_instructions`, a role-specific `AGENTS.md` or `CLAUDE.md`): rejected. Each harness reads instruction files differently, Codex's `-c` overrides drop its TUI into embedded mode with no external surface, and a file per role does not follow a role that moves.
- **Handing over the previous session's transcript**: rejected. Transcripts are harness-specific and large; the next holder needs the role's state, not the old session's memory.

## Consequences

- A session must receive and act on hub events at any time; the adapter contract and the hub must guarantee delivery on reconnect.
- Handing a role over is a hub operation. The handover note is mandatory when the holder hands over and optional when the human reassigns.
