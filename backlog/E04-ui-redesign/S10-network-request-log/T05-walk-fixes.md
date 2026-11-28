---
status: open
owner: extension
depends_on: [E04/S10/T04]
---

# T05 Fixes from the reviewer's walk of the request log

From the reviewer's walk of `E04/S10` at `bdb8e20`. Done when every item holds, each checked in a real browser.

1. The Network page has one scroller in Chrome at 1280 and 360. Cause found: the `.visually-hidden` host name spans inside each row checkbox's `label.checkbox` are absolutely positioned with no positioned ancestor inside `#content`, so they extend the page. Checked by the page (`html`) scroll height equalling the viewport while `#content` scrolls.
2. The Route cell names a request skipped by a rule: "Direct, skipped by rule 'name'", while a request with no matching rule reads "Direct". Lines with the same label and reason merge into one with the summed count, so no two identical lines show. Chrome keeps the "Expected:" prefix.
3. Open tabs appear in the Tabs card as soon as the Network section renders in Chrome, as they do in Firefox; the reviewer measured about 2.75 s, and one run timed out at about 2.8 s with an empty card. The cause is found and stated in the report.
