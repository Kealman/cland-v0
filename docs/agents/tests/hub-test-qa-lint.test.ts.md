# hub/test/qa-lint.test.ts

T1 covers the public text linter with an additive in-memory build-source map, preserving callers that supply text alone. The matrix checks missing test paths, ambiguous basenames, declared titles and zero/invalid Node patterns, simple CSS atoms scoped to web/src, and literal test/member/item totals with derived-case/plan hints. Keep valid paths/titles/attributes and non-count deadlines/viewports as positive controls alongside each missing reference.

Per-test Markdown guidance retains its complete path: existing guides produce no missing-test finding; missing guides produce exactly one absent-file finding. Keep real present/missing test paths and a named title in the same fixture to preserve test-reference checks.

Singular and plural title syntax naming a guide remains a file reference. Keep actual present and missing titles in that fixture to prove title validation remains active.

Title scanning is dependency-free and lexical. Quoted, escaped and static-template titles remain literal; unrelated strings, comments, expression-start, arrow-body and control-statement regex literals, nested dynamic templates and computed titles do not create static declarations. Whole attribute names matter: data-id cannot satisfy id or #card, and aria-label cannot satisfy label. Assert original source line numbers and keep text-only compatibility tests.

M4 preserves the difference between a closing control condition (a following regex starts a statement) and an ordinary call’s closing parenthesis (a following slash can be division). Keep arrow/if/while/for/else/return regex decoys, literal/static-title positives, and division/interpolation positives. A nonterminated slash must not swallow a later declaration.

The agreed drift-detector bar excludes adversarial project sources. The for-await/postfix/object/function-division matrix is a pre-fix false-absence control: it initially returned lines [2,3,4,5] instead of [1]. For-await and postfix tokens preserve known contexts; brace/slash ambiguity remains fail-closed with unresolved findings, preserving real names already identified without claiming hidden names are absent. Keep the original table, static/escaped-title, division and interpolation assertions.

T-1903 adds pure T1 run-copy advisory controls through `lintQaRunCopy`.
Each correction class has a planted missing-guidance positive and a completed
guidance negative. These test lexical presence only; they do not claim execution
of helpers, exact case expansion or pin freshness. Blocking `lintQaBrief`
regressions remain unchanged. The separate T2 `qa-lint-cli.test.ts` control
proves all five file/line report-only messages leave exit 0 and coexist with an
existing blocking command finding returning exit 1. Neither test opens a browser.

The pure settlement control exercises the shared withCleanupAsync contract used
by the CLI fixture: the selected error object and code survive cleanup failure,
cleanup is joined before reporting, its diagnostic stays secondary, and a
cleanup-only failure still fails. This control does not launch native work.
