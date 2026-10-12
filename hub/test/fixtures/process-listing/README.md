# Recorded process listings

Captured on macOS with `/bin/ps` and Ubuntu 24.04 arm64 with procps-ng 4.0.4,
using `ps -ww -p <shell>,<zombie> -o pid=,ppid=,pgid=,lstart=,stat=,command=`.
Neither capture set `PS_PERSONALITY`.

The live child ran `/bin/sh -c 'sleep 600 & wait'` in a new session, with three
additional arguments: `fixture with "double" and 'single' quotes`, 4096 `x`
characters, and `final-argument`. A Python parent forked another child that exited
without being reaped until after capture, producing the zombie row.

Only volatile identities and dates were canonicalized: PID/parent/group became
420100/420001/420100 for the shell and 420101/420001/420001 for the zombie, and
start dates became `Mon Oct  5 12:00:00 2026` to exercise the single-digit day.
Column spacing, state and command text are the actual dialect output; the zombie
commands differ between dialects. The parsed live rows must match exactly.
