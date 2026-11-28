---
status: open
owner: extension
depends_on: [E04/S10/T02]
---

# T03 Review fixes for the request log

From the lead's look and the designer's review of `E04/S10`. Done when every item holds, each checked in a real browser, and these screenshots are captured in both browsers and looked at: two hosts selected with "Create rule from selection" enabled; the prefilled rule sheet (Firefox with Fine tuning open, Chrome with hosts only); a host routed by a rule showing "Skip in rule 'name'" and the sheet it opens; a row with blocked (403) and errors; two page groups with three or more hosts and one long host name, at 1280 and 360; the error state with Retry; loading.

## Lead

1. When Firefox observed a route and no candidate matches it, the row shows the observed route (for example "Direct") with the reason unknown, and its bytes count as direct. "Inferred" applies only when there is no observation.
2. Routes read the proxy's label: "good, default proxy", "good, by rule 'name'", "good, by site proxy", "good, by tab proxy", or "Direct"; on Chrome prefixed "Expected:".

## Designer

3. Below 720 px each host is a stacked block with no sideways scroll: host, then types, results, route, and bytes, each on its own line with a small label.
4. At 720 px and up the Host column holds the name on one line; Types and Route give way first.
5. The checkbox stands alone with the host as its accessible label; no visible "Select" text and no "Select" heading.
6. "Create rule from selection" is in the log toolbar, always visible, disabled until a host is selected, with "Select a host first." beside it.
7. Order: Tabs card; one log toolbar with Refresh, Clear, "Copy as JSON", and "Auto refresh" at the right; a second line with "Create rule from selection"; the page groups.
8. Each page group sits in a card; the Tabs card and toolbar take the same full content width.
9. Bytes show Sent and Received; on Chrome "N without a size" sits with the bytes.
10. The route cell shows a count only when a host has more than one route, one line per route.
11. The details tree has one header line and aligned Sent and Received columns.
12. "Through proxies" adds the unsized count when there is one: "Through proxies: 0 B of 0 B (5 requests without a size)".
13. Plurals are right ("Monitoring 1 tab.", "1 request").
14. The last column is headed "Action" and hidden when no row has one.
15. The section help line reads "What monitored tabs requested, and how each request was routed."
16. The Tabs empty text has no inner border.
