# OpenCode compatibility before a cland release

Run `npm run check:opencode` from the cland source checkout before the release dry run. Other projects retain their own release checks.

This network check compares the newest stable OpenCode 2.x wire operations and event names with the tested version. It downloads and integrity-checks that exact binary, then completes a turn against a local fake provider with scratch HOME, XDG directories and OPENCODE_DB. It is deliberately separate from `npm test`.

A pass updates the exclusive bound in `hub/src/doctor/ranges.ts`. Have that source change reviewed and merged before previewing the release. A failure preserves the range and files a Bug in the tracker's Bugs category. Resolve the Bug and rerun the check before continuing; a reported filing failure also blocks release until the Bug is filed and resolved.
