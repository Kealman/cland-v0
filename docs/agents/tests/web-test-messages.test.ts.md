# web/test/messages.test.ts

`web/test/messages.test.ts` owns the authenticated history/delta → rendered P12
message seam: headers, role gutters, human/Aide bands, watch text, recorded
verdict criteria, safe Markdown elements, whole-item navigation and artifact
chips. The shared isolated Headless Shell fixture retains CSP and observes
cleanup. Thread paging tests capture each message's actual pre-load offset,
including a date separator, and retain the final anchor assertion; tall read-mark
fixtures use Markdown paragraphs so their offscreen tail stays offscreen.
