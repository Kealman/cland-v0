# Hub documentation placement

Add an item's hub reference and subsystem implementation guidance to the matching
`docs/hub/<subsystem>.md` file. Find it through [the hub index](../../hub/README.md).
Keep `hub/README.md` as an index: add only a pointer when introducing a subsystem.
The implement skill keeps the shared implementation, review and verdict procedure;
subsystem-specific instructions belong beside that subsystem's reference.

The verbatim implementation notes moved from the implement skill live under
`docs/hub/implementation/`, indexed by `hub/README.md`. This directory keeps the
original relative links valid. Read the matching notes when changing a subsystem.
New subsystem guidance belongs in that reference or note; record an item's skill
provenance only in `.agents/skills/implement/CHANGES/<item>-<topic>.md`.

`npm run test:lint` includes the implement workflow guard through `test:static`.
It compares whole paragraphs with a frozen workflow baseline, without Git or a
running hub. It ships in report mode: findings are printed and do not affect the
exit status. `node hub/test/lint-implement-workflow.ts --enforce` explicitly
selects refusing behaviour; the wired default omits that switch. A separate item
will authorize enforcement after the report period. New or edited paragraphs
in the implement `SKILL.md` follow the workflow policy with an
immediately preceding `<!-- cland-workflow-change: T-<n> <reason> -->` marker.
The item id and nonblank reason are mandatory; the marker covers one paragraph,
with either a newline or blank line separating it from the text. Use one marker
per changed paragraph, including headings. Keep the baseline immutable: deliberate
workflow edits carry their markers in the skill instead of expanding the allowlist.
The immutable migration proof checks moved subsystem bytes at their indexed
destinations and retained workflow bytes in the frozen workflow baseline. Live
workflow replacements use the marker policy, so the old paragraph need not stay
alongside its replacement. The report-only guard adds no runtime or
verification-admission policy.

Update links and executable documentation readers when moving text. Preserve their
assertions and migrate QA brief commands as well as production and test consumers.
