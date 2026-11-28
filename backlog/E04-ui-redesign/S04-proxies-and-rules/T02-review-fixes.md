---
status: done
owner: extension
depends_on: [E04/S04/T01]
---

# T02 Review fixes for Proxies and Rules

From the designer's review of `E04/S04` (and the reviewer's walk, added below when it reports). Done when every item holds, each checked in a real browser where it is visible, and the screenshot sets are re-captured and looked at.

## Must fix

1. The resource type grid is built from `src/constant/requestTypes.ts`: the same 21 values the validator accepts, no others.
2. The proxy row's switch is labelled "Notify if down".
3. Fix on a set aside proxy opens the sheet in fix mode, as the rule sheet does: fault summary, faulty fields marked, focus on the first.
4. On Chrome the proxy sheet's Advanced group carries the "Firefox only" badge and "Chrome ignores both settings. They are saved and take effect in Firefox."; the "Notify if down" help starts with the "Firefox only" badge.
5. "By kind of request" has no badge on its heading; "Resource types" carries "Firefox only" and "Never proxy files matching" carries "Limited on Chrome", each on its field label. The shared field gains a badge slot in its label row for this.
6. Below 720 px, row actions drop to their own line under the row body.
7. Proxy rows: line 1 label, the type badge ("HTTP" or "SOCKS5"), the address in mono, then "user: name" or "no sign in"; line 2 masked password with Show, then "Notify if down" and its switch; a reason or "Setting ignored" line only when there is one.
8. "Not used", "Setting ignored", and "Proxy unavailable" sit on the title line after the name; the reason on the line below.
9. Rule patterns in mono, then a `--space-3` gap, then the Tuned summary in muted small text.
10. Disclosures (Fine tuning, Advanced) show a chevron at the left of the summary that turns when open.
11. Inside Fine tuning, group headings use the uppercase muted group label; `--space-4` between fields, `--space-5` between groups.
12. The DNS row for an HTTP proxy shows only the locked text "Always on the proxy side for HTTP proxies.", no "Off, locked" badge.
13. Switch fields in both sheets are one row, label left and switch right, help below.
14. Only Edit or Fix is bordered in a row; Export and Delete are borderless.
15. The rule row's switch (or "Off, locked") leads the title line: switch with "On" or "Off", name, "via" proxy.
16. The failover timeout note reads "Failover timeout is not a whole number of seconds, 1 or more, so the default is used." for every invalid stored value.
17. The missing id reason reads "This proxy has no internal id, so rules and sites cannot use it. Open Fix and save to repair it." (saving from the sheet assigns an id).
18. The type grid is a real grid: three equal columns at a sheet width of 480 px or more, two below; `--space-1` row gap, `--space-3` column gap; each cell one label holding its checkbox and text, `--control-h` high.
19. Editing a proxy whose failover timeout is "Setting ignored" opens Advanced, shows the field error under the field, and puts focus there.
20. A rule with both resource type lists stored stays valid and routes as stored. Its sheet shows an info note, not an error: "This rule has both a 'never proxy' and an 'only proxy' type list. Saving keeps the mode shown here." The row shows the rule normally.

## Reviewer, focus (criterion 8 and related)

27. A focused section heading keeps focus across a storage re-render.
28. An open inline delete confirm survives a storage re-render, with focus kept on Cancel or Delete.
29. Rule rows key focus by a stable identity of the rule, not its position, so an insert above a focused row keeps focus on the same rule.
30. After Delete or Delete selected removes the focused row, focus moves to the next row's same control, or the previous one, or the section heading when the list is empty.
31. "Show only these" and "Show all" keep focus on the control that replaces the one pressed.
32. Escape dismissing the discard prompt returns focus to the field being edited.
33. Closing a sheet whose opener was rebuilt while it was open returns focus to the opener's replacement.

Each of 27 to 33 is checked with real keys and a storage write from a second tab, in both browsers, the way the reviewer's script `.chrome-cdp-work/ux-s04-run.mjs` does.

## Smaller

21. Nav counts include set aside entries: "Rules 6 (2 need fixing)".
22. Host and Port side by side, Port about 96 px wide.
23. "Only when the page is on" adds with "Add site".
24. The resource type fieldset has no browser default border; the legend is a small label.
25. The set aside proxy reason is a statement ("Host is missing."); the instruction form stays as the field error in the sheet.
26. Proxies help line says "sites", not "site overrides".
