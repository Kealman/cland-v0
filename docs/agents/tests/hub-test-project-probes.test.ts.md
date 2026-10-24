# hub/test/project-probes.test.ts

Bare-root merge admission uses the hub's injected read-only Git probe in component
fixtures; the production boundary runs native Git. `project-probes.test.ts` proves
the injected bare fact still refuses while imports, merge preflight and cleanup
retain the zero-child census.
