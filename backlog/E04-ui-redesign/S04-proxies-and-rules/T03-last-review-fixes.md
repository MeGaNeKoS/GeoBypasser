---
status: done
owner: extension
depends_on: [E04/S04/T02]
---

# T03 Last review fixes for Proxies and Rules

From the designer's second review (and the reviewer's second walk, added below when it reports). Done when every item holds, each checked in a real browser where it is visible.

## Designer

1. No resource type label breaks mid word in the type grid at any width: columns use `minmax(max-content, 1fr)` and the label does not wrap. Checked at 1280 px, where `object_subrequest` breaks today.
2. The two column type grid below a 480 px sheet width is seen in a screenshot.
3. A rule whose only fault is its static extensions value: the Tuned summary leaves out the ignored setting ("skips files" is not shown while "Setting ignored" is).
4. The static extensions reason reads "'Never proxy files matching' is not a valid pattern, so it is ignored. The rule still works."
5. Fix on a rule set aside for an unknown resource type shows an error summary line and a note above the type grid: "This rule stores a type this version does not know: bogus. Saving removes it." Save stays enabled. Checked in a screenshot.
6. The missing id reason ("This proxy has no internal id, so rules and sites cannot use it. Open Fix and save to repair it.") is seen in a screenshot, and Fix then Save assigns an id.
7. The set aside proxy reason for a bad port reads "Port is not a number from 1 to 65535." The "Failover timeout is not valid." reason is removed if it cannot be shown (a bad timeout only ignores the setting), or replaced with the failover note if it can.
8. The reason line sits directly under the title line in both lists.
9. On the Chrome proxy sheet, "Firefox only" for "Notify if down" sits in the label badge slot, not in the help text.
10. A badge inside a group heading keeps its own case ("Firefox only", not "FIREFOX ONLY").
12. When another page changes the rule that has focus, focus stays on that rule's row: if the rule's key is gone after the re-render, focus goes to the same control in the row at the same position. Checked with a second tab edit in both browsers.
13. Rule focus keys are built from the stored rule only, without runtime `compiled*` fields.

## Housekeeping

11. Stale screenshots from before the fixes are deleted and the sets recaptured; `focusableWithKey` lives once, in `src/ui/dom.ts`.
