# hub/test/qa-relay-close.test.ts

Pure relay shutdown seam: a rejected tick still joins every close; a rejected
close remains secondary to the tick cause and cannot skip other closes. Actual
native close receipts are exercised by qa/cases/HOSTS-005.test.ts in a native slot.
