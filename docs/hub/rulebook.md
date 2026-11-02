## Rulebook

The project's rules live in the committed `.cland/RULES.md`. `cland init` creates
an empty file with the one-line header `# Project rules` and a high-water comment,
and preserves an existing rulebook. Each entry has this shape:

```markdown
## 3 One suite at a time
Scope: all
Date: 2026-10-14
Status: active
Origin: shell
Reason: concurrent suites contend for shared resources.

Run at most one full suite at a time; targeted single-file runs are free.
```

A rule is addressed as `rule 3`, never `R-3` (which names a release). Numbers
increase in file order and retired rules stay in the file, so their numbers are
never reused. A `<!-- cland: rule high-water 3 -->` comment after the header
records the highest number ever allocated. Adds use one more than the greater of
this mark and the highest number present, then update the mark. Keep this comment
when hand-removing an entry; resolve a merge conflict to the higher mark. A missing
mark falls back to the highest entry number; a mark below an entry's number logs a
`rules-counter-behind` warning on load. `Scope` is `all` or comma-separated role names from `roles.toml`.
`Date` is the date added or last edited; `Status` is `active` or
`retired YYYY-MM-DD`. `Reason` explains the rule; the paragraph after the fields
is its text. Origins identify where it came from: `message:<topic>/<msg_id>`,
`session:<aide-name>`, `shell`, `workbench`, or `memory:<path>` for migrated rules.

```sh
cland rule add "Run one full suite at a time." --scope all --reason "Avoid contention" --title "One suite"
cland rule add "Use the recorded brief." --scope implementer,reviewer --reason "Keep scope clear" --origin memory:/path/to/briefs.md
cland rule edit 1 --scope implementer --text "Check the verify queue before running a suite."
cland rule retire 1 --reason "Superseded by the scheduler"
cland rule list
cland rule list --all --role implementer --json
cland rule show 1
```

Every command accepts `--json`. Listing returns active rules by default;
`--all` includes retired entries. `--role` includes `all` and rules naming that
role. A shell edit preserves the number and origin and updates `Date`; session
tools and workbench edits keep their existing origin-update behaviour. Retirement
keeps `Origin`, records its date and appends its reason to `Reason`. Its own origin
is stored separately as an optional `Retired-origin:` line after `Reason` (the
`retired_origin` field in JSON). Show and list display both origins. Older retired
entries without this field remain readable.

The CLI acts as the calling shell's session, using the hub's held role rather
than a claimed role in its environment. The human's shell writes `Origin: shell`;
an Aide writes `Origin: session:<name>`. Either may explicitly supply
`--origin memory:<path>` for the seed. Other session shells are refused with
`forbidden`: Coordinators record rules through the rule tool from a human
message, and other roles propose rules to the Coordinator. Shell callers cannot
supply message, workbench or another session's origins.

The hub owns writes, serializes them, and replaces the file atomically. An edit
rewrites only its rule and the high-water mark, preserving every other entry byte
for byte except trailing file whitespace: add, edit and retire leave exactly one
final newline. Before replacement it re-reads the source; if a hand edit or merge arrived
during the temporary write, the write refuses with a retry message and leaves that
edit intact. The hub
refreshes the file every 500 ms, like `roles.toml`, so hand edits and merges are
read without a restart. A parse failure is logged as `rules-unreadable` with its
line and reason; reads keep the last good rulebook, and writes refuse to overwrite
the malformed file until it is repaired. The protocol frames are `rule.add`,
`rule.edit`, `rule.retire`, `rule.list` and `rule.show`; writes return `{ rule }`
and listing returns `{ rules }` with every field.

Every role clause ends with **Project rules for your role**: active rules in scope,
in number order, as `rule <n>: <text> (reason: <reason>)`, or
`No project rules apply to your role.` The launch brief ends with the same list.
Retired rules are omitted. A reconnect rebuilds the clause from the current rulebook. The Coordinator and Aide keep their cache guidance at the start of the rules section in `roles.toml`; the hub places that section after staffing, skills and handover notes. The T1 guard in `hub/test/roles-clauses.test.ts` checks both shipped sources. A rendered base reply (with default staffing and the `pong: ` prefix) must keep 15% growth headroom below the 7680-byte reserve: at most 6528 bytes. The reserve remains 512 bytes below the 8192-byte send cap. Move procedures behind triggered skill/doc pointers while retaining rules and permissions inline. The fixed clause-headroom check covers only the base instructions: project rules can grow, and role-event delivery carries the complete section even beyond the send tool's 8192-byte cap.

The spoke exposes `rule.add`, `rule.edit`, `rule.retire` and `rule.list`.
Write arguments match the CLI (`number` for edit/retire), plus `origin`.
A Coordinator must supply `{ topic, msg_id }` naming the existing human message
that stated the change; missing, agent-written or wrong-topic origins return
`forbidden` with a reason. The stored origin is `message:<topic>/<msg_id>`.
An Aide's tool writes always record `session:<name>`. Other roles are refused
and propose rules to the Coordinator in their item topic. Every role can call
`rule.list` with optional `all` and `role`. Each tool edit or retirement records
its own authorized origin; ordinary shell edits preserve the existing origin.
A Coordinator or Aide records a stated rule with `rule.add`, never only in harness
memory; a memory repeating the rule names its number.

Each added, edited or retired rule (including a valid hand edit or merge) produces
one `rule` event row and a direct delivery to each running session in scope,
including Aides. No subscription is needed. The full rule text, scope and reason,
or retirement and reason, wait with `digest: turn` until the next turn; they never
steer a running turn or add a needs-you. Removing a role from the scope sends that
role the retirement form. Numeric event filters remain `1`–`9`; all ten kinds,
including `rule`, have palette filters.

