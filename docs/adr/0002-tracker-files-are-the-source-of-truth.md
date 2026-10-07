# Task tracker: Markdown files are the source of truth, the hub keeps the index

cland needs a task tracker with more than GitHub Issues offer (claims by sessions, links to topics and branches, verdict records, cost per item) and under full control, while humans still collaborate through GitHub. We keep the tracker as one Markdown file per item with YAML frontmatter, committed in the project repo, written through the hub (which serializes writes and keeps a SQLite index for queries) and editable by hand. Live state, such as claims and session status, stays in the hub store, not in files. Nothing commits automatically: the Coordinator or the human commits tracker changes together with the work.

## Considered options

- **GitHub Issues as the source of truth**: rejected. A personal account has no server-side gating (no merge queue, no required approvals on private repos), content creation is rate-limited, an author cannot approve its own pull request, and agent traffic would flood the space meant for humans. A sync to GitHub stays possible later because item ids are stable.
- **SQLite as the source of truth**: rejected. Unreadable to humans and agents without tooling, does not merge, invisible in git history.

## Consequences

- The Matt Pocock skills target the tracker through its CLI, described in `docs/agents/issue-tracker.md` as an "other" tracker.
- Concurrent hand edits and hub writes resolve as last writer wins; the hub re-indexes on file change.
