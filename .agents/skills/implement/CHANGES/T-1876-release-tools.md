T-1876: describe the optional hub-side release gh lookup, no auth/network calls,
legacy/offline unknown result and restart guidance.
The shared lookup uses POSIX exec candidates (unset PATH defaults, empty and
relative entries from the child's cwd), with native conformance and consumer
regressions in executable-path.test.ts.
