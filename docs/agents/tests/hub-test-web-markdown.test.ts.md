# hub/test/web-markdown.test.ts

Message Markdown has a lower-tier seam: `hub/test/web-markdown.test.ts` (T1)
imports the pure `web/src/markdown.ts` parser. Literal contracts cover blocks,
inline tokens, configured whole item ids, message-local fences and hostile
HTML/images/URL schemes. No browser or hub fixture is needed for parsing.
Web typecheck runs `web/check-html.ts` (T0): seeded source fixtures exercise the
same AST guard that scans `web/src`, refusing named raw-HTML sink references
(`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`).
Renderers still need their own element/navigation/browser evidence.
