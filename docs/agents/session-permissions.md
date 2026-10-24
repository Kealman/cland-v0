# Session reads and lifecycle permissions

`cland session list`, `cland session list --json` and `--archived` use the
separate `session.list` read grant. Every role has it by default, like `who`.
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

On hub frames, role/tool availability comes first; unavailable tools return
`forbidden` without argument diagnostics. Available tools validate arguments
before argument-dependent scope and ownership checks. The spoke retains local
MCP validation without a hub call. `invalid_argument` keeps `ok: false`, `error` and `reason` with field
guidance: correct the arguments and retry. Validation failures produce no Agents
refusal notice. A `forbidden` reply is a role or permission refusal: follow rule 5,
stop that action and escalate through the lead chain when needed.

MCP task tools retain the legacy `item` locator alias for canonical `id`.
CLI task frames continue to carry `item`; legacy task-list item context is ignored.
MCP `ask` retains omitted `options` as a free-only question: the spoke supplies `[]`
before sending the wire frame, which still requires a concrete string array.
