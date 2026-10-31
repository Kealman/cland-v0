# hub/test/suite-tiers.test.ts

At T1, lint and read the manifest with scratch files: round-trip optional read-path loadGuards, accept repository-relative globs and T4 targets, and reject malformed maps or missing/non-T4 targets at lint and selection admission. Keep legacy manifests compatible. No processes or load files run.

T-1504 exercises working-tree admission with a task/delivery epic under a release,
checks the exact key and owner source line, and selects a standing ancestor for
new stanzas. The shipped manifest is checked against a disposable copy of its
owner ancestry; a planted release-parent epic is the refusal positive control.
The source manifest is read only and never migrated. Other duration fixtures use
categories, retaining ids so legacy and historical-admission assertions survive.
