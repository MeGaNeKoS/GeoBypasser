---
status: open
owner: extension
depends_on: [E04/S10/T03]
---

# T04 Second review fixes for the request log

From the designer's second review of `E04/S10`. Done when every item holds, each checked in a real browser, and these screenshots are captured and looked at: populated at 1280 in both browsers; the Firefox create rule sheet scrolled to "By page"; a row with details open; the "Monitoring 1 tab." line; the empty Tabs card; a page group with no Action column; populated at 360 in Chrome.

1. Column widths at 1280: Host sized to its content; Results and Action never wrap; Types at least 120 px, Route at least 180 px, Bytes at least 150 px with "Sent x" and "Received y" each on one line; spare width goes to Route; a long host wraps only when the card cannot fit the rest, and then at dots and hyphens. Nothing falls off the card in either browser.
2. A request that failed before it was routed (for example an unknown host) shows "No route: the request failed first." instead of a raw value such as ":-1".
3. The Firefox create rule sheet prefills "Only when the page is on" with the page host and its summary reads "Tuned: on 1 site".
4. Only one element scrolls on the Network page (no second scrollbar), and at 360 the page title is not under the top bar.
5. Plurals hold for results: "1 error (500)".
6. Loading skeleton rows sit in a card like the page groups.
7. At 360 the checkbox sits beside the host name.
8. On the component test page, demo items have a gap so the Scope control does not cover the switch's "On".
