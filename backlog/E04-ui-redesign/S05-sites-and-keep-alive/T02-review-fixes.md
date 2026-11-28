---
status: in_progress
owner: extension
depends_on: [E04/S05/T01]
---

# T02 Review fixes for Sites and Keep-alive

From the designer's review of `E04/S05` (and the reviewer's walk, added below when it reports). Done when every item holds, each checked in a real browser where it is visible, and fresh screenshots of both lists at the narrowest width and of the Sites list at 1280 px are captured and looked at.

## Designer

1. At the narrowest width both sections match Proxies and Rules at 500 px: buttons at natural width, toolbar on one wrapping line, row actions inline under the text, the keep-alive switch on its row. The interim `#content button` full width rule in `assets/dashboard.css` is removed.
2. Sites rows are one line: the domain in mono, badges after it, then "via" and the proxy label, or "Direct", in muted text. The proxy id shows only when the proxy is gone, once in mono after "via", with the "Proxy unavailable" badge. Below 720 px "via …" may wrap.
3. The keep-alive Fix sheet marks its faulty fields like the site Fix sheet: the help stays, an error line with icon and danger colour sits below it, the first pattern input has the danger border, and the same error line sits under the Active row.
4. Both lists sort in `pageView`: Sites by domain, case insensitive; Keep-alive in the order of the Proxies list, rules whose proxy is not in the list last, by id. Set aside rows keep their sorted place.
5. A proxy select whose stored value is a set aside proxy reads "Unavailable: label" (the raw id only when no stored proxy has it), with the help "This proxy is not used because it is invalid. Fix it in Proxies, or choose another." under the select. Row titles use the label the same way. This applies to the site, rule, and keep-alive sheets, and is not a fault of the entry.
6. The set aside keep-alive reason states facts: "No tab URL pattern." and "Active state is missing."; the sheet keeps the instruction wording.
7. A raw id used as a keep-alive row title is in mono.
8. A new keep-alive rule opens with Active on.
9. The Keep-alive help line reads "Checks a proxy while tabs matching its patterns are open."
10. The Test URL placeholder is regular weight.
11. Pattern inputs (keep-alive tab patterns and the rule sheet's pattern lists) are mono.

## Reviewer

12. Editing a keep-alive rule never overwrites another rule: the proxy select offers only proxies with no keep-alive rule, plus the rule's own, and does not offer Direct. When the proxy changes, focus follows the rule to its new key. Checked in both browsers.
13. Importing sites or keep-alive rules never replaces a stored entry silently: an imported entry whose domain or proxy is already stored opens the interim duplicate sheet with "Replace" and "Skip" (no "Keep both", since the key is unique), as Proxies does. Checked in both browsers.
14. On Chrome, Home's Sites row links to `#sites` and its set aside "N site" links to `#sites?set-aside`.
15. A new keep-alive rule is stored active in both browsers (with item 8).

