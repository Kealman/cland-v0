## Agent skills

### Issue tracker

Issues are tracked as items in cland's own tracker (`.cland/tasks/`, the `cland task` CLI, run as `node hub/bin/cland.ts task …`). The tracker is the only source of truth: the GitHub Issues mirror for `Kealman/cland-v0` was retired on 2026-10-09, after the v0.0.1 release. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## web/

Use CSS Modules and `var(--token)` from `web/src/tokens.css` for styling; colour values live only in that file. Copy `web/src/Shell.tsx` and `Shell.module.css` for component structure. Keep secondary text at 4.5:1 on ground and selection; the typecheck checks colours and contrast.

No UI library or Tailwind, and no new dependency without the human's approval. Show names, counts and facts in the interface; put explanations in tooltips, help and docs. Route keyboard bindings through the single physical-code key map (the shell-key slice adds it); never add a component-local key listener.

<!-- cland:begin managed by cland 0.1.0 — cland init and cland update rewrite this block; write your own instructions outside it -->
## cland

This project's agent sessions run under cland: a hub connects every session, and the human follows and steers them from the cland workbench.

- **Obey hub events.** When cland launched your session, the hub sends you two kinds of messages, each wrapped as `<channel source="cland" …>…</channel>`. A role clause says which role you hold and what it owns: follow it until a newer clause replaces it. A delivery is a message from the human or another session: answer it with cland's `send` tool, not only in your reply text.
- **Tasks go through `cland task`**, as `docs/agents/issue-tracker.md` describes. Items live in `.cland/tasks/`; never write item files by hand.
- **Show work through `artifact.create`**, with a kind, title, topic and either `content` or a `path` to copy. The hub keeps the file and posts its artifact chip in the topic; use its id and durable path when referring to it, never files in tmp.
- **Sub-agents never use the hub.** The cland tools belong to your session. A sub-agent you start reports back to you and does not call cland's tools through your session's connection.
- **Only cland release pushes to GitHub:** only `cland release` pushes to `github`. Commit on your task branch; push it to the local territory (`origin`). Task work reaches `dev` through `cland merge`. The Coordinator commits tracker and docs work on the root’s `dev` and publishes it with `cland push` from its own shell (the human may also run it). `main` moves through `cland release` and `cland sync`.
<!-- cland:end -->
