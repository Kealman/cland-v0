# web/test/readme.test.ts

`web/test/readme.test.ts` follows the web README's single getting-started block
through a local clone of a disposable source seed, the production build, real
detached hub startup and CLI-minted `web --no-open` link into a fresh Headless
Shell context. Its explicit `npm install` substitution symlinks the root install,
as task worktrees do; no registry or browser download runs. Source copying
excludes live Git metadata, tracker/runtime state and generated output. HOME,
XDG, Git and child account/provider environments are sealed; openers and harness
binaries are stubbed, browser HTTP/WebSocket traffic is confined to the scratch
loopback edge, and cleanup observes the browser group and hub PID gone before
removing roots. It uses a real hub process because the README's hub-start lifecycle
is the subject. Build first, then run both new files, web-auth.test.ts and
web-tunnel-guide.test.ts targeted before mode-free verification.
