---
id: T-295
kind: question
title: "OpenCode's new major version: what changed, what it adds for cland"
state: open
labels:
  - research
  - ready-for-human
assignee: null
parent: T-294
blocked_by: []
topic: null
branch: null
created: 2026-10-12T15:31:51.661Z
updated: 2026-10-12T16:18:56.108Z
---

## Question

The human asked on 2026-10-12: OpenCode has shipped a new major version (https://opencode.ai/v2/docs/migrate-v1/); study what changed and whether it gives cland more to work with. cland's OpenCode adapter (hub/src/adapters/opencode.ts, opencode/client.ts, server.ts, state.ts) was built against opencode v2.0.24, the version installed on this machine, and uses `opencode serve` with the endpoints /session, /session/{id}, /session/{id}/prompt, /session/{id}/message, /session/{id}/model, /session/active, /event, /permission and /config.

To find out, for the research branch `research/opencode-v2`: what the migration guide and the v2 docs say changed from v1 (config, permissions, agents and subagents, commands, plugins and hooks, the server API and the SDK, the event stream, sessions and their children, share, attach and the client-server split, auth and accounts, usage); which of it the adapter already relies on and which parts are deprecated or renamed; the capabilities v2 adds that cland does not use yet and what each would give (per role, per hub feature: launch, brief, role clause, deliveries, asks and approvals, verdicts, sub-agents, resume for stopped sessions per spec v0.1.2 §3.5, accounts per §3.13, limits, the quick message, artifacts); what cland would have to change to use them; and the risks (API stability, version pinning, what the Codex and Claude Code adapters cannot match). Resolved by the research note and a comment here; the human decides what enters v0.1.3.

## Comments

### human · 2026-10-12T16:18:56.108Z

Research done: `docs/research/opencode-v2.md` on branch `research/opencode-v2`, commit 4855adeacd4268075f6da66d4952f5cb7f34fdd1 (pushed to the territory). The probes are in `docs/research/opencode-v2/`. Facts and options only; the decisions stay with the human.

**What "the new major version" is.** v2.0.0 shipped on 2026-09-11, and cland's OpenCode adapter was already built on 2.0.24. The news of 2026-10-11 is v1.19.0 telling v1 users to run `opencode upgrade --major`. `opencode.ai/install` and `opencode.ai/docs` still serve v1. Since 2.0.24, three releases have shipped: 2.0.25, 2.0.26 and 2.0.27 (the last on 2026-10-12).

**Change table, v1 to v2 (brief):**

| Area | v1 | v2 | For an integration |
|---|---|---|---|
| Install | `opencode-ai`, `opencode.ai/install`, GitHub releases | `@opencode/cli`, `opencode.ai/v2/install`; tags only; same `opencode` command | the default installer still gives v1, which cland cannot drive |
| Process model | a server per TUI; `serve` on :4096; `attach`, `web` | one shared background service (:49374) plus `--standalone`/`--server`; `attach` and `web` gone | cland runs its own `serve` per session |
| Server API | root routes: `/session/:id/message`, `prompt_async`, `/event`, `/tui/*`; OpenAPI at `/doc` | a new contract under `/api` (142 operations at 2.0.27): durable inbox `prompt {text, delivery, resume, id}`, `/api/event`; OpenAPI at `/openapi.json`; labeled "Experimental" | v1 clients must be rewritten; the adapter is already v2 |
| Auth | optional `OPENCODE_SERVER_PASSWORD` | always a password, `OPENCODE_PASSWORD` | fits |
| SDK | `@opencode-ai/sdk` (still at 1.19.0) | `@opencode/client` (HTTP), `@opencode/sdk` (in-process), MIT | cland uses plain fetch |
| Events | `session.idle`, `session.status`, `message.*`, `/global/event` | `session.execution.*`, `session.step.*`, `session.inbox.*`, `permission.*`, `form.*`; `session.status` and `session.idle` declared but never published; live-only | state from execution events plus a snapshot (what the adapter does) |
| Sessions | children, share, revert | one SQLite database; host-chosen ids; `parentID` children; fork, move; execution claims swept by the managed service | resume = the same database and id |
| Permissions | effects grouped by tool | an ordered `{action, resource, effect}` list per config, agent and session; no OS sandbox | policy can be set per session |
| Agents and commands | `agent`/`mode`, `prompt`, `variant` | `agents` with `system`, `model#variant`, `permissions`; `subagent: true` commands | effort = a model variant |
| Plugins | `server()` hooks | `Plugin.define` with hooks (`session.hook`, `permission.hook`, `tool.hook`) and plugin RPC over HTTP; v1 plugins do not run | an in-process bridge would be new code |
| TUI | layered `tui.json` | one global `cli.json`; Enter steers, Ctrl+X Enter queues | attach unchanged |
| Instructions, skills | `AGENTS.md`, `CLAUDE.md` fallback | `AGENTS.md` only; per-session instruction entries; `.agents/skills` and `.claude/skills` read | fine for cland's layout |
| MCP | `mcp.<name>` | `mcp.servers.<name>`; Code Mode by default; `_meta` carries the calling session | the spoke is reached through `execute` |
| Share, LSP | public links; built-in LSP | sharing not supported yet; LSP not run | none |
| Accounts, usage | `auth.json` | credentials in the database; `OPENCODE_DB`/`XDG_DATA_HOME`; no plan limits | v0.1.2 §3.13 unchanged |

**What touches the adapter.**
- Nothing it uses is deprecated, renamed or reshaped in 2.0.27. The ten operations it calls changed only additively, and the event schema files it reads are unchanged:
  - `GET`/`POST /api/session`, `/move`, `/prompt`, `/active`, `/permission`, `/form`, `/message/{id}`;
  - `GET /api/model`;
  - `GET /api/event`.
- The ticket's `/config` and `/session/{id}/model` are not called. The other route names in the ticket are v1-style shorthand.
- The whole API is labeled experimental. 2.0.0 to 2.0.10 renamed 129 operation IDs and moved 13 routes under `/api/experimental/`; since 2.0.10, changes are additive.
- Fragile points:
  - the `server listening on <url>` log line;
  - `session.status` exists but is never published;
  - a declined approval is reported as `interrupted {reason: "shutdown"}` (#54180).
- The doctor's range `>=2.0.24 <2.1.0` admits 2.0.25 to 2.0.27, which were never run.

**A present risk (observed, independent of upgrading).** cland's per-session servers share the user's default OpenCode database with the background service. When that service boots, it resumes any session with an unreleased execution claim, including a cland session mid-turn on its own server. Probe P3 observed two processes driving one session. Upstream #51213 is open, and the code is unchanged in 2.0.27. Anything that starts the service triggers it, including an agent running `opencode mcp list`.

**Top five unused capabilities and what they give:**
1. **Session-scoped permission rules, `agent` and `model.variant` at `session.create`.** The roles.toml policy, D8 and `effort` would reach OpenCode sessions; today the adapter drops them. Also `parseModel` mangles `provider/model#variant`.
2. **A host-chosen inbox id on `prompt`.** Admission becomes idempotent: a timed-out inject retried at the next idle can no longer arrive twice. OpenCode-only; the contract does not change.
3. **Durable instruction entries** (`PUT /api/experimental/session/{id}/instructions/entries/{key}`). The role clause as system context that survives compaction and updates in place on handover. Experimental, and moved once. Codex and Claude Code can only set instructions at launch.
4. **Child sessions** (`session.created {parentID}`). Sub-agents' pending approvals, usage and models fold into the parent; this is input for T-270's "sub-agents included".
5. **The approval reply endpoint** (`POST …/permission/{id}/reply`), plus `switchModel`/`switchAgent`. `approvalRelay` and `setModel` become possible; both are contract decisions.

**Recommendation (priority order; the human decides):**
1. v0.1.3: cland's OpenCode servers on a database cland owns (`OPENCODE_DB`), per user or per account through T-272, recorded with the session.
2. v0.1.3: version hygiene: the doctor points 1.x to `upgrade --major` and the v2 installer; re-verify the range to 2.0.27; pin or follow with a per-release wire check.
3. v0.1.3: the launch policy for OpenCode (permission rules, variant, D8, `#variant` parsing); measure `codemode: false` for the spoke.
4. v0.1.3: idempotent prompt ids.
5. Experiment, or defer: the clause as an instruction entry, measured on a real model across a compaction.
6. Fold into T-270: child-session tracking.
7. Defer: the approval relay, `setModel`, attachments, `resume:false` events, a cland OpenCode plugin, one server per project, the durable log.

**Not closed:**
- 2.0.25 to 2.0.27 were read from source and OpenAPI only; they were not run (2.0.24 is installed).
- No model call, so the instruction-entry effect, `codemode: false`, and Zen free models in a fresh database are untested.
- No TUI was attached to see how host-made forms and permission requests render.
- When #51213 will be fixed is unknown.
