# hub/test/host-agent-closure.test.ts

`hub/test/host-agent-closure.test.ts` is T1: source parsing and injected native
observations only. Run `node --test hub/test/host-agent-closure.test.ts` under
targeted admission. No child, socket, hub, harness, installer or Git runs.

The dev compiler regenerates the entrypoint's import and native-asset graph;
its paths/hashes must match committed host/agent/closure.json. Regenerate with
`node hub/bin/generate-host-agent-closure.ts`. The production registry's static
startup graph must import no dev-only package. Native restart controls preserve
fresh-child signalling and reject a different Linux start tick, unknown birth,
observed exit and absent captured authority. The T3 restart fixture supplies the
real native replacement and standalone-runtime proof.

The recovery handshake control preserves an old hello without the optional
capability and sends restore-claude only when the capability is advertised.

A previous null restore report remains unknown even when a newer client asks for
the optional report. It is never treated as an empty incomplete-generation list.
