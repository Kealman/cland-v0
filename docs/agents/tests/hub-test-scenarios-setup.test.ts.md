# hub/test/scenarios/setup.test.ts

T3 runs setup through a real CLI and PTY on sealed scratch machines with fake
vendor binaries and a stand-in launcher. Terminal scripts after starting a hub
answer `Let several people sign in to the web (users mode)? [y/N]` with Enter,
then the remote and `Set up agent hosts? [y/N]` offers with Enter. Expected rows
include sign-in mode and agent hosts skip; piped untouched setup keeps exit zero.
Piped single-mode setup without --yes skips with its auth command. Preserve the
favourite/install/trust assertions, onboarding job receipt, hub/Aide reuse,
launcher counts and observed native PID closure before directory disposal.

Run this file once in the native preservation slot on supported Node, with its
own before/after inventory and original output. Do not open a browser or use the
live project. The scenario's existing root cleanup owner also runs after a
missing prompt or early assertion; don't remove those hooks. The T-1830 updated
scenario completed in 8.943 s on macOS, below the 10 s tier default; no allowance
was added. The first red stopped at the unanswered hosts prompt under the
existing terminal deadline, and is not a passing duration sample.
