# hub/test/digitalocean-endpoint.test.ts

T1, pure endpoint parsing/formatting; no network, filesystem, process or browser.
Run `node --test hub/test/digitalocean-endpoint.test.ts` on supported Node with
inherited `CLAND_*` stripped. Real and legacy custom bases retain 250/minute;
custom declaration fragments carry positive integer limits but never enter the
transport URL. Real API aliases ignore fragments and cannot raise 250. Invalid, duplicate or unknown
declarations, query-bearing bases and embedded credentials are refused. The same
exported parser is used by the client, fake formatter and QA brief URL checks.
