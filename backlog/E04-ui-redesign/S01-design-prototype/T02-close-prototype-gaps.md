---
status: done
owner: extension
depends_on: []
---

# T02 Close the prototype gaps found in review

`T01` built the prototype; the designer's second review and a reviewer's walk in real Chrome and Firefox found the gaps below. This task closes them so the owner can review the prototype. `T01` closes with this task.

Done when every item holds, each checked in a real browser where it is visible, and the screenshot sets are re-captured.

## Designer, before the owner's review

1. Proxies has the "needs fixing" warn banner and a nav warning count for its set aside entry, as Rules, Sites, and Keep-alive do. "Show only these" is on all four lists, with the same "Nothing left to fix" result.
2. A list selection survives a re-render caused by a row toggle, Show or Hide, or an export; it clears after delete, after import, and on leaving the section.
3. About's rule priority is a numbered list, its badges sit on the text's middle, and on Chrome the description reads "Manage a list of proxies and route browser traffic through them by site, or by request rule." "Optional keep-alive monitoring for proxies" carries "Firefox only" on Chrome.

## Reviewer, defects

4. On Firefox, Tab never lands on the `<dialog>` element or on `.sheet__body` without a visible focus ring, in any sheet (Export, Review, Choose files included).
5. A second Esc on the "Discard changes?" prompt keeps editing; only Discard throws edits away. Both browsers.
6. The popup's "Using" line reads "Saved, not in effect:" while the not in control warning shows.
7. The Review sheet's Error state is reachable by a user: with the bar's list state on Error, an import path ends in it. "Choose another" returns to the source the import came from. "Choose another" and "Cancel" sit in the sheet body, and the Empty state shows its text under a "To add" label, as `design.md` shows.
8. Review has a "Settings in this file" row for fallback to direct, alongside default proxy and test URL.
9. Keep-alive rows show "Proxy unavailable" when their proxy is missing.
10. A save failure is reachable from the bar and shows the error Banner with Dismiss, as `design.md` describes.
11. The rule sheet's help links are present: "What is a match pattern?" and "Examples".
12. Export copy matches the owner's decision that exports include credentials: no "left out" wording on the Export card or in list export notices, and "Leave out usernames and passwords" in the sheet, off by default.
13. Defaults' default proxy select offers "None" as a real option, then usable proxies.

## Designer, smaller

14. Rules: the "Setting ignored" badge is on the title line after "via", with the note as one paragraph below.
15. The devtools line is centred in the area under the bar.
16. Import card: the Import button aligns with the URL input, not with its help text.
17. Test's "Add to list" prefills username and password too.
18. Skeleton rows reuse the real row's grid (checkbox box; a bar in a `--control-h` line box and a 40% bar in a text line box; two button sized boxes in `.row__actions`; below 720 px a third 60% bar), landing within 20 px of real row height at 1280 and 360.
19. The keep-alive "Setting ignored" note reads "Test URL is not valid, so the default test URL is used." The proxy "Setting ignored" note for a bad failover timeout renders on its row.
20. A nav label spans the full row when the row has no count, so "Import and export" stays on one line.
21. Copy: "proxies", not "proxys"; the Export sheet's keep-alive group shows proxy labels, not ids.
