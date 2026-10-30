# hub/test/web-bundle.test.ts

T-1458 extends the fixture with `webReadiness`: current source stamp plus resolvable
React, React DOM and Playwright packages is clear; absent/stale output and a broken
node_modules link produce explicit findings. Fake packages and all bundle inputs
live in the disposable root. No browser, build or live project is launched.
