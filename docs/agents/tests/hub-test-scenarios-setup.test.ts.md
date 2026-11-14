# hub/test/scenarios/setup.test.ts

T3 runs setup through a real CLI and PTY on sealed scratch machines with fake
vendor binaries and a stand-in launcher. Every terminal script answers the new
`Set up agent hosts? [y/N]` offer with Enter, retaining default No. Expected rows
include agent hosts skip; piped untouched setup keeps exit zero. Preserve the
favourite/install/trust assertions, onboarding job receipt, hub/Aide reuse,
launcher counts and observed native PID closure before directory disposal.

Run this file once in the native preservation slot on supported Node, with its
own before/after inventory and original output. Do not open a browser or use the
live project. The scenario's existing root cleanup owner also runs after a
missing prompt or early assertion; don't remove those hooks. The T-1830 updated
scenario completed in 8.943 s on macOS, below the 10 s tier default; no allowance
was added. The first red stopped at the unanswered hosts prompt under the
existing terminal deadline, and is not a passing duration sample.
