# hub/test/screenshot-capture.test.ts

`hub/test/screenshot-capture.test.ts` is T1: it exercises the pure scanner and
failure boundary used by the manual site capture, without a hub, browser, child
process or filesystem fixture. Run the file alone with
`node --test hub/test/screenshot-capture.test.ts`.

The first case sends real failed-boundary errors through Node's spec and TAP
reporters, retaining a positive nonempty output receipt and final absence checks
for planted bearer, token, sign-in-link, cause and custom-field values. It rejects
the pre-fix scanner's assertion-actual leak. The remaining cases keep positive
secret-detection controls, a clean-input control, successful return values and
asynchronous sign-in/cleanup rejection. Only fixed phase diagnostics may leave
the boundary; original errors are never attached as causes or copied properties.

These checks provide no browser/layout or physical-phone installation evidence.
The image capture procedure and its sealed fixture ownership remain in
`site/SCREENSHOTS.md`.
