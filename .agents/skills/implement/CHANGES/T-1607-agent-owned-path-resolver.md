# T-1607 agent-owned path resolver

Supersedes the root implementation placement in T-1607-state-path-resolution.md.
Run104d0239/A-16479 failed the agent dependency boundary on claude.ts importing
the hub state-paths.ts. The unchanged boundary plus inventory pair reproduced
7 pass/1 fail locally before the fix. Coordinator5b96e26f approved keeping the
single pure implementation inside agent/state-paths.ts, with root state-paths.ts
re-exporting the same function and the existing unit case asserting identity.

The exact HOME inventory registrations move to the agent resolver path; their
owner and reason remain. No copied resolver or added import-leaf exception.
Both source guards remain unedited. T-1605 regenerates its future closure
manifest after T-1607 lands; no manifest change belongs here. Precedence and
the real-directory/UID/0700 admission precondition stay unchanged.

Run104d0239 completed T0 and failed T1; later tiers and load repetitions did not
execute. Linux c-8 lifetime217s, cost$0.0151. A fresh source verdict is required
before another mode-free verification.
