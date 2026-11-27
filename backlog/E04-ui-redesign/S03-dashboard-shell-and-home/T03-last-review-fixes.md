---
status: done
owner: extension
depends_on: [E04/S03/T02]
---

# T03 Last review fixes for the frame and Home

From the designer's and the reviewer's second checks. Done when every item holds, each checked in a real browser where it is visible.

1. "Where your traffic goes" shows its order numbers 1 to 5 in the indent already reserved for them.
2. On Chrome, the Home "Tab proxy" row is a plain row, with no link and no chevron.
3. The Proxies card lines have `--space-2` between them.
4. Escape closes the narrow screen menu, sets `aria-expanded` to `false`, and returns focus to the menu button. Checked with a real Escape key in both browsers.
5. Choosing a section from the narrow screen menu moves focus to that section's heading, not to the page. Checked with a real key press in both browsers.
6. The legacy help link (`.help` in `assets/dashboard.css`) meets 4.5:1 contrast in both themes, using a token colour; checked by computing the ratio in the light theme "Add rule" modal.
