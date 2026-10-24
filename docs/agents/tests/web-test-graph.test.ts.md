# web/test/graph.test.ts

`web/test/graph.test.ts` proves T-1076's three criteria with one sealed hub/browser:
a Graph-first release loads a closed epic from its parent page and displays hub
progress/work and token done colours without reading that epic's children;
Tree/Graph round trips retain scope/filter/selection, node navigation selects the
matching tree row and card return restores focus; the source colour guard and
computed SVG paints retain the shared tokens. Cases use fresh contexts and
observe browser/hub teardown. The typecheck retains the token-only source guard.
