# hub/test/web-edge.test.ts

Web-edge component tests use `projectHub` discovery (`webPort`), HTTP requests
and `hub.status.web` frames. `hub/test/web-edge.test.ts` is T2: its restarts
exercise listener port persistence without starting a daemon process. Bundle
fixtures live inside the disposable project, selected through `[web] dist`;
missing-bundle cases use a missing fixture directory/index, so building the real
`web/dist` cannot change their expected result. An occupied web port leaves the
spoke and Unix-socket edges available; inspect the `web-unavailable` log and
`cland doctor` warning rather than expecting a hub startup failure. Set
`[web] port` or `[web] dist` before startup; both require a restart to apply.
The T2 `hub-status-component.test.ts` checks available and unavailable web details
in the CLI's hub block, before `sessions: N`. The T3 hub-lifecycle scenario keeps
the discovery `webPort` contract and checks that session rows follow that heading
directly. The compiler contract fixture in `typecheck.test.ts` includes each root
typecheck project, including `shared/wire/tsconfig.json` and a browser-safe source.
