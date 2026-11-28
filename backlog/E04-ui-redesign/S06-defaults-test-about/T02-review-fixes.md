---
status: open
owner: extension
depends_on: [E04/S06/T01]
---

# T02 Review fixes for Defaults, Test, and About

From the designer's review of `E04/S06` (and the reviewer's walk, added below when it reports). Done when every item holds, each checked in a real browser where it is visible, and screenshots of Test and About at 1280 and 360 px and of a set aside default proxy are captured and looked at.

## Designer

1. Cards in all three sections have `--space-4` between them, and the section header has the same spacing as Proxies and Rules.
2. The Chrome "not routing" banner from `design.md` "Other proxy extensions" shows at the top of every dashboard section while another extension or a policy controls proxy settings, and clears live with "GeoBypass is routing again." in the status line. This is the dashboard half of `E05/S02/T02`; the popup half comes with the popup story.
3. About's rule priority is a numbered list, 1 to 5. Each tier reads: number, name in semibold, its badge, then the description on the next line.
4. The Test result panel carries its state with an icon: success has the check icon, "Connected through", then host and port in mono; failed has the warning icon and danger colour on "Failed:"; blocked has the warning icon.
5. A failed test reads "Failed: no response through this proxy." instead of the raw browser error; the timeout wording stays.
6. When validation blocks a test, the result panel returns to "No test run yet".
7. A Port error line spans the full Host and Port row.
8. "Clear all tab proxies" is a secondary button at natural width, left aligned.
9. The Chrome About description reads "...by site or by request rule." (the Chrome manifest description changes to match).
10. "Optional keep-alive monitoring for proxies" carries "Firefox only" on Chrome.
11. The features list splits "Proxy list" and "Per-tab proxy assignment" into two items on both browsers; the second carries "Firefox only" on Chrome.
12. The page scrollbar sits at the window edge: the scrolling element spans the full width, with the content width limit on an inner wrapper. This applies to every section.
13. Headings in sentence case ("Rule priority").
14. The Test timeout note reads "Tests time out after 5 seconds, or 30 for an HTTP proxy with a username."
15. About's features and links are plain bulleted lists.
