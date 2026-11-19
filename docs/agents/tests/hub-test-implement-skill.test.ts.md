# hub/test/implement-skill.test.ts

`hub/test/implement-skill.test.ts` is T1. Run it with
`node --test hub/test/implement-skill.test.ts` after targeted admission permits
tests. It uses repository files and the pure workflow lint policy, with no hub,
socket, Git or child process.

The frozen pre-move skill and explicit paragraph map prove every moved paragraph
exists byte-for-byte at an indexed subsystem destination, every unmoved workflow
paragraph remains in the immutable workflow baseline, and subsystem paragraphs
leave the live workflow. Keep that baseline
immutable: it records the source of the move, rather than current documentation.

When the authorized dev merge supersedes a moved paragraph, the separate
`implement-merge-replacements.json` receipt records the incoming source commit,
the original paragraph position/destination, exact previous bytes and exact new
bytes. The check ties the previous bytes to the untouched historical fixture
and requires the incoming bytes at the same indexed destination, absent from the
live skill. This preserves migration history while replacing superseded guidance.
The current receipts cover the landed periodic-T3 and restart-settlement updates.

The lint controls plant subsystem additions, edited workflow text, valid scoped
markers, missing item/reason markers and orphan markers. A valid marker permits
one paragraph only, with either a newline or blank line before that paragraph.
The complete-contract control replaces an original paragraph in the frozen
workflow source, checks the migration assertions, then requires enforcement to
refuse the unmarked replacement and accept the marked replacement. It does not
require obsolete wording in the live skill.

The shipped `test:static` invocation omits `--enforce`: findings print and exit
status stays 0. Controls use the same exported checker as T0 to prove the wired
report default and explicit enforcement refusal; no child process is needed.
