# hub/test/build-guard-tiers.test.ts

`hub/test/build-guard-tiers.test.ts` (T1) checks in-memory package scripts and
source maps. No shell command, package manager, installer or hub is launched.
The controls plant an orphan, then cover it with an eager tier-wrapper import;
type-only and lazy references cannot supply that proof. Keep npm aliases,
workspace/prefix routing, quoted paths, globs, cycles and missing-target controls.

`node hub/test/lint-build-guard-tiers.ts` runs in `test:static` in report mode.
It inventories every package build/prebuild/postbuild (including build variants),
follows npm script lifecycle aliases and static eager local value imports from
`tiers.json`. All direct script targets are conservative guard candidates, irrespective of
filename. A build implementation (such as `web/build.ts`) can be reported too;
record its non-guard reason in the item rather than hiding it by filename.
Opaque shell commands, missing targets and script cycles report incomplete facts;
computed shell commands and subprocesses hidden in a script require manual review.
No package command executes, and findings do not feed the exit status.

The site tests already enter T1 through `hub/test/remote-docs.test.ts`: its eager
onboarding import and remote-docs value import execute both site's test modules.
A manifest entry with no eager runtime path to a guard does not cover that guard.

Operand-free implicit discovery, eval launches and shell `-c` report incomplete
inventory, never positive coverage. Keep these planted negatives. npm routing
preserves repeated workspace selectors and stops interpreting options at `--`;
keep the two-workspace and script-argument routing controls. Unrecognized npm
options retain an incomplete diagnostic while understood targets are inspected.

Launcher support is deliberately restricted: an interpreter's first script
operand, or Node's explicit `--test` file/glob operands. Script argv and preload
paths never prove execution. Unsupported options, extensionless targets and eval
forms (including `--eval=`) report incomplete even beside a covered decoy file.
Keep those decoy controls when extending recognized launcher modes.

Before launcher parsing, single pipes/background operators, newlines,
redirections and substitutions report incomplete shell structure. This
conservative check can also flag quoted operator bytes. Keep the covered-first,
uncovered-second controls; known bundlers cannot hide an uninspected pipeline.
