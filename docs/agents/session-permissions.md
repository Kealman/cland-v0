# Session reads and lifecycle permissions

`cland session list`, `cland session list --json` and `--archived` use the
separate `session.list` read grant. Every built-in role has it by default, like `who`.
The CLI preserves the calling shell's session identity and the hub checks its
current role; listing does not launch a session. The shipped and project role
clauses name the read and its lack of mutation authority within their existing
queue guidance.

Projects with explicit `[<role>.permissions] tools` arrays in `.cland/roles.toml`
add `"session.list"` to each role that should read launched sessions. A
`"session.launch"` grant no longer implies that read. An explicitly restricted
role can omit `"session.list"`; a session without a role has no tools.

`session.launch`, `session.stop`, `session.resume`, `session.archive` and
`session.prune` keep their existing grants and role boundaries. Implementers,
Reviewers and QA may list sessions but are refused these mutations by default.
Leads retain scoped launch/stop authority; listing needs no item claim.

See the [permission table](../../hub/README.md#permissions) and the
[regression seam](tests/hub-test-permissions.test.ts.md).

Codex command sandboxes are separate from these hub grants. Generated and
built-in fallback sandboxes agree: Implementer/Aide workspace-write, Reviewer
read-only, Coordinator/Lead/QA full access. T-1222 changes omitted sandbox keys
for Implementer/Aide from full access to workspace-write and for Coordinator/Lead
from Codex's own configuration to explicit full access. Explicit project values
are kept; running sessions retain their policy until relaunched. Configure
`writable_roots` for workspace-write roles that commit from linked task worktrees
or write outside their cwd. See [The Codex sandbox](../review-and-qa.md#the-codex-sandbox)
for setup, limits and historical evidence. During onboarding, the generated Codex
Aide has no extra writable roots: the Coordinator commits and publishes at the
root on the human's ok. The Aide launches or contacts that role even with only a
map; publication precedes release work, or the Coordinator waits for the first
epic. An Aide with current root Git write access commits and publishes itself;
role/tool grants still apply.

On hub frames, role/tool availability comes first; unavailable tools return
`forbidden` without argument diagnostics. Available tools validate arguments
before argument-dependent scope and ownership checks. The spoke retains local
MCP validation without a hub call. `invalid_argument` keeps `ok: false`, `error` and `reason` with field
guidance: correct the arguments and retry. Validation failures produce no Agents
refusal notice. A `forbidden` reply is a role or permission refusal: follow rule 5,
stop that action and escalate through the lead chain when needed.

Permission-dependent fields remain known to validation even when the caller
cannot use them. `merge.override` is a string in the shared schema and the spoke
preserves it: a session with merge access receives `forbidden` with
`only the human may override verdicts`. A misspelling such as `overide` still
returns `invalid_argument`. Tool availability continues to run first.

MCP task tools retain the legacy `item` locator alias for canonical `id`.
CLI task frames continue to carry `item`; legacy task-list item context is ignored.
MCP `ask` retains omitted `options` as a free-only question: the spoke supplies `[]`
before sending the wire frame, which still requires a concrete string array.

## Custom roles

Definitions live under `[custom.<name>]` in `.cland/roles.toml`; launch with
`cland session launch <session> --role <name>`. Their tools default to deny;
`permissions.tools` lists exact grants from the custom allowlist in
[hub permissions](../../hub/README.md#custom-roles). Unknown fields, unknown
or forbidden grants and reserved names refuse the edit with the field path.
The previous valid snapshot remains in force.

A custom worker may claim an assigned item with `task.claim:own`, mark its own
criteria `done`, set only `review` on its own claim, and request built-in review.
Its `verify` grant admits mode-free task runs only for that live claim's worktree
and topic; occasions and other items are refused. The hub's ready transition and
merge gates remain the same. Route questions and completion to the Coordinator
or responsible built-in lead: `lead T-n` skips custom claims. Custom roles do not
write Reviewer/QA verdicts or verify/fail criterion marks. Their clause comes
from the custom table; built-in clause text stays unchanged.

Staff custom sessions manually. Automatic custom pools and hierarchy roles are
outside this capability. See the [worked example](../../site/src/content/docs/docs/crew.md#add-a-custom-role).
