# S10 Network request log for finding rules

As someone (usually an agent driving the browser) unlocking a region locked site, I can monitor a tab, see every host the page pulled with how each request went and how it was routed, and turn what I see into the smallest set of rules, so only what the site needs goes through a proxy and the rest stays direct.

The DevTools panel and the popup's Monitor switch stay as built in `E04/S08`. Ships in 2.0.0.

## Acceptance criteria

1. **Recording.** For each monitored tab, the background keeps in memory, per page host and request host: resource types seen with counts, request count, results (status codes, and failures from `webRequest.onErrorOccurred` with their reason), count from cache, sent and received bytes, and the route with its reason (direct; or proxy label plus "by rule", "by site proxy", "by tab proxy", "default proxy", with the rule id). On Firefox the route is the one the routing handler chose for that request. On Chrome it is recomputed from the stored config and marked as expected. Nothing new is written to storage.
2. **One count per request.** A request is counted once whether or not DevTools is open, in both browsers. Checked by loading a file of known size with DevTools closed and then open.
3. **Chrome received bytes.** Without DevTools, Chrome's received bytes come from a source that works (for example the response `Content-Length`), or the view says plainly that received bytes on Chrome need DevTools open. Which one holds is measured, not assumed.
4. **Tabs card.** The Network section lists open http and https tabs (host in mono, page title muted) with a "Monitor: host" switch each, sharing the popup's per tab state. Empty state: "No web page is open in a tab."
5. **Request log.** Grouped by page host, one row per request host showing types with counts, results ("N OK", "N blocked (403)", "N failed: reason", "N from cache", each with an icon), the route wording above, and bytes; a row expands to per type lines and the path tree. The page line shows "Through proxies: X of Y". On Chrome every route reads "Expected: ..." with one info banner saying Chrome does not report the route. Empty states: "No traffic recorded yet. Turn on a tab above, or use Monitor this tab in the popup." and "Monitoring N tabs. Nothing recorded yet. Load or reload the page." Error: "Could not read usage from the extension." with Retry.
6. **Readable by an agent.** Rows are a real table, each carrying `data-page`, `data-host`, `data-types`, `data-route`, `data-rule-id`, `data-result`. "Copy as JSON" copies the same records.
7. **From the log to a rule.** Rows can be selected; "Create rule from selection" opens the normal rule sheet prefilled (name: the page host; one `*://host/*` match per selected host; proxy left to choose; on Firefox, "Only when the page is on" set to the page host and "Only proxy these" ticked for types selected on type lines). A host routed by a rule offers "Skip in rule 'name'", which opens that rule with the host added to "Never proxy these hosts". Nothing saves until Save. On Chrome the sheet prefills hosts only.
8. **Review.** The designer reviews screenshots of each state in both browsers, the reviewer walks the discovery loop on a local test site in both browsers (monitor, load, create a rule from selection, reload, see the route change, skip a host), and their findings are fixed.
9. **Gates.** `npm test` and both smoke tests pass, with a smoke step that monitors a tab, loads a page, and reads the log's `data-*` rows.

## Known limits, stated in the view or the README

A region lock that answers 200 with a "not available" page looks like success; only trying a rule and reloading shows it. Chrome rules match by host only, so discovery by type or page is Firefox only; host patterns found on Firefox carry over to Chrome.
