## Agent skills

### Issue tracker

Issues are tracked as items in cland's own tracker (`.cland/tasks/`, the `cland task` CLI, run as `node hub/bin/cland.ts task …`); GitHub Issues for `Kealman/cland-v0` remain the human-facing mirror until slice 1 is done. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- cland:begin managed by cland 0.1.0 — cland init and cland update rewrite this block; write your own instructions outside it -->
## cland

This project's agent sessions run under cland: a hub connects every session, and the human follows and steers them from the cland workbench.

- **Obey hub events.** When cland launched your session, the hub sends you two kinds of messages, each wrapped as `<channel source="cland" …>…</channel>`. A role clause says which role you hold and what it owns: follow it until a newer clause replaces it. A delivery is a message from the human or another session: answer it with cland's `send` tool, not only in your reply text.
- **Tasks go through `cland task`**, as `docs/agents/issue-tracker.md` describes. Items live in `.cland/tasks/`; never write item files by hand.
- **Artifacts go through the hub** once it has artifact tools (cland slice 2). Until then, name the files you produce in a task comment or a message.
- **Sub-agents never use the hub.** The cland tools belong to your session. A sub-agent you start reports back to you and does not call cland's tools through your session's connection.
- **Push to GitHub only on the Coordinator's explicit decision.** Commit on your own branch. Do not push, open pull requests or merge into the default branch unless the Coordinator decided so for this change.
<!-- cland:end -->
