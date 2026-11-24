# hub

### Prerequisite and packaging reports

`node hub/test/lint-prerequisites.ts` (also in `npm run test:static`) reports
install-shaped CLI command-module imports and transitive site test dependencies.
The CLI copy omits test cases (retaining shipped runtime support) and rejects development-only package imports from
production source. Site tests may read repository text and import dependency-free
shared declarations; every transitive package import must belong to site/package.json.
The site source collector includes `.agents/skills/qa/secret-scan-policy.ts`
as one sanctioned shared module for capture scripts; other QA kit modules remain
outside the collected boundary.
These new guards report findings and do not change the check's exit status.

Web-selected package runs report current `web/dist` source-stamp and resolvable
`node_modules` status before probing or repairing a bundle. Standalone Web probes
report the same facts. Missing/stale output or dependencies are advisory in this
rollout; the existing rebuild and browser availability behavior still applies.
Run `npm install` to repair dependencies and `npm run build` for the source-stamped
bundle. A worktree's valid node_modules link counts as installed. This report
launches no browser and grants no access to the human's profile.

