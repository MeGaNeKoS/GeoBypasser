---
status: open
owner: extension
depends_on: [E04/S08/T01]
---

# T02 Review fixes for the popup and devtools panel

From the designer's review of `E04/S08` (and the reviewer's walk, added below when it reports). Done when every item holds, each checked in a real browser, and these screenshots are captured and looked at: a popup with seven or more rules (the scrolling list with a cut off row), a popup with a proxy set and a finished test, and the Chrome not in control popup with a site proxy saved ("Saved, not in effect:").

## Designer

1. "N rules need fixing" is one line: warning icon, "4 rules need fixing.", then the "Open dashboard" link on the same line.
2. "Test in dashboard" is an inline text link ending the sentence "Per tab proxies and Test proxy here are Firefox only. Test in dashboard", with that sentence as its own paragraph in the note.
3. The empty rules state is regular weight, with "Open dashboard" styled as a link.
4. "RULES" is a section heading in the same style as "THIS TAB", on one line with the filter at the right.
5. "Open extensions page" is a quiet button, and the not routing block has a gap below the header divider.
6. "Keep DevTools open while monitoring." carries the info icon.
7. The domain uses `--text-lg`.
8. No divider closes the popup under the Rules block.
9. The panel error line carries the warning icon.
11. Flipping a rule from the keyboard keeps focus in the list: the rule leaves the filtered list, so focus moves to the next row's switch, or the previous one, or the filter when the list is empty. Checked with real keys in both browsers.
10. The panel's off state reads "Network monitoring is off for this tab. Turn on Monitor this tab in the popup.", with no icon colour.

Open: item 10 and `E04/S08` criterion 5 are covered by unit tests only. They close when the owner opens DevTools on a tab and sees the off state, the on state, and the change when Monitor is toggled.
