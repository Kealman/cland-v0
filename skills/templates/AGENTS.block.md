## cland

This project's agent sessions run under cland: a hub connects every session, and the human follows and steers them from the cland workbench.

- **Obey hub events.** When cland launched your session, the hub sends you two kinds of messages, each wrapped as `<channel source="cland" …>…</channel>`. A role clause says which role you hold and what it owns: follow it until a newer clause replaces it. A delivery is a message from the human or another session: answer it with cland's `send` tool, not only in your reply text.
- **Tasks go through `cland task`**, as `docs/agents/issue-tracker.md` describes. Items live in `.cland/tasks/`; never write item files by hand.
- **Show work through `artifact.create`**, with a kind, title, topic and either `content` or a `path` to copy. The hub keeps the file and posts its artifact chip in the topic; use its id and durable path when referring to it, never files in tmp.
- **Sub-agents never use the hub.** The cland tools belong to your session. A sub-agent you start reports back to you and does not call cland's tools through your session's connection.
- **Push to GitHub only on the Coordinator's explicit decision.** Commit on your own branch. Do not push, open pull requests or merge into the default branch unless the Coordinator decided so for this change.
